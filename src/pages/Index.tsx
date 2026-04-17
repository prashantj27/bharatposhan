import { useState, useRef, useCallback, useMemo, useEffect, Fragment } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import IndiaMap, { type IndiaMapHandle } from "@/components/IndiaMap";
import DistrictSearch from "@/components/DistrictSearch";
import { computeDistrictDrivers } from "@/lib/districtDrivers";
import { generateInterventionPdf, generateFullDistrictReport, generateAiEnhancedInterventionPdf, generateAiEnhancedFullReport } from "@/lib/generateInterventionPdf";
import { supabase } from "@/integrations/supabase/client";
import nfhsData from "@/data/nfhsDistrictData.json";
import logoImg from "@/assets/logo.png";
import { trackEvent } from "@/lib/umami";
import ScrollHint from "@/components/ScrollHint";

const nfhsLookup = nfhsData as Record<string, { female_literacy?: number; sanitation?: number; [k: string]: any }>;

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

const DISTRICTS = RAW_DISTRICTS.map(d => {
  const { drivers, interventions } = computeDistrictDrivers(d);
  const nk = `${d.state}|${d.name}`;
  const nd = nfhsLookup[nk];
  return { ...d, drivers, interventions, female_literacy: nd?.female_literacy ?? null as number | null, sanitation: nd?.sanitation ?? null as number | null };
});

const riskColor = (r: number) => {
  if (r > 0.6) return "#ef4444";
  if (r > 0.4) return "#f97316";
  if (r > 0.2) return "#eab308";
  return "#22c55e";
};
const riskLabel = (r: number) => r > 0.6 ? "CRITICAL" : r > 0.4 ? "HIGH" : r > 0.2 ? "MODERATE" : "LOW";
const riskBg = (r: number) => r > 0.6 ? "rgba(239,68,68,0.08)" : r > 0.4 ? "rgba(249,115,22,0.08)" : r > 0.2 ? "rgba(234,179,8,0.08)" : "rgba(34,197,94,0.08)";

const NATIONAL_TRENDS = [
  { year: "2005-06", stunting: 48.0, wasting: 19.8, underweight: 42.5 },
  { year: "2015-16", stunting: 38.4, wasting: 21.0, underweight: 35.8 },
  { year: "2019-21", stunting: 35.5, wasting: 19.3, underweight: 32.1 },
];

function useScreenSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return {
    isMobile: size.w < 768,
    isTablet: size.w >= 768 && size.w < 1024,
    isSmallMobile: size.w < 380,
    w: size.w,
    h: size.h,
  };
}

// -- Styled sub-components --
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 10, color: "hsl(215,18%,50%)", letterSpacing: "0.18em", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
    {children}
  </div>
);

