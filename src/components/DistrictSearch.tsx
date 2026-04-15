import { useState, useRef, useEffect, useMemo } from "react";
import nfhsData from "@/data/nfhsDistrictData.json";

interface DistrictSearchProps {
  onSelect: (district: string, state: string) => void;
}

const allDistricts = Object.entries(
  nfhsData as Record<string, { district: string; state: string }>
).map(([key, val]) => ({
  key,
  district: val.district,
  state: val.state,
  label: `${val.district}, ${val.state}`,
}));

export default function DistrictSearch({ onSelect }: DistrictSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allDistricts
      .filter(d => d.district.toLowerCase().includes(q) || d.state.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{
        display: "flex", alignItems: "center",
        background: "hsla(225,22%,10%,0.9)",
        border: "1px solid hsla(220,15%,20%,0.6)",
        borderRadius: 10, padding: "0 12px", gap: 8,
        backdropFilter: "blur(16px)",
        boxShadow: "0 4px 16px hsla(0,0%,0%,0.3)",
        transition: "border-color 0.2s",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(215,18%,45%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
          placeholder="Search 707 districts…"
          style={{
            background: "transparent", border: "none", outline: "none",
            color: "hsl(210,25%,92%)", fontSize: 12, padding: "9px 0", width: "100%",
            fontFamily: "'Inter', sans-serif", fontWeight: 400,
          }}
        />
        {query && (
          <span
            onClick={() => { setQuery(""); setOpen(false); }}
            style={{ cursor: "pointer", fontSize: 12, color: "hsl(215,18%,45%)", fontWeight: 500, padding: "2px 4px", borderRadius: 4, transition: "all 0.15s" }}
          >✕</span>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
          background: "hsla(225,22%,9%,0.98)", border: "1px solid hsla(220,15%,20%,0.6)",
          borderRadius: 12, maxHeight: 260, overflowY: "auto",
          boxShadow: "0 12px 40px hsla(0,0%,0%,0.5)",
          backdropFilter: "blur(20px)",
        }}>
          {results.map((r, i) => (
            <div
              key={r.key}
              onClick={() => { onSelect(r.district, r.state); setQuery(r.label); setOpen(false); }}
              style={{
                padding: "10px 14px", cursor: "pointer", fontSize: 12,
                borderBottom: i < results.length - 1 ? "1px solid hsla(220,15%,16%,0.5)" : "none",
                transition: "background 0.15s",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "hsla(25,95%,55%,0.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: "hsl(210,25%,92%)", fontWeight: 500 }}>{r.district}</span>
              <span style={{ color: "hsl(215,18%,45%)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>{r.state}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
