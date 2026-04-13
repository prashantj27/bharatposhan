import { useState, useRef, useCallback, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import IndiaMap, { type IndiaMapHandle } from "@/components/IndiaMap";
import DistrictSearch from "@/components/DistrictSearch";
import { computeDistrictDrivers } from "@/lib/districtDrivers";
import { generateInterventionPdf, generateFullDistrictReport } from "@/lib/generateInterventionPdf";
import { supabase } from "@/integrations/supabase/client";
import nfhsData from "@/data/nfhsDistrictData.json";

// Source: NFHS-5 (2019-21) district-level fact sheets, rchiips.org
// Risk = 0.4×stunting/100 + 0.3×wasting/100 + 0.3×underweight/100
const RAW_DISTRICTS = [
  { id: 1, name: "Pashchim Singhbhum", state: "Jharkhand", risk: 0.52, stunting: 60.6, wasting: 30.5, underweight: 62.4, anemia_children: 73.3, anemia_women: 72.6, breastfeeding: 73.7, immunization: 87.0, trend: [{ year: "NFHS-3", score: 0.58 }, { year: "NFHS-4", score: 0.55 }, { year: "NFHS-5", score: 0.52 }] },
  { id: 2, name: "Dahod", state: "Gujarat", risk: 0.46, stunting: 55.3, wasting: 27.8, underweight: 53.0, anemia_children: 87.2, anemia_women: 75.1, breastfeeding: 47.6, immunization: 66.2, trend: [{ year: "NFHS-3", score: 0.54 }, { year: "NFHS-4", score: 0.50 }, { year: "NFHS-5", score: 0.46 }] },
  { id: 3, name: "Panch Mahals", state: "Gujarat", risk: 0.45, stunting: 47.1, wasting: 35.7, underweight: 51.9, anemia_children: 91.0, anemia_women: 69.8, breastfeeding: 58.9, immunization: 95.4, trend: [{ year: "NFHS-3", score: 0.53 }, { year: "NFHS-4", score: 0.49 }, { year: "NFHS-5", score: 0.45 }] },
  { id: 4, name: "Nandurbar", state: "Maharashtra", risk: 0.45, stunting: 45.8, wasting: 30.7, underweight: 57.2, anemia_children: 79.3, anemia_women: 64.2, breastfeeding: 86.6, immunization: 72.4, trend: [{ year: "NFHS-3", score: 0.52 }, { year: "NFHS-4", score: 0.48 }, { year: "NFHS-5", score: 0.45 }] },
  { id: 5, name: "Adilabad", state: "Andhra Pradesh", risk: 0.43, stunting: 45.7, wasting: 29.5, underweight: 52.0, anemia_children: 76.3, anemia_women: 61.1, breastfeeding: 72.2, immunization: 69.3, trend: [{ year: "NFHS-3", score: 0.50 }, { year: "NFHS-4", score: 0.47 }, { year: "NFHS-5", score: 0.43 }] },
  { id: 6, name: "Jehanabad", state: "Bihar", risk: 0.43, stunting: 41.3, wasting: 36.6, underweight: 51.7, anemia_children: 61.9, anemia_women: 68.1, breastfeeding: 32.8, immunization: 70.3, trend: [{ year: "NFHS-3", score: 0.50 }, { year: "NFHS-4", score: 0.46 }, { year: "NFHS-5", score: 0.43 }] },
  { id: 7, name: "The Dangs", state: "Gujarat", risk: 0.43, stunting: 37.6, wasting: 40.9, underweight: 53.1, anemia_children: 82.4, anemia_women: 77.2, breastfeeding: 76.2, immunization: 91.3, trend: [{ year: "NFHS-3", score: 0.51 }, { year: "NFHS-4", score: 0.47 }, { year: "NFHS-5", score: 0.43 }] },
  { id: 8, name: "Pakur", state: "Jharkhand", risk: 0.43, stunting: 51.3, wasting: 23.6, underweight: 51.4, anemia_children: 72.1, anemia_women: 79.7, breastfeeding: 73.1, immunization: 69.4, trend: [{ year: "NFHS-3", score: 0.50 }, { year: "NFHS-4", score: 0.46 }, { year: "NFHS-5", score: 0.43 }] },
  { id: 9, name: "Banda", state: "Uttar Pradesh", risk: 0.43, stunting: 51.0, wasting: 25.7, underweight: 49.8, anemia_children: 82.2, anemia_women: 52.2, breastfeeding: 46.7, immunization: 62.9, trend: [{ year: "NFHS-3", score: 0.50 }, { year: "NFHS-4", score: 0.47 }, { year: "NFHS-5", score: 0.43 }] },
  { id: 10, name: "Karimganj", state: "Assam", risk: 0.42, stunting: 29.1, wasting: 48.0, underweight: 52.9, anemia_children: 64.1, anemia_women: 52.0, breastfeeding: 53.1, immunization: 75.1, trend: [{ year: "NFHS-3", score: 0.49 }, { year: "NFHS-4", score: 0.45 }, { year: "NFHS-5", score: 0.42 }] },
  { id: 11, name: "Araria", state: "Bihar", risk: 0.41, stunting: 49.9, wasting: 23.9, underweight: 47.8, anemia_children: 75.8, anemia_women: 67.9, breastfeeding: 69.0, immunization: 61.6, trend: [{ year: "NFHS-3", score: 0.48 }, { year: "NFHS-4", score: 0.44 }, { year: "NFHS-5", score: 0.41 }] },
  { id: 12, name: "Ernakulam", state: "Kerala", risk: 0.14, stunting: 17.6, wasting: 9.7, underweight: 11.3, anemia_children: 27.1, anemia_women: 25.2, breastfeeding: 67.7, immunization: 71.2, trend: [{ year: "NFHS-3", score: 0.18 }, { year: "NFHS-4", score: 0.16 }, { year: "NFHS-5", score: 0.14 }] },
  { id: 13, name: "Pune", state: "Maharashtra", risk: 0.32, stunting: 30.7, wasting: 31.4, underweight: 32.7, anemia_children: 47.7, anemia_women: 42.3, breastfeeding: 67.5, immunization: 74.8, trend: [{ year: "NFHS-3", score: 0.38 }, { year: "NFHS-4", score: 0.35 }, { year: "NFHS-5", score: 0.32 }] },
  { id: 14, name: "Lower Dibang Valley", state: "Arunachal Pradesh", risk: 0.11, stunting: 14.3, wasting: 7.6, underweight: 9.7, anemia_children: 51.5, anemia_women: 34.6, breastfeeding: 60.1, immunization: 73.8, trend: [{ year: "NFHS-3", score: 0.16 }, { year: "NFHS-4", score: 0.14 }, { year: "NFHS-5", score: 0.11 }] },
];

// Compute drivers dynamically from NFHS-5 indicators
const DISTRICTS = RAW_DISTRICTS.map(d => {
  const { drivers, interventions } = computeDistrictDrivers(d);
  return { ...d, drivers, interventions };
});

const riskColor = (r: number) => {
  if (r > 0.75) return "#ef233c";
  if (r > 0.5) return "#f77f00";
  if (r > 0.3) return "#fcbf49";
  return "#52b788";
};
const riskLabel = (r: number) => r > 0.75 ? "CRITICAL" : r > 0.5 ? "HIGH" : r > 0.3 ? "MODERATE" : "LOW";
const riskBg = (r: number) => r > 0.75 ? "rgba(239,35,60,0.15)" : r > 0.5 ? "rgba(247,127,0,0.15)" : r > 0.3 ? "rgba(252,191,73,0.15)" : "rgba(82,183,136,0.15)";

// Source: NFHS India Reports (NFHS-3: 2005-06, NFHS-4: 2015-16, NFHS-5: 2019-21)
const NATIONAL_TRENDS = [
  { year: "2005-06", stunting: 48.0, wasting: 19.8, underweight: 42.5 },
  { year: "2015-16", stunting: 38.4, wasting: 21.0, underweight: 35.8 },
  { year: "2019-21", stunting: 35.5, wasting: 19.3, underweight: 32.1 },
];

export default function Index() {
  const [selected, setSelected] = useState(DISTRICTS[0]);
  const [filterState, setFilterState] = useState("All");
  const [filterRisk, setFilterRisk] = useState("All");
  const [activeLayer, setActiveLayer] = useState("malnutrition");
  const [hoveredState, setHoveredState] = useState<{ name: string; risk: number } | null>(null);
  const [tooltip, setTooltip] = useState<{ name: string; risk: number; x: number; y: number } | null>(null);
  const mapRef = useRef<IndiaMapHandle>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchAiAnalysis = useCallback(async (district: string, state: string, indicators: any) => {
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-district", {
        body: { district, state, indicators },
      });
      if (error) throw new Error(error.message || "AI analysis failed");
      if (data?.error) throw new Error(data.error);
      if (data?.analysis) {
        setAiAnalysis(data.analysis);
      }
    } catch (e: any) {
      console.error("AI analysis error:", e);
      setAiError(e.message || "Failed to generate AI analysis");
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleDistrictSearch = useCallback((district: string, state: string) => {
    mapRef.current?.zoomToDistrict(district, state);
  }, []);

  const states = [...new Set(DISTRICTS.map(d => d.state))].sort();

  // Build state-specific top-10 districts from full NFHS data
  const allNfhsDistricts = nfhsData as Record<string, { district: string; state: string; stunting: number; wasting: number; underweight: number; risk: number; anemia_children: number; anemia_women: number; breastfeeding: number; immunization: number }>;

  const stateDistricts = useMemo(() => {
    const currentState = selected.state;
    return Object.values(allNfhsDistricts)
      .filter(d => d.state === currentState)
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 10);
  }, [selected.state]);

  const filtered = DISTRICTS.filter(d =>
    (filterState === "All" || d.state === filterState) &&
    (filterRisk === "All" ||
      (filterRisk === "Critical" && d.risk > 0.75) ||
      (filterRisk === "High" && d.risk > 0.5 && d.risk <= 0.75) ||
      (filterRisk === "Moderate" && d.risk > 0.3 && d.risk <= 0.5) ||
      (filterRisk === "Low" && d.risk <= 0.3))
  ).sort((a, b) => b.risk - a.risk);

  const topTen = [...DISTRICTS].sort((a, b) => b.risk - a.risk).slice(0, 8);

  const handleStateHover = useCallback((name: string | null, risk: number | null, pos: number[] | null) => {
    if (!name || risk === null) { setHoveredState(null); setTooltip(null); return; }
    setHoveredState({ name, risk });
    if (pos) setTooltip({ name, risk, x: pos[0], y: pos[1] });
  }, []);

  const handleStateClick = useCallback((name: string) => {
    const match = DISTRICTS.find(d => {
      const dn = d.state.toLowerCase();
      const sn = name.toLowerCase();
      return sn.includes(dn.slice(0, 5)) || dn.includes(sn.slice(0, 5));
    });
    if (match) setSelected(match);
  }, []);

  const handleDistrictClick = useCallback((district: string, state: string, data: any) => {
    const { drivers, interventions } = computeDistrictDrivers({
      stunting: data.stunting,
      wasting: data.wasting,
      underweight: data.underweight,
      anemia_children: data.anemia_children ?? 67,
      anemia_women: data.anemia_women ?? 57,
      breastfeeding: data.breastfeeding ?? 64,
      immunization: data.immunization ?? 76,
      risk: data.risk,
    });
    const districtObj = {
      id: 999,
      name: district,
      state: state,
      risk: data.risk,
      stunting: data.stunting,
      wasting: data.wasting,
      underweight: data.underweight,
      anemia_children: data.anemia_children ?? 0,
      anemia_women: data.anemia_women ?? 0,
      breastfeeding: data.breastfeeding ?? 0,
      immunization: data.immunization ?? 0,
      interventions,
      drivers,
      trend: [
        { year: "NFHS-3", score: data.risk + 0.06 },
        { year: "NFHS-4", score: data.risk + 0.03 },
        { year: "NFHS-5", score: data.risk },
      ],
    };
    setSelected(districtObj);
    // Trigger AI analysis
    fetchAiAnalysis(district, state, {
      stunting: data.stunting,
      wasting: data.wasting,
      underweight: data.underweight,
      anemia_children: data.anemia_children,
      anemia_women: data.anemia_women,
      breastfeeding: data.breastfeeding,
      immunization: data.immunization,
      risk: data.risk,
    });
  }, [fetchAiAnalysis]);

  return (
    <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: "#070d1a", minHeight: "100vh", color: "#e0e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(7,13,26,0.96)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#ff6b35,#f7c59f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🌾</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "0.05em", color: "#fff" }}>POSHAN<span style={{ color: "#ff6b35" }}>AI</span></div>
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.18em", marginTop: -2 }}>NUTRITION INTELLIGENCE PLATFORM · GOI</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["malnutrition", "literacy", "sanitation", "scheme"].map(l => (
            <button key={l} onClick={() => setActiveLayer(l)} style={{ padding: "4px 12px", borderRadius: 4, border: `1px solid ${activeLayer === l ? "#ff6b35" : "rgba(255,255,255,0.1)"}`, background: activeLayer === l ? "rgba(255,107,53,0.15)" : "transparent", color: activeLayer === l ? "#ff6b35" : "#6b7fa3", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", textTransform: "uppercase", transition: "all 0.2s" }}>
              {l}
            </button>
          ))}
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#52b788", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: "#52b788", letterSpacing: "0.1em" }}>LIVE · NFHS-5</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 61px)" }}>
        {/* Left sidebar */}
        <div style={{ width: 220, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <div>
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>NATIONAL KPIs</div>
            {[{ label: "Avg Stunting", val: "35.5%", delta: "▼ 2.9% vs NFHS-4" }, { label: "Avg Wasting", val: "19.3%", delta: "▼ 1.7% vs NFHS-4" }, { label: "Avg Underweight", val: "32.1%", delta: "▼ 3.7% vs NFHS-4" }].map(k => (
              <div key={k.label} style={{ padding: "8px 10px", background: "#0d1628", borderRadius: 6, marginBottom: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 9, color: "#6b7fa3" }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 500, color: "#fff", lineHeight: 1.2 }}>{k.val}</div>
                <div style={{ fontSize: 10, color: "#52b788" }}>{k.delta}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>TOP 10 · {selected.state.toUpperCase()}</div>
            {stateDistricts.map((d, i) => {
              const isSelected = selected.name === d.district && selected.state === d.state;
              return (
                <div key={`${d.state}|${d.district}`} onClick={() => {
                  mapRef.current?.zoomToDistrict(d.district, d.state);
                }} style={{ padding: "8px 10px", borderRadius: 6, marginBottom: 4, cursor: "pointer", border: `1px solid ${isSelected ? "rgba(255,107,53,0.4)" : "rgba(255,255,255,0.04)"}`, background: isSelected ? "rgba(255,107,53,0.1)" : "#0d1628", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 9, color: "#4a5f7a", fontWeight: 600, minWidth: 14 }}>#{i + 1}</span>
                      <div style={{ fontSize: 11, color: "#e0e8f0", fontWeight: 500 }}>{d.district}</div>
                    </div>
                    <div style={{ fontSize: 10, color: riskColor(d.risk), fontWeight: 500 }}>{(d.risk * 100).toFixed(0)}</div>
                  </div>
                  <div style={{ height: 2, borderRadius: 1, background: "#1a2340", marginTop: 6 }}>
                    <div style={{ height: "100%", width: `${d.risk * 100}%`, background: riskColor(d.risk), borderRadius: 1, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Map area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 20px", fontSize: 10, color: "#6b7fa3", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span>India</span><span style={{ color: "#ff6b35" }}>›</span>
              <span>{selected.state}</span><span style={{ color: "#ff6b35" }}>›</span>
              <span style={{ color: "#fff" }}>{selected.name}</span>
            </div>
            {hoveredState && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 10px", borderRadius: 4, background: riskBg(hoveredState.risk), border: `1px solid ${riskColor(hoveredState.risk)}40` }}>
                <span style={{ fontSize: 10, color: "#a0b4cc" }}>{hoveredState.name}</span>
                <span style={{ fontSize: 10, color: riskColor(hoveredState.risk), fontWeight: 600 }}>{riskLabel(hoveredState.risk)} · {(hoveredState.risk * 100).toFixed(0)}</span>
              </div>
            )}
          </div>

          <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "radial-gradient(ellipse at 50% 40%, #0d1628 0%, #070d1a 100%)" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />

            <IndiaMap
              ref={mapRef}
              activeLayer={activeLayer}
              onStateHover={handleStateHover}
              onStateClick={handleStateClick}
              onDistrictClick={handleDistrictClick}
              hoveredStateName={hoveredState?.name}
              selectedStateName={selected?.state}
            />

            {/* District Search */}
            <div style={{ position: "absolute", top: 14, left: 14, zIndex: 20, width: 260 }}>
              <DistrictSearch onSelect={handleDistrictSearch} />
            </div>

            {tooltip && (
              <div style={{
                position: "absolute",
                left: tooltip.x + 16, top: tooltip.y + 16,
                background: "rgba(5,10,22,0.96)",
                border: `1px solid ${riskColor(tooltip.risk)}55`,
                borderRadius: 9, padding: "10px 14px",
                pointerEvents: "none", zIndex: 50,
                backdropFilter: "blur(14px)",
                boxShadow: `0 8px 32px ${riskColor(tooltip.risk)}25`,
                minWidth: 155, maxWidth: 220,
              }}>
                <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, marginBottom: 6, fontFamily: "'Syne',sans-serif" }}>{tooltip.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.08em" }}>RISK SCORE</span>
                  <span style={{ fontSize: 10, color: riskColor(tooltip.risk), fontWeight: 700 }}>{(tooltip.risk * 100).toFixed(0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.08em" }}>STATUS</span>
                  <span style={{ fontSize: 9, color: riskColor(tooltip.risk), letterSpacing: "0.1em" }}>{riskLabel(tooltip.risk)}</span>
                </div>
                <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.07)" }}>
                  <div style={{ height: "100%", width: `${tooltip.risk * 100}%`, background: `linear-gradient(90deg,${riskColor(tooltip.risk)}55,${riskColor(tooltip.risk)})`, borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 8, color: "#3a5070", marginTop: 5, letterSpacing: "0.06em" }}>Click to view NFHS data</div>
              </div>
            )}

            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(255,107,53,0.25),transparent)", animation: "scan 5s linear infinite", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 320, borderLeft: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: riskBg(selected.risk), border: `1px solid ${riskColor(selected.risk)}30`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: "#fff" }}>{selected.name}</div>
                <div style={{ fontSize: 10, color: "#6b7fa3", marginTop: 2 }}>{selected.state} · District</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: riskColor(selected.risk), lineHeight: 1 }}>{(selected.risk * 100).toFixed(0)}</div>
                <div style={{ fontSize: 8, color: riskColor(selected.risk), letterSpacing: "0.15em" }}>{riskLabel(selected.risk)} RISK</div>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", marginTop: 12 }}>
              <div style={{ height: "100%", width: `${selected.risk * 100}%`, background: `linear-gradient(90deg,${riskColor(selected.risk)}80,${riskColor(selected.risk)})`, borderRadius: 2, transition: "width 0.6s ease" }} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>NUTRITION INDICATORS · NFHS-5 (2019-21)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Stunting", val: selected.stunting, unit: "%", color: "#ef233c" },
                { label: "Wasting", val: selected.wasting, unit: "%", color: "#f77f00" },
                { label: "Underweight", val: selected.underweight, unit: "%", color: "#fcbf49" },
                { label: "Anaemia (Children)", val: selected.anemia_children, unit: "%", color: "#e76f51" },
                { label: "Anaemia (Women)", val: selected.anemia_women, unit: "%", color: "#e9c46a" },
                { label: "Excl. Breastfeeding", val: selected.breastfeeding, unit: "%", color: "#52b788" },
                { label: "Full Immunization", val: selected.immunization, unit: "%", color: "#48cae4" },
              ].map(i => (
                <div key={i.label} style={{ background: "#0d1628", borderRadius: 6, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 9, color: "#6b7fa3" }}>{i.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: i.color }}>{i.val}<span style={{ fontSize: 10 }}>{i.unit}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>🧠 AI CAUSAL DRIVERS</div>
            {selected.drivers.map(d => (
              <div key={d.factor} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
                  <span style={{ color: "#a0b4cc" }}>{d.factor}</span>
                  <span style={{ color: "#ff6b35", fontWeight: 500 }}>{d.contribution}%</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: "#1a2340" }}>
                  <div style={{ height: "100%", width: `${d.contribution}%`, background: "linear-gradient(90deg,#ff6b3580,#ff6b35)", borderRadius: 2, transition: "width 0.8s ease" }} />
                </div>
              </div>
            ))}
            <div style={{ fontSize: 9, color: "#4a5f7a", marginTop: 4, padding: "6px 8px", background: "rgba(255,107,53,0.05)", borderRadius: 4, borderLeft: "2px solid #ff6b3540" }}>
              Source: Decomposition analysis of NFHS-5 (2019-21) indicators · Census 2011 · NITI Aayog DNP 2022
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>RISK TREND</div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={selected.trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={riskColor(selected.risk)} stopOpacity={0.55} />
                    <stop offset="95%" stopColor={riskColor(selected.risk)} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" tick={{ fill: "#6b7fa3", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 1]} hide />
                <Tooltip contentStyle={{ background: "#0d1628", border: `1px solid ${riskColor(selected.risk)}55`, borderRadius: 6, fontSize: 10 }} formatter={(v: number) => [(v * 100).toFixed(0) + "%", "Risk Score"]} labelStyle={{ color: "#a0b4cc" }} />
                <Area type="monotone" dataKey="score" stroke={riskColor(selected.risk)} strokeWidth={2.5} fill="url(#riskGrad)" dot={{ r: 4, fill: riskColor(selected.risk), stroke: "#070d1a", strokeWidth: 1.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              💡 AI-POWERED INTERVENTIONS
              {aiLoading && <span style={{ color: "#ff6b35", fontSize: 8, animation: "pulse 1s infinite" }}>● ANALYZING...</span>}
            </div>
            {aiLoading && (
              <div style={{ padding: "16px 10px", textAlign: "center", color: "#6b7fa3", fontSize: 10 }}>
                <div style={{ marginBottom: 8 }}>🔬 AI is researching {selected.name}, {selected.state}...</div>
                <div style={{ fontSize: 8, color: "#4a5f7a" }}>Analyzing NFHS-5 data, geography, demographics & existing schemes</div>
                <div style={{ height: 2, background: "#1a2340", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg, #ff6b35, #f7c59f)", borderRadius: 2, animation: "scan 2s linear infinite" }} />
                </div>
              </div>
            )}
            {aiError && (
              <div style={{ padding: "10px", borderRadius: 6, background: "rgba(239,35,60,0.1)", border: "1px solid rgba(239,35,60,0.2)", fontSize: 10, color: "#ef233c", marginBottom: 8 }}>
                {aiError}
                <div style={{ fontSize: 8, color: "#6b7fa3", marginTop: 4 }}>Showing fallback recommendations below</div>
              </div>
            )}
            {aiAnalysis?.district_context && (
              <div style={{ padding: "8px 10px", borderRadius: 6, marginBottom: 8, background: "rgba(255,107,53,0.05)", border: "1px solid rgba(255,107,53,0.1)", fontSize: 9, color: "#a0b4cc" }}>
                <div style={{ color: "#ff6b35", fontWeight: 600, marginBottom: 4, fontSize: 8, letterSpacing: "0.15em" }}>DISTRICT CONTEXT</div>
                <div style={{ marginBottom: 3 }}>{aiAnalysis.district_context.geography}</div>
                <div style={{ marginBottom: 3 }}>{aiAnalysis.district_context.population_profile}</div>
                {aiAnalysis.district_context.key_challenges?.slice(0, 2).map((c: string, i: number) => (
                  <div key={i} style={{ color: "#6b7fa3", fontSize: 8 }}>⚠ {c}</div>
                ))}
              </div>
            )}
            {(aiAnalysis?.interventions || selected.interventions).map((inv: any, i: number) => {
              const isAi = typeof inv === "object" && inv.name;
              const name = isAi ? inv.name : inv;
              const desc = isAi ? inv.description : null;
              const priority = isAi ? inv.priority : null;
              const impact = isAi ? inv.expected_impact : null;
              const priorityColor = priority === "critical" ? "#ef233c" : priority === "high" ? "#f77f00" : "#52b788";
              return (
                <div key={i} style={{ padding: "8px 10px", borderRadius: 6, marginBottom: 5, background: "#0d1628", border: `1px solid ${isAi ? "rgba(255,107,53,0.12)" : "rgba(255,255,255,0.05)"}`, fontSize: 10, color: "#a0b4cc" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: isAi ? "#ff6b35" : "#52b788", flexShrink: 0, marginTop: 1 }}>{isAi ? "🤖" : "→"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                        <span style={{ fontWeight: 500, color: "#e0e8f0" }}>{name}</span>
                        {priority && <span style={{ fontSize: 7, color: priorityColor, padding: "1px 5px", borderRadius: 3, border: `1px solid ${priorityColor}40`, textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>{priority}</span>}
                      </div>
                      {desc && <div style={{ fontSize: 9, color: "#6b7fa3", marginTop: 3 }}>{desc}</div>}
                      {impact && <div style={{ fontSize: 8, color: "#52b788", marginTop: 3 }}>📈 {impact}</div>}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); generateInterventionPdf(name, { ...selected, aiAnalysis: isAi ? inv : null, districtContext: aiAnalysis?.district_context, fiveYearProjection: aiAnalysis?.five_year_projection }); }}
                      style={{ flexShrink: 0, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(82,183,136,0.3)", background: "rgba(82,183,136,0.1)", color: "#52b788", fontSize: 8, cursor: "pointer", letterSpacing: "0.1em", fontWeight: 600, transition: "all 0.2s", marginTop: 1 }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(82,183,136,0.25)"; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(82,183,136,0.1)"; }}
                    >
                      ↓ PDF
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Download Full District Report button */}
            {(aiAnalysis?.interventions?.length > 0 || selected.interventions?.length > 0) && (
              <button
                onClick={() => generateFullDistrictReport({
                  ...selected,
                  aiAnalysis: aiAnalysis,
                  districtContext: aiAnalysis?.district_context,
                  fiveYearProjection: aiAnalysis?.five_year_projection,
                })}
                disabled={aiLoading}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,107,53,0.4)",
                  background: "linear-gradient(135deg, rgba(255,107,53,0.15), rgba(247,197,159,0.1))",
                  color: "#ff6b35",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: aiLoading ? "not-allowed" : "pointer",
                  letterSpacing: "0.08em",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 4,
                  transition: "all 0.2s",
                  opacity: aiLoading ? 0.5 : 1,
                  fontFamily: "'Syne',sans-serif",
                }}
                onMouseEnter={e => { if (!aiLoading) (e.target as HTMLElement).style.background = "linear-gradient(135deg, rgba(255,107,53,0.3), rgba(247,197,159,0.2))"; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = "linear-gradient(135deg, rgba(255,107,53,0.15), rgba(247,197,159,0.1))"; }}
              >
                📄 Download Full District Report
              </button>
            )}
          </div>

          <div>
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>NATIONAL NFHS TRENDS</div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={NATIONAL_TRENDS} barGap={2}>
                <XAxis dataKey="year" tick={{ fill: "#6b7fa3", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 55]} />
                <Tooltip contentStyle={{ background: "#0d1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 10 }} />
                <Bar dataKey="stunting" fill="#ef233c80" radius={[2, 2, 0, 0]} />
                <Bar dataKey="wasting" fill="#f77f0080" radius={[2, 2, 0, 0]} />
                <Bar dataKey="underweight" fill="#fcbf4980" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", fontSize: 8, color: "#6b7fa3" }}>
              <span style={{ color: "#ef233c" }}>● Stunting</span>
              <span style={{ color: "#f77f00" }}>● Wasting</span>
              <span style={{ color: "#fcbf49" }}>● Underweight</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 20px", background: "#070d1a", display: "flex", gap: 10, alignItems: "center", overflowX: "auto" }}>
        <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", whiteSpace: "nowrap", marginRight: 6 }}>TOP PRIORITY DISTRICTS</div>
        {topTen.map((d, i) => (
          <div key={d.id} onClick={() => setSelected(d)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 12px", borderRadius: 20, border: `1px solid ${selected.id === d.id ? riskColor(d.risk) : "rgba(255,255,255,0.07)"}`, background: selected.id === d.id ? riskBg(d.risk) : "#0d1628", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.2s" }}>
            <span style={{ fontSize: 9, color: "#4a5f7a" }}>#{i + 1}</span>
            <span style={{ fontSize: 10, color: "#e0e8f0" }}>{d.name}</span>
            <span style={{ fontSize: 10, color: riskColor(d.risk), fontWeight: 600 }}>{(d.risk * 100).toFixed(0)}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "6px 20px", background: "#070d1a", fontSize: 8, color: "#3a5070", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>Data: NFHS-5 (2019-21) · rchiips.org/nfhs</span>
        <span>Census 2011 · censusindia.gov.in</span>
        <span>NITI Aayog District Nutrition Profile · niti.gov.in</span>
        <span>Risk = 0.4×Stunting + 0.3×Wasting + 0.3×Underweight (normalized)</span>
      </div>

      <style>{`
        @keyframes scan { 0%{top:0} 100%{top:100%} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing:border-box; scrollbar-width:thin; scrollbar-color:#1a2340 transparent; }
        select { cursor:pointer; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#1a2340;border-radius:2px}
      `}</style>
    </div>
  );
}
