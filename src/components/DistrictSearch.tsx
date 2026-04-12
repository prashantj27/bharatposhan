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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", background: "#0d1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0 10px", gap: 6 }}>
        <span style={{ fontSize: 13, opacity: 0.5 }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
          placeholder="Search 594 districts…"
          style={{
            background: "transparent", border: "none", outline: "none",
            color: "#e0e8f0", fontSize: 11, padding: "7px 0", width: "100%",
            fontFamily: "'DM Mono', monospace",
          }}
        />
        {query && (
          <span
            onClick={() => { setQuery(""); setOpen(false); }}
            style={{ cursor: "pointer", fontSize: 11, color: "#6b7fa3" }}
          >✕</span>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "#0d1628", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6, marginTop: 4, maxHeight: 240, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          {results.map(r => (
            <div
              key={r.key}
              onClick={() => {
                onSelect(r.district, r.state);
                setQuery(r.label);
                setOpen(false);
              }}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: 11,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,107,53,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: "#e0e8f0" }}>{r.district}</span>
              <span style={{ color: "#6b7fa3", marginLeft: 6 }}>{r.state}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
