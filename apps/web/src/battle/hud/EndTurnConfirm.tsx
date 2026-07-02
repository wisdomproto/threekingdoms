"use client";
/**
 * EndTurnConfirm (레퍼런스 §11 "전부대 명령 끝냅니까? 예/아니오") —
 * 미행동 부대가 남은 채 [턴 종료]를 누르면 뜨는 확인 모달. 오조작으로 부대를
 * 통째로 대기시키는 사고를 막는다. 문구는 원작 베끼지 않은 독자 표현.
 *
 * 입력 상태기계의 confirmEndTurn 상태에서만 렌더. 예→endTurnConfirm(일괄 대기 커밋),
 * 아니오→cancel(아군 페이즈 복귀). 엔진/스토어 불변 — ui 상태만 본다.
 */
import type { InputState, UiEvent } from "../inputMachine";
import { HUD_FONT } from "./frames";

const OVERLAY_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(6, 7, 9, 0.5)",
  pointerEvents: "auto",
  userSelect: "none",
  zIndex: 20,
};

const CARD_STYLE: React.CSSProperties = {
  minWidth: 240,
  maxWidth: "82vw",
  padding: "18px 20px 16px",
  borderRadius: 10,
  border: "1.5px solid #6f5a34",
  background: "rgba(18, 15, 11, 0.98)",
  boxShadow: "0 8px 28px rgba(0, 0, 0, 0.6)",
  color: "#ece8e0",
  textAlign: "center",
  fontFamily: HUD_FONT, // HUD 크롬 서체 통일(P0)
};

const BTN_BASE: React.CSSProperties = {
  minWidth: 92,
  minHeight: 48,
  padding: "0 18px",
  borderRadius: 8,
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  touchAction: "manipulation",
};

export function EndTurnConfirm({
  ui,
  dispatch,
}: {
  ui: InputState;
  dispatch: (e: UiEvent) => void;
}): React.ReactElement | null {
  if (ui.kind !== "confirmEndTurn") return null;
  return (
    <div style={OVERLAY_STYLE} onClick={() => dispatch({ type: "cancel" })}>
      <div style={CARD_STYLE} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, lineHeight: 1.55, marginBottom: 16 }}>
          아직 명령하지 않은 부대가 <strong style={{ color: "#e8c84a" }}>{ui.remaining}기</strong> 있습니다.
          <br />
          이대로 이번 턴을 마칩니까?
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            type="button"
            style={{ ...BTN_BASE, border: "1px solid #55462a", background: "rgba(40, 34, 24, 0.9)", color: "#d8ccb2" }}
            onClick={() => dispatch({ type: "cancel" })}
          >
            아니오
          </button>
          <button
            type="button"
            style={{ ...BTN_BASE, border: "1px solid #8a6f3a", background: "#6f5a34", color: "#fdf6e6" }}
            onClick={() => dispatch({ type: "endTurnConfirm" })}
          >
            예
          </button>
        </div>
      </div>
    </div>
  );
}
