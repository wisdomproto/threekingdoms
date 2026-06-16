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
import {
  computeDamage, distance, areFoes, flankingCount, flankMultiplier, chargeMultiplier, doubleStrikes,
  hitChance, agilityPower,
} from "@tk/engine";
import type { BattleContext, BattleState, Coord, UnitState } from "@tk/engine";

export interface CounterPreview {
  damage: number;
  /** 반격으로 공격자가 퇴각하는가 */
  willRetreat: boolean;
  /** 반격 명중률(%) — 시드확률(§2-1). 100이면 표시 생략 */
  hitPercent: number;
}

export interface AttackPreview {
  /** 공격자가 가할 피해 (협공 보너스 포함) */
  damage: number;
  /** 이 피해로 방어자가 퇴각(병력 0)하는가 — 강조색 트리거 */
  willRetreat: boolean;
  /** 명중률(%) — 시드확률(§2-1). 100이면 표시 생략. 필살=100(항상 명중) */
  hitPercent: number;
  /** 반격이 발생하면 그 추정치. 미발생(방어자 퇴각/사거리 밖) 시 생략 */
  counter?: CounterPreview;
  /** 협공 발동 시 — 대상 포위도(공격자 포함)와 추가피해%. 미발동이면 생략 */
  flank?: { surround: number; bonusPercent: number };
  /** 기병 돌격 발동 시(이동 후 공격) — 추가피해%. 미발동이면 생략 */
  charge?: { bonusPercent: number };
  /** 연속공격(2중공격) 발동 시 — 2타 피해. 미발동이면 생략 (damage엔 2타 합산 포함) */
  doubleStrike?: { secondDamage: number };
  /** 필살 조준 — 대형 확정 일격(무반격). damage는 필살 피해 */
  ultimate?: boolean;
  /** 상태이상 부여 능력(Phase D) — 적중 시 chance%로 부여. 미보유면 생략. */
  inflicts?: { kind: string; chance: number }[];
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
  ultimate = false,
): AttackPreview | null {
  const rawAttacker = state.units.find((u) => u.id === attackerId);
  const defender = state.units.find(
    (u) => u.x === defenderCoord.x && u.y === defenderCoord.y && !u.retreated,
  );
  if (!rawAttacker || rawAttacker.retreated || !defender) return null;
  // 적대 진영(camp 다름)만 타깃 — 우군(같은 camp)은 피해 예측 대상이 아니다
  if (!areFoes(defender.side, rawAttacker.side)) return null;

  // 필살: 대형 확정 일격(무반격·협공/돌격/연속 무관). 엔진 ultimate 케이스와 동일.
  if (ultimate) {
    const sig = ctx.data.commanders[rawAttacker.id]?.ultimate;
    const ultMult = 1 + (sig?.percent ?? ctx.data.combat.sp.ultimatePercent) / 100;
    const dmg = computeDamage(ctx, rawAttacker, defender, 1, ultMult);
    return { damage: dmg, willRetreat: defender.troops - dmg <= 0, hitPercent: 100, ultimate: true };
  }

  // 엔진은 move→attack 순으로 처리하므로, 이동 예정이면 공격자를 from에 두고 moved=true로 맞춘다
  // (협공 포위도·기병 돌격 판정 모두 '공격 시점' 상태와 일치시키기 위함).
  const dest = from ?? { x: rawAttacker.x, y: rawAttacker.y };
  const willMove = dest.x !== rawAttacker.x || dest.y !== rawAttacker.y;
  const attacker: UnitState = willMove
    ? { ...rawAttacker, x: dest.x, y: dest.y, moved: true }
    : rawAttacker;

  const flankState: BattleState = willMove
    ? { ...state, units: state.units.map((u) => (u.id === attackerId ? attacker : u)) }
    : state;
  const surround = flankingCount(flankState, attacker, defender);
  const flankMult = flankMultiplier(ctx, surround);
  const flank =
    flankMult > 1 ? { surround, bonusPercent: Math.round((flankMult - 1) * 100) } : undefined;

  // 기병 돌격: 이동 후 공격 시 추가피해 (개시 공격에만 — 반격 제외, 엔진과 일치)
  const chargeMult = chargeMultiplier(ctx, attacker);
  const charge =
    chargeMult > 1 ? { bonusPercent: Math.round((chargeMult - 1) * 100) } : undefined;

  // 명중률(시드확률 §2-1) — 엔진 hitChance와 동일 입력(순발력). 공격 1타·연속2타 공통.
  const hitPercent = hitChance(agilityPower(attacker), agilityPower(defender), ctx.data.combat.accuracy);
  // 상태이상 부여 능력(Phase D) — 엔진 resolveStrike와 동일(일반 공격에만, 필살 제외).
  const inflictArr = (attacker.inflictStatuses ?? []).map((s) => ({ kind: s.kind, chance: s.chance }));
  const inflicts = inflictArr.length ? inflictArr : undefined;

  const mult = flankMult * chargeMult;
  // 타당 피해 — 고정뎀(flatDamagePerLevel)이면 방어/지형/협공 무시, 아니면 computeDamage. (Phase C)
  const strikeDamage = (ratio: number): number =>
    attacker.flatDamagePerLevel != null
      ? Math.max(ctx.data.combat.minDamage, attacker.flatDamagePerLevel * (attacker.level + 1))
      : computeDamage(ctx, attacker, defender, ratio, mult);
  const dmg1 = strikeDamage(1);

  let damage: number;
  let doubleStrike: { secondDamage: number } | undefined;
  if (attacker.multiHit != null) {
    // 관통(Phase C): N회 전타격(각 dmg1 동일). 레거시 2타 미적용.
    damage = dmg1 * attacker.multiHit;
    doubleStrike = undefined;
  } else {
    // 레거시 연속공격: 1타로 격파 안 되고 이동력 우위면 2타(secondHitPercent). 엔진과 동일 순서.
    const lethal1 = defender.troops - dmg1 <= 0;
    const doubles = !lethal1 && doubleStrikes(ctx, attacker, defender);
    const dmg2 = doubles ? strikeDamage(ctx.data.combat.doubleStrike.secondHitPercent / 100) : 0;
    doubleStrike = doubles ? { secondDamage: dmg2 } : undefined;
    damage = dmg1 + dmg2;
  }
  const willRetreat = defender.troops - damage <= 0;

  // 반격: 공격자 noCounter(Phase C)면 생략. 아니면 방어자 생존 + 공격자가 방어자 사거리 안.
  if (!attacker.noCounter && !willRetreat) {
    const d = distance({ x: attacker.x, y: attacker.y }, { x: defender.x, y: defender.y });
    if (d >= defender.rangeMin && d <= defender.rangeMax) {
      const counterDamage = defender.flatDamagePerLevel != null
        ? Math.max(ctx.data.combat.minDamage, defender.flatDamagePerLevel * (defender.level + 1))
        : computeDamage(ctx, defender, attacker, ctx.data.combat.counterRatio);
      const counterHitPercent = hitChance(agilityPower(defender), agilityPower(attacker), ctx.data.combat.accuracy);
      return {
        damage,
        willRetreat,
        hitPercent,
        counter: { damage: counterDamage, willRetreat: attacker.troops - counterDamage <= 0, hitPercent: counterHitPercent },
        flank,
        charge,
        doubleStrike,
        inflicts,
      };
    }
  }
  return { damage, willRetreat, hitPercent, flank, charge, doubleStrike, inflicts };
}
