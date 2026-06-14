"use client";
/**
 * AttackForecast (Tier 1-1) — 공격 대상 선택(targetSelect) 단계에서 각 공격 가능 타깃의
 * 예상 피해를 미리 보여주는 패널. 결정론 전투라 명중%는 없고 **정확한 피해 숫자**만 노출한다.
 *
 * 표시: 대상별 `대상명  피해 N (반격 M)`. 한 방에 퇴각시키는 대상은 강조색(격파 임박).
 * 반격으로 우리 부대가 퇴각하는 경우 반격 수치도 강조색.
 *
 * 구현 메모: 맵 위 부유 배지 대신 HUD 패널 목록으로 — 그리드→스크린 투영(렌더러 소유)을
 * DOM으로 끌어오지 않아 회귀 위험이 낮고 모바일 가독성이 좋다(작은 칸 위 텍스트보다 명확).
 * 좌표·피해는 committed(엔진 진실)에서 직접 계산 — targetSelect 동안 커밋이 없어 안정적이다.
 */
import type { BattleContext, BattleState } from "@tk/engine";
import type { InputState } from "../inputMachine";
import { buildAttackPreview, type AttackPreview } from "../attackPreview";
import { PANEL_FRAME } from "./frames";

const RETREAT_COLOR = "#ff5d5d"; // 격파 임박 — 강조
const DAMAGE_COLOR = "#ffd27a"; // 일반 피해 (청동 호박색)
const COUNTER_COLOR = "#c7cdd4"; // 반격 (회색조 — 우리가 받는 피해)

const PANEL_STYLE: React.CSSProperties = {
  position: "absolute",
  // 좌측 중단 — 상단 UnitPanel(공격자 정보)과 우상단 미니맵/하단 액션존을 모두 피한다
  top: "42%",
  left: 12,
  minWidth: 168,
  maxWidth: 248,
  padding: "2px 8px 6px",
  ...PANEL_FRAME,
  background: "rgba(16, 14, 10, 0.9)",
  backgroundClip: "padding-box",
  color: "#e8e6e3",
  fontSize: 14,
  lineHeight: 1.4,
  pointerEvents: "none", // 정보 전용 — 맵 탭을 가리지 않는다
  userSelect: "none",
  zIndex: 5,
};

interface Row {
  id: string;
  name: string;
  preview: AttackPreview;
}

export function AttackForecast({
  ui,
  ctx,
  committed,
}: {
  ui: InputState;
  ctx: BattleContext;
  /** 엔진 진실 상태 — 피해 산출 입력. targetSelect 동안 불변이라 안전 */
  committed: BattleState;
}): React.ReactElement | null {
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
            {r.preview.counter ? (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  color: r.preview.counter.willRetreat ? RETREAT_COLOR : COUNTER_COLOR,
                }}
              >
                (반격 {r.preview.counter.damage})
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
