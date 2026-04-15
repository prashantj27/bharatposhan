import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import nfhsData from "@/data/nfhsDistrictData.json";

interface IndiaMapProps {
  activeLayer: string;
  onStateHover: (name: string | null, risk: number | null, pos: number[] | null) => void;
  onStateClick: (name: string, risk: number) => void;
  onDistrictClick?: (district: string, state: string, data: any) => void;
  hoveredStateName: string | null | undefined;
  selectedStateName: string | null | undefined;
}

// State-level average risk scores computed from NFHS-5 (2019-21) district data
const STATE_RISK_MAP: Record<string, number> = {
  "Andaman & Nicobar Islands": 0.23, "Andaman and Nicobar": 0.23, "Andaman and Nicobar Islands": 0.23,
  "Andhra Pradesh": 0.26, "Arunachal Pradesh": 0.19, "Assam": 0.3,
  "Bihar": 0.37, "Chandigarh": 0.19, "Chhattisgarh": 0.3,
  "Dadra and Nagar Haveli": 0.3, "Dadra and Nagar Haveli & Daman and Diu": 0.3,
  "Dadra and Nagar Haveli and Daman and Diu": 0.3, "Daman and Diu": 0.3,
  "Delhi": 0.23, "NCT of Delhi": 0.23, "Goa": 0.23,
  "Gujarat": 0.35, "Haryana": 0.2, "Himachal Pradesh": 0.25,
  "Jammu & Kashmir": 0.23, "Jammu and Kashmir": 0.23,
  "Jharkhand": 0.35, "Karnataka": 0.29, "Kerala": 0.2,
  "Ladakh": 0.23, "Lakshadweep": 0.26, "Madhya Pradesh": 0.29,
  "Maharashtra": 0.33, "Maharastra": 0.33,
  "Manipur": 0.17, "Meghalaya": 0.29, "Mizoram": 0.19,
  "Nagaland": 0.27, "Odisha": 0.27, "Orissa": 0.27,
  "Puducherry": 0.21, "Punjab": 0.19, "Rajasthan": 0.27,
  "Sikkim": 0.17, "Tamil Nadu": 0.21, "Telangana": 0.3,
  "Tripura": 0.27, "Uttar Pradesh": 0.31, "Uttarakhand": 0.2, "Uttaranchal": 0.2,
  "West Bengal": 0.3,
};

const districtData = nfhsData as Record<string, { district: string; state: string; stunting: number; wasting: number; underweight: number; risk: number; anemia_children: number; anemia_women: number; breastfeeding: number; immunization: number; female_literacy?: number; sanitation?: number }>;

const riskColor = (r: number) => {
  if (r > 0.6) return "#ef4444";
  if (r > 0.4) return "#f97316";
  if (r > 0.2) return "#eab308";
  return "#22c55e";
};

declare global {
  interface Window {
    google: any;
    initGoogleMap: () => void;
  }
}

export interface IndiaMapHandle {
  zoomToDistrict: (district: string, state: string) => void;
}

