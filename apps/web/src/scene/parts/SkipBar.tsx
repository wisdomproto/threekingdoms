"use client";
/** 막간 씬 상단 바 — 좌측 타이틀 + 우측 건너뛰기 버튼(클릭 전파 차단). */
import { BRONZE_GOLD, BRONZE_DIM } from "./tokens";

export function SkipBar({
  title,
  onSkip,
}: {
  /** 상단 표시용(스테이지명 등). */
  title?: string;
  onSkip: () => void;
}): React.ReactElement {
  return (
    <div style={{ position: "absolute", top: "calc(12px + env(safe-area-inset-top))", left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px" }}>
      <span style={{ color: BRONZE_DIM, fontSize: 13, letterSpacing: "0.05em", maxWidth: "45%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{title}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSkip(); }}
        style={{ background: "rgba(20,17,14,0.7)", color: BRONZE_GOLD, border: `1px solid ${BRONZE_DIM}`, borderRadius: 4, minHeight: 44, padding: "8px 12px", fontSize: 14, cursor: "pointer" }}
      >
        건너뛰기 ▶▶
      </button>
    </div>
  );
}
