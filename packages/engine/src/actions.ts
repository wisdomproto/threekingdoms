import type { Side, Objective, FailCondition } from "@tk/data";
import type { Action, ActionResult, BattleContext, BattleEvent, BattleState, UnitState } from "./types";
import { areFoes, camp } from "./types";
import { getMovableTiles, unitAt } from "./movement";
import {
  computeDamage, distance, getAttackableTargets,
  strategyDamage, strategyAoeCells, getStrategyTargets, expForNextLevel,
  spiritPower, flankingCount, flankMultiplier, chargeMultiplier, doubleStrikes, canUltimate,
  hitChance, agilityPower,
} from "./combat";
import { nextRandom } from "./rng";
import { findDuelTrigger } from "./events";
import { spawnUnit } from "./createBattle";

function getUnit(state: BattleState, id: string): UnitState {
  const u = state.units.find((u) => u.id === id);
  if (!u) throw new Error(`unknown unit: ${id}`);
  return u;
}

function replaceUnit(state: BattleState, unit: UnitState): BattleState {
  return { ...state, units: state.units.map((u) => (u.id === unit.id ? unit : u)) };
}

/** SP(필살 게이지)를 amount만큼 더해 maxSp로 클램프한 유닛 사본. 결정론. */
function addSp(u: UnitState, amount: number): UnitState {
  return { ...u, sp: Math.min(u.maxSp ?? Infinity, (u.sp ?? 0) + amount) };
}

/**
 * 아군이 적을 격파(retreat)했을 때 콤보 +1 + 보너스 자금 적립(§7/§12). 전투력 아님(밸런스 중립).
 * 비격파·비아군이면 무변. 콤보는 아군 페이즈 시작 시 리셋(maybeAdvancePhase).
 */
function registerComboKill(
  ctx: BattleContext, state: BattleState, attackerSide: Side, killed: boolean,
): { state: BattleState; events: BattleEvent[] } {
  if (!killed || attackerSide !== "player") return { state, events: [] };
  const combo = (state.combo ?? 0) + 1;
  const gold = ctx.data.combat.combo.goldPerStack * combo;
  return {
    state: { ...state, combo, pendingRewards: [...state.pendingRewards, { conditionId: "combo", treasures: [], gold }] },
    events: [{ type: "combo", count: combo, gold }],
  };
}

function assertCanAct(state: BattleState, unit: UnitState, forMove: boolean): void {
  if (state.status !== "ongoing") throw new Error("battle already ended");
  if (unit.retreated) throw new Error(`${unit.id} already retreated`);
  if (unit.side !== state.phase) throw new Error(`not ${unit.side} phase`);
  if (unit.acted) throw new Error(`${unit.id} already acted`);
  if (forMove && unit.moved) throw new Error(`${unit.id} already moved`);
}

/** 병력 차감 → 0이면 퇴각. 새 상태와 이벤트를 반환. hit=false(미스)는 호출측이 따로 emit하므로 기본 true. */
function dealDamage(
  state: BattleState, attacker: UnitState, defender: UnitState, damage: number, counter: boolean, hit = true,
): { state: BattleState; events: BattleEvent[] } {
  const troops = Math.max(0, defender.troops - damage);
  const retreated = troops === 0;
  const events: BattleEvent[] = [
    { type: "damageDealt", attackerId: attacker.id, defenderId: defender.id, damage, counter, hit },
  ];
  if (retreated) events.push({ type: "unitRetreated", unitId: defender.id });
  return { state: replaceUnit(state, { ...defender, troops, retreated }), events };
}

/**
 * 명중 롤(시드 고정, §2-1 2026-06-16) — rngState를 전진시킨다. value×100 < 명중% 이면 명중.
 * 명중% = hitChance(공격자 순발, 방어자 순발, accuracy). 필살/책략/아이템은 호출 안 함(항상 명중).
 */
