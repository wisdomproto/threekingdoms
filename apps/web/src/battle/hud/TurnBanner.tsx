"use client";
/**
 * TurnBanner (설계 §2.3) — 상단 턴/페이즈 표시 + 턴 종료 버튼.
 * 턴 종료 버튼은 idle(아군 페이즈, 진행 중)에만 노출하며 하단 우측 엄지 존에 둔다 —
 * ActionMenu(하단 중앙)와 동시에 보이는 상태가 없으므로 충돌 없음.
 */
import type { InputState, UiEvent } from "../inputMachine";
import type { BattleVM } from "../viewmodel";

const BAR_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "calc(10px + env(safe-area-inset-top)) 14px 10px", // 노치 기기 상단 안전 영역
  color: "#e8e6e3",
  fontSize: 15,
  background: "linear-gradient(rgba(10, 12, 15, 0.75), rgba(10, 12, 15, 0))",
  pointerEvents: "none",
  userSelect: "none",
};

const END_TURN_STYLE: React.CSSProperties = {
  position: "absolute",
  right: 12,
  bottom: "calc(12px + env(safe-area-inset-bottom))",
  minHeight: 56,
  minWidth: 104,
  padding: "0 18px",
  borderRadius: 14,
  border: "1px solid #3a414a",
  background: "rgba(24, 28, 33, 0.92)",
  color: "#e8e6e3",
  fontSize: 17,
  fontWeight: 600,
  cursor: "pointer",
  touchAction: "manipulation",
};

function phaseLabel(ui: InputState, vm: BattleVM): string {
  if (ui.kind === "enemyTurn") return "적군 페이즈 진행 중…";
  if (ui.kind === "autoTurn") return "자동전투 진행 중…";
  if (ui.kind === "animating") return "…";
  return vm.turn.phase === "player" ? "아군 페이즈" : "적군 페이즈";
}

export function TurnBanner({
  ui,
  vm,
  dispatch,
}: {
  ui: InputState;
  vm: BattleVM;
  dispatch: (e: UiEvent) => void;
}): React.ReactElement {
  const canEndTurn =
    ui.kind === "idle" && vm.turn.phase === "player" && vm.status === "ongoing";
  return (
    <>
      <div style={BAR_STYLE}>
        <strong>
          {vm.turn.turn}턴 <span style={{ color: "#9aa3ad" }}>/ {vm.turn.turnLimit}</span>
        </strong>
        <span style={{ color: vm.turn.phase === "player" ? "#4da3ff" : "#ff6b6b" }}>
          {phaseLabel(ui, vm)}
        </span>
      </div>
      {canEndTurn && (
        <button
          type="button"
          style={END_TURN_STYLE}
          onClick={() => dispatch({ type: "endTurnPressed" })}
        >
          턴 종료
        </button>
      )}
    </>
  );
}
