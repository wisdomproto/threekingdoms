/**
 * 공격 전 피해 예측 (Tier 1-1, core-loop-gap-analysis.md §2 / §3).
 *
 * ⚠️ 결정론 전투가 *의도된 설계*다 (combat.ts:49 "퍼즐성=계산 가능성"). 따라서
 *   명중%·확률은 표시하지 않는다 — 정확한 피해 숫자만 노출한다.
 *
 * 엔진의 실제 공격 처리(actions.ts "attack" 케이스)를 그대로 모사한 순수 함수:
 *   - 피해 = computeDamage(ctx, attacker, defender)
 *   - 반격: 방어자가 피해 후 생존(troops - dmg > 0) && 공격자가 방어자 사거리 안일 때만.
 *     반격 피해 = computeDamage(ctx, defender, attacker, counterRatio).
 *     간접공격(궁/포)으로 사거리 밖에서 때리면 거리 조건에서 자연히 반격 없음 — 엔진과 동일.
 *   - willRetreat = 피해 후 병력 0 이하 (퇴각).
 *
 * 이동 후 공격을 고려해 공격자 위치는 `from`(이동 예정 칸)으로 평가한다 — 엔진이 move 커밋 뒤
 * unit.x/y를 그 칸으로 바꾼 상태에서 공격을 처리하는 것과 일치(actions.ts:136, 180).
 * `from` 생략 시 공격자의 현재 칸을 쓴다.
 *
 * 전부 읽기 전용 — 상태를 커밋하지 않는다. computeDamage/distance는 엔진 export.
 */
import { computeDamage, distance, areFoes, flankingCount, flankMultiplier } from "@tk/engine";
import type { BattleContext, BattleState, Coord, UnitState } from "@tk/engine";

export interface CounterPreview {
  damage: number;
  /** 반격으로 공격자가 퇴각하는가 */
  willRetreat: boolean;
}

export interface AttackPreview {
  /** 공격자가 가할 피해 (협공 보너스 포함) */
  damage: number;
  /** 이 피해로 방어자가 퇴각(병력 0)하는가 — 강조색 트리거 */
  willRetreat: boolean;
  /** 반격이 발생하면 그 추정치. 미발생(방어자 퇴각/사거리 밖) 시 생략 */
  counter?: CounterPreview;
  /** 협공 발동 시 — 대상 포위도(공격자 포함)와 추가피해%. 미발동이면 생략 */
  flank?: { surround: number; bonusPercent: number };
}

/** 공격자를 `pos`에 놓은 가상 사본 — 위치 의존 계산(지형 guard/거리)을 이동 후 기준으로 맞춘다 */
function relocated(unit: UnitState, pos: Coord): UnitState {
  return unit.x === pos.x && unit.y === pos.y ? unit : { ...unit, x: pos.x, y: pos.y };
}

/**
 * 공격 한 번의 피해·반격·퇴각을 예측한다.
 * @param from 공격자가 이동 후 서게 될 칸(미지정 = 현재 칸). targetSelect의 preview를 넘긴다.
 * @returns 유효 대상이 아니면(없거나 같은 편/퇴각) null.
 */
export function buildAttackPreview(
  ctx: BattleContext,
  state: BattleState,
  attackerId: string,
  defenderCoord: Coord,
  from?: Coord,
): AttackPreview | null {
  const rawAttacker = state.units.find((u) => u.id === attackerId);
  const defender = state.units.find(
    (u) => u.x === defenderCoord.x && u.y === defenderCoord.y && !u.retreated,
  );
  if (!rawAttacker || rawAttacker.retreated || !defender) return null;
  // 적대 진영(camp 다름)만 타깃 — 우군(같은 camp)은 피해 예측 대상이 아니다
  if (!areFoes(defender.side, rawAttacker.side)) return null;

  const attacker = relocated(rawAttacker, from ?? { x: rawAttacker.x, y: rawAttacker.y });

  // 협공: 엔진은 공격 시점에 공격자가 `from`에 서 있으므로, 그 위치를 반영한 가상 state로 포위도를 센다.
  const moved = attacker !== rawAttacker;
  const flankState: BattleState = moved
    ? { ...state, units: state.units.map((u) => (u.id === attackerId ? attacker : u)) }
    : state;
  const surround = flankingCount(flankState, attacker, defender);
  const flankMult = flankMultiplier(ctx, surround);
  const flank =
    flankMult > 1 ? { surround, bonusPercent: Math.round((flankMult - 1) * 100) } : undefined;

  const damage = computeDamage(ctx, attacker, defender, 1, flankMult);
  const willRetreat = defender.troops - damage <= 0;

  // 반격: 방어자 생존 + 공격자가 방어자 사거리 안 (actions.ts:178-182). 반격엔 협공 미적용(엔진과 일치).
  if (!willRetreat) {
    const d = distance({ x: attacker.x, y: attacker.y }, { x: defender.x, y: defender.y });
    if (d >= defender.rangeMin && d <= defender.rangeMax) {
      const counterDamage = computeDamage(ctx, defender, attacker, ctx.data.combat.counterRatio);
      return {
        damage,
        willRetreat,
        counter: { damage: counterDamage, willRetreat: attacker.troops - counterDamage <= 0 },
        flank,
      };
    }
  }
  return { damage, willRetreat, flank };
}
