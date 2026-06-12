"use client";
/**
 * ResultOverlay (설계 §2.3, §5 battleOver) — 종료 화면.
 * battleOver 진입은 드레인 이후이므로(store.onDrained → settled 갱신 → drained 디스패치)
 * 이 시점의 vm.status는 항상 최종 결과와 일치한다 — 연출 종료 전 스포일러 없음.
 */
import type { InputState } from "../inputMachine";
import type { BattleVM } from "../viewmodel";

const OVERLAY_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: 16,
  background: "rgba(8, 10, 13, 0.78)",
  color: "#e8e6e3",
  userSelect: "none",
};

const BUTTON_STYLE: React.CSSProperties = {
  minHeight: 56,
  minWidth: 160,
  padding: "0 24px",
  borderRadius: 14,
  border: "1px solid #3a414a",
  background: "rgba(24, 28, 33, 0.95)",
  color: "#e8e6e3",
  fontSize: 17,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
};

export function ResultOverlay({
  ui,
  vm,
}: {
  ui: InputState;
  vm: BattleVM;
}): React.ReactElement | null {
  if (ui.kind !== "battleOver") return null;
  const victory = ui.result === "victory";
  return (
    <div style={OVERLAY_STYLE}>
      <h1 style={{ fontSize: 44, margin: 0, color: victory ? "#ffd76a" : "#ff6b6b" }}>
        {victory ? "승리" : "패배"}
      </h1>
      <p style={{ margin: 0, color: "#9aa3ad" }}>
        {vm.turn.turn}턴 · {vm.turn.turnLimit}턴 제한
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button type="button" style={BUTTON_STYLE} onClick={() => window.location.reload()}>
          다시 도전
        </button>
        <a href="/" style={BUTTON_STYLE}>
          처음으로
        </a>
      </div>
    </div>
  );
}
