import type { Action, ActionResult, BattleContext, BattleEvent, BattleState, UnitState } from "./types";
import { getMovableTiles, unitAt } from "./movement";
import {
  computeDamage, distance, getAttackableTargets,
  strategyDamage, strategyAoeCells, getStrategyTargets, expForNextLevel,
  spiritPower,
} from "./combat";
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

/** 병력 차감 → 0이면 퇴각. 새 상태와 이벤트를 반환 */
function dealDamage(
  state: BattleState, attacker: UnitState, defender: UnitState, damage: number, counter: boolean,
): { state: BattleState; events: BattleEvent[] } {
  const troops = Math.max(0, defender.troops - damage);
  const retreated = troops === 0;
  const events: BattleEvent[] = [
    { type: "damageDealt", attackerId: attacker.id, defenderId: defender.id, damage, counter },
  ];
  if (retreated) events.push({ type: "unitRetreated", unitId: defender.id });
  return { state: replaceUnit(state, { ...defender, troops, retreated }), events };
}

/** 병력 회복 → maxTroops 상한. 실제 회복량(클램프 후)과 갱신된 상태를 반환. 결정론. */
function healTroops(
  state: BattleState, target: UnitState, amount: number,
): { state: BattleState; healed: number } {
  const troops = Math.min(target.maxTroops, target.troops + Math.max(0, amount));
  const healed = troops - target.troops;
  return { state: replaceUnit(state, { ...target, troops }), healed };
}

/**
 * 경험치 부여 (§10 행동 기반). 결정론 — 난수 없음.
 *  gain = round(damage/2) + (대상 퇴각/전멸 시 defenderLevelAtHit×10 + 20 : 0)
 *  누적 후 레벨업: while (exp >= level×50 && level < cap) { exp -= level×50; level++; emit levelUp }
 *  cap = ctx.stage.levelCap ?? 99. defenderLevelAtHit = 피격 직전 대상 레벨(데미지 적용 전 값).
 */
function grantExp(
  ctx: BattleContext,
  state: BattleState,
  attackerId: string,
  damage: number,
  defenderDowned: boolean,
  defenderLevelAtHit: number,
): { state: BattleState; events: BattleEvent[] } {
  const events: BattleEvent[] = [];
  const attacker = state.units.find((u) => u.id === attackerId);
  if (!attacker) return { state, events };
  const cap = ctx.stage.levelCap ?? 99;
  const kill = defenderDowned ? defenderLevelAtHit * 10 + 20 : 0;
  const gain = Math.round(damage / 2) + kill;

  let level = attacker.level;
  let exp = attacker.exp + gain;
  while (exp >= expForNextLevel(level) && level < cap) {
    exp -= expForNextLevel(level);
    level += 1;
    events.push({ type: "levelUp", unitId: attackerId, newLevel: level });
  }
  return { state: replaceUnit(state, { ...attacker, level, exp }), events };
}

