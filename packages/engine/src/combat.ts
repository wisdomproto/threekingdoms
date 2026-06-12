import type { BattleContext, BattleState, Coord, UnitState } from "./types";
import { nextRandom } from "./rng";
import { terrainAt } from "./movement";

/**
 * 데미지 공식 (계수는 전부 data/combat.json — CLAUDE.md §11 데이터-코드 분리):
 * base  = atk - def * defFactor
 * mult  = 상성 배율 × (1 - 방어측 지형 guard) × (1 + 레벨차 × levelCoef)
 * 분산  = ±varianceRatio (시드 RNG)
 * 결과  = max(minDamage, floor(base × mult × variance))
 */
export function computeDamage(
  ctx: BattleContext,
  state: BattleState,
  attacker: UnitState,
  defender: UnitState,
): { damage: number; nextRngState: number } {
  const cfg = ctx.data.combat;
  const base = Math.max(0, attacker.atk - defender.def * cfg.defFactor);
  const advantage = cfg.classAdvantage[attacker.classId]?.[defender.classId] ?? 1;
  const guard = terrainAt(ctx, defender.x, defender.y).guard;
  const levelFactor = 1 + (attacker.level - defender.level) * cfg.levelCoef;
  const [rand, nextRngState] = nextRandom(state.rngState);
  const variance = 1 - cfg.varianceRatio + rand * cfg.varianceRatio * 2;
  const damage = Math.max(
    cfg.minDamage,
    Math.floor(base * advantage * (1 - guard) * levelFactor * variance),
  );
  return { damage, nextRngState };
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
      const d = distance(pos, t);
      return d >= unit.rangeMin && d <= unit.rangeMax;
    })
    .map((t) => t.id);
}
