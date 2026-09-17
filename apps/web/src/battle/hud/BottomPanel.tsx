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
import { StrategyIcon } from "./StrategyIcon";
import { assetUrl } from "../../assetUrl";
import type { GameData } from "../../game/data";
import { HUD_BRONZE_DIM, HUD_FONT, HUD_INK, HUD_PARCHMENT } from "./frames";
import { canEndTurn } from "./TurnBanner";
import { PortraitBox, TroopsBar, UnitPanel, activeUnitId, sideColor } from "./UnitPanel";

/** 패널 높이 CSS 변수 — AudioController(bottom calc)가 읽어 컨트롤을 패널 위로 올린다 */
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
  background: "linear-gradient(180deg, rgba(17,22,20,.25), rgba(12,17,16,.72))",
  borderTop: "1px solid rgba(216,190,120,.38)",
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

function ActionBtn({ item, data, mode }: { item: Item; data: GameData; mode: InputState["kind"] }): React.ReactElement {
  const dim = item.disabled || item.placeholder;
  const strategy = mode === "strategyMenu" ? data.strategies[item.key] : undefined;
  const tool = mode === "itemMenu" ? data.items[item.key] : undefined;
  const art: Record<string, string> = { attack: "쌍고검", strategy: "손자의병법서", item: "한방약", assist: "청룡언월도", ultimate: "방천화극" };
  const artName = tool?.name ?? art[item.key];
  return (
    <button
      type="button"
      data-testid="bottom-action"
      disabled={dim}
      aria-label={item.label}
      onClick={dim ? undefined : item.onPress}
      style={{
        ...BTN_STYLE,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        minHeight: 62, fontSize: 12, padding: "3px 2px",
        background: "radial-gradient(ellipse at 50% 32%, rgba(170,133,58,.25), rgba(17,22,20,.15))",
        borderColor: "rgba(214,185,116,.35)",
        textShadow: "0 1px 3px #000",
        ...(item.accent && !dim ? { color: item.accent } : {}),
        ...(dim ? { opacity: 0.58, filter: "saturate(.35)", cursor: "default" } : {}),
      }}
    >
      {strategy ? <StrategyIcon name={strategy.name} category={strategy.category} /> : artName ?
        <img src={assetUrl(`/assets/ui/items/${encodeURIComponent(artName)}.webp`)} alt="" style={{ width: 36, height: 36, objectFit: "contain", filter: "drop-shadow(0 1px 3px #000)" }} /> :
        <svg viewBox="0 0 32 32" aria-hidden="true" width="36" height="36" fill="none" stroke="#e7cf87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="16" cy="16" r="13" strokeOpacity=".5" />
          {item.key === "wait" ? <path d="M11 9v14M21 9v14" /> : <path d="m13 10-6 6 6 6M7 16h13q5 0 5 5" />}
        </svg>}
      <span>{item.label}</span>
    </button>
  );
}

/** 유닛 한 줄(초상·이름·병종/Lv·병력바·SP) + [상세]. collapsed(compact)에서는 초상·SP 생략 */
function UnitRow({ unit, compact, onDetail }: { unit: UnitVM; compact?: boolean; onDetail: () => void }): React.ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
      {!compact && <PortraitBox key={unit.name} name={unit.name} compact />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap", flexWrap: "wrap" }}>
          <strong style={{ fontSize: compact ? 14 : 16, color: sideColor(unit.side) }}>{unit.name}</strong>
          <span style={{ fontSize: 12, color: "#9aa3ad", overflow: "hidden", textOverflow: "ellipsis" }}>
            {unit.className} · Lv.{unit.level}
            {unit.acted ? " · 행동 완료" : ""}
          </span>
        </div>
        {!compact && <div style={{ fontSize: 10, color: unit.sp >= unit.maxSp ? "#5ad7ff" : "#b5c0c3" }}>SP {unit.sp}/{unit.maxSp}</div>}
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
  const id = activeUnitId(ui);
  useEffect(() => setSheet(false), [ui.kind, id]);   // 조회 대상이 바뀌거나 사라져도 시트 상태가 남지 않게

  if (hidden) return null;
  const unit = id ? (vm.units.find((u) => u.id === id) ?? null) : null;
  const items = state === "expanded" && !previewWalking ? itemsFor(ui, dispatch, ctx.data).filter(item => !item.placeholder) : [];

  return (
    <>
      <div id="hudBottom" ref={rootRef} style={state === "collapsed" && !unit ? { ...ROOT_STYLE, background: "transparent", borderTop: "none", pointerEvents: "none" } : ROOT_STYLE}>
        {state === "collapsed" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: AUX_H, padding: "4px 8px" }}>
            {unit ? <UnitRow unit={unit} compact onDetail={() => setSheet(true)} /> : <div style={{ flex: 1 }} />}
            {canEndTurn(ui, vm) && (
              <button
                type="button"
                data-testid="bottom-end-turn"
                onClick={() => dispatch({ type: "endTurnPressed" })}
                style={{ ...BTN_STYLE, pointerEvents: "auto", minWidth: 96, padding: "0 16px", flexShrink: 0 }}
              >
                턴 종료
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, padding: "6px 12px" }}>
            {unit && <div style={{ width: 240, flexShrink: 0 }}><UnitRow unit={unit} onDetail={() => setSheet(true)} /></div>}
            {<div style={{ position: "absolute", right: 12, bottom: "100%", maxHeight: 300, overflowY: "auto" }}><AttackForecast ui={ui} ctx={ctx} committed={committed} dispatch={dispatch} /></div>}
            {ui.kind === "selected" ? (
              <div style={{ textAlign: "center", fontSize: 14, color: "#9aa3ad", padding: "8px 0" }}>이동할 칸이나 적을 탭</div>
            ) : items.length > 0 ? (
              <div style={{ display: "grid", flex: 1, minWidth: 0, gridTemplateColumns: ui.kind === "postMoveMenu" ? `repeat(${items.length}, minmax(0, 1fr))` : "repeat(4, minmax(0, 1fr))", gap: 6, maxHeight: 120, overflowY: "auto" }}>
                {items.map((item) => (
                  <ActionBtn key={item.key} item={item} data={ctx.data} mode={ui.kind} />
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
            maxHeight: "80%",
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