/** 승패 판정. 충족 시 status 변경 + battleEnded 이벤트 */
function checkOutcome(ctx: BattleContext, state: BattleState): { state: BattleState; events: BattleEvent[] } {
  if (state.status !== "ongoing") return { state, events: [] };
  const v = ctx.stage.victory;
  const d = ctx.stage.defeat;
  const retreated = (id: string) => getUnit(state, id).retreated;

  // 패배 체크 우선 — 군주 퇴각과 마지막 적 격파가 동시 발생하면 defeat (원작 룰)
  // 턴 제한: turn은 maybeAdvancePhase의 적→아군 전환에서만 증가하므로,
  // turn > turnLimit은 "turnLimit번째 라운드를 온전히 끝낸 직후"에만 참이 된다 (sim runner의 turn <= maxTurns 의미론과 일치)
  if (state.turn > ctx.stage.turnLimit) {
    return { state: { ...state, status: "defeat" }, events: [{ type: "battleEnded", result: "defeat" }] };
  }
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
          next = replaceUnit(next, { ...loser, troops: 0, retreated: true });
          events.push({ type: "unitRetreated", unitId: loserId });
        }
        next = replaceUnit(next, { ...getUnit(next, unit.id), acted: true });
        break;
      }

      // 일반 공격 — 원작 룰: 명중 100%, 분산 없음
      const dmg = computeDamage(ctx, unit, target);
      const targetLevelAtHit = getUnit(next, target.id).level;
      const hit = dealDamage(next, unit, getUnit(next, target.id), dmg, false);
      next = hit.state;
      events.push(...hit.events);
      // 경험치: 데미지 절반 + 격파(퇴각) 보너스
      const atkExp = grantExp(ctx, next, unit.id, dmg, getUnit(next, target.id).retreated, targetLevelAtHit);
      next = atkExp.state;
      events.push(...atkExp.events);

      // 반격: 방어측 생존 + 공격측이 방어측 사거리 안
      const defender = getUnit(next, target.id);
      if (!defender.retreated) {
        const d = distance({ x: unit.x, y: unit.y }, { x: defender.x, y: defender.y });
        if (d >= defender.rangeMin && d <= defender.rangeMax) {
          const ctrDmg = computeDamage(ctx, defender, getUnit(next, unit.id), ctx.data.combat.counterRatio);
          const attackerLevelAtHit = getUnit(next, unit.id).level;
          const ctr = dealDamage(next, defender, getUnit(next, unit.id), ctrDmg, true);
          next = ctr.state;
          events.push(...ctr.events);
          // 반격 경험치는 반격자(방어측)에게
          const ctrExp = grantExp(ctx, next, defender.id, ctrDmg, getUnit(next, unit.id).retreated, attackerLevelAtHit);
          next = ctrExp.state;
          events.push(...ctrExp.events);
        }
      }
      // 반격으로 공격자가 퇴각했어도 acted=true로 통일 — maybeAdvancePhase의 retreated 필터가 가드
      next = replaceUnit(next, { ...getUnit(next, unit.id), acted: true });
      break;
    }

    case "strategy": {
      assertCanAct(state, unit, false);
      const strat = ctx.data.strategies[action.strategyId];
      if (!strat) throw new Error(`unknown strategy: ${action.strategyId}`);
      const cls = ctx.data.unitClasses[unit.classId];
      if (!cls || !cls.strategies.includes(action.strategyId)) {
        throw new Error(`${unit.id} cannot use ${action.strategyId}`);
      }
      if (unit.mp < strat.mp) throw new Error(`${unit.id} not enough MP for ${action.strategyId}`);
      const castable = getStrategyTargets(ctx, state, unit.id, action.strategyId);
      if (!castable.some((t) => t.x === action.target.x && t.y === action.target.y)) {
        throw new Error(`(${action.target.x},${action.target.y}) not a valid cast target`);
      }
      // MP 소비 → 시전 이벤트(연출/VFX) → AoE 데미지(간접=무반격)
      next = replaceUnit(state, { ...unit, mp: unit.mp - strat.mp });
      events.push({
        type: "strategyCast", casterId: unit.id, strategyId: action.strategyId, target: action.target,
      });
      for (const c of strategyAoeCells(action.target, strat.aoe)) {
        const t = unitAt(next, c.x, c.y);
        if (!t || t.retreated) continue;
        const isTarget = strat.target === "enemy" ? t.side !== unit.side : t.side === unit.side;
        if (!isTarget) continue;
        const caster = getUnit(next, unit.id);
        if (strat.category === "heal") {
          // 회복 책략: 회복량 = power + round(시전 정신력 × power / 10), 상한 = maxTroops (결정론).
          // 정신력이 높을수록 회복 효율이 커진다 — 책사/도사 지원 가치. 화계(데미지)는 불변.
          const heal = strat.power + Math.round((spiritPower(caster) * strat.power) / 10);
          const res = healTroops(next, getUnit(next, t.id), heal);
          next = res.state;
        } else {
          const dmg = strategyDamage(caster, t, strat.power);
          const hit = dealDamage(next, caster, getUnit(next, t.id), dmg, false);
          next = hit.state;
          events.push(...hit.events);
        }
      }
      next = replaceUnit(next, { ...getUnit(next, unit.id), acted: true });
      break;
    }

    case "useItem": {
      assertCanAct(state, unit, false);
      const item = ctx.data.items[action.itemId];
      if (!item) throw new Error(`unknown item: ${action.itemId}`);
      if (!unit.items.includes(action.itemId)) {
        throw new Error(`${unit.id} does not have item ${action.itemId}`);
      }
      if (item.category !== "supplyItem" && item.category !== "attackItem") {
        throw new Error(`item ${action.itemId} is not usable (category ${item.category})`);
      }
      // target 생략 시 시전자 자신
      const tgtCoord = action.target ?? { x: unit.x, y: unit.y };
      const tgt = unitAt(state, tgtCoord.x, tgtCoord.y);
      if (!tgt || tgt.retreated) throw new Error(`no valid target at (${tgtCoord.x},${tgtCoord.y})`);

      let amount = 0;
      if (item.category === "supplyItem") {
        // 회복약: 대상 아군 troops를 power만큼 회복 (상한 = maxTroops)
        if (tgt.side !== unit.side) throw new Error(`supplyItem target must be ally`);
        const res = healTroops(state, tgt, item.power);
        next = res.state;
        amount = res.healed;
      } else {
        // attackItem: 대상 적 troops를 power 고정 감소 (최소 0, 반격 없음)
        if (tgt.side === unit.side) throw new Error(`attackItem target must be enemy`);
        const hit = dealDamage(state, unit, tgt, item.power, false);
        next = hit.state;
        events.push(...hit.events);
        amount = Math.min(item.power, tgt.troops); // 실제 가한 피해(병력이 더 적으면 그만큼)
      }

      // itemId 1개 소모 — 첫 번째 매칭만 제거 (중복 소지 지원)
      const remaining = [...getUnit(next, unit.id).items];
      const idx = remaining.indexOf(action.itemId);
      if (idx >= 0) remaining.splice(idx, 1);
      next = replaceUnit(next, { ...getUnit(next, unit.id), items: remaining, acted: true });

      events.push({
        type: "itemUsed", unitId: unit.id, itemId: action.itemId, target: action.target, amount,
      });
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

  // 턴 증가 직후 재판정 — 턴 제한 패배가 "아군 페이즈 시작 시점"(phaseChanged 직후)에 잡히도록.
  // 첫 checkOutcome에서 이미 종료됐다면 조기 반환되고, 유닛 상태는 그 사이 불변이라 이중 판정 위험 없음
  const lateOutcome = checkOutcome(ctx, next);
  next = lateOutcome.state;
  events.push(...lateOutcome.events);

  return { state: next, events };
}
