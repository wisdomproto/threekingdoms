"use client";
/**
 * BattleControls (feel-spec §A 카메라 + 자동전투) — 우상단 보조 컨트롤.
 * - 기본 줌 복귀: 수동 줌/팬 후 스테이지 기본 카메라(줌·포커스)로 되돌린다.
 * - 자동전투: 아군 페이즈를 그리디 AI가 대신 진행 (토글). ON이면 강조 표시.
 * TurnBanner(상단 바)·ActionMenu/턴종료(하단)와 겹치지 않게 우상단 세로 스택에 둔다.
 */
const STACK_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "calc(52px + env(safe-area-inset-top))",
  right: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  pointerEvents: "none",
  userSelect: "none",
};

const BTN_STYLE: React.CSSProperties = {
  minHeight: 40,
  minWidth: 96,
  padding: "0 14px",
  borderRadius: 12,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#3a414a",
  background: "rgba(24, 28, 33, 0.92)",
  color: "#e8e6e3",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  pointerEvents: "auto",
  touchAction: "manipulation",
};

export function BattleControls({
  auto,
  onToggleAuto,
  onResetCamera,
}: {
  auto: boolean;
  onToggleAuto: () => void;
  onResetCamera: () => void;
}): React.ReactElement {
  const autoStyle: React.CSSProperties = auto
    ? { ...BTN_STYLE, borderColor: "#ffc24b", color: "#ffc24b", background: "rgba(50, 40, 14, 0.92)" }
    : BTN_STYLE;
  return (
    <div style={STACK_STYLE}>
      <button type="button" style={BTN_STYLE} onClick={onResetCamera}>
        ⟲ 기본 줌
      </button>
      <button type="button" style={autoStyle} onClick={onToggleAuto}>
        {auto ? "⏸ 자동전투" : "▶ 자동전투"}
      </button>
    </div>
  );
}