const IndiaMap = forwardRef<IndiaMapHandle, IndiaMapProps>(function IndiaMap({ activeLayer, onStateHover, onStateClick, onDistrictClick, hoveredStateName, selectedStateName }, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  
  const districtLayerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const [viewMode, setViewMode] = useState<"states" | "districts">("districts");
  const labelsRef = useRef<any[]>([]);
  const currentLabelStateRef = useRef<string | null>(null);
  const [showResetButton, setShowResetButton] = useState(false);
  const zoomToStateRef = useRef<(stateName: string) => void>(() => {});

  const getLayerRisk = useCallback((risk: number, dd?: typeof districtData[string]) => {
    if (activeLayer === "literacy" && dd?.female_literacy != null) {
      // Invert: higher literacy = lower risk (green), lower literacy = higher risk (red)
      return 1 - dd.female_literacy / 100;
    }
    if (activeLayer === "sanitation" && dd?.sanitation != null) {
      // Invert: higher sanitation = lower risk (green), lower sanitation = higher risk (red)
      return 1 - dd.sanitation / 100;
    }
    return risk;
  }, [activeLayer]);

  // Clear all existing district labels
  const clearLabels = useCallback(() => {
    labelsRef.current.forEach(marker => marker.setMap(null));
    labelsRef.current = [];
    currentLabelStateRef.current = null;
    setShowResetButton(false);
  }, []);

  // Add district name labels for a given state
  const showStateDistrictLabels = useCallback((stateName: string) => {
    const map = mapRef.current;
    const layer = districtLayerRef.current;
    if (!map || !layer || !window.google) return;
    if (currentLabelStateRef.current === stateName) return; // already showing

    clearLabels();
    currentLabelStateRef.current = stateName;
    setShowResetButton(true);

    layer.forEach((feature: any) => {
      const fs = feature.getProperty("state") || "";
      if (fs.toLowerCase() !== stateName.toLowerCase()) return;

      const fd = feature.getProperty("district") || "";
      if (!fd) return;

      // Compute centroid of feature geometry
      const bounds = new window.google.maps.LatLngBounds();
      feature.getGeometry().forEachLatLng((latlng: any) => bounds.extend(latlng));
      const center = bounds.getCenter();

      const key = `${fs}|${fd}`;
      const dd = districtData[key];
      const risk = dd?.risk ?? 0.3;

      const marker = new window.google.maps.Marker({
        position: center,
        map: map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 0,
        },
        label: {
          text: fd,
          color: "#c8d6e5",
          fontSize: "9px",
          fontWeight: "500",
          fontFamily: "'DM Mono', monospace",
          className: "district-label",
        },
        clickable: false,
        zIndex: 10,
      });

      labelsRef.current.push(marker);
    });
  }, [clearLabels]);

  // Show all of India in the panel — use setCenter/setZoom directly
  // because fitBounds over-zooms in narrow-tall panels
  const fitToIndia = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    clearLabels();
    // Center of mainland India, zoom 5 shows full country in most viewports
    const bounds = new window.google.maps.LatLngBounds(
      { lat: 6.5, lng: 68 },
      { lat: 37, lng: 97.5 }
    );
    map.fitBounds(bounds, { top: 5, right: 5, bottom: 5, left: 5 });
  }, [clearLabels]);

  // Zoom to state bounds and show labels
  const zoomToState = useCallback((stateName: string) => {
    const map = mapRef.current;
    const layer = districtLayerRef.current;
    if (!map || !layer || !window.google) return;

    const stateBounds = new window.google.maps.LatLngBounds();
    let found = false;

    layer.forEach((feature: any) => {
      const fs = feature.getProperty("state") || "";
      if (fs.toLowerCase() === stateName.toLowerCase()) {
        found = true;
        feature.getGeometry().forEachLatLng((latlng: any) => stateBounds.extend(latlng));
      }
    });

    if (found) {
      map.fitBounds(stateBounds, 40);
      // Cap zoom to prevent over-zooming on small states/UTs
      window.google.maps.event.addListenerOnce(map, "idle", () => {
        const zoom = map.getZoom();
        if (zoom !== undefined && zoom > 9) {
          map.setZoom(9);
        }
      });
      showStateDistrictLabels(stateName);
    }
  }, [showStateDistrictLabels]);

  // Keep ref in sync
  zoomToStateRef.current = zoomToState;

  useEffect(() => {
    let cancelled = false;

    const loadMap = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("get-maps-key");
        if (fnError || !data?.key) { setError("Failed to load map API key"); setLoading(false); return; }

        if (window.google?.maps) { if (!cancelled) initMap(); return; }

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}&callback=initGoogleMap`;
        script.async = true;
        script.defer = true;
        window.initGoogleMap = () => { if (!cancelled) initMap(); };
        script.onerror = () => { if (!cancelled) { setError("Failed to load Google Maps"); setLoading(false); } };
        document.head.appendChild(script);
      } catch { if (!cancelled) { setError("Error initializing map"); setLoading(false); } }
    };

    const initMap = () => {
      if (!mapContainerRef.current || !window.google) return;

      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat: 22, lng: 82 },
        zoom: 4, minZoom: 2, maxZoom: 10,
        mapTypeId: "roadmap", disableDefaultUI: true, zoomControl: true,
        zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_TOP },
        styles: [
          { elementType: "geometry", stylers: [{ color: "#0d1628" }] },
          { elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#070d1a" }] },
          { featureType: "road", stylers: [{ visibility: "off" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#2a3f5f" }, { weight: 1.5 }] },
          { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#e0e6ed" }, { weight: 2.5 }, { visibility: "on" }] },
          { featureType: "administrative.province", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0d1628" }] },
        ],
        restriction: { latLngBounds: { north: 37, south: 6, west: 68, east: 98 }, strictBounds: true },
      });
      mapRef.current = map;

      // Clear labels when user zooms out to country level
      map.addListener("zoom_changed", () => {
        const zoom = map.getZoom();
        if (zoom !== undefined && zoom < 6) {
          clearLabels();
        }
      });

      // District layer
      const districtLayer = new window.google.maps.Data();
      districtLayerRef.current = districtLayer;
      districtLayer.loadGeoJson("/india-districts.json", undefined, () => {
        applyDistrictStyles(districtLayer);
        fitToIndia();
        setLoading(false);
      });
      districtLayer.setMap(map);

      // District events
      districtLayer.addListener("mouseover", (event: any) => {
        const district = event.feature.getProperty("district") || "";
        const state = event.feature.getProperty("state") || "";
        const key = `${state}|${district}`;
        const dd = districtData[key];
        const risk = dd?.risk ?? STATE_RISK_MAP[state] ?? 0.4;
        hoveredRef.current = key;

        districtLayer.overrideStyle(event.feature, {
          strokeWeight: 2, strokeColor: "#ffffff", fillOpacity: 0.9, zIndex: 5,
        });

        if (event.domEvent && mapContainerRef.current) {
          const rect = mapContainerRef.current.getBoundingClientRect();
          const x = event.domEvent.clientX - rect.left;
          const y = event.domEvent.clientY - rect.top;
          const label = `${district}, ${state}`;
          onStateHover(label, risk, [x, y]);
        }
      });

      districtLayer.addListener("mouseout", (event: any) => {
        hoveredRef.current = null;
        districtLayer.revertStyle(event.feature);
        onStateHover(null, null, null);
      });

      districtLayer.addListener("click", (event: any) => {
        const district = event.feature.getProperty("district") || "";
        const state = event.feature.getProperty("state") || "";
        const key = `${state}|${district}`;
        const dd = districtData[key];

        // Zoom to state level (not district) and show district labels
        zoomToStateRef.current(state);

        if (onDistrictClick && dd) {
          onDistrictClick(district, state, dd);
        } else {
          const risk = dd?.risk ?? STATE_RISK_MAP[state] ?? 0.4;
          onStateClick(district || state, risk);
        }
      });
    };

    loadMap();
    return () => { cancelled = true; };
  }, []);

  useImperativeHandle(ref, () => ({
    zoomToDistrict(district: string, state: string) {
      const layer = districtLayerRef.current;
      const map = mapRef.current;
      if (!layer || !map) return;

      // Zoom to state level and show labels
      zoomToStateRef.current(state);

      // Find the specific district and trigger its click callback
      layer.forEach((feature: any) => {
        const fd = feature.getProperty("district") || "";
        const fs = feature.getProperty("state") || "";
        if (fd.toLowerCase() === district.toLowerCase() && fs.toLowerCase() === state.toLowerCase()) {
          const key = `${fs}|${fd}`;
          const dd = districtData[key];
          if (onDistrictClick && dd) onDistrictClick(fd, fs, dd);
        }
      });
    }
  }), [onDistrictClick, zoomToState]);

  useEffect(() => {
    if (districtLayerRef.current) applyDistrictStyles(districtLayerRef.current);
  }, [activeLayer, getLayerRisk, selectedStateName]);

  const applyDistrictStyles = useCallback((layer: any) => {
    layer.setStyle((feature: any) => {
      const district = feature.getProperty("district") || "";
      const state = feature.getProperty("state") || "";
      const key = `${state}|${district}`;
      const dd = districtData[key];
      const risk = dd?.risk ?? STATE_RISK_MAP[state] ?? 0.4;
      const layerRisk = getLayerRisk(risk, dd);
      const color = riskColor(layerRisk);
      const isHovered = hoveredRef.current === key;
      const isSelected = selectedStateName && state.toLowerCase().includes((selectedStateName || "").toLowerCase().slice(0, 4));

      return {
        fillColor: color,
        fillOpacity: isHovered ? 0.9 : isSelected ? 0.75 : 0.5,
        strokeColor: isHovered ? "#ffffff" : "rgba(255,255,255,0.12)",
        strokeWeight: isHovered ? 2 : 0.3,
        zIndex: isHovered ? 5 : isSelected ? 2 : 1,
      };
    });
  }, [activeLayer, getLayerRisk, selectedStateName]);


  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ef233c", fontSize: 12, padding: 20, textAlign: "center" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {loading && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(7,13,26,0.95)", color: "#6b7fa3", fontSize: 12 }}>
          Loading Map with 707 Districts…
        </div>
      )}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Reset Map button */}
      {!loading && (
        <button
          onClick={() => fitToIndia()}
          style={{
            position: "absolute", top: 120, right: 14, zIndex: 10,
            background: "hsla(225,22%,10%,0.92)", border: "1px solid hsla(220,15%,22%,0.6)",
            borderRadius: 9, padding: "7px 14px", cursor: "pointer",
            color: "hsl(210,25%,80%)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600, letterSpacing: "0.06em", backdropFilter: "blur(16px)",
            display: "flex", alignItems: "center", gap: 7,
            transition: "all 0.2s ease",
            boxShadow: "0 4px 16px hsla(0,0%,0%,0.3)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "hsla(25,95%,55%,0.4)"; e.currentTarget.style.color = "hsl(25,95%,60%)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "hsla(220,15%,22%,0.6)"; e.currentTarget.style.color = "hsl(210,25%,80%)"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M3 12l6-6M3 12l6 6"/></svg>
          RESET MAP
        </button>
      )}

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 14, left: 14,
        background: "hsla(225,22%,10%,0.92)", border: "1px solid hsla(220,15%,20%,0.5)",
        borderRadius: 12, padding: "12px 16px", backdropFilter: "blur(16px)", zIndex: 5,
        boxShadow: "0 4px 20px hsla(0,0%,0%,0.3)",
      }}>
        <div style={{ fontSize: 10, color: "hsl(215,18%,48%)", marginBottom: 8, letterSpacing: "0.12em", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
          {activeLayer.toUpperCase()} RISK · DISTRICT
        </div>
        {[["CRITICAL", "#ef4444", "> 60"], ["HIGH", "#f97316", "40–60"], ["MODERATE", "#eab308", "20–40"], ["LOW", "#22c55e", "< 20"]].map(([l, c, r]) => (
          <div key={l} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: c as string, boxShadow: `0 0 8px ${c}50` }} />
            <span style={{ fontSize: 10, color: "hsl(210,20%,72%)", fontWeight: 500 }}>{l}</span>
            <span style={{ fontSize: 9, color: "hsl(215,12%,40%)", fontFamily: "'JetBrains Mono', monospace" }}>{r}</span>
          </div>
        ))}
        <div style={{ fontSize: 9, color: "hsl(215,12%,38%)", marginTop: 6, borderTop: "1px solid hsla(220,15%,18%,0.5)", paddingTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
          Source: NFHS-5 (2019-21) · 707 Districts
        </div>
      </div>
    </div>
  );
});

export default IndiaMap;
