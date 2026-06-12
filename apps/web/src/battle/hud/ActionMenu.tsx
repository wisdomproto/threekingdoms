"use client";
/**
 * ActionMenu (설계 §2.3, §5) — postMoveMenu의 공격/대기/취소 메뉴.
 * 버튼 56px, 하단 엄지 존 배치 (안 2 흡수: 정량 오탭 방지 규칙).
 * targetSelect에서는 취소 버튼만 노출 — 기계상 무효 타일 탭이 noop이므로
 * 모바일에서 취소 버튼 없이는 targetSelect를 빠져나갈 수 없다.
 */
import type { InputState, UiEvent } from "../inputMachine";

const ZONE_STYLE: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: "calc(12px + env(safe-area-inset-bottom))",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
  pointerEvents: "none",
};

const BUTTON_STYLE: React.CSSProperties = {
  minHeight: 56, // 엄지 존 최소 터치 크기 (설계 §2.3)
  minWidth: 92,
  padding: "0 20px",
  borderRadius: 14,
  border: "1px solid #3a414a",
  background: "rgba(24, 28, 33, 0.92)",
  color: "#e8e6e3",
  fontSize: 17,
  fontWeight: 600,
  pointerEvents: "auto",
  cursor: "pointer",
  touchAction: "manipulation",
};

function Btn({
  label,
  onPress,
  disabled,
  accent,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accent?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled ?? false}
      style={{
        ...BUTTON_STYLE,
        ...(accent ? { borderColor: accent, color: accent } : {}),
        ...(disabled ? { opacity: 0.4, cursor: "default" } : {}),
      }}
    >
      {label}
    </button>
  );
}

export function ActionMenu({
  ui,
  dispatch,
  previewWalking = false,
}: {
  ui: InputState;
  dispatch: (e: UiEvent) => void;
  /** 프리뷰 워크 진행 중 — true면 메뉴 숨김 (워크 완료 후 표시, 원작 UX §수정명세-1) */
  previewWalking?: boolean;
}): React.ReactElement | null {
  // 프리뷰 워크 중에는 메뉴를 숨긴다 — 유닛이 목적지에 도착한 뒤 표시
  if (previewWalking) return null;

  if (ui.kind === "postMoveMenu") {
    return (
      <div style={ZONE_STYLE}>
        <Btn
          label="공격"
          accent="#ff6b6b"
          disabled={ui.attackable.length === 0}
          onPress={() => dispatch({ type: "menuAttack" })}
        />
        <Btn label="대기" accent="#4da3ff" onPress={() => dispatch({ type: "menuWait" })} />
        <Btn label="취소" onPress={() => dispatch({ type: "menuCancel" })} />
      </div>
    );
  }
  if (ui.kind === "targetSelect") {
    return (
      <div style={ZONE_STYLE}>
        <span
          style={{
            color: "#ffb4b4",
            fontSize: 14,
            background: "rgba(24, 28, 33, 0.8)",
            padding: "8px 12px",
            borderRadius: 10,
          }}
        >
          공격 대상을 선택하세요
        </span>
        <Btn label="취소" onPress={() => dispatch({ type: "cancel" })} />
      </div>
    );
  }
  return null;
}