const TopDistrictsDropdown = ({ stateDistricts, selected, stateName, mapRef, isMobile, setMobilePanel }: any) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ flex: 1 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: open ? 10 : 0 }}
      >
        <SectionLabel>Top 10 · {stateName}</SectionLabel>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0, marginBottom: 10 }}
        >
          <path d="M3 5L7 9L11 5" stroke="hsl(215,18%,50%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {stateDistricts.map((d: any, i: number) => {
            const isSelected = selected.name === d.district && selected.state === d.state;
            return (
              <div key={`${d.state}|${d.district}`} onClick={() => {
                mapRef.current?.zoomToDistrict(d.district, d.state);
                if (isMobile) setMobilePanel("map");
              }} className="glass-card" style={{
                padding: "10px 12px", cursor: "pointer",
                border: `1px solid ${isSelected ? "hsla(25,95%,55%,0.4)" : "hsla(220,15%,18%,0.5)"}`,
                background: isSelected ? "hsla(25,95%,55%,0.08)" : "hsla(225,22%,11%,0.6)",
                animation: "fadeIn 0.3s ease",
                animationDelay: `${i * 30}ms`,
                animationFillMode: "both",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "hsl(215,12%,38%)", fontWeight: 700, minWidth: 18, fontFamily: "'JetBrains Mono', monospace" }}>#{i + 1}</span>
                    <div style={{ fontSize: 12, color: "hsl(210,25%,90%)", fontWeight: 600 }}>{d.district}</div>
                  </div>
                  <div style={{ fontSize: 12, color: riskColor(d.risk), fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{(d.risk * 100).toFixed(0)}</div>
                </div>
                <div style={{ height: 3, borderRadius: 4, background: "hsl(220,15%,14%)", marginTop: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${d.risk * 100}%`, background: `linear-gradient(90deg, ${riskColor(d.risk)}80, ${riskColor(d.risk)})`, borderRadius: 4, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ label, val, delta }: { label: string; val: string; delta: string }) => (
  <div className="glass-card" style={{ padding: "8px 10px" }}>
    <div style={{ fontSize: 9, color: "hsl(215,18%,50%)", fontWeight: 500, marginBottom: 1 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: "hsl(210,25%,93%)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>{val}</div>
    <div style={{ fontSize: 9, color: "#22c55e", fontWeight: 500, marginTop: 1, display: "flex", alignItems: "center", gap: 2 }}>
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M5 8V2M5 2L2 5M5 2L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      {delta}
    </div>
  </div>
);

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
  const [pdfLoading, setPdfLoading] = useState<string | null>(null); // tracks which PDF is generating (intervention name or "full");
  const { isMobile, isTablet, w } = useScreenSize();
  const [mobilePanel, setMobilePanel] = useState<"map" | "districts" | "details">("map");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);

  // ---- District detail-view engagement tracking (scroll depth + time on view) ----
  // A "view" starts when a district detail panel becomes visible
  // (always on desktop; only when mobilePanel==="details" on mobile),
  // and ends when the district changes, the panel hides, the tab is hidden,
  // or the page unloads.
  const detailVisible = !isMobile || mobilePanel === "details";
  useEffect(() => {
    if (!detailVisible) return;
    const district = selected.name;
    const state = selected.state;
    const startedAt = performance.now();
    let maxScrollPct = 0;
    const milestonesFired = new Set<number>();

    trackEvent("district_view_start", { district, state });

    const scrollEl = rightPanelRef.current;
    const onScroll = () => {
      if (!scrollEl) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const scrollable = scrollHeight - clientHeight;
      if (scrollable <= 0) return;
      const pct = Math.min(100, Math.round((scrollTop / scrollable) * 100));
      if (pct > maxScrollPct) maxScrollPct = pct;
      [25, 50, 75, 100].forEach(m => {
        if (pct >= m && !milestonesFired.has(m)) {
          milestonesFired.add(m);
          trackEvent("district_scroll_depth", { district, state, depth_pct: m });
        }
      });
    };
    scrollEl?.addEventListener("scroll", onScroll, { passive: true });

    let ended = false;
    const endView = (reason: string) => {
      if (ended) return;
      ended = true;
      const duration_ms = Math.round(performance.now() - startedAt);
      // Skip ultra-short views that are usually accidental
      if (duration_ms < 500) return;
      trackEvent("district_view_end", {
        district, state, duration_ms,
        max_scroll_pct: maxScrollPct,
        reason,
      });
    };

    const onVisibility = () => { if (document.hidden) endView("tab_hidden"); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", () => endView("pagehide"));

    return () => {
      scrollEl?.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      endView("changed");
    };
  }, [detailVisible, selected.name, selected.state]);

  // ---- Session-level journey tracking ----
  // Records the ordered sequence of districts a user views in a single session,
  // so we can analyze comparison and exploration patterns.
  const journeyRef = useRef<{
    sessionId: string;
    startedAt: number;
    steps: { district: string; state: string; t_ms: number }[];
    lastEmittedCount: number;
    flushed: boolean;
  } | null>(null);

  if (!journeyRef.current) {
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    journeyRef.current = {
      sessionId,
      startedAt: performance.now(),
      steps: [],
      lastEmittedCount: 0,
      flushed: false,
    };
    trackEvent("session_start", { session_id: sessionId });
  }

  // Append the current district to the journey when it changes & is being viewed
  useEffect(() => {
    if (!detailVisible) return;
    const j = journeyRef.current!;
    const last = j.steps[j.steps.length - 1];
    if (last && last.district === selected.name && last.state === selected.state) return;
    const step = {
      district: selected.name,
      state: selected.state,
      t_ms: Math.round(performance.now() - j.startedAt),
    };
    j.steps.push(step);
    trackEvent("district_journey_step", {
      session_id: j.sessionId,
      step: j.steps.length,
      district: step.district,
      state: step.state,
      t_ms: step.t_ms,
    });
  }, [detailVisible, selected.name, selected.state]);

  // Periodic + end-of-session journey summary
  useEffect(() => {
    const flush = (reason: string) => {
      const j = journeyRef.current;
      if (!j) return;
      if (reason === "pagehide" && j.flushed) return;
      if (j.steps.length === 0) return;
      if (reason === "checkpoint" && j.steps.length === j.lastEmittedCount) return;

      const uniqueKeys = new Set(j.steps.map(s => `${s.state}|${s.district}`));
      const states = new Set(j.steps.map(s => s.state));
      // Compact path string; cap to last 50 entries to respect Umami payload limits
      const path = j.steps.map(s => `${s.state}|${s.district}`).slice(-50).join(" → ");

      trackEvent("district_journey_summary", {
        session_id: j.sessionId,
        reason,
        total_views: j.steps.length,
        unique_districts: uniqueKeys.size,
        unique_states: states.size,
        session_duration_ms: Math.round(performance.now() - j.startedAt),
        path,
      });
      j.lastEmittedCount = j.steps.length;
      if (reason === "pagehide") j.flushed = true;
    };

    const onVisibility = () => { if (document.hidden) flush("tab_hidden"); };
    const onPageHide = () => flush("pagehide");
    const checkpoint = window.setInterval(() => flush("checkpoint"), 120_000);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(checkpoint);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  // Static dark theme colors
  const t = {
    bg: "hsl(225,20%,6%)",
    panelBorder: "hsl(220,15%,14%)",
    headerBg: "linear-gradient(180deg, hsla(225,24%,10%,0.98), hsla(225,22%,8%,0.96))",
    text1: "hsl(210,25%,96%)",
    text2: "hsl(210,25%,90%)",
    text3: "hsl(215,18%,50%)",
    textMuted: "hsl(215,12%,40%)",
    footerBg: "hsl(225,24%,7%)",
    btnInactive: "hsla(225,22%,12%,0.6)",
    btnInactiveText: "hsl(215,18%,55%)",
    btnInactiveBorder: "hsl(220,15%,18%)",
  };

  const fetchAiAnalysis = useCallback(async (district: string, state: string, indicators: any) => {
    setAiLoading(true); setAiError(null); setAiAnalysis(null);
    trackEvent("ai_analysis_requested", { district, state });
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("analyze-district", { body: { district, state, indicators } });
      if (error) throw new Error(error.message || "AI analysis failed");
      if (data?.error) throw new Error(data.error);
      if (data?.analysis) setAiAnalysis(data.analysis);
      trackEvent("ai_analysis_success", { district, state, duration_ms: Math.round(performance.now() - t0) });
    } catch (e: any) {
      console.error("AI analysis error:", e);
      setAiError(e.message || "Failed to generate AI analysis");
      trackEvent("ai_analysis_failed", { district, state, error: e?.message?.slice(0, 120) });
    } finally { setAiLoading(false); }
  }, []);

  const handleDistrictSearch = useCallback((district: string, state: string) => {
    trackEvent("district_search_select", { district, state });
    mapRef.current?.zoomToDistrict(district, state);
    if (isMobile) setMobilePanel("map");
  }, [isMobile]);

  const allNfhsDistricts = nfhsData as Record<string, { district: string; state: string; stunting: number; wasting: number; underweight: number; risk: number; anemia_children: number; anemia_women: number; breastfeeding: number; immunization: number }>;

  const stateDistricts = useMemo(() => {
    return Object.values(allNfhsDistricts)
      .filter(d => d.state === selected.state)
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 10);
  }, [selected.state]);

  const handleStateHover = useCallback((name: string | null, risk: number | null, pos: number[] | null) => {
    if (!name || risk === null) { setHoveredState(null); setTooltip(null); return; }
    setHoveredState({ name, risk });
    if (pos) setTooltip({ name, risk, x: pos[0], y: pos[1] });
  }, []);

  const handleStateClick = useCallback((name: string) => {
    trackEvent("state_click", { state: name });
    const match = DISTRICTS.find(d => {
      const dn = d.state.toLowerCase();
      const sn = name.toLowerCase();
      return sn.includes(dn.slice(0, 5)) || dn.includes(sn.slice(0, 5));
    });
    if (match) setSelected(match);
  }, []);

  const handleDistrictClick = useCallback((district: string, state: string, data: any) => {
    trackEvent("district_select", { district, state, risk: Number(data?.risk?.toFixed?.(2) ?? data?.risk) });
    const { drivers, interventions } = computeDistrictDrivers({
      stunting: data.stunting, wasting: data.wasting, underweight: data.underweight,
      anemia_children: data.anemia_children ?? 67, anemia_women: data.anemia_women ?? 57,
      breastfeeding: data.breastfeeding ?? 64, immunization: data.immunization ?? 76, risk: data.risk,
    });
    setSelected({
      id: 999, name: district, state, risk: data.risk,
      stunting: data.stunting, wasting: data.wasting, underweight: data.underweight,
      anemia_children: data.anemia_children ?? 0, anemia_women: data.anemia_women ?? 0,
      breastfeeding: data.breastfeeding ?? 0, immunization: data.immunization ?? 0,
      female_literacy: data.female_literacy ?? null, sanitation: data.sanitation ?? null,
      interventions, drivers,
      trend: [
        { year: "NFHS-3", score: data.risk + 0.06 },
        { year: "NFHS-4", score: data.risk + 0.03 },
        { year: "NFHS-5", score: data.risk },
      ],
    });
    if (isMobile) setMobileDetailOpen(true);
    fetchAiAnalysis(district, state, {
      stunting: data.stunting, wasting: data.wasting, underweight: data.underweight,
      anemia_children: data.anemia_children, anemia_women: data.anemia_women,
      breastfeeding: data.breastfeeding, immunization: data.immunization, risk: data.risk,
    });
  }, [fetchAiAnalysis, isMobile]);

  // ---- LAYER BUTTONS (map overlay) ----
  const renderLayerButtons = () => (
    <div style={{
      position: "absolute", top: 12, left: 14, zIndex: 20,
      display: "flex", gap: 5,
    }}>
      {["malnutrition", "literacy", "sanitation"].map(l => (
        <button key={l} onClick={() => { trackEvent("layer_change", { layer: l }); setActiveLayer(l); }} style={{
          padding: isMobile ? "4px 9px" : "5px 14px", borderRadius: 7,
          border: `1px solid ${activeLayer === l ? "hsl(25,95%,55%)" : "hsla(220,15%,40%,0.4)"}`,
          background: activeLayer === l ? "hsla(25,95%,55%,0.18)" : "hsla(225,24%,8%,0.75)",
          color: activeLayer === l ? "hsl(25,95%,60%)" : "hsl(215,18%,60%)",
          fontSize: isMobile ? 8 : 10, fontWeight: 600, letterSpacing: "0.06em",
          cursor: "pointer", textTransform: "uppercase", transition: "all 0.2s ease",
          backdropFilter: "blur(12px)",
        }}>
          {isMobile ? l.slice(0, 3).toUpperCase() : l}
        </button>
      ))}
    </div>
  );

  // ---- LEFT SIDEBAR ----
  const renderLeftSidebar = () => (
    <div style={{
      width: isMobile ? "100%" : isTablet ? 190 : 240, flexShrink: 0,
      zIndex: 10, position: "relative",
      borderRight: isMobile ? "none" : "1px solid hsl(220,15%,14%)",
      display: "flex", flexDirection: "column",
      ...(isMobile ? { height: "100%" } : { minHeight: 0 }),
    }}>
      {/* Fixed logo header */}
      <div style={{
        padding: "10px 10px 8px", 
        borderBottom: "2px solid transparent",
        borderImage: "linear-gradient(90deg, transparent, hsl(25,95%,55%), hsl(200,70%,55%), transparent) 1",
        display: "flex", justifyContent: "center", flexShrink: 0, position: "relative" as const,
        background: "linear-gradient(135deg, hsla(225,24%,8%,0.85), hsla(225,22%,5%,0.95))",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 6px 16px -4px hsla(25,95%,55%,0.15)",
      }}>
        <img src={logoImg} alt="PoshanAtlas AI" style={{ height: isMobile ? 54 : 70, width: "auto" }} />
      </div>
      {/* Scrollable content */}
      <div ref={leftPanelRef} className="glass-panel" style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        padding: isMobile ? "14px" : "18px 14px",
        display: "flex", flexDirection: "column", gap: 18,
        position: "relative",
      }}>
      <div>
        <SectionLabel>National KPIs</SectionLabel>
        <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : undefined, flexDirection: isMobile ? undefined : "column", gap: 8 }}>
          <KpiCard label="Avg Stunting" val="35.5%" delta="2.9%" />
          <KpiCard label="Avg Wasting" val="19.3%" delta="1.7%" />
          <KpiCard label="Avg Underweight" val="32.1%" delta="3.7%" />
        </div>
      </div>
      {/* National NFHS Trends */}
      <div>
        <SectionLabel>National NFHS Trends</SectionLabel>
        <div className="glass-card" style={{ padding: "12px 8px 4px 0", overflow: "hidden" }}>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={NATIONAL_TRENDS} barGap={2}>
              <XAxis dataKey="year" tick={{ fill: "hsl(215,18%,50%)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 55]} />
              <Tooltip contentStyle={{ background: "hsl(225,22%,9%)", border: "1px solid hsl(220,15%,18%)", borderRadius: 10, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
              <Bar dataKey="stunting" fill="#ef444480" radius={[4, 4, 0, 0]} />
              <Bar dataKey="wasting" fill="#f9731680" radius={[4, 4, 0, 0]} />
              <Bar dataKey="underweight" fill="#eab30880" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: 10, color: "hsl(215,18%,50%)", marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
          <span><span style={{ color: "#ef4444" }}>●</span> Stunting</span>
          <span><span style={{ color: "#f97316" }}>●</span> Wasting</span>
          <span><span style={{ color: "#eab308" }}>●</span> Underweight</span>
        </div>
      </div>

      {/* Risk Trend */}
      {(() => {
        const scores = selected.trend.map((t: any) => t.score);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const padding = Math.max((maxScore - minScore) * 0.3, 0.02);
        const yMin = Math.max(0, Math.floor((minScore - padding) * 100) / 100);
        const yMax = Math.min(1, Math.ceil((maxScore + padding) * 100) / 100);
        return (
          <div>
            <SectionLabel>Risk Trend · {selected.name}</SectionLabel>
            <div className="glass-card" style={{ padding: "12px 8px 4px 0", overflow: "hidden" }}>
              <ResponsiveContainer width="100%" height={isMobile ? 110 : 130}>
                <LineChart data={selected.trend} margin={{ top: 10, right: 14, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsla(220,15%,20%,0.5)" />
                  <XAxis dataKey="year" tick={{ fill: "hsl(215,18%,50%)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: "hsl(220,15%,16%)" }} tickLine={false} />
                  <YAxis domain={[yMin, yMax]} tick={{ fill: "hsl(215,18%,50%)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} width={40} />
                  <ReferenceLine y={selected.risk} stroke={`${riskColor(selected.risk)}44`} strokeDasharray="5 3" />
                  <Tooltip contentStyle={{ background: "hsl(225,22%,9%)", border: `1px solid ${riskColor(selected.risk)}40`, borderRadius: 10, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} formatter={(v: number) => [(v * 100).toFixed(1) + "%", "Risk"]} labelStyle={{ color: "hsl(215,18%,60%)" }} />
                  <Line type="monotone" dataKey="score" stroke={riskColor(selected.risk)} strokeWidth={2.5} dot={{ r: 5, fill: riskColor(selected.risk), stroke: "hsl(225,22%,8%)", strokeWidth: 2 }} activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 10, color: "hsl(215,12%,40%)", marginTop: 6, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>
              Change: {((scores[0] - scores[scores.length - 1]) * 100).toFixed(1)}% improvement
            </div>
          </div>
        );
      })()}

      {/* AI Causal Drivers - moved from right panel */}
      <div>
        <SectionLabel>🧠 AI Causal Drivers</SectionLabel>
        {selected.drivers.map(d => {
          const districtVal = d.factor === "Female Literacy" && selected.female_literacy != null
            ? `${selected.female_literacy}%`
            : d.factor === "WASH (Sanitation)" && selected.sanitation != null
            ? `${selected.sanitation}%`
            : null;
          return (
            <div key={d.factor} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: "hsl(210,20%,72%)", fontWeight: 500 }}>
                  {d.factor}
                  {districtVal && <span style={{ color: "hsl(215,18%,45%)", fontSize: 9, marginLeft: 6, fontFamily: "'JetBrains Mono', monospace" }}>({districtVal})</span>}
                </span>
                <span style={{ color: "hsl(25,95%,55%)", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{d.contribution}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 4, background: "hsl(220,15%,14%)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${d.contribution}%`, background: "linear-gradient(90deg, hsla(25,95%,55%,0.5), hsl(25,95%,55%))", borderRadius: 4, transition: "width 0.8s ease" }} />
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 10, color: "hsl(215,12%,38%)", padding: "8px 10px", background: "hsla(25,95%,55%,0.04)", borderRadius: 8, borderLeft: "3px solid hsla(25,95%,55%,0.3)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
          Source: NFHS-5 · Census 2011 · NITI Aayog DNP 2022
        </div>
      </div>

      {/* Collapsible Top 10 */}
      <TopDistrictsDropdown
        stateDistricts={stateDistricts}
        selected={selected}
        stateName={selected.state}
        mapRef={mapRef}
        isMobile={isMobile}
        setMobilePanel={setMobilePanel}
      />
      <ScrollHint targetRef={leftPanelRef} side="right" />
      </div>
    </div>
  );

  // ---- RIGHT PANEL ----
  const renderRightPanel = () => (
    <div ref={rightPanelRef} className="glass-panel" style={{
      width: isMobile ? "100%" : isTablet ? 290 : 340, flexShrink: 0,
      zIndex: 10, position: "relative",
      borderLeft: isMobile ? "none" : "1px solid hsl(220,15%,14%)",
      overflowY: "auto", padding: isMobile ? "14px" : "18px 16px",
      display: "flex", flexDirection: "column", gap: 16,
      ...(isMobile ? { height: "100%" } : { minHeight: 0 }),
    }}>
      {/* District header */}
      <div style={{
        background: `linear-gradient(135deg, ${riskBg(selected.risk)}, transparent)`,
        border: `1px solid ${riskColor(selected.risk)}20`,
        borderRadius: 14, padding: isMobile ? "16px 14px 14px" : "24px 20px 18px",
        position: "relative", overflow: "visible",
      }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: `radial-gradient(circle at top right, ${riskColor(selected.risk)}10, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: "hsl(210,25%,96%)", letterSpacing: "-0.01em", lineHeight: 1.25, wordBreak: "break-word" }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: "hsl(215,18%,50%)", marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>{selected.state} · District</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, paddingTop: 2 }}>
            <div style={{ fontSize: isMobile ? 28 : 34, fontWeight: 800, color: riskColor(selected.risk), lineHeight: 1.1, letterSpacing: "-0.01em" }}>{(selected.risk * 100).toFixed(0)}</div>
            <div style={{ fontSize: 9, color: riskColor(selected.risk), letterSpacing: "0.15em", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>{riskLabel(selected.risk)}</div>
          </div>
        </div>
        <div style={{ height: 4, borderRadius: 4, background: "hsla(220,15%,20%,0.5)", marginTop: 14 }}>
          <div style={{ height: "100%", width: `${selected.risk * 100}%`, background: `linear-gradient(90deg, ${riskColor(selected.risk)}60, ${riskColor(selected.risk)})`, borderRadius: 4, transition: "width 0.6s ease", boxShadow: `0 0 12px ${riskColor(selected.risk)}30` }} />
        </div>
      </div>

      {/* Nutrition Indicators */}
      <div>
        <SectionLabel>Nutrition Indicators · NFHS-5</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8 }}>
          {[
            { label: "Stunting", val: selected.stunting, color: "#ef4444" },
            { label: "Wasting", val: selected.wasting, color: "#f97316" },
            { label: "Underweight", val: selected.underweight, color: "#eab308" },
            { label: "Anaemia (C)", val: selected.anemia_children, color: "#f87171" },
            { label: "Anaemia (W)", val: selected.anemia_women, color: "#fbbf24" },
            { label: "Breastfeed", val: selected.breastfeeding, color: "#22c55e" },
            { label: "Immunization", val: selected.immunization, color: "#38bdf8" },
            ...(selected.female_literacy != null ? [{ label: "Fem. Literacy", val: selected.female_literacy, color: "#a78bfa" }] : []),
            ...(selected.sanitation != null ? [{ label: "Sanitation", val: selected.sanitation, color: "#2dd4bf" }] : []),
          ].map(i => (
            <div key={i.label} className="glass-card" style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: "hsl(215,18%,48%)", fontWeight: 500, marginBottom: 2 }}>{i.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: i.color, letterSpacing: "-0.02em", fontFamily: "'JetBrains Mono', monospace" }}>
                {i.val}<span style={{ fontSize: 11, fontWeight: 500 }}>%</span>
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* AI Interventions */}
      <div>
        <SectionLabel>
          💡 AI-Powered Interventions
          {aiLoading && <span style={{ color: "hsl(25,95%,55%)", fontSize: 9, animation: "pulse 1s infinite", marginLeft: 8 }}>● ANALYZING...</span>}
        </SectionLabel>
        {aiLoading && (
          <div className="glass-card" style={{ padding: "18px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "hsl(215,18%,55%)", marginBottom: 10 }}>🔬 AI is researching {selected.name}, {selected.state}...</div>
            <div style={{ height: 3, background: "hsl(220,15%,14%)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg, hsl(25,95%,55%), hsl(35,90%,65%))", borderRadius: 4, animation: "scan 2s linear infinite" }} />
            </div>
          </div>
        )}
        {aiError && (
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "hsla(0,72%,55%,0.06)", border: "1px solid hsla(0,72%,55%,0.15)", fontSize: 11, color: "#ef4444" }}>
            {aiError}
            <div style={{ fontSize: 9, color: "hsl(215,12%,40%)", marginTop: 4 }}>Showing fallback recommendations</div>
          </div>
        )}
        {aiAnalysis?.district_context && (
          <div className="glass-card" style={{ padding: "12px 14px", borderLeft: "3px solid hsla(25,95%,55%,0.3)" }}>
            <div style={{ color: "hsl(25,95%,60%)", fontWeight: 700, marginBottom: 5, fontSize: 9, letterSpacing: "0.15em", fontFamily: "'JetBrains Mono', monospace" }}>DISTRICT CONTEXT</div>
            <div style={{ fontSize: 10, color: "hsl(210,20%,72%)", marginBottom: 3 }}>{aiAnalysis.district_context.geography}</div>
            <div style={{ fontSize: 10, color: "hsl(210,20%,72%)", marginBottom: 3 }}>{aiAnalysis.district_context.population_profile}</div>
            {aiAnalysis.district_context.key_challenges?.slice(0, 2).map((c: string, i: number) => (
              <div key={i} style={{ color: "hsl(215,12%,45%)", fontSize: 9 }}>⚠ {c}</div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          {(aiAnalysis?.interventions || selected.interventions).map((inv: any, i: number) => {
            const isAi = typeof inv === "object" && inv.name;
            const name = isAi ? inv.name : inv;
            const desc = isAi ? inv.description : null;
            const priority = isAi ? inv.priority : null;
            const impact = isAi ? inv.expected_impact : null;
            const priorityColor = priority === "critical" ? "#ef4444" : priority === "high" ? "#f97316" : "#22c55e";
            return (
              <div key={i} className="glass-card" style={{ padding: "10px 12px", borderLeft: `3px solid ${isAi ? "hsla(25,95%,55%,0.3)" : "hsla(155,55%,48%,0.3)"}` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: isAi ? "hsl(25,95%,55%)" : "#22c55e", flexShrink: 0, marginTop: 1, fontSize: 12 }}>{isAi ? "🤖" : "→"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, color: "hsl(210,25%,90%)", fontSize: 11 }}>{name}</span>
                      {priority && <span style={{ fontSize: 8, color: priorityColor, padding: "2px 7px", borderRadius: 6, border: `1px solid ${priorityColor}30`, background: `${priorityColor}10`, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{priority}</span>}
                    </div>
                    {desc && <div style={{ fontSize: 10, color: "hsl(215,18%,50%)", marginTop: 4 }}>{desc}</div>}
                    {impact && <div style={{ fontSize: 9, color: "#22c55e", marginTop: 4, fontWeight: 500 }}>📈 {impact}</div>}
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setPdfLoading(name);
                      trackEvent("pdf_intervention_requested", { intervention: name, district: selected.name, state: selected.state, ai_enhanced: !!isAi });
                      const t0 = performance.now();
                      try {
                        await generateAiEnhancedInterventionPdf(name, { ...selected, aiAnalysis: isAi ? inv : null, districtContext: aiAnalysis?.district_context, fiveYearProjection: aiAnalysis?.five_year_projection });
                        trackEvent("pdf_intervention_success", { intervention: name, district: selected.name, state: selected.state, duration_ms: Math.round(performance.now() - t0) });
                      } catch (err: any) {
                        trackEvent("pdf_intervention_failed", { intervention: name, district: selected.name, error: err?.message?.slice(0, 120) });
                        throw err;
                      } finally { setPdfLoading(null); }
                    }}
                    disabled={pdfLoading === name}
                    style={{
                      flexShrink: 0, padding: "5px 10px", borderRadius: 7,
                      border: "1px solid hsla(155,55%,48%,0.25)",
                      background: pdfLoading === name ? "hsla(155,55%,48%,0.18)" : "hsla(155,55%,48%,0.08)",
                      color: "#22c55e", fontSize: 9, cursor: pdfLoading === name ? "wait" : "pointer",
                      fontWeight: 700, transition: "all 0.2s",
                      fontFamily: "'JetBrains Mono', monospace",
                      opacity: pdfLoading === name ? 0.7 : 1,
                    }}
                    onMouseEnter={e => { if (pdfLoading !== name) (e.target as HTMLElement).style.background = "hsla(155,55%,48%,0.18)"; }}
                    onMouseLeave={e => { if (pdfLoading !== name) (e.target as HTMLElement).style.background = "hsla(155,55%,48%,0.08)"; }}
                  >
                    {pdfLoading === name ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, border: "2px solid #22c55e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> AI...
                      </span>
                    ) : "↓ PDF"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {(aiAnalysis?.interventions?.length > 0 || selected.interventions?.length > 0) && (
          <button
            onClick={async () => {
              setPdfLoading("full");
              trackEvent("pdf_full_report_requested", { district: selected.name, state: selected.state, ai_enhanced: !!aiAnalysis });
              const t0 = performance.now();
              try {
                await generateAiEnhancedFullReport({ ...selected, aiAnalysis, districtContext: aiAnalysis?.district_context, fiveYearProjection: aiAnalysis?.five_year_projection });
                trackEvent("pdf_full_report_success", { district: selected.name, state: selected.state, duration_ms: Math.round(performance.now() - t0) });
              } catch (err: any) {
                trackEvent("pdf_full_report_failed", { district: selected.name, error: err?.message?.slice(0, 120) });
                throw err;
              } finally { setPdfLoading(null); }
            }}
            disabled={aiLoading || pdfLoading === "full"}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12,
              border: "1px solid hsla(25,95%,55%,0.3)",
              background: pdfLoading === "full"
                ? "linear-gradient(135deg, hsla(25,95%,55%,0.2), hsla(35,90%,65%,0.12))"
                : "linear-gradient(135deg, hsla(25,95%,55%,0.1), hsla(35,90%,65%,0.06))",
              color: "hsl(25,95%,60%)", fontSize: 12, fontWeight: 700,
              cursor: aiLoading || pdfLoading === "full" ? "not-allowed" : "pointer",
              letterSpacing: "0.04em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginTop: 8, transition: "all 0.2s",
              opacity: aiLoading || pdfLoading === "full" ? 0.7 : 1,
              boxShadow: "0 4px 16px hsla(25,95%,55%,0.1)",
            }}
          >
            {pdfLoading === "full" ? (
              <>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid hsl(25,95%,60%)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                🤖 AI Generating Report...
              </>
            ) : "📄 Download Full Report"}
          </button>
        )}
      </div>

      <ScrollHint targetRef={rightPanelRef} side="left" />
    </div>
  );

  // ---- MAP AREA ----
  const renderMapArea = () => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: isMobile ? "50vh" : undefined }}>
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "hsl(225,25%,5%)" }}>
        <IndiaMap
          ref={mapRef}
          activeLayer={activeLayer}
          onStateHover={handleStateHover}
          onStateClick={handleStateClick}
          onDistrictClick={handleDistrictClick}
          hoveredStateName={hoveredState?.name}
          selectedStateName={selected?.state}
        />
        {renderLayerButtons()}
        <div style={{ position: "absolute", top: 46, left: 14, zIndex: 20, width: isMobile ? "calc(100% - 28px)" : 280 }}>
          <DistrictSearch onSelect={handleDistrictSearch} />
        </div>
        {!isMobile && tooltip && (
          <div style={{
            position: "absolute",
            left: tooltip.x + 16, top: tooltip.y + 16,
            background: "hsla(225,24%,8%,0.96)",
            border: `1px solid ${riskColor(tooltip.risk)}40`,
            borderRadius: 12, padding: "12px 16px",
            pointerEvents: "none", zIndex: 50,
            backdropFilter: "blur(20px)",
            boxShadow: `0 8px 32px ${riskColor(tooltip.risk)}20, 0 0 0 1px hsla(220,15%,20%,0.3)`,
            minWidth: 170, maxWidth: 240,
          }}>
            <div style={{ fontSize: 13, color: "hsl(210,25%,96%)", fontWeight: 700, marginBottom: 8 }}>{tooltip.name}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "hsl(215,18%,50%)", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>RISK SCORE</span>
              <span style={{ fontSize: 12, color: riskColor(tooltip.risk), fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{(tooltip.risk * 100).toFixed(0)}</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: "hsla(220,15%,20%,0.5)" }}>
              <div style={{ height: "100%", width: `${tooltip.risk * 100}%`, background: `linear-gradient(90deg, ${riskColor(tooltip.risk)}40, ${riskColor(tooltip.risk)})`, borderRadius: 99 }} />
            </div>
            <div style={{ fontSize: 9, color: "hsl(215,12%,38%)", marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>Click to view NFHS data</div>
          </div>
        )}
      </div>
    </div>
  );

  // ---- MOBILE LAYOUT ----
  if (isMobile) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", background: t.bg, height: "100dvh", color: t.text2, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        
        {/* Map always visible behind everything on mobile */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {mobilePanel === "map" && renderMapArea()}
          {mobilePanel === "districts" && (
            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
              {renderLeftSidebar()}
            </div>
          )}
          {mobilePanel === "details" && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", WebkitOverflowScrolling: "touch" }}>
              {renderRightPanel()}
            </div>
          )}
        </div>

        {/* Floating district card on map view */}
        {mobilePanel === "map" && (
          <div
            onClick={() => setMobilePanel("details")}
            style={{
              position: "absolute", bottom: 52, left: 8, right: 8, zIndex: 30,
              background: `linear-gradient(135deg, ${riskBg(selected.risk)}, hsla(225,22%,10%,0.97))`,
              border: `1px solid ${riskColor(selected.risk)}25`,
              borderRadius: 14, padding: "10px 14px", cursor: "pointer",
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(210,25%,96%)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</div>
                <div style={{ fontSize: 9, color: "hsl(215,18%,50%)", marginTop: 2 }}>{selected.state} · Tap for details</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: riskColor(selected.risk), fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, marginLeft: 12 }}>{(selected.risk * 100).toFixed(0)}</div>
            </div>
          </div>
        )}

        {/* Bottom tabs */}
        <div style={{ display: "flex", borderTop: `1px solid ${t.panelBorder}`, background: t.footerBg, zIndex: 40, flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {[
            { key: "map" as const, icon: "🗺️", label: "Map" },
            { key: "districts" as const, icon: "📊", label: "Districts" },
            { key: "details" as const, icon: "📋", label: "Details" },
          ].map(tab => (
            <button key={tab.key} onClick={() => { trackEvent("mobile_tab_switch", { tab: tab.key }); setMobilePanel(tab.key); }} style={{
              flex: 1, padding: "8px 0 6px", border: "none", cursor: "pointer",
              background: mobilePanel === tab.key ? "hsla(25,95%,55%,0.08)" : "transparent",
              color: mobilePanel === tab.key ? "hsl(25,95%,60%)" : "hsl(215,18%,45%)",
              fontSize: 10, fontWeight: mobilePanel === tab.key ? 700 : 400,
              borderTop: mobilePanel === tab.key ? "2px solid hsl(25,95%,55%)" : "2px solid transparent",
              fontFamily: "'Inter', sans-serif",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            }}>
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- DESKTOP / TABLET LAYOUT ----
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: t.bg, height: "100vh", color: t.text2, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {renderLeftSidebar()}
        {renderMapArea()}
        {renderRightPanel()}
      </div>
      <div style={{ borderTop: `1px solid ${t.panelBorder}`, padding: "7px 24px", background: t.footerBg, fontSize: 9, color: t.textMuted, display: "flex", gap: 20, flexWrap: "wrap", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
        <span>Data: NFHS-5 (2019-21) · rchiips.org/nfhs</span>
        <span>Census 2011 · censusindia.gov.in</span>
        <span>NITI Aayog District Nutrition Profile · niti.gov.in</span>
        <span>Risk = 0.4×Stunting + 0.3×Wasting + 0.3×Underweight</span>
      </div>
    </div>
  );
}