function rollHit(
  ctx: BattleContext, state: BattleState, attacker: UnitState, defender: UnitState,
): { hit: boolean; state: BattleState } {
  const pct = hitChance(agilityPower(attacker), agilityPower(defender), ctx.data.combat.accuracy);
  const [v, nextState] = nextRandom(state.rngState);
  return { hit: v * 100 < pct, state: { ...state, rngState: nextState } };
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

/** id로 유닛을 찾되 없으면 undefined (미투입 증원 대상 등 — 던지지 않음) */
function findUnit(state: BattleState, id: string): UnitState | undefined {
  return state.units.find((u) => u.id === id);
}

/** 유닛이 퇴각 상태인가. 미투입(부재) 유닛은 "아직 안 퇴각"으로 본다(false). */
function isRetreated(state: BattleState, id: string): boolean {
  return findUnit(state, id)?.retreated === true;
}

/**
 * 단일 승리 목표 충족 여부 (M3①). 부재 유닛 대상은 미충족으로 안전 처리.
 *  - surviveTurns: turn > turns (그 turns번째 라운드를 온전히 끝낸 직후 충족 — turnLimit 의미론과 동일)
 *  - reachTile/captureTile: 점유는 retreated 아닌 유닛의 (x,y) 일치로 판정.
 */
function objectiveMet(ctx: BattleContext, state: BattleState, o: Objective): boolean {
  switch (o.kind) {
    case "defeatAll":
      return !state.units.some((u) => camp(u.side) === "hostile" && !u.retreated);
    case "defeatUnit":
      return isRetreated(state, o.unitId);
    case "reachTile": {
      if (o.unitId !== undefined) {
        const u = findUnit(state, o.unitId);
        return !!u && !u.retreated && u.x === o.x && u.y === o.y;
      }
      // unitId 생략 = 아무 아군(camp friendly)이 그 칸에 도달
      return state.units.some((u) => camp(u.side) === "friendly" && !u.retreated && u.x === o.x && u.y === o.y);
    }
    case "surviveTurns":
      return state.turn > o.turns;
    case "captureTile":
      return state.units.some((u) => u.side === o.side && !u.retreated && u.x === o.x && u.y === o.y);
  }
}

/** 단일 패배 조건 충족 여부 (M3①). */
function failConditionMet(ctx: BattleContext, state: BattleState, f: FailCondition): boolean {
  switch (f.kind) {
    case "unitRetreated":
      return isRetreated(state, f.unitId);
    case "allRetreated":
      // 호위 대상 전부 퇴각 시 패배. 전원이 (퇴각했거나 부재)면 충족 — 단 1명도 존재·생존 시 미충족.
      return f.unitIds.every((id) => isRetreated(state, id)) &&
        f.unitIds.some((id) => findUnit(state, id) !== undefined);
    case "turnLimitExceeded":
      return state.turn > ctx.stage.turnLimit;
  }
}

/**
 * 승패 판정 (M3①). objectives/failConditions가 있으면 그쪽 우선, 없으면 레거시 victory/defeat 폴백.
 * 최상위 계약 보존: status는 "ongoing"|"victory"|"defeat"만, battleEnded 이벤트도 동일.
 *
 * 우선순위(원작 룰 — 동시 발생 시 패배 우선):
 *  1) failConditions 중 하나라도 충족 → defeat
 *  2) turnLimit 처리: failConditions에 turnLimitExceeded가 **명시**됐으면 위 1)에서 처리.
 *     명시 안 했으면 기존대로 turn > turnLimit 단순 종료=defeat (하위호환).
 *  3) 모든 non-optional objective 충족 → victory
 */
function checkOutcome(ctx: BattleContext, state: BattleState): { state: BattleState; events: BattleEvent[] } {
  if (state.status !== "ongoing") return { state, events: [] };

  const objectives = ctx.stage.objectives;
  const failConditions = ctx.stage.failConditions;
  const useNew = objectives !== undefined && objectives.length > 0;

  const defeat = (): { state: BattleState; events: BattleEvent[] } =>
    ({ state: { ...state, status: "defeat" }, events: [{ type: "battleEnded", result: "defeat" }] });
  const victory = (): { state: BattleState; events: BattleEvent[] } =>
    ({ state: { ...state, status: "victory" }, events: [{ type: "battleEnded", result: "victory" }] });

  if (useNew) {
    // 패배 우선 (명시 failConditions는 승리보다 우선 — 원작 동시발생 룰)
    if (failConditions?.some((f) => failConditionMet(ctx, state, f))) return defeat();
    // 필수 목표 전부 충족 시 승리 — *암묵* turnLimit 종료보다 먼저 판정한다.
    //  surviveTurns:N + turnLimit:N + (turnLimitExceeded 미명시) 조합에서, turn>N 시점에
    //  생존 목표가 막 충족되는데 암묵 turnLimit 패배가 선점해버리는 버그 방지.
    //  (turnLimitExceeded를 *명시*한 스테이지는 위 패배-우선에서 이미 처리됨 → 의도된 시간압박 유지.)
    const required = objectives.filter((o) => !o.optional);
    if (required.length > 0 && required.every((o) => objectiveMet(ctx, state, o))) return victory();
    // turnLimitExceeded를 명시하지 않았으면 기존 단순 종료 룰 유지(하위호환)
    const hasTurnLimitFail = failConditions?.some((f) => f.kind === "turnLimitExceeded") ?? false;
    if (!hasTurnLimitFail && state.turn > ctx.stage.turnLimit) return defeat();
    return { state, events: [] };
  }

  // ── 레거시 폴백 (objectives 미지정 스테이지) ──
  const v = ctx.stage.victory!;
  const d = ctx.stage.defeat;
  if (state.turn > ctx.stage.turnLimit) return defeat();
  if (d?.kind === "lordRetreat" && isRetreated(state, d.unitId)) return defeat();
  const enemiesAlive = state.units.some((u) => camp(u.side) === "hostile" && !u.retreated);
  const victoryMet =
    (v.kind === "defeatAll" && !enemiesAlive) ||
    (v.kind === "defeatUnit" && isRetreated(state, v.unitId));
  if (victoryMet) return victory();
  return { state, events: [] };
}

/** 페이즈 순서 (Tier 2-1): player → ally(우군) → enemy → player. 한 바퀴(→player)에서 턴 증가. */
const PHASE_ORDER: Side[] = ["player", "ally", "enemy"];

/** 살아있는 유닛이 한 명이라도 있는 진영인가 (빈 페이즈 스킵용) */
function sideHasLivingUnits(state: BattleState, side: Side): boolean {
  return state.units.some((u) => u.side === side && !u.retreated);
}

/**
 * 현재 페이즈 전원이 acted면 다음 페이즈로 전환. PHASE_ORDER를 순환하되
 * **살아있는 유닛이 없는 진영(우군 미투입 스테이지의 ally 등)은 건너뛴다** —
 * 빈 페이즈에 갇히지 않게(그 페이즈를 구동할 유닛이 없으면 maybeAdvancePhase를
 * 다시 부를 액션도 없으므로 교착). 다음 페이즈 측 moved/acted 리셋.
 * 한 바퀴 돌아 player로 복귀할 때만 턴 증가 (라운드 = player→ally→enemy 1회).
 */
function maybeAdvancePhase(state: BattleState): { state: BattleState; events: BattleEvent[] } {
  if (state.status !== "ongoing") return { state, events: [] };
  const remaining = state.units.some((u) => u.side === state.phase && !u.retreated && !u.acted);
  if (remaining) return { state, events: [] };

  const startIdx = PHASE_ORDER.indexOf(state.phase);
  let nextPhase: Side = state.phase;
  let wrapped = false;
  // 최대 한 바퀴(3) 돌며 유닛이 있는 다음 진영을 찾는다. 전원 빈 경우(이론상 없음)는 player로.
  for (let step = 1; step <= PHASE_ORDER.length; step++) {
    const idx = (startIdx + step) % PHASE_ORDER.length;
    if (idx <= startIdx) wrapped = true; // player(idx 0)를 지나면 새 라운드
    const cand = PHASE_ORDER[idx]!;
    if (sideHasLivingUnits(state, cand)) {
      nextPhase = cand;
      break;
    }
  }
  const nextTurn = wrapped ? state.turn + 1 : state.turn;
  const units = state.units.map((u) =>
    u.side === nextPhase ? { ...u, moved: false, acted: false } : u,
  );
  // 콤보는 아군 페이즈 시작 시 0으로 리셋 (연속 격파 단위 = 한 아군 페이즈)
  const combo = nextPhase === "player" ? 0 : state.combo;
  return {
    state: { ...state, phase: nextPhase, turn: nextTurn, units, combo },
    events: [{ type: "phaseChanged", phase: nextPhase, turn: nextTurn }],
  };
}

/**
 * 증원 트리거 평가 → 충족분 투입 (M3① §2-6). 결정론.
 *  - turn 트리거: state.turn 이 trigger.turn 이상이 된 뒤 첫 평가에서 스폰(턴 도달 시점 직후).
 *  - unitDefeated 트리거: 그 유닛이 퇴각한 뒤 첫 평가에서 스폰.
 * once 보장: spawnedReinforcements에 id 누적. 투입 유닛은 spawnUnit(정규 초기화)으로 생성.
 * 매 액션 처리 끝(checkOutcome 전)과 페이즈 전환 직후 호출돼도 중복 없음(id 가드).
 */
function applyReinforcements(ctx: BattleContext, state: BattleState): { state: BattleState; events: BattleEvent[] } {
  if (state.status !== "ongoing") return { state, events: [] };
  let next = state;
  const events: BattleEvent[] = [];
  for (const r of ctx.stage.reinforcements ?? []) {
    if (next.spawnedReinforcements.includes(r.id)) continue;
    const fire =
      (r.trigger.kind === "turn" && next.turn >= r.trigger.turn) ||
      (r.trigger.kind === "unitDefeated" && isRetreated(next, r.trigger.unitId));
    if (!fire) continue;
    const spawned = r.units.map((p) => spawnUnit(ctx.data, { ...p, side: r.side }));
    next = {
      ...next,
      units: [...next.units, ...spawned],
      spawnedReinforcements: [...next.spawnedReinforcements, r.id],
    };
    events.push({
      type: "reinforcementArrived", reinforcementId: r.id, side: r.side,
      // 렌더 데이터 동봉 — 렌더러가 committed 조회 없이 스프라이트 생성(자기서술 계약).
      units: spawned.map((u) => ({
        id: u.id, classId: u.classId, x: u.x, y: u.y, troops: u.troops, maxTroops: u.maxTroops,
      })),
    });
  }
  return { state: next, events };
}

/**
 * 전략조건(보물 게이트) 평가 (M3① §2-1). 충족 시 metStrategyConditions push + pendingRewards 적립
 * + strategyConditionMet 이벤트. 승패 무관. 결정론. 일기토 발동/유닛 이동 커밋 후 호출.
 *  - duelOccurred: duelHistory에 그 id 포함 시.
 *  - duelsInOrder: duelHistory가 duelIds를 "순서 보존 포함"(부분수열)하면 충족.
 *  - unitReachedTile: 그 유닛이 (x,y) 점유 시.
 */
function duelsInOrderSatisfied(history: string[], ids: string[]): boolean {
  let i = 0;
  for (const h of history) {
    if (h === ids[i]) i++;
    if (i === ids.length) return true;
  }
  return i === ids.length;
}

function evaluateStrategyConditions(ctx: BattleContext, state: BattleState): { state: BattleState; events: BattleEvent[] } {
  let next = state;
  const events: BattleEvent[] = [];
  for (const sc of ctx.stage.strategyConditions ?? []) {
    if (next.metStrategyConditions.includes(sc.id)) continue;
    let met = false;
    switch (sc.trigger.kind) {
      case "duelOccurred":
        met = next.duelHistory.includes(sc.trigger.duelId);
        break;
      case "duelsInOrder":
        met = duelsInOrderSatisfied(next.duelHistory, sc.trigger.duelIds);
        break;
      case "unitReachedTile": {
        const u = findUnit(next, sc.trigger.unitId);
        met = !!u && !u.retreated && u.x === sc.trigger.x && u.y === sc.trigger.y;
        break;
      }
    }
    if (!met) continue;
    const gold = sc.reward.gold ?? 0;
    next = {
      ...next,
      metStrategyConditions: [...next.metStrategyConditions, sc.id],
      pendingRewards: [...next.pendingRewards, { conditionId: sc.id, treasures: [...sc.reward.treasures], gold }],
    };
    events.push({ type: "strategyConditionMet", id: sc.id, treasures: [...sc.reward.treasures], gold });
  }
  return { state: next, events };
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
      // 적대 진영(camp 다름)만 공격 가능 — 우군(같은 camp)은 타깃 불가
      if (target.retreated || !areFoes(target.side, unit.side)) throw new Error("invalid target");
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
        next = {
          ...state,
          firedEvents: [...state.firedEvents, duel.id],
          duelHistory: [...state.duelHistory, duel.id], // 전략조건(순서) 판정용 발동 이력
        };
        if (duel.outcome.loserRetreats) {
          const loser = getUnit(next, loserId);
          next = replaceUnit(next, { ...loser, troops: 0, retreated: true });
          events.push({ type: "unitRetreated", unitId: loserId });
        }
        next = replaceUnit(next, { ...getUnit(next, unit.id), acted: true });
        break;
      }

      // 일반 공격 — 명중/회피는 시드 고정 확률(§2-1 2026-06-16), 피해 크기는 결정론(computeDamage).
      // 결정론 보정: 협공(포위도) × 돌격(기병 이동공격). 철벽·저격은 computeDamage 내부(병종 자동).
      const flankN = flankingCount(state, unit, target);
      const flankMult = flankMultiplier(ctx, flankN);
      const chargeMult = chargeMultiplier(ctx, unit);
      let attackerHit = false; // 공격자 타격이 한 번이라도 명중했나(참여 SP 판정)
      let defenderHit = false; // 방어자가 피해를 입었나(피격 SP 판정)

      // 1타 명중 롤(시드). 미스면 0뎀·hit:false만 — 피해/경험치/협공연출 없음.
      const roll1 = rollHit(ctx, next, unit, target);
      next = roll1.state;
      if (roll1.hit) {
        if (flankMult > 1) {
          events.push({ type: "flank", attackerId: unit.id, defenderId: target.id, surround: flankN, bonusPercent: Math.round((flankMult - 1) * 100) });
        }
        const dmg = computeDamage(ctx, unit, target, 1, flankMult * chargeMult);
        const targetLevelAtHit = getUnit(next, target.id).level;
        const hit = dealDamage(next, unit, getUnit(next, target.id), dmg, false);
        next = hit.state;
        events.push(...hit.events);
        const atkExp = grantExp(ctx, next, unit.id, dmg, getUnit(next, target.id).retreated, targetLevelAtHit);
        next = atkExp.state;
        events.push(...atkExp.events);
        attackerHit = true; defenderHit = true;
      } else {
        events.push({ type: "damageDealt", attackerId: unit.id, defenderId: target.id, damage: 0, counter: false, hit: false });
      }

      // 연속공격(2중공격): 대상 생존 + 이동력 우위. 각 타 독립 명중 롤. 협공·돌격 동일 배율.
      const afterHit1 = getUnit(next, target.id);
      if (!afterHit1.retreated && doubleStrikes(ctx, unit, target)) {
        const roll2 = rollHit(ctx, next, unit, afterHit1);
        next = roll2.state;
        if (roll2.hit) {
          const ratio2 = ctx.data.combat.doubleStrike.secondHitPercent / 100;
          const dmg2 = computeDamage(ctx, unit, afterHit1, ratio2, flankMult * chargeMult);
          const lvl2 = afterHit1.level;
          events.push({ type: "doubleStrike", attackerId: unit.id, defenderId: target.id });
          const hit2 = dealDamage(next, unit, afterHit1, dmg2, false);
          next = hit2.state;
          events.push(...hit2.events);
          const atkExp2 = grantExp(ctx, next, unit.id, dmg2, getUnit(next, target.id).retreated, lvl2);
          next = atkExp2.state;
          events.push(...atkExp2.events);
          attackerHit = true; defenderHit = true;
        } else {
          events.push({ type: "damageDealt", attackerId: unit.id, defenderId: afterHit1.id, damage: 0, counter: false, hit: false });
        }
      }

      // 반격: 방어측 생존 + 공격측이 방어측 사거리 안. 반격도 독립 명중 롤.
      const defender = getUnit(next, target.id);
      if (!defender.retreated) {
        const d = distance({ x: unit.x, y: unit.y }, { x: defender.x, y: defender.y });
        if (d >= defender.rangeMin && d <= defender.rangeMax) {
          const rollC = rollHit(ctx, next, defender, getUnit(next, unit.id));
          next = rollC.state;
          if (rollC.hit) {
            const ctrDmg = computeDamage(ctx, defender, getUnit(next, unit.id), ctx.data.combat.counterRatio);
            const attackerLevelAtHit = getUnit(next, unit.id).level;
            const ctr = dealDamage(next, defender, getUnit(next, unit.id), ctrDmg, true);
            next = ctr.state;
            events.push(...ctr.events);
            // 반격 경험치는 반격자(방어측)에게
            const ctrExp = grantExp(ctx, next, defender.id, ctrDmg, getUnit(next, unit.id).retreated, attackerLevelAtHit);
            next = ctrExp.state;
            events.push(...ctrExp.events);
          } else {
            events.push({ type: "damageDealt", attackerId: defender.id, defenderId: getUnit(next, unit.id).id, damage: 0, counter: true, hit: false });
          }
        }
      }
      // 필살 게이지(SP) 누적 — 명중한 타격에만(미스=참여 SP 없음). 공격자=onAttack(+격파 시 onKill), 피격자 생존 시 onHitTaken.
      {
        const spCfg = ctx.data.combat.sp;
        const killed = getUnit(next, target.id).retreated;
        if (attackerHit) {
          next = replaceUnit(next, addSp(getUnit(next, unit.id), spCfg.onAttack + (killed ? spCfg.onKill : 0)));
        }
        const def2 = getUnit(next, target.id);
        if (!def2.retreated && defenderHit) next = replaceUnit(next, addSp(def2, spCfg.onHitTaken));
      }
      // 콤보(연속 격파) — 격파는 명중으로만 일어나므로 자연 게이트.
      {
        const combo = registerComboKill(ctx, next, unit.side, getUnit(next, target.id).retreated);
        next = combo.state;
        events.push(...combo.events);
      }
      // 반격으로 공격자가 퇴각했어도 acted=true로 통일 — maybeAdvancePhase의 retreated 필터가 가드
      next = replaceUnit(next, { ...getUnit(next, unit.id), acted: true });
      break;
    }

    case "ultimate": {
      assertCanAct(state, unit, false);
      const target = getUnit(state, action.targetId);
      if (target.retreated || !areFoes(target.side, unit.side)) throw new Error("invalid target");
      if (!getAttackableTargets(ctx, state, unit.id).includes(target.id)) throw new Error(`${target.id} out of range`);
      if (!canUltimate(unit)) throw new Error(`${unit.id} SP not full`);
      // 필살 = SP 소진 대형 확정 일격. 협공/돌격/연속과 무관한 단타·무반격(결정론).
      // 네임드 시그니처(§8 고유 스킬)가 있으면 그 위력·이름 사용, 없으면 기본 필살치.
      const sig = ctx.data.commanders[unit.id]?.ultimate;
      const ultMult = 1 + (sig?.percent ?? ctx.data.combat.sp.ultimatePercent) / 100;
      const dmg = computeDamage(ctx, unit, target, 1, ultMult);
      events.push({ type: "ultimate", attackerId: unit.id, defenderId: target.id, damage: dmg, name: sig?.name });
      const tLvl = getUnit(next, target.id).level;
      const hit = dealDamage(next, unit, getUnit(next, target.id), dmg, false);
      next = hit.state;
      events.push(...hit.events);
      const ultExp = grantExp(ctx, next, unit.id, dmg, getUnit(next, target.id).retreated, tLvl);
      next = ultExp.state;
      events.push(...ultExp.events);
      // 콤보 — 필살로 격파했으면 +1
      {
        const combo = registerComboKill(ctx, next, unit.side, getUnit(next, target.id).retreated);
        next = combo.state;
        events.push(...combo.events);
      }
      // SP 소진 + acted (무반격)
      next = replaceUnit(next, { ...getUnit(next, unit.id), sp: 0, acted: true });
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
        // target "enemy" = 적대 진영(camp 다름), "ally" = 같은 진영(우군 포함)
        const isTarget = strat.target === "enemy" ? areFoes(t.side, unit.side) : !areFoes(t.side, unit.side);
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
        // 회복약: 같은 진영(아군·우군) troops를 power만큼 회복 (상한 = maxTroops)
        if (areFoes(tgt.side, unit.side)) throw new Error(`supplyItem target must be friendly`);
        const res = healTroops(state, tgt, item.power);
        next = res.state;
        amount = res.healed;
      } else {
        // attackItem: 적대 진영 troops를 power 고정 감소 (최소 0, 반격 없음)
        if (!areFoes(tgt.side, unit.side)) throw new Error(`attackItem target must be hostile`);
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

  // 행동 결과(이동/격파 등) 반영 후 전략조건·증원 평가 → 승패 판정.
  // 순서: 증원(unitDefeated 트리거 — 이번 행동의 퇴각 반영) → 전략조건(이동 도달·일기토) → 승패.
  const reinf = applyReinforcements(ctx, next);
  next = reinf.state;
  events.push(...reinf.events);

  const sc = evaluateStrategyConditions(ctx, next);
  next = sc.state;
  events.push(...sc.events);

  const outcome = checkOutcome(ctx, next);
  next = outcome.state;
  events.push(...outcome.events);

  const phase = maybeAdvancePhase(next);
  next = phase.state;
  events.push(...phase.events);

  // 페이즈 전환(턴 증가) 직후 — turn 트리거 증원 투입 + 전략조건 재평가(증원 등 상태 변화 반영).
  const reinf2 = applyReinforcements(ctx, next);
  next = reinf2.state;
  events.push(...reinf2.events);

  const sc2 = evaluateStrategyConditions(ctx, next);
  next = sc2.state;
  events.push(...sc2.events);

  // 턴 증가 직후 재판정 — 턴 제한 패배/생존 목표(surviveTurns)가 "다음 페이즈 시작 시점"에 잡히도록.
  // 첫 checkOutcome에서 이미 종료됐다면 조기 반환되고, 유닛 상태는 그 사이 불변이라 이중 판정 위험 없음
  const lateOutcome = checkOutcome(ctx, next);
  next = lateOutcome.state;
  events.push(...lateOutcome.events);

  return { state: next, events };
}
