import type { StatusEffect, StatusKind, Side } from "@tk/data";
import type { BattleContext, BattleState, BattleEvent, UnitState } from "./types";

/** 활성 상태이상 보유 여부. */
export function hasStatus(u: UnitState, kind: StatusKind): boolean {
  return (u.statuses ?? []).some((s) => s.kind === kind);
}

/** 같은 kind 있으면 turns=max로 갱신, 없으면 추가. 순수(새 배열). */
export function applyStatus(
  statuses: StatusEffect[] | undefined, kind: StatusKind, turns: number,
): StatusEffect[] {
  const cur = statuses ?? [];
  if (cur.some((s) => s.kind === kind)) {
    return cur.map((s) => (s.kind === kind ? { kind, turns: Math.max(s.turns, turns) } : s));
  }
  return [...cur, { kind, turns }];
}

/**
 * side 진영 유닛의 페이즈 시작 처리 — 중독 피해 + turns−1 + 만료. 결정론(난수 없음).
 * 중독 피해는 statusTick, 만료는 statusExpired로 서술(diffSnapshot은 troops만 보지만 표시 정합 위해 전부 emit).
 */
export function tickStatuses(
  ctx: BattleContext, state: BattleState, side: Side,
): { state: BattleState; events: BattleEvent[] } {
  const events: BattleEvent[] = [];
  let units = state.units;
  for (const u of state.units) {
    if (u.side !== side || u.retreated || !u.statuses || u.statuses.length === 0) continue;
    let troops = u.troops;
    let retreated: boolean = u.retreated;
    for (const s of u.statuses) {
      if (s.kind === "poison" && !retreated) {
        const dmg = ctx.data.combat.status.poisonDamage;
        troops = Math.max(0, troops - dmg);
        events.push({ type: "statusTick", unitId: u.id, kind: "poison", damage: dmg });
        if (troops === 0) {
          retreated = true;
          events.push({ type: "unitRetreated", unitId: u.id });
        }
      }
    }
    const next: StatusEffect[] = [];
    for (const s of u.statuses) {
      const t = s.turns - 1;
      if (t <= 0) events.push({ type: "statusExpired", unitId: u.id, kind: s.kind });
      else next.push({ kind: s.kind, turns: t });
    }
    units = units.map((x) => (x.id === u.id ? { ...x, troops, retreated, statuses: next } : x));
  }
  return { state: { ...state, units }, events };
}
