import type { BattleContext, BattleState, Coord, UnitState } from "./types";
import { terrainAt } from "./movement";

/** 보정능력치 — 80 이상에서 가치가 비선형 급증하는 원작 커브 (레퍼런스 §6) */
export function adjustedStat(x: number): number {
  return Math.round(4000 / (140 - x));
}

export function attackPower(u: UnitState): number {
  return (u.baseAtk + u.morale + adjustedStat(u.war)) * (10 + u.level) / 10 * u.weaponBonus;
}

export function defensePower(u: UnitState): number {
  return (u.baseDef + u.morale + adjustedStat(u.leadership)) * (10 + u.level) / 10;
}

/** 공격측 line 기준 방어력 배율: 유리 0.75 / 불리 1.25 / 그 외 1.0 */
function defFactor(ctx: BattleContext, attacker: UnitState, defender: UnitState): number {
  const cfg = ctx.data.combat;
  if (cfg.lineAdvantage[attacker.line] === defender.line) return cfg.advantageDefFactor;
  if (cfg.lineAdvantage[defender.line] === attacker.line) return cfg.disadvantageDefFactor;
  return 1.0;
}

/**
 * 원작 데미지 공식 — 명중 100%, 분산 없음 (퍼즐성 = 계산 가능성).
 * 데미지 = (공격력 − 방어력 × 상성계수 ÷ 2) × (1 − 방어측 지형 guard), ratio는 반격 0.5용
 */
export function computeDamage(
  ctx: BattleContext, attacker: UnitState, defender: UnitState, ratio = 1,
): number {
  const guard = terrainAt(ctx, defender.x, defender.y).guard;
  const raw = attackPower(attacker) - defensePower(defender) * defFactor(ctx, attacker, defender) / 2;
  return Math.max(ctx.data.combat.minDamage, Math.floor(Math.max(0, raw) * (1 - guard) * ratio));
}

export function distance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** from 위치 기준 사거리 내 적 id 목록. from 생략 시 현재 위치 */
export function getAttackableTargets(
  ctx: BattleContext,
  state: BattleState,
  unitId: string,
  from?: Coord,
): string[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.retreated) return [];
  const pos = from ?? { x: unit.x, y: unit.y };
  return state.units
    .filter((t) => t.side !== unit.side && !t.retreated)
    .filter((t) => {
      const d = distance(pos, { x: t.x, y: t.y });
      return d >= unit.rangeMin && d <= unit.rangeMax;
    })
    .map((t) => t.id);
}
