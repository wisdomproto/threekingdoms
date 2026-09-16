"use client";
import type { CSSProperties } from "react";
import type { SortieSummary } from "../sortieSummary";

export interface SortieBarProps {
  summary: SortieSummary;
  maxSlots: number;
  onSortie: () => void;
  onClearAll: () => void;
  onAutoDeploy: () => void;
}
const button: CSSProperties = { minHeight: 44, padding: "8px 14px", border: "1px solid #957c42", borderRadius: 6, background: "#40341a", color: "#f0dba1", fontSize: 14, cursor: "pointer" };
export function SortieBar({ summary, maxSlots, onSortie, onClearAll, onAutoDeploy }: SortieBarProps) {
  return <section aria-label="출진 편성 현황" style={{ background: "#251d10", border: "1px solid #8e743a", borderRadius: 8, padding: 10, color: "#eee0b6", fontFamily: "system-ui" }}>
    <style>{`.prep-sortie-actions { display:grid; grid-template-columns:1fr auto auto minmax(120px,180px); align-items:center; gap:8px; } @media(max-width:1100px) { .prep-sortie-actions { grid-template-columns:repeat(3,minmax(0,1fr)); } .prep-sortie-actions > span { grid-column:1 / -1; } .prep-sortie-actions > button { padding:8px 4px !important; font-size:14px !important; } }`}</style>
    <div className="prep-sortie-actions">
      <span aria-live="polite" style={{ fontSize: 13, flex: "1 1 160px", color: "#c4b387" }}><strong style={{ color: "#eee0b6", marginRight: 12 }}>출진 {summary.count}/{maxSlots}</strong>총전력 {summary.totalPower}{summary.warnings.length > 0 ? ` · ${summary.warnings.join(" · ")}` : ""}</span>
      <button style={button} onClick={onClearAll} disabled={!summary.count}>전체취소</button>
      <button style={button} title="전투 기본 장수를 우선하고 남은 자리를 합류 장수로 채웁니다" onClick={onAutoDeploy}>자동 배치</button>
      <button style={{ ...button, color: summary.count ? "#fff0bc" : "#ad9b72", flexGrow: 1, minHeight: 48, fontSize: 17, fontWeight: 800, background: summary.count ? "#922d21" : "#4c4128", opacity: summary.count ? 1 : 0.6 }} onClick={onSortie} disabled={!summary.count}>{summary.count ? `${summary.count}명 출진` : "출진"}</button>
    </div>
  </section>;
}
