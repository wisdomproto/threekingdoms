"use client";
/**
 * AttackForecast (Tier 1-1) — 공격 대상 선택(targetSelect) 단계에서 각 공격 가능 타깃의
 * 예상 피해를 미리 보여주는 패널. **명중%(시드확률 §2-1)**와 정확한 피해 숫자를 노출한다.
 * (2026-06-16 시드확률 전환 전까지는 명중 100% 결정론이었음 — 이제 순발 차로 100% 미만 가능.)
 *
 * 표시: 대상별 `대상명  피해 N 명중 P% (반격 M)`. 명중 100%면 생략. 한 방에 퇴각시키는 대상은 강조색.
 * 반격으로 우리 부대가 퇴각하는 경우 반격 수치도 강조색.
 *
 * 구현 메모: 맵 위 부유 배지 대신 HUD 패널 목록으로 — 그리드→스크린 투영(렌더러 소유)을
 * DOM으로 끌어오지 않아 회귀 위험이 낮고 모바일 가독성이 좋다(작은 칸 위 텍스트보다 명확).
 * 좌표·피해는 committed(엔진 진실)에서 직접 계산 — targetSelect 동안 커밋이 없어 안정적이다.
 *
 * confirmAttack(입문 공격 확인, 스펙 §5): 목록 대신 **VS 카드** — 공격자→대상, 명중/피해/반격,
 * 행동 후 예상 병력, [공격]/[취소]. 카드 버튼만 pointerEvents:auto(패널은 정보 전용 유지).
 * 흐름 자식(스펙 §4): 절대좌표 없음 — BattleScreen 좌측 컬럼이 위치를 정한다.
 */
import type { BattleContext, BattleState } from "@tk/engine";
import type { InputState, UiEvent } from "../inputMachine";
import { buildAttackPreview, type AttackPreview } from "../attackPreview";
import { HUD_BRONZE, HUD_BRONZE_DIM, HUD_FONT, HUD_INK, HUD_PARCHMENT, PANEL_FRAME } from "./frames";

const RETREAT_COLOR = "#ff5d5d"; // 격파 임박 — 강조
const DAMAGE_COLOR = "#ffd27a"; // 일반 피해 (청동 호박색)
const COUNTER_COLOR = "#c7cdd4"; // 반격 (회색조 — 우리가 받는 피해)
const FLANK_COLOR = "#ff9a3d"; // 협공 (§10 대상군과 같은 주황)
const CHARGE_COLOR = "#7bd3ff"; // 기병 돌격 (질주 — 하늘색)
const DOUBLE_COLOR = "#d8a6ff"; // 연속공격 2연타 (보라)
const HIT_COLOR = "#9aa3ad"; // 명중률 (회색조 보조 — 100% 미만일 때만)

const PANEL_STYLE: React.CSSProperties = {
  minWidth: 168,
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "2px 8px 6px",
  ...PANEL_FRAME,
  background: "rgba(16, 14, 10, 0.9)",
  backgroundClip: "padding-box",
  color: "#e8e6e3",
  fontSize: 14,
  lineHeight: 1.4,
  pointerEvents: "none", // 정보 전용 — 맵 탭을 가리지 않는다
  userSelect: "none",
};

/** VS 카드 버튼 — 터치 타깃 ≥44px(design-guide), 패널의 pointerEvents:none을 버튼만 되돌린다 */
const CARD_BTN: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  pointerEvents: "auto",
  fontFamily: HUD_FONT,
  fontSize: 15,
  fontWeight: 700,
  color: HUD_PARCHMENT,
  background: HUD_INK,
  border: `1.5px solid ${HUD_BRONZE_DIM}`,
  borderRadius: 6,
  cursor: "pointer",
  touchAction: "manipulation",
};

/**
 * 입문 공격 확인 카드. prior(selected|targetSelect)가 공격자·이동 프리뷰·필살의 진실.
 * 예상 병력 = troops − 피해(0 하한); 반격 없으면 "반격 없음"(방어자 퇴각/사거리 밖).
 */
