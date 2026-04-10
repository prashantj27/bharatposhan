import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IndiaMapProps {
  activeLayer: string;
  onStateHover: (name: string | null, risk: number | null, pos: number[] | null, rect?: DOMRect) => void;
  onStateClick: (name: string, risk: number) => void;
  hoveredStateName: string | null | undefined;
  selectedStateName: string | null | undefined;
}

const STATE_RISK_MAP: Record<string, number> = {
  "Jammu and Kashmir": 0.48, "Jammu & Kashmir": 0.48, "Himachal Pradesh": 0.31, "Punjab": 0.38,
  "Uttarakhand": 0.36, "Uttaranchal": 0.36, "Haryana": 0.42, "Delhi": 0.33, "NCT of Delhi": 0.33,
  "Rajasthan": 0.55, "Uttar Pradesh": 0.75, "Bihar": 0.78,
  "Sikkim": 0.29, "Arunachal Pradesh": 0.58, "Nagaland": 0.45,
  "Manipur": 0.52, "Mizoram": 0.40, "Tripura": 0.55,
  "Meghalaya": 0.64, "Assam": 0.62, "West Bengal": 0.58,
  "Jharkhand": 0.71, "Odisha": 0.68, "Orissa": 0.68, "Chhattisgarh": 0.66,
  "Madhya Pradesh": 0.61, "Gujarat": 0.45, "Maharashtra": 0.41,
  "Andhra Pradesh": 0.42, "Karnataka": 0.35, "Telangana": 0.44,
  "Goa": 0.19, "Kerala": 0.22, "Tamil Nadu": 0.29,
  "Lakshadweep": 0.21, "Andaman and Nicobar Islands": 0.28, "Andaman and Nicobar": 0.28,
  "Puducherry": 0.24, "Chandigarh": 0.25, "Ladakh": 0.40,
  "Dadra and Nagar Haveli and Daman and Diu": 0.33, "Dadra and Nagar Haveli": 0.35, "Daman and Diu": 0.30,
};

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

