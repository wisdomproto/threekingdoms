"use client";
/**
 * BottomPanel (모바일 전투 HUD, 스펙 2026-09-12 §4) — <768px에서 부유 ActionMenu·절대좌표 턴종료를
 * 대신하는 하단 한 패널. 상태는 순수 `bottomPanelState(ui)`가 정한다(사용자 토글 없음):
 *  - hidden   : battleOver — ResultSequence를 가리지 않게 렌더 생략
 *  - collapsed: [idle inspectedId 유닛 한 줄 → 상세 시트] [턴 종료 52px]
 *  - expanded : 유닛 행(초상·이름·Lv·병력바·SP·[상세]) → AttackForecast → itemsFor 4열 큰 버튼(≥52px)
 * 행동 모델은 ActionMenu.itemsFor 그대로(로직 중복 0). 패널이 자기 높이를 ResizeObserver로 재서
 * `--tk-bottom-inset`(documentElement)에 쓴다 — AudioControl·목표 칩이 그만큼 위로 올라간다(언마운트 시 제거).
 * 상세 시트(#hudSheet) = UnitPanel 그대로 + 닫기. ui.kind가 바뀌면 자동으로 닫힌다.
 */
import { useEffect, useRef, useState } from "react";
import type { BattleContext, BattleState } from "@tk/engine";
import { bottomPanelState } from "../hudLayout";
import type { InputState, UiEvent } from "../inputMachine";
import type { BattleVM, UnitVM } from "../viewmodel";
import { itemsFor, type Item } from "./ActionMenu";
import { AttackForecast } from "./AttackForecast";
import { HUD_BRONZE_DIM, HUD_FONT, HUD_INK, HUD_PARCHMENT } from "./frames";
import { canEndTurn } from "./TurnBanner";
import { PortraitBox, TroopsBar, UnitPanel, activeUnitId, sideColor } from "./UnitPanel";

/** 패널 높이 CSS 변수 — AudioController(bottom calc)·BattleScreen 목표 칩이 읽는다 */
export const BOTTOM_INSET_VAR = "--tk-bottom-inset";
/** 터치 타깃(design-guide §2): 행동 52 / 보조 44 */
const ACTION_H = 52;
const AUX_H = 44;

const ROOT_STYLE: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 6, // 대사창(8)·PauseMenu(80)보다 아래
  boxSizing: "border-box",
  paddingBottom: "env(safe-area-inset-bottom)",
  background: HUD_INK,
  borderTop: `1px solid ${HUD_BRONZE_DIM}`,
  color: HUD_PARCHMENT,
  fontFamily: HUD_FONT,
  pointerEvents: "auto",
  userSelect: "none",
};

const BTN_STYLE: React.CSSProperties = {
  minHeight: ACTION_H,
  padding: "0 4px",
  border: `1px solid ${HUD_BRONZE_DIM}`,
  borderRadius: 6,
  background: "linear-gradient(180deg, rgba(56, 48, 35, 0.98), rgba(34, 29, 20, 0.98))",
  color: "#ece8e0",
  fontSize: 16,
  fontWeight: 700,
  fontFamily: HUD_FONT,
  letterSpacing: "0.04em",
  cursor: "pointer",
  touchAction: "manipulation",
  whiteSpace: "nowrap",
};

const AUX_BTN_STYLE: React.CSSProperties = {
  ...BTN_STYLE,
  minHeight: AUX_H,
  minWidth: AUX_H,
  fontSize: 14,
  padding: "0 12px",
  flexShrink: 0,
};

function ActionBtn({ item }: { item: Item }): React.ReactElement {
  const dim = item.disabled || item.placeholder;
  return (
    <button
      type="button"
      data-testid="bottom-action"
      disabled={dim}
      onClick={dim ? undefined : item.onPress}
      style={{
        ...BTN_STYLE,
        ...(item.accent && !dim ? { color: item.accent } : {}),
        ...(dim ? { opacity: 0.4, cursor: "default" } : {}),
      }}
    >
      {item.label}
    </button>
  );
}

