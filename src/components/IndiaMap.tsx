import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3Geo from "d3-geo";

interface IndiaMapProps {
  activeLayer: string;
  onStateHover: (name: string | null, risk: number | null, pos: number[] | null, rect?: DOMRect) => void;
  onStateClick: (name: string, risk: number) => void;
  hoveredStateName: string | null | undefined;
  selectedStateName: string | null | undefined;
}

const STATE_RISK_MAP: Record<string, number> = {
  "Jammu and Kashmir": 0.48, "Himachal Pradesh": 0.31, "Punjab": 0.38,
  "Uttaranchal": 0.36, "Haryana": 0.42, "Delhi": 0.33,
  "Rajasthan": 0.55, "Uttar Pradesh": 0.75, "Bihar": 0.78,
  "Sikkim": 0.29, "Arunachal Pradesh": 0.58, "Nagaland": 0.45,
  "Manipur": 0.52, "Mizoram": 0.40, "Tripura": 0.55,
  "Meghalaya": 0.64, "Assam": 0.62, "West Bengal": 0.58,
  "Jharkhand": 0.71, "Orissa": 0.68, "Chhattisgarh": 0.66,
  "Madhya Pradesh": 0.61, "Gujarat": 0.45, "Maharashtra": 0.41,
  "Andhra Pradesh": 0.42, "Karnataka": 0.35,
  "Goa": 0.19, "Kerala": 0.22, "Tamil Nadu": 0.29,
  "Lakshadweep": 0.21, "Andaman and Nicobar": 0.28,
  "Puducherry": 0.24, "Chandigarh": 0.25,
  "Dadra and Nagar Haveli": 0.35, "Daman and Diu": 0.30,
};

const DISPLAY_NAMES: Record<string, string> = {
  "Orissa": "Odisha",
  "Uttaranchal": "Uttarakhand",
  "Jammu and Kashmir": "Jammu & Kashmir",
  "Andaman and Nicobar": "Andaman & Nicobar",
  "Dadra and Nagar Haveli": "Dadra & Nagar Haveli",
  "Daman and Diu": "Daman & Diu",
};

const riskColor = (r: number | undefined | null) => {
  if (r === undefined || r === null) return "#1a2a3a";
  if (r > 0.75) return "#ef233c";
  if (r > 0.5) return "#f77f00";
  if (r > 0.3) return "#fcbf49";
  return "#52b788";
};

interface GeoFeature {
  type: string;
  properties: { name: string };
  geometry: any;
}

interface GeoData {
  type: string;
  features: GeoFeature[];
}

