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
  "Andaman and Nicobar": 0.19, "Andaman and Nicobar Islands": 0.19,
  "Andhra Pradesh": 0.28, "Arunachal Pradesh": 0.19, "Assam": 0.30,
  "Bihar": 0.36, "Chandigarh": 0.19, "Chhattisgarh": 0.29,
  "Dadra and Nagar Haveli": 0.36, "Dadra and Nagar Haveli and Daman and Diu": 0.32,
  "Daman and Diu": 0.28, "Delhi": 0.19, "NCT of Delhi": 0.19,
  "Goa": 0.23, "Gujarat": 0.35, "Haryana": 0.20,
  "Himachal Pradesh": 0.25, "Jammu and Kashmir": 0.24, "Jammu & Kashmir": 0.24,
  "Jharkhand": 0.35, "Karnataka": 0.29, "Kerala": 0.20,
  "Lakshadweep": 0.26, "Madhya Pradesh": 0.30, "Maharashtra": 0.33,
  "Manipur": 0.17, "Meghalaya": 0.29, "Mizoram": 0.19,
  "Nagaland": 0.27, "Odisha": 0.27, "Orissa": 0.27,
  "Puducherry": 0.21, "Punjab": 0.18, "Rajasthan": 0.27,
  "Sikkim": 0.17, "Tamil Nadu": 0.21, "Telangana": 0.28,
  "Tripura": 0.26, "Uttar Pradesh": 0.31, "Uttarakhand": 0.20, "Uttaranchal": 0.20,
  "West Bengal": 0.29, "Ladakh": 0.24,
};

const districtData = nfhsData as Record<string, { district: string; state: string; stunting: number; wasting: number; underweight: number; risk: number; anemia_children: number; anemia_women: number; breastfeeding: number; immunization: number }>;

const riskColor = (r: number) => {
  if (r > 0.75) return "#ef233c";
  if (r > 0.5) return "#f77f00";
  if (r > 0.3) return "#fcbf49";
  return "#52b788";
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

  const getLayerRisk = useCallback((risk: number) => {
    if (activeLayer === "literacy") return 1 - risk * 0.9;
    if (activeLayer === "sanitation") return 1 - risk * 0.85;
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

  // Show all of India with the top (J&K) near the top of the panel.
  // The center panel is taller than wide, so we set center north of
  // geographic center so India's northern border is near the top edge.
  const fitToIndia = useCallback(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !window.google || !container) return;
    clearLabels();
    const h = container.clientHeight;
    const w = container.clientWidth;
    const aspect = h / w;
    // For tall containers, shift center north so India fills from top
    // India's geographic center is ~21°N; we shift based on aspect ratio
    const centerLat = aspect > 1.2 ? 24 : aspect > 0.9 ? 22.5 : 21;
    map.setCenter({ lat: centerLat, lng: 82 });
    // Choose zoom so the ~30° longitude span fits the container width
    // At zoom 5, each tile covers ~11.25° lng → 256px * 2^5 / 360 ≈ 28px/deg
    // For 450px wide panel: 450/30 ≈ 15px/deg → zoom ~4.7, round to 5
    map.setZoom(w < 500 ? 4 : 5);
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
        center: { lat: 25, lng: 82 },
        zoom: 5, minZoom: 4, maxZoom: 10,
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
          { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#3a5a8a" }, { weight: 2 }, { visibility: "on" }] },
          { featureType: "administrative.province", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0d1628" }] },
        ],
        restriction: { latLngBounds: { north: 38, south: 6, west: 67, east: 98 }, strictBounds: false },
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
      const layerRisk = getLayerRisk(risk);
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
          Loading Map with 594 Districts…
        </div>
      )}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Reset Map button */}
      {showResetButton && !loading && (
        <button
          onClick={() => {
            fitToIndia();
          }}
          style={{
            position: "absolute", top: 14, left: 14, zIndex: 10,
            background: "rgba(7,13,26,0.92)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6, padding: "6px 12px", cursor: "pointer",
            color: "#c8d6e5", fontSize: 10, fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.1em", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", gap: 6,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.color = "#ffffff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#c8d6e5"; }}
        >
          <span style={{ fontSize: 12 }}>←</span> RESET MAP
        </button>
      )}

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 14, left: 14,
        background: "rgba(7,13,26,0.92)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "10px 14px", backdropFilter: "blur(12px)", zIndex: 5,
      }}>
        <div style={{ fontSize: 9, color: "#6b7fa3", marginBottom: 6, letterSpacing: "0.15em" }}>
          {activeLayer.toUpperCase()} RISK · DISTRICT LEVEL
        </div>
        {[["CRITICAL", "#ef233c", "> 75"], ["HIGH", "#f77f00", "50–75"], ["MODERATE", "#fcbf49", "30–50"], ["LOW", "#52b788", "< 30"]].map(([l, c, r]) => (
          <div key={l} style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c as string, boxShadow: `0 0 5px ${c}60` }} />
            <span style={{ fontSize: 9, color: "#8899b4" }}>{l}</span>
            <span style={{ fontSize: 8, color: "#4a5f7a" }}>{r}</span>
          </div>
        ))}
        <div style={{ fontSize: 8, color: "#4a5f7a", marginTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 4 }}>
          Source: NFHS-5 (2019-21) · 594 Districts
        </div>
      </div>
    </div>
  );
});

export default IndiaMap;