/** 유닛 한 줄(초상·이름·병종/Lv·병력바·SP) + [상세]. collapsed(compact)에서는 초상·SP 생략 */
function UnitRow({ unit, compact, onDetail }: { unit: UnitVM; compact?: boolean; onDetail: () => void }): React.ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
      {!compact && <PortraitBox key={unit.name} name={unit.name} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
          <strong style={{ fontSize: compact ? 14 : 16, color: sideColor(unit.side) }}>{unit.name}</strong>
          <span style={{ fontSize: 12, color: "#9aa3ad", overflow: "hidden", textOverflow: "ellipsis" }}>
            {unit.className} · Lv.{unit.level}
            {unit.acted ? " · 행동 완료" : ""}
          </span>
          {!compact && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: unit.sp >= unit.maxSp ? "#5ad7ff" : "#9aa3ad" }}>
              SP {unit.sp}/{unit.maxSp}
            </span>
          )}
        </div>
        <div style={{ marginTop: -4 }}>
          <TroopsBar unit={unit} />
        </div>
      </div>
      <button type="button" data-testid="bottom-detail" onClick={onDetail} style={AUX_BTN_STYLE}>
        상세
      </button>
    </div>
  );
}

export function BottomPanel({
  ui,
  vm,
  ctx,
  committed,
  dispatch,
  previewWalking = false,
}: {
  ui: InputState;
  vm: BattleVM;
  ctx: BattleContext;
  committed: BattleState;
  dispatch: (e: UiEvent) => void;
  /** 프리뷰 워크 진행 중 — 행동 버튼 숨김(ActionMenu와 같은 규칙) */
  previewWalking?: boolean;
}): React.ReactElement | null {
  const state = bottomPanelState(ui);
  const hidden = state === "hidden";
  const rootRef = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useState(false);

  // 패널 높이 → --tk-bottom-inset (AudioControl·목표 칩이 패널 위로). 언마운트/hidden 시 제거.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const root = document.documentElement;
    const report = (): void => root.style.setProperty(BOTTOM_INSET_VAR, `${el.offsetHeight}px`);
    report();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(report);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty(BOTTOM_INSET_VAR);
    };
  }, [hidden]);
  // 상태 전이 시 상세 시트 자동 닫힘
  useEffect(() => setSheet(false), [ui.kind]);

  if (hidden) return null;
  const id = activeUnitId(ui);
  const unit = id ? (vm.units.find((u) => u.id === id) ?? null) : null;
  const items = state === "expanded" && !previewWalking ? itemsFor(ui, dispatch) : [];

  return (
    <>
      <div id="hudBottom" ref={rootRef} style={ROOT_STYLE}>
        {state === "collapsed" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: AUX_H, padding: "4px 8px" }}>
            {unit ? <UnitRow unit={unit} compact onDetail={() => setSheet(true)} /> : <div style={{ flex: 1 }} />}
            {canEndTurn(ui, vm) && (
              <button
                type="button"
                data-testid="bottom-end-turn"
                onClick={() => dispatch({ type: "endTurnPressed" })}
                style={{ ...BTN_STYLE, minWidth: 96, padding: "0 16px", flexShrink: 0 }}
              >
                턴 종료
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "6px 8px" }}>
            {unit && <UnitRow unit={unit} onDetail={() => setSheet(true)} />}
            <AttackForecast ui={ui} ctx={ctx} committed={committed} dispatch={dispatch} />
            {ui.kind === "selected" ? (
              <div style={{ textAlign: "center", fontSize: 14, color: "#9aa3ad", padding: "8px 0" }}>이동할 칸이나 적을 탭</div>
            ) : items.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, maxHeight: "50vh", overflowY: "auto" }}>
                {items.map((item) => (
                  <ActionBtn key={item.key} item={item} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
      {sheet && unit && (
        <div
          id="hudSheet"
          style={{
            ...ROOT_STYLE,
            zIndex: 7,
            maxHeight: "70vh",
            overflowY: "auto",
            padding: "6px 8px calc(8px + env(safe-area-inset-bottom))",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 13, letterSpacing: "0.2em", color: "#9aa3ad" }}>부대 정보</span>
            <button type="button" data-testid="sheet-close" onClick={() => setSheet(false)} style={AUX_BTN_STYLE}>
              닫기
            </button>
          </div>
          <UnitPanel ui={ui} vm={vm} />
        </div>
      )}
    </>
  );
}