function ConfirmCard({
  ui,
  ctx,
  committed,
  dispatch,
}: {
  ui: Extract<InputState, { kind: "confirmAttack" }>;
  ctx: BattleContext;
  committed: BattleState;
  dispatch: (e: UiEvent) => void;
}): React.ReactElement | null {
  const prior = ui.prior;
  const attacker = committed.units.find((u) => u.id === prior.unitId && !u.retreated);
  const target = committed.units.find((u) => u.id === ui.targetId && !u.retreated);
  if (!attacker || !target) return null;
  const ultimate = prior.kind === "targetSelect" && prior.ultimate;
  const preview = buildAttackPreview(
    ctx,
    committed,
    prior.unitId,
    { x: target.x, y: target.y },
    prior.kind === "targetSelect" ? prior.preview : undefined,
    ultimate,
  );
  if (!preview) return null;
  const name = (id: string): string => ctx.data.commanders[id]?.name ?? id;
  const after = (troops: number, dmg: number): number => Math.max(0, troops - dmg);
  const attackerAfter = after(attacker.troops, preview.counter?.damage ?? 0);
  const targetAfter = after(target.troops, preview.damage);
  const stat: React.CSSProperties = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  return (
    <div style={PANEL_STYLE} data-testid="attack-confirm">
      <div style={{ fontSize: 15, fontWeight: 800, color: HUD_PARCHMENT, marginBottom: 4 }}>
        {ultimate ? <span style={{ color: "#5ad7ff" }}>필살 </span> : null}
        {name(prior.unitId)} <span style={{ color: HUD_BRONZE }}>→</span> {name(ui.targetId)}
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
        <span style={{ ...stat, color: HIT_COLOR }}>명중 {preview.hitPercent}%</span>
        <span style={{ ...stat, color: preview.willRetreat ? RETREAT_COLOR : DAMAGE_COLOR, fontWeight: 700 }}>
          피해 {preview.damage}
          {preview.willRetreat ? " 격파" : ""}
        </span>
        {preview.counter ? (
          <span style={{ ...stat, color: preview.counter.willRetreat ? RETREAT_COLOR : COUNTER_COLOR }}>
            반격 {preview.counter.damage}
          </span>
        ) : (
          <span style={{ ...stat, color: COUNTER_COLOR }}>반격 없음</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#9aa3ad", marginTop: 5 }}>행동 후 예상 병력</div>
      <div style={{ ...stat, fontSize: 13, color: "#c7cdd4" }}>
        {name(prior.unitId)} <strong style={{ color: HUD_PARCHMENT }}>{attackerAfter}</strong>
        {" / "}
        {name(ui.targetId)}{" "}
        <strong style={{ color: targetAfter === 0 ? RETREAT_COLOR : HUD_PARCHMENT }}>{targetAfter}</strong>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          data-testid="attack-confirm-ok"
          onClick={() => dispatch({ type: "confirmAttack" })}
          style={{ ...CARD_BTN, color: "#16130f", background: HUD_BRONZE, borderColor: HUD_BRONZE }}
        >
          공격
        </button>
        <button
          type="button"
          data-testid="attack-confirm-cancel"
          onClick={() => dispatch({ type: "cancel" })}
          style={CARD_BTN}
        >
          취소
        </button>
      </div>
    </div>
  );
}

interface Row {
  id: string;
  name: string;
  preview: AttackPreview;
}

export function AttackForecast({
  ui,
  ctx,
  committed,
  dispatch,
}: {
  ui: InputState;
  ctx: BattleContext;
  /** 엔진 진실 상태 — 피해 산출 입력. targetSelect 동안 불변이라 안전 */
  committed: BattleState;
  /** VS 카드 [공격]/[취소] — confirmAttack/cancel 이벤트 */
  dispatch: (e: UiEvent) => void;
}): React.ReactElement | null {
  if (ui.kind === "confirmAttack") {
    return <ConfirmCard ui={ui} ctx={ctx} committed={committed} dispatch={dispatch} />;
  }
  if (ui.kind !== "targetSelect" || ui.attackable.length === 0) return null;

  const rows: Row[] = [];
  for (const id of ui.attackable) {
    const target = committed.units.find((u) => u.id === id && !u.retreated);
    if (!target) continue;
    const preview = buildAttackPreview(
      ctx,
      committed,
      ui.unitId,
      { x: target.x, y: target.y },
      ui.preview, // 이동 후 칸 기준 (제자리면 from=preview=현위치)
      ui.ultimate, // 필살 조준이면 필살 피해
    );
    if (!preview) continue;
    rows.push({
      id,
      name: ctx.data.commanders[id]?.name ?? id,
      preview,
    });
  }
  if (rows.length === 0) return null;

  return (
    <div style={PANEL_STYLE}>
      <div style={{ fontSize: 12, color: "#9aa3ad", marginBottom: 2 }}>예상 피해</div>
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 3,
          }}
        >
          <span style={{ color: "#c7cdd4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.name}
          </span>
          <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
            <strong style={{ color: r.preview.willRetreat ? RETREAT_COLOR : DAMAGE_COLOR }}>
              {r.preview.damage}
              {r.preview.willRetreat ? " 격파" : ""}
            </strong>
            {r.preview.hitPercent < 100 ? (
              <span style={{ marginLeft: 6, fontSize: 12, color: HIT_COLOR }}>
                명중 {r.preview.hitPercent}%
              </span>
            ) : null}
            {r.preview.charge ? (
              <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: CHARGE_COLOR }}>
                돌격+{r.preview.charge.bonusPercent}%
              </span>
            ) : null}
            {r.preview.doubleStrike ? (
              <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: DOUBLE_COLOR }}>
                2연타
              </span>
            ) : null}
            {r.preview.ultimate ? (
              <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 800, color: "#5ad7ff" }}>
                필살
              </span>
            ) : null}
            {r.preview.flank ? (
              <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: FLANK_COLOR }}>
                협공+{r.preview.flank.bonusPercent}%
              </span>
            ) : null}
            {r.preview.counter ? (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  color: r.preview.counter.willRetreat ? RETREAT_COLOR : COUNTER_COLOR,
                }}
              >
                (반격 {r.preview.counter.damage}
                {r.preview.counter.hitPercent < 100 ? ` 명중 ${r.preview.counter.hitPercent}%` : ""})
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
