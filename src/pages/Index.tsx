import { useState, useRef, useCallback } from "react";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from "recharts";
import IndiaMap from "@/components/IndiaMap";

const DISTRICTS = [
  { id: 1, name: "Purnea", state: "Bihar", risk: 0.92, stunting: 51.2, wasting: 28.4, underweight: 44.1, literacy: 38.2, sanitation: 22.1, ruralPct: 88, healthInfra: 12, interventions: ["Poshan Abhiyaan expansion", "ICDS strengthening", "Swachh Bharat Mission acceleration"], drivers: [{ factor: "Sanitation Access", contribution: 38 }, { factor: "Female Literacy", contribution: 29 }, { factor: "Health Infrastructure", contribution: 19 }, { factor: "Income Proxy", contribution: 14 }], trend: [{ year: "2016", score: 0.95 }, { year: "2018", score: 0.93 }, { year: "2020", score: 0.92 }, { year: "2022", score: 0.90 }] },
  { id: 2, name: "Shrawasti", state: "Uttar Pradesh", risk: 0.89, stunting: 49.8, wasting: 26.1, underweight: 42.3, literacy: 41.5, sanitation: 28.3, ruralPct: 91, healthInfra: 14, interventions: ["Mid-Day Meal scheme boost", "Anaemia awareness campaign", "Rural health sub-centres"], drivers: [{ factor: "Sanitation Access", contribution: 35 }, { factor: "Female Literacy", contribution: 31 }, { factor: "Health Infrastructure", contribution: 20 }, { factor: "Income Proxy", contribution: 14 }], trend: [{ year: "2016", score: 0.93 }, { year: "2018", score: 0.91 }, { year: "2020", score: 0.89 }, { year: "2022", score: 0.87 }] },
  { id: 3, name: "Bahraich", state: "Uttar Pradesh", risk: 0.87, stunting: 48.2, wasting: 25.3, underweight: 41.0, literacy: 43.1, sanitation: 31.2, ruralPct: 89, healthInfra: 16, interventions: ["PMGSY road connectivity", "ASHAs reinforcement", "Water & sanitation"], drivers: [{ factor: "Female Literacy", contribution: 34 }, { factor: "Sanitation Access", contribution: 30 }, { factor: "Rural Population", contribution: 22 }, { factor: "Health Infrastructure", contribution: 14 }], trend: [{ year: "2016", score: 0.91 }, { year: "2018", score: 0.89 }, { year: "2020", score: 0.87 }, { year: "2022", score: 0.85 }] },
  { id: 4, name: "Gajapati", state: "Odisha", risk: 0.85, stunting: 46.5, wasting: 24.8, underweight: 39.7, literacy: 44.2, sanitation: 33.5, ruralPct: 86, healthInfra: 18, interventions: ["Tribal nutrition programme", "WSHG microfinance", "Mobile health vans"], drivers: [{ factor: "Sanitation Access", contribution: 32 }, { factor: "Income Proxy", contribution: 28 }, { factor: "Female Literacy", contribution: 26 }, { factor: "Health Infrastructure", contribution: 14 }], trend: [{ year: "2016", score: 0.89 }, { year: "2018", score: 0.87 }, { year: "2020", score: 0.85 }, { year: "2022", score: 0.83 }] },
  { id: 5, name: "Rajnandgaon", state: "Chhattisgarh", risk: 0.83, stunting: 45.1, wasting: 23.2, underweight: 38.5, literacy: 47.8, sanitation: 36.4, ruralPct: 84, healthInfra: 21, interventions: ["Supplementary nutrition", "Jan Aushadhi Kendras", "Anganwadi upscaling"], drivers: [{ factor: "Income Proxy", contribution: 36 }, { factor: "Sanitation Access", contribution: 27 }, { factor: "Female Literacy", contribution: 24 }, { factor: "Rural Population", contribution: 13 }], trend: [{ year: "2016", score: 0.87 }, { year: "2018", score: 0.85 }, { year: "2020", score: 0.83 }, { year: "2022", score: 0.80 }] },
  { id: 6, name: "Dumka", state: "Jharkhand", risk: 0.81, stunting: 44.2, wasting: 22.7, underweight: 37.3, literacy: 49.1, sanitation: 38.2, ruralPct: 82, healthInfra: 22, interventions: ["Forest rights + nutrition link", "Midwife training"], drivers: [{ factor: "Female Literacy", contribution: 38 }, { factor: "Income Proxy", contribution: 30 }, { factor: "Sanitation Access", contribution: 20 }, { factor: "Health Infrastructure", contribution: 12 }], trend: [{ year: "2016", score: 0.86 }, { year: "2018", score: 0.84 }, { year: "2020", score: 0.81 }, { year: "2022", score: 0.79 }] },
  { id: 7, name: "Malkangiri", state: "Odisha", risk: 0.80, stunting: 43.5, wasting: 22.1, underweight: 36.8, literacy: 50.3, sanitation: 39.8, ruralPct: 81, healthInfra: 24, interventions: ["Remote area mobile clinics", "PDS fortified food"], drivers: [{ factor: "Sanitation Access", contribution: 34 }, { factor: "Income Proxy", contribution: 29 }, { factor: "Female Literacy", contribution: 23 }, { factor: "Rural Population", contribution: 14 }], trend: [{ year: "2016", score: 0.85 }, { year: "2018", score: 0.83 }, { year: "2020", score: 0.80 }, { year: "2022", score: 0.78 }] },
  { id: 8, name: "Narayanpur", state: "Chhattisgarh", risk: 0.79, stunting: 42.8, wasting: 21.4, underweight: 36.1, literacy: 51.2, sanitation: 41.3, ruralPct: 83, healthInfra: 19, interventions: ["Tribal anganwadi network", "Iron-folic supplementation"], drivers: [{ factor: "Income Proxy", contribution: 33 }, { factor: "Sanitation Access", contribution: 28 }, { factor: "Female Literacy", contribution: 25 }, { factor: "Health Infrastructure", contribution: 14 }], trend: [{ year: "2016", score: 0.84 }, { year: "2018", score: 0.82 }, { year: "2020", score: 0.79 }, { year: "2022", score: 0.77 }] },
  { id: 9, name: "West Garo Hills", state: "Meghalaya", risk: 0.74, stunting: 40.1, wasting: 20.2, underweight: 33.2, literacy: 54.1, sanitation: 45.2, ruralPct: 78, healthInfra: 27, interventions: ["Community nutrition gardens", "SABLA scheme"], drivers: [{ factor: "Sanitation Access", contribution: 31 }, { factor: "Female Literacy", contribution: 29 }, { factor: "Income Proxy", contribution: 25 }, { factor: "Health Infrastructure", contribution: 15 }], trend: [{ year: "2016", score: 0.80 }, { year: "2018", score: 0.77 }, { year: "2020", score: 0.74 }, { year: "2022", score: 0.72 }] },
  { id: 10, name: "Khunti", state: "Jharkhand", risk: 0.72, stunting: 39.3, wasting: 19.8, underweight: 32.5, literacy: 55.8, sanitation: 46.8, ruralPct: 79, healthInfra: 28, interventions: ["JSY incentives", "JSSK scheme awareness"], drivers: [{ factor: "Female Literacy", contribution: 36 }, { factor: "Sanitation Access", contribution: 28 }, { factor: "Income Proxy", contribution: 22 }, { factor: "Health Infrastructure", contribution: 14 }], trend: [{ year: "2016", score: 0.78 }, { year: "2018", score: 0.75 }, { year: "2020", score: 0.72 }, { year: "2022", score: 0.70 }] },
  { id: 11, name: "Rae Bareli", state: "Uttar Pradesh", risk: 0.65, stunting: 36.2, wasting: 17.4, underweight: 29.8, literacy: 58.1, sanitation: 51.3, ruralPct: 75, healthInfra: 33, interventions: ["ASHA performance bonus", "School health programme"], drivers: [{ factor: "Female Literacy", contribution: 38 }, { factor: "Sanitation Access", contribution: 30 }, { factor: "Income Proxy", contribution: 20 }, { factor: "Health Infrastructure", contribution: 12 }], trend: [{ year: "2016", score: 0.72 }, { year: "2018", score: 0.69 }, { year: "2020", score: 0.65 }, { year: "2022", score: 0.62 }] },
  { id: 12, name: "Sundergarh", state: "Odisha", risk: 0.62, stunting: 34.8, wasting: 16.9, underweight: 28.4, literacy: 60.3, sanitation: 53.8, ruralPct: 72, healthInfra: 36, interventions: ["PHC upgrades", "Nutrition counselling centres"], drivers: [{ factor: "Sanitation Access", contribution: 34 }, { factor: "Income Proxy", contribution: 28 }, { factor: "Female Literacy", contribution: 24 }, { factor: "Health Infrastructure", contribution: 14 }], trend: [{ year: "2016", score: 0.69 }, { year: "2018", score: 0.66 }, { year: "2020", score: 0.62 }, { year: "2022", score: 0.59 }] },
  { id: 13, name: "Ernakulam", state: "Kerala", risk: 0.18, stunting: 18.2, wasting: 8.1, underweight: 14.3, literacy: 94.2, sanitation: 91.3, ruralPct: 38, healthInfra: 82, interventions: ["Maintain Kudumbashree model", "Urban nutrition clinics"], drivers: [{ factor: "Female Literacy", contribution: 42 }, { factor: "Health Infrastructure", contribution: 35 }, { factor: "Sanitation Access", contribution: 15 }, { factor: "Income Proxy", contribution: 8 }], trend: [{ year: "2016", score: 0.22 }, { year: "2018", score: 0.20 }, { year: "2020", score: 0.18 }, { year: "2022", score: 0.16 }] },
  { id: 14, name: "Pune", state: "Maharashtra", risk: 0.24, stunting: 20.4, wasting: 9.3, underweight: 16.2, literacy: 86.3, sanitation: 84.2, ruralPct: 42, healthInfra: 74, interventions: ["Urban slum nutrition drive", "PMJAY coverage"], drivers: [{ factor: "Sanitation Access", contribution: 38 }, { factor: "Female Literacy", contribution: 31 }, { factor: "Income Proxy", contribution: 21 }, { factor: "Health Infrastructure", contribution: 10 }], trend: [{ year: "2016", score: 0.28 }, { year: "2018", score: 0.26 }, { year: "2020", score: 0.24 }, { year: "2022", score: 0.22 }] },
];

