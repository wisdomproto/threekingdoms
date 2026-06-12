import {
  getAttackableTargets, getMovableTiles, distance,
  type Action, type BattleContext, type BattleState,
} from "@tk/engine";

/**
 * 그리디 정책 (양 진영 공용):
 * 1) 현재 위치에서 공격 가능하면 HP가 가장 낮은 적 공격
 * 2) 아직 안 움직였으면 가장 가까운 적과의 거리를 최소화하는 타일로 이동
 * 3) 그 외 대기
 */
export function chooseAction(ctx: BattleContext, state: BattleState): Action | undefined {
  const unit = state.units.find(
    (u) => u.side === state.phase && !u.retreated && !u.acted,
  );
  if (!unit) return undefined; // applyAction이 페이즈를 자동 전환하므로 정상적으론 도달 안 함

  const targets = getAttackableTargets(ctx, state, unit.id);
  if (targets.length > 0) {
    const weakest = targets
      .map((id) => state.units.find((u) => u.id === id)!)
      .sort((a, b) => a.troops - b.troops)[0]!;
    return { type: "attack", unitId: unit.id, targetId: weakest.id };
  }

  if (!unit.moved) {
    const enemies = state.units.filter((u) => u.side !== unit.side && !u.retreated);
    if (enemies.length > 0) {
      const tiles = getMovableTiles(ctx, state, unit.id);
      const score = (t: { x: number; y: number }) =>
        Math.min(...enemies.map((e) => distance(t, { x: e.x, y: e.y })));
      const best = [...tiles].sort((a, b) => score(a) - score(b))[0];
      if (best && !(best.x === unit.x && best.y === unit.y)) {
        return { type: "move", unitId: unit.id, to: best };
      }
    }
  }

  return { type: "wait", unitId: unit.id };
}
