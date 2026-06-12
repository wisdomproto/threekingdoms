import type { Action, ActionResult, BattleContext, BattleEvent, BattleState, UnitState } from "./types";
import { getMovableTiles } from "./movement";
import { computeDamage, distance, getAttackableTargets } from "./combat";
import { findDuelTrigger } from "./events";

function getUnit(state: BattleState, id: string): UnitState {
  const u = state.units.find((u) => u.id === id);
  if (!u) throw new Error(`unknown unit: ${id}`);
  return u;
}

function replaceUnit(state: BattleState, unit: UnitState): BattleState {
  return { ...state, units: state.units.map((u) => (u.id === unit.id ? unit : u)) };
}

function assertCanAct(state: BattleState, unit: UnitState, forMove: boolean): void {
  if (state.status !== "ongoing") throw new Error("battle already ended");
  if (unit.retreated) throw new Error(`${unit.id} already retreated`);
  if (unit.side !== state.phase) throw new Error(`not ${unit.side} phase`);
  if (unit.acted) throw new Error(`${unit.id} already acted`);
  if (forMove && unit.moved) throw new Error(`${unit.id} already moved`);
}

/** HP 차감 → 0이면 퇴각. 새 상태와 이벤트를 반환 */
function dealDamage(
  state: BattleState, attacker: UnitState, defender: UnitState, damage: number, counter: boolean,
): { state: BattleState; events: BattleEvent[] } {
  const hp = Math.max(0, defender.hp - damage);
  const retreated = hp === 0;
  const events: BattleEvent[] = [
    { type: "damageDealt", attackerId: attacker.id, defenderId: defender.id, damage, counter },
  ];
  if (retreated) events.push({ type: "unitRetreated", unitId: defender.id });
  return { state: replaceUnit(state, { ...defender, hp, retreated }), events };
}

/** 승패 판정. 충족 시 status 변경 + battleEnded 이벤트 */
function checkOutcome(ctx: BattleContext, state: BattleState): { state: BattleState; events: BattleEvent[] } {
  if (state.status !== "ongoing") return { state, events: [] };
  const v = ctx.stage.victory;
  const d = ctx.stage.defeat;
  const retreated = (id: string) => getUnit(state, id).retreated;

  if (d.kind === "lordRetreat" && retreated(d.unitId)) {
    return { state: { ...state, status: "defeat" }, events: [{ type: "battleEnded", result: "defeat" }] };
  }
  const enemiesAlive = state.units.some((u) => u.side === "enemy" && !u.retreated);
  const victoryMet =
    (v.kind === "defeatAll" && !enemiesAlive) ||
    (v.kind === "defeatUnit" && retreated(v.unitId));
  if (victoryMet) {
    return { state: { ...state, status: "victory" }, events: [{ type: "battleEnded", result: "victory" }] };
  }
  return { state, events: [] };
}

/** 현재 페이즈 전원이 acted면 페이즈 전환 (+적→아군이면 턴 증가), 다음 페이즈 측 moved/acted 리셋 */
function maybeAdvancePhase(state: BattleState): { state: BattleState; events: BattleEvent[] } {
  if (state.status !== "ongoing") return { state, events: [] };
  const remaining = state.units.some((u) => u.side === state.phase && !u.retreated && !u.acted);
  if (remaining) return { state, events: [] };
  const nextPhase = state.phase === "player" ? "enemy" : "player";
  const nextTurn = nextPhase === "player" ? state.turn + 1 : state.turn;
  const units = state.units.map((u) =>
    u.side === nextPhase ? { ...u, moved: false, acted: false } : u,
  );
  return {
    state: { ...state, phase: nextPhase, turn: nextTurn, units },
    events: [{ type: "phaseChanged", phase: nextPhase, turn: nextTurn }],
  };
}

export function applyAction(ctx: BattleContext, state: BattleState, action: Action): ActionResult {
  const unit = getUnit(state, action.unitId);
  const events: BattleEvent[] = [];
  let next = state;

  switch (action.type) {
    case "move": {
      assertCanAct(state, unit, true);
      const reachable = getMovableTiles(ctx, state, unit.id);
      if (!reachable.some((t) => t.x === action.to.x && t.y === action.to.y)) {
        throw new Error(`(${action.to.x},${action.to.y}) is not reachable`);
      }
      const from = { x: unit.x, y: unit.y };
      next = replaceUnit(state, { ...unit, x: action.to.x, y: action.to.y, moved: true });
      events.push({ type: "unitMoved", unitId: unit.id, from, to: action.to });
      break; // 이동은 acted 아님 — 이후 공격/대기 가능
    }

    case "attack": {
      assertCanAct(state, unit, false);
      const target = getUnit(state, action.targetId);
      if (target.retreated || target.side === unit.side) throw new Error("invalid target");
      const inRange = getAttackableTargets(ctx, state, unit.id).includes(target.id);
      if (!inRange) throw new Error(`${target.id} out of range`);

      const duel = findDuelTrigger(ctx, state, unit.id, target.id);
      if (duel) {
        // 스토리 일기토: 스크립트 고정 결과, 일반 데미지 교환 없음 (CLAUDE.md §9)
        const loserId = duel.outcome.winnerId === unit.id ? target.id : unit.id;
        events.push({
          type: "duelTriggered", eventId: duel.id,
          attackerId: unit.id, defenderId: target.id, winnerId: duel.outcome.winnerId,
        });
        next = { ...state, firedEvents: [...state.firedEvents, duel.id] };
        if (duel.outcome.loserRetreats) {
          const loser = getUnit(next, loserId);
          next = replaceUnit(next, { ...loser, hp: 0, retreated: true });
          events.push({ type: "unitRetreated", unitId: loserId });
        }
        next = replaceUnit(next, { ...getUnit(next, unit.id), acted: true });
        break;
      }

      // 일반 공격 — computeDamage가 소비한 rngState를 즉시 반영
      const atkResult = computeDamage(ctx, state, unit, target);
      next = { ...state, rngState: atkResult.nextRngState };
      const hit = dealDamage(next, unit, getUnit(next, target.id), atkResult.damage, false);
      next = hit.state;
      events.push(...hit.events);

      // 반격: 방어측 생존 + 공격측이 방어측 사거리 안 — 갱신된 rngState로 별도 분산
      const defender = getUnit(next, target.id);
      if (!defender.retreated) {
        const d = distance({ x: unit.x, y: unit.y }, { x: defender.x, y: defender.y });
        if (d >= defender.rangeMin && d <= defender.rangeMax) {
          const ctrResult = computeDamage(ctx, next, defender, getUnit(next, unit.id));
          next = { ...next, rngState: ctrResult.nextRngState };
          const ctr = dealDamage(next, defender, getUnit(next, unit.id), ctrResult.damage, true);
          next = ctr.state;
          events.push(...ctr.events);
        }
      }
      next = replaceUnit(next, { ...getUnit(next, unit.id), acted: true });
      break;
    }

    case "wait": {
      assertCanAct(state, unit, false);
      next = replaceUnit(state, { ...unit, acted: true });
      break;
    }
  }

  const outcome = checkOutcome(ctx, next);
  next = outcome.state;
  events.push(...outcome.events);

  const phase = maybeAdvancePhase(next);
  next = phase.state;
  events.push(...phase.events);

  return { state: next, events };
}