export default function IndiaMap({ activeLayer, onStateHover, onStateClick, hoveredStateName, selectedStateName }: IndiaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const dataLayerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);

  const getLayerRisk = useCallback((risk: number) => {
    if (activeLayer === "literacy") return 1 - risk * 0.9;
    if (activeLayer === "sanitation") return 1 - risk * 0.85;
    return risk;
  }, [activeLayer]);

  // Load Google Maps API
  useEffect(() => {
    let cancelled = false;

    const loadMap = async () => {
      try {
        // Fetch the API key from edge function
        const { data, error: fnError } = await supabase.functions.invoke("get-maps-key");
        if (fnError || !data?.key) {
          setError("Failed to load map API key");
          setLoading(false);
          return;
        }

        const apiKey = data.key;

        // Check if Google Maps is already loaded
        if (window.google?.maps) {
          if (!cancelled) initMap();
          return;
        }

        // Load Google Maps script
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap`;
        script.async = true;
        script.defer = true;

        window.initGoogleMap = () => {
          if (!cancelled) initMap();
        };

        script.onerror = () => {
          if (!cancelled) {
            setError("Failed to load Google Maps");
            setLoading(false);
          }
        };

        document.head.appendChild(script);
      } catch (err) {
        if (!cancelled) {
          setError("Error initializing map");
          setLoading(false);
        }
      }
    };

    const initMap = () => {
      if (!mapContainerRef.current || !window.google) return;

      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat: 22.5, lng: 82 },
        zoom: 5,
        minZoom: 4,
        maxZoom: 10,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_TOP,
        },
        styles: [
          { elementType: "geometry", stylers: [{ color: "#0d1628" }] },
          { elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#070d1a" }] },
          { featureType: "road", stylers: [{ visibility: "off" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#2a3f5f" }, { weight: 1.5 }] },
          { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#1a2a44" }, { weight: 0.8 }] },
          { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#4a6080" }, { visibility: "on" }] },
          { featureType: "administrative.province", elementType: "labels.text.stroke", stylers: [{ color: "#070d1a" }, { weight: 2 }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0d1628" }] },
        ],
        restriction: {
          latLngBounds: { north: 38, south: 6, west: 67, east: 98 },
          strictBounds: false,
        },
      });

      mapRef.current = map;

      // Load GeoJSON for state boundaries  
      const dataLayer = new window.google.maps.Data();
      dataLayerRef.current = dataLayer;

      dataLayer.loadGeoJson("/india-states.json", undefined, () => {
        applyStyles(dataLayer);
        setLoading(false);
      });

      dataLayer.setMap(map);

      // Event listeners
      dataLayer.addListener("mouseover", (event: any) => {
        const name = event.feature.getProperty("name") || event.feature.getProperty("NAME_1") || event.feature.getProperty("st_nm") || "";
        const risk = STATE_RISK_MAP[name] ?? 0.4;
        hoveredRef.current = name;

        dataLayer.overrideStyle(event.feature, {
          strokeWeight: 2,
          strokeColor: "#ffffff",
          fillOpacity: 0.9,
          zIndex: 2,
        });

        if (event.latLng) {
          const point = getPixelPosition(map, event.latLng);
          onStateHover(name, risk, point ? [point.x, point.y] : null);
        }
      });

      dataLayer.addListener("mouseout", (event: any) => {
        hoveredRef.current = null;
        dataLayer.revertStyle(event.feature);
        onStateHover(null, null, null);
      });

      dataLayer.addListener("click", (event: any) => {
        const name = event.feature.getProperty("name") || event.feature.getProperty("NAME_1") || event.feature.getProperty("st_nm") || "";
        const risk = STATE_RISK_MAP[name] ?? 0.4;
        onStateClick(name, risk);
      });
    };

    loadMap();
    return () => { cancelled = true; };
  }, []);

  // Update styles when activeLayer changes
  useEffect(() => {
    if (dataLayerRef.current) {
      applyStyles(dataLayerRef.current);
    }
  }, [activeLayer, getLayerRisk]);

  const applyStyles = useCallback((dataLayer: any) => {
    dataLayer.setStyle((feature: any) => {
      const name = feature.getProperty("name") || feature.getProperty("NAME_1") || feature.getProperty("st_nm") || "";
      const risk = STATE_RISK_MAP[name] ?? 0.4;
      const layerRisk = getLayerRisk(risk);
      const color = riskColor(layerRisk);
      const isHovered = hoveredRef.current === name;
      const isSelected = selectedStateName && name.toLowerCase().includes((selectedStateName || "").toLowerCase().slice(0, 4));

      return {
        fillColor: color,
        fillOpacity: isHovered ? 0.9 : isSelected ? 0.75 : 0.55,
        strokeColor: isHovered ? "#ffffff" : isSelected ? color : "rgba(255,255,255,0.25)",
        strokeWeight: isHovered ? 2 : isSelected ? 1.5 : 0.5,
        zIndex: isHovered ? 2 : isSelected ? 1 : 0,
      };
    });
  }, [activeLayer, getLayerRisk, selectedStateName]);

  const getPixelPosition = (map: any, latLng: any) => {
    const bounds = map.getBounds();
    const projection = map.getProjection();
    if (!bounds || !projection) return null;

    const topRight = projection.fromLatLngToPoint(bounds.getNorthEast());
    const bottomLeft = projection.fromLatLngToPoint(bounds.getSouthWest());
    const scale = Math.pow(2, map.getZoom());
    const worldPoint = projection.fromLatLngToPoint(latLng);

    const containerEl = mapContainerRef.current;
    if (!containerEl) return null;

    const rect = containerEl.getBoundingClientRect();
    const x = ((worldPoint.x - bottomLeft.x) * scale) / (rect.width / 256) * (rect.width / ((topRight.x - bottomLeft.x) * scale));
    const y = ((worldPoint.y - topRight.y) * scale) / (rect.height / 256) * (rect.height / ((bottomLeft.y - topRight.y) * scale));

    return { x, y };
  };

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
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(7,13,26,0.95)", color: "#6b7fa3", fontSize: 12,
        }}>
          Loading Google Maps…
        </div>
      )}

      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 14, left: 14,
        background: "rgba(7,13,26,0.92)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "10px 14px",
        backdropFilter: "blur(12px)", zIndex: 5,
      }}>
        <div style={{ fontSize: 9, color: "#6b7fa3", marginBottom: 6, letterSpacing: "0.15em" }}>
          {activeLayer.toUpperCase()} RISK
        </div>
        {[["CRITICAL", "#ef233c", "> 75"], ["HIGH", "#f77f00", "50–75"], ["MODERATE", "#fcbf49", "30–50"], ["LOW", "#52b788", "< 30"]].map(([l, c, r]) => (
          <div key={l} style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c as string, boxShadow: `0 0 5px ${c}60` }} />
            <span style={{ fontSize: 9, color: "#8899b4" }}>{l}</span>
            <span style={{ fontSize: 8, color: "#4a5f7a" }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