export default function IndiaMap({ activeLayer, onStateHover, onStateClick, hoveredStateName, selectedStateName }: IndiaMapProps) {
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch("/india-states.json")
      .then(r => r.json())
      .then(setGeoData);
  }, []);

  const projection = useMemo(() => {
    return d3Geo.geoMercator()
      .center([82, 23])
      .scale(1000)
      .translate([400, 450]);
  }, []);

  const pathGenerator = useMemo(() => {
    return d3Geo.geoPath().projection(projection);
  }, [projection]);

  const getLayerRisk = (risk: number) => {
    if (activeLayer === "literacy") return 1 - risk * 0.9;
    if (activeLayer === "sanitation") return 1 - risk * 0.85;
    return risk;
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.7, Math.min(5, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && panStart.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => { setIsPanning(false); panStart.current = null; }, []);
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  if (!geoData) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7fa3", fontSize: 12 }}>Loading map…</div>;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={{ position: "absolute", top: 14, right: 14, zIndex: 20, display: "flex", flexDirection: "column", gap: 5 }}>
        {[{ l: "+", a: () => setZoom(z => Math.min(5, z * 1.2)) },
          { l: "−", a: () => setZoom(z => Math.max(0.7, z / 1.2)) },
          { l: "⊙", a: resetView }].map(b => (
          <button key={b.l} onClick={b.a} style={{
            width: 30, height: 30, borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(7,13,26,0.88)", color: "#8899b4",
            fontSize: b.l === "⊙" ? 13 : 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)", transition: "all 0.15s",
            lineHeight: 1,
          }}>{b.l}</button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 800 900"
        style={{ width: "100%", height: "100%", cursor: isPanning ? "grabbing" : "grab", userSelect: "none" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#162035" />
            <stop offset="100%" stopColor="#070d1a" />
          </radialGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="strongGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width="800" height="900" fill="url(#mapGlow)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
           style={{ transformOrigin: "400px 450px" }}>

          {geoData.features.map((feature) => {
            const stateName = feature.properties.name;
            const risk = STATE_RISK_MAP[stateName] ?? 0.4;
            const layerRisk = getLayerRisk(risk);
            const fill = riskColor(layerRisk);
            const displayName = DISPLAY_NAMES[stateName] || stateName;
            const isHov = hoveredStateName === displayName;
            const isSel = selectedStateName && displayName.includes(selectedStateName?.slice(0, 4));
            const d = pathGenerator(feature.geometry as any) || "";
            const centroid = pathGenerator.centroid(feature.geometry as any);

            return (
              <g key={stateName}>
                {isHov && (
                  <path d={d} fill={fill} opacity={0.4} filter="url(#strongGlow)" />
                )}
                <path
                  d={d}
                  fill={isHov ? fill : isSel ? fill + "ee" : fill + "99"}
                  stroke={isHov ? "#ffffff" : isSel ? fill : "rgba(255,255,255,0.18)"}
                  strokeWidth={isHov ? 1.2 / zoom : isSel ? 0.8 / zoom : 0.4 / zoom}
                  style={{ transition: "fill 0.2s, stroke 0.2s", cursor: "pointer" }}
                  onMouseEnter={() => {
                    const svgEl = svgRef.current;
                    if (!svgEl) return;
                    const rect = svgEl.getBoundingClientRect();
                    const svgX = (centroid[0] * zoom + pan.x);
                    const svgY = (centroid[1] * zoom + pan.y);
                    const px = (svgX / 800) * rect.width;
                    const py = (svgY / 900) * rect.height;
                    onStateHover(displayName, risk, [px, py], rect);
                  }}
                  onMouseLeave={() => onStateHover(null, null, null)}
                  onClick={() => onStateClick(displayName, risk)}
                />
                {zoom > 1.8 && centroid[0] && (
                  <text
                    x={centroid[0]} y={centroid[1]}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={7 / zoom}
                    fill="rgba(255,255,255,0.75)"
                    style={{ pointerEvents: "none", fontFamily: "DM Mono, monospace", fontWeight: 500 }}
                  >
                    {displayName.length > 12 ? displayName.slice(0, 8) + "…" : displayName}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div style={{
        position: "absolute", bottom: 14, left: 14,
        background: "rgba(7,13,26,0.92)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "10px 14px",
        backdropFilter: "blur(12px)"
      }}>
        <div style={{ fontSize: 9, color: "#6b7fa3", marginBottom: 6, letterSpacing: "0.15em" }}>
          {activeLayer.toUpperCase()} RISK
        </div>
        {[["CRITICAL", "#ef233c", "> 75"], ["HIGH", "#f77f00", "50–75"], ["MODERATE", "#fcbf49", "30–50"], ["LOW", "#52b788", "< 30"]].map(([l, c, r]) => (
          <div key={l} style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c, boxShadow: `0 0 5px ${c}60` }} />
            <span style={{ fontSize: 9, color: "#8899b4" }}>{l}</span>
            <span style={{ fontSize: 8, color: "#4a5f7a" }}>{r}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 6, paddingTop: 5, fontSize: 8, color: "#3a4f6a" }}>
          Scroll to zoom · Drag to pan
        </div>
      </div>
    </div>
  );
}
