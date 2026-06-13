"use client";
/**
 * ActionMenu (설계 §2.3, §5) — postMoveMenu의 공격/대기/취소 메뉴.
 * 버튼 56px, 하단 엄지 존 배치 (안 2 흡수: 정량 오탭 방지 규칙).
 * targetSelect에서는 취소 버튼만 노출 — 기계상 무효 타일 탭이 noop이므로
 * 모바일에서 취소 버튼 없이는 targetSelect를 빠져나갈 수 없다.
 */
import { gameData } from "@tk/data";
import type { InputState, UiEvent } from "../inputMachine";
import { BUTTON_FRAME } from "./frames";

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
  minWidth: 88,
  padding: "0 8px",
  // 청동 알약 프레임(border-image) — accent는 텍스트 색으로만 반영
  ...BUTTON_FRAME,
  background: "rgba(20, 17, 12, 0.55)",
  backgroundClip: "padding-box",
  color: "#e8e6e3",
  fontSize: 17,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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
        ...(accent ? { color: accent } : {}), // 프레임은 청동 고정, 강조는 글자색만
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
        {ui.strategies.length > 0 ? (
          <Btn label="계략" accent="#b890ff" onPress={() => dispatch({ type: "menuStrategy" })} />
        ) : null}
        {ui.items.length > 0 ? (
          <Btn label="도구" accent="#7bd88f" onPress={() => dispatch({ type: "menuItem" })} />
        ) : null}
        <Btn label="대기" accent="#4da3ff" onPress={() => dispatch({ type: "menuWait" })} />
        <Btn label="취소" onPress={() => dispatch({ type: "menuCancel" })} />
      </div>
    );
  }
  if (ui.kind === "strategyMenu") {
    return (
      <div style={ZONE_STYLE}>
        {ui.strategies.map((id) => {
          const s = gameData.strategies[id];
          return (
            <Btn
              key={id}
              label={`${s?.name ?? id} (MP${s?.mp ?? "?"})`}
              accent="#b890ff"
              onPress={() => dispatch({ type: "selectStrategy", strategyId: id })}
            />
          );
        })}
        <Btn label="취소" onPress={() => dispatch({ type: "menuCancel" })} />
      </div>
    );
  }
  if (ui.kind === "itemMenu") {
    return (
      <div style={ZONE_STYLE}>
        {ui.items.map((id) => {
          const it = gameData.items[id];
          const isHeal = it?.category === "supplyItem";
          return (
            <Btn
              key={id}
              label={`${it?.name ?? id} (${isHeal ? "+" : ""}${it?.power ?? "?"})`}
              accent={isHeal ? "#7bd88f" : "#ff8a5b"}
              onPress={() => dispatch({ type: "selectItem", itemId: id })}
            />
          );
        })}
        <Btn label="취소" onPress={() => dispatch({ type: "menuCancel" })} />
      </div>
    );
  }
  if (ui.kind === "targetSelect" || ui.kind === "strategyTarget" || ui.kind === "itemTarget") {
    const prompt =
      ui.kind === "targetSelect"
        ? "공격 대상을 선택하세요"
        : ui.kind === "strategyTarget"
          ? "책략 대상 칸을 선택하세요"
          : ui.itemKind === "supplyItem"
            ? "회복할 아군을 선택하세요"
            : "공격할 적을 선택하세요";
    const color =
      ui.kind === "targetSelect"
        ? "#ffb4b4"
        : ui.kind === "strategyTarget"
          ? "#d7c0ff"
          : ui.itemKind === "supplyItem"
            ? "#b9f0c6"
            : "#ffc6a8";
    return (
      <div style={ZONE_STYLE}>
        <span
          style={{
            color,
            fontSize: 14,
            background: "rgba(24, 28, 33, 0.8)",
            padding: "8px 12px",
            borderRadius: 10,
          }}
        >
          {prompt}
        </span>
        <Btn label="취소" onPress={() => dispatch({ type: "cancel" })} />
      </div>
    );
  }
  return null;
}