const riskColor = (r: number) => {
  if (r > 0.75) return "#ef233c";
  if (r > 0.5) return "#f77f00";
  if (r > 0.3) return "#fcbf49";
  return "#52b788";
};
const riskLabel = (r: number) => r > 0.75 ? "CRITICAL" : r > 0.5 ? "HIGH" : r > 0.3 ? "MODERATE" : "LOW";
const riskBg = (r: number) => r > 0.75 ? "rgba(239,35,60,0.15)" : r > 0.5 ? "rgba(247,127,0,0.15)" : r > 0.3 ? "rgba(252,191,73,0.15)" : "rgba(82,183,136,0.15)";

const NATIONAL_TRENDS = [
  { year: "2006", stunting: 48, wasting: 20, underweight: 43 },
  { year: "2011", stunting: 42, wasting: 21, underweight: 36 },
  { year: "2016", stunting: 38, wasting: 21, underweight: 36 },
  { year: "2021", stunting: 36, wasting: 19, underweight: 32 },
];

export default function Index() {
  const [selected, setSelected] = useState(DISTRICTS[0]);
  const [filterState, setFilterState] = useState("All");
  const [filterRisk, setFilterRisk] = useState("All");
  const [activeLayer, setActiveLayer] = useState("malnutrition");
  const [hoveredState, setHoveredState] = useState<{ name: string; risk: number } | null>(null);
  const [tooltip, setTooltip] = useState<{ name: string; risk: number; x: number; y: number } | null>(null);

  const states = [...new Set(DISTRICTS.map(d => d.state))].sort();
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
    setSelected({
      id: 999,
      name: district,
      state: state,
      risk: data.risk,
      stunting: data.stunting,
      wasting: data.wasting,
      underweight: data.underweight,
      literacy: 100 - data.risk * 60,
      sanitation: 100 - data.risk * 55,
      ruralPct: Math.round(50 + data.risk * 40),
      healthInfra: Math.round(90 - data.risk * 70),
      interventions: ["Poshan Abhiyaan", "ICDS Strengthening", "Swachh Bharat Mission"],
      drivers: [
        { factor: "Sanitation Access", contribution: 35 },
        { factor: "Female Literacy", contribution: 30 },
        { factor: "Health Infrastructure", contribution: 22 },
        { factor: "Income Proxy", contribution: 13 },
      ],
      trend: [
        { year: "2016", score: data.risk + 0.06 },
        { year: "2018", score: data.risk + 0.04 },
        { year: "2020", score: data.risk + 0.02 },
        { year: "2022", score: data.risk },
      ],
    });
  }, []);

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
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>FILTERS</div>
            <select value={filterState} onChange={e => setFilterState(e.target.value)} style={{ width: "100%", padding: "6px 8px", background: "#0d1628", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#e0e8f0", fontSize: 11, marginBottom: 6 }}>
              <option>All</option>
              {states.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} style={{ width: "100%", padding: "6px 8px", background: "#0d1628", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#e0e8f0", fontSize: 11 }}>
              {["All", "Critical", "High", "Moderate", "Low"].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>NATIONAL KPIs</div>
            {[{ label: "Avg Stunting", val: "35.5%", delta: "▼ 2.5%" }, { label: "Avg Wasting", val: "19.3%", delta: "▼ 1.8%" }, { label: "High Risk Districts", val: "112", delta: "▼ 14" }].map(k => (
              <div key={k.label} style={{ padding: "8px 10px", background: "#0d1628", borderRadius: 6, marginBottom: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 9, color: "#6b7fa3" }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 500, color: "#fff", lineHeight: 1.2 }}>{k.val}</div>
                <div style={{ fontSize: 10, color: "#52b788" }}>{k.delta} vs NFHS-4</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>DISTRICTS · {filtered.length}</div>
            {filtered.map(d => (
              <div key={d.id} onClick={() => setSelected(d)} style={{ padding: "8px 10px", borderRadius: 6, marginBottom: 4, cursor: "pointer", border: `1px solid ${selected.id === d.id ? "rgba(255,107,53,0.4)" : "rgba(255,255,255,0.04)"}`, background: selected.id === d.id ? "rgba(255,107,53,0.1)" : "#0d1628", transition: "all 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "#e0e8f0", fontWeight: 500 }}>{d.name}</div>
                  <div style={{ fontSize: 10, color: riskColor(d.risk), fontWeight: 500 }}>{(d.risk * 100).toFixed(0)}</div>
                </div>
                <div style={{ fontSize: 9, color: "#6b7fa3", marginTop: 2 }}>{d.state}</div>
                <div style={{ height: 2, borderRadius: 1, background: "#1a2340", marginTop: 6 }}>
                  <div style={{ height: "100%", width: `${d.risk * 100}%`, background: riskColor(d.risk), borderRadius: 1, transition: "width 0.5s" }} />
                </div>
              </div>
            ))}
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
              activeLayer={activeLayer}
              onStateHover={handleStateHover}
              onStateClick={handleStateClick}
              onDistrictClick={handleDistrictClick}
              hoveredStateName={hoveredState?.name}
              selectedStateName={selected?.state}
            />

            {tooltip && (
              <div style={{
                position: "absolute",
                left: tooltip.x, top: tooltip.y,
                transform: "translate(-50%, calc(-100% - 14px))",
                background: "rgba(5,10,22,0.96)",
                border: `1px solid ${riskColor(tooltip.risk)}55`,
                borderRadius: 9, padding: "10px 14px",
                pointerEvents: "none", zIndex: 50,
                backdropFilter: "blur(14px)",
                boxShadow: `0 8px 32px ${riskColor(tooltip.risk)}25`,
                minWidth: 155,
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
                <div style={{ fontSize: 8, color: "#3a5070", marginTop: 5, letterSpacing: "0.06em" }}>Click to explore districts</div>
                <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `6px solid ${riskColor(tooltip.risk)}55` }} />
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
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>NUTRITION INDICATORS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Stunting", val: selected.stunting, unit: "%", color: "#ef233c" },
                { label: "Wasting", val: selected.wasting, unit: "%", color: "#f77f00" },
                { label: "Underweight", val: selected.underweight, unit: "%", color: "#fcbf49" },
                { label: "Literacy", val: selected.literacy, unit: "%", color: "#52b788" },
                { label: "Sanitation", val: selected.sanitation, unit: "%", color: "#48cae4" },
                { label: "Health Infra", val: selected.healthInfra, unit: "/100", color: "#9b89fa" },
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
              Source: SHAP feature attribution · Random Forest v2.1
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
            <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: "0.2em", marginBottom: 8 }}>💡 RECOMMENDED INTERVENTIONS</div>
            {selected.interventions.map((inv, i) => (
              <div key={i} style={{ padding: "8px 10px", borderRadius: 6, marginBottom: 5, background: "#0d1628", border: "1px solid rgba(255,255,255,0.05)", fontSize: 10, color: "#a0b4cc", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#52b788", flexShrink: 0 }}>→</span>
                <span>{inv}</span>
              </div>
            ))}
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
