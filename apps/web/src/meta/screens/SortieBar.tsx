"use client";
import type { SortieSummary } from "../sortieSummary";
import { BUTTON_FRAME } from "../../battle/hud/frames";

const C = {
  bar: "rgba(12, 11, 8, 0.92)",
  text: "#e8e6e3",
  muted: "#9aa3ad",
  bronze: "#caa86a",
  warn: "#e86a4a",
};

export interface SortieBarProps {
  summary: SortieSummary;
  maxSlots: number;
  onSortie: () => void;
}

export function SortieBar({ summary, maxSlots, onSortie }: SortieBarProps): React.ReactElement {
  const { count, totalPower, warnings, emptyDefault } = summary;

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        background: C.bar,
        borderTop: "1px solid #2a2f36",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        zIndex: 20,
        flexWrap: "wrap",
      }}
    >
      {/* 편성 요약 */}
      <span style={{ fontSize: 13, color: C.muted, flex: "0 0 auto" }}>
        출전{" "}
        <strong style={{ color: C.bronze }}>
          {emptyDefault ? "기본" : `${count}/${maxSlots}`}
        </strong>
        {!emptyDefault && totalPower > 0 && (
          <span style={{ color: C.muted, marginLeft: 8 }}>
            총전력 <strong style={{ color: C.text }}>{totalPower}</strong>
          </span>
        )}
      </span>

      {/* 경고 */}
      {warnings.length > 0 && (
        <span style={{ fontSize: 12, color: C.warn, flex: "1 1 auto" }}>
          ⚠ {warnings.join(" · ")}
        </span>
      )}

      {/* 출진 버튼 — 항상 활성(sortie.ts 계약: 빈 편성=stage 기본값) */}
      <button
        type="button"
        onClick={onSortie}
        style={{
          ...BUTTON_FRAME,
          borderWidth: "10px 14px",
          padding: "6px 20px",
          fontSize: 15,
          fontWeight: 700,
          color: C.bronze,
          background: "rgba(202, 168, 106, 0.12)",
          cursor: "pointer",
          marginLeft: "auto",
          flexShrink: 0,
        }}
      >
        출진 ▶
      </button>
    </div>
  );
}
