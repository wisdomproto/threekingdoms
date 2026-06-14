import {
  getAttackableTargets, getMovableTiles, distance, areFoes,
  type Action, type BattleContext, type BattleState, type UnitState, type Coord,
} from "@tk/engine";

/**
 * 그리디 정책 (전 진영 공용 — player·ally·enemy) + **목표 인식**(M3②).
 *
 * 기본 행동 (순수 그리디):
 *  1) 현재 위치에서 공격 가능하면 HP가 가장 낮은 적 공격
 *  2) 아직 안 움직였으면 가장 가까운 적(적대 진영)과의 거리를 최소화하는 타일로 이동
 *  3) 그 외 대기
 *
 * 목표 인식 오버레이 (스테이지 objectives/failConditions에서 유도 — 27스테이지 비섬멸 목표 검증용):
 *  - **탈출 유닛**: non-optional reachTile 목표의 unitId (예: 하비1차 유비). 적을 향해 돌진하지 않고
 *    목표 칸을 향해 거리를 최소화하며 이동한다. 인접한 적이 길을 막으면 그 적만 친다.
 *  - **호위 대상**: allRetreated 패배조건에 묶인 우군(예: 서주 도겸). 적진으로 자살하지 않고
 *    가장 가까운 적에서 *멀어지는* 방향(또는 같은 camp 본대 쪽)으로 후퇴해 생존을 우선한다.
 *  - **보호 대상(군주)**: unitRetreated 패배조건의 unitId (예: 유비). 군대보다 앞서 적진에
 *    돌격하지 않는다 — 적과 SAFE_BUFFER 칸 이상 거리를 유지하는 타일 중 적에 가장 가까운 칸으로만
 *    전진(전열 뒤를 따라감). 그래서 군주가 단신 돌격해 즉사하는 그리디 자살을 막는다.
 *
 * "적"은 camp가 다른 진영(areFoes). 우군(ally)은 player를 적으로 보지 않고, enemy는 player·ally 양쪽이 적.
 * 이 오버레이는 데이터(시나리오 배치)는 건드리지 않고 *플레이어/우군의 합리적 의도*만 흉내 낸다 —
 * 순수 그리디는 "최단거리 적 돌진"뿐이라 탈출·호위형 목표를 영원히 달성 못 하기 때문.
 */
export function chooseAction(ctx: BattleContext, state: BattleState): Action | undefined {
  const unit = state.units.find(
    (u) => u.side === state.phase && !u.retreated && !u.acted,
  );
  if (!unit) return undefined; // applyAction이 페이즈를 자동 전환하므로 정상적으론 도달 안 함

  // 공격 가능하면 가장 약한 적 격파 우선 (탈출 유닛도 길을 막는 적은 친다)
  const targets = getAttackableTargets(ctx, state, unit.id);
  if (targets.length > 0) {
    const weakest = targets
      .map((id) => state.units.find((u) => u.id === id)!)
      .sort((a, b) => a.troops - b.troops)[0]!;
    return { type: "attack", unitId: unit.id, targetId: weakest.id };
  }

  if (!unit.moved) {
    // ── 목표 인식: 탈출 유닛 → 목표 칸으로 라우팅 ──────────────────────────────
    const escapeTile = escapeGoalFor(ctx, unit);
    if (escapeTile) {
      const move = stepToward(ctx, state, unit, escapeTile);
      if (move) return move;
      // 목표 칸에 이미 도달했거나 더 못 가까이 가면 대기 (목표 충족 후 소모 방지)
      return { type: "wait", unitId: unit.id };
    }

    const enemies = state.units.filter((u) => areFoes(u.side, unit.side) && !u.retreated);
    if (enemies.length > 0) {
      const tiles = getMovableTiles(ctx, state, unit.id);

      // ── 목표 인식: 호위 대상 우군 → 적에서 멀어지는 후퇴 ──────────────────────
      if (isEscort(ctx, unit)) {
        const score = (t: Coord) =>
          Math.min(...enemies.map((e) => distance(t, { x: e.x, y: e.y })));
        // 적과의 최소거리를 *최대화*(멀어짐). 동률이면 본대(같은 camp 평균 위치)에 가까이.
        const allies = state.units.filter((u) => !areFoes(u.side, unit.side) && u.id !== unit.id && !u.retreated);
        const cx = allies.length ? allies.reduce((a, u) => a + u.x, 0) / allies.length : unit.x;
        const cy = allies.length ? allies.reduce((a, u) => a + u.y, 0) / allies.length : unit.y;
        const best = [...tiles].sort((a, b) => {
          const d = score(b) - score(a);
          if (d !== 0) return d;
          return distance(a, { x: cx, y: cy }) - distance(b, { x: cx, y: cy });
        })[0];
        if (best && !(best.x === unit.x && best.y === unit.y)) {
          return { type: "move", unitId: unit.id, to: best };
        }
        return { type: "wait", unitId: unit.id };
      }

      const nearestEnemyDist = (t: Coord) =>
        Math.min(...enemies.map((e) => distance(t, { x: e.x, y: e.y })));

      // ── 목표 인식: 보호 대상(군주) → 전열 뒤에서 안전거리 유지하며 전진 ──────────
      if (isProtected(ctx, unit)) {
        // SAFE_BUFFER 이상 떨어진 타일만 후보(적 사거리 밖). 그중 적에 가장 가까운 칸으로 전진.
        const SAFE_BUFFER = 3;
        const safe = tiles.filter((t) => nearestEnemyDist(t) >= SAFE_BUFFER);
        const pool = safe.length > 0 ? safe : tiles; // 전부 위험하면(포위) 그나마 가장 안전한 칸
        const best = safe.length > 0
          ? [...pool].sort((a, b) => nearestEnemyDist(a) - nearestEnemyDist(b))[0] // 안전권 내 최대 전진
          : [...pool].sort((a, b) => nearestEnemyDist(b) - nearestEnemyDist(a))[0]; // 위험권: 가장 안전한 칸으로
        if (best && !(best.x === unit.x && best.y === unit.y)) {
          return { type: "move", unitId: unit.id, to: best };
        }
        return { type: "wait", unitId: unit.id };
      }

      // 순수 그리디: 가장 가까운 적과의 거리 최소화
      const best = [...tiles].sort((a, b) => nearestEnemyDist(a) - nearestEnemyDist(b))[0];
      if (best && !(best.x === unit.x && best.y === unit.y)) {
        return { type: "move", unitId: unit.id, to: best };
      }
    }
  }

  return { type: "wait", unitId: unit.id };
}

/** 이 유닛이 non-optional reachTile 목표의 대상이면 그 목표 칸. 아니면 undefined. */
function escapeGoalFor(ctx: BattleContext, unit: UnitState): Coord | undefined {
  for (const o of ctx.stage.objectives ?? []) {
    if (o.kind === "reachTile" && !o.optional && o.unitId === unit.id) {
      return { x: o.x, y: o.y };
    }
  }
  return undefined;
}

/** 이 유닛이 allRetreated 패배조건(호위 대상)에 포함돼 있으면 true. */
function isEscort(ctx: BattleContext, unit: UnitState): boolean {
  for (const f of ctx.stage.failConditions ?? []) {
    if (f.kind === "allRetreated" && f.unitIds.includes(unit.id)) return true;
  }
  return false;
}

/** 이 유닛이 unitRetreated 패배조건(보호 대상 군주)이면 true — 단신 돌격 금지. */
function isProtected(ctx: BattleContext, unit: UnitState): boolean {
  for (const f of ctx.stage.failConditions ?? []) {
    if (f.kind === "unitRetreated" && f.unitId === unit.id) return true;
  }
  return false;
}

/** 이동 가능 타일 중 goal 까지 맨해튼 거리를 최소화하는 칸으로 한 걸음. 더 못 가까이 가면 undefined. */
function stepToward(
  ctx: BattleContext, state: BattleState, unit: UnitState, goal: Coord,
): Action | undefined {
  const tiles = getMovableTiles(ctx, state, unit.id);
  const cur = distance({ x: unit.x, y: unit.y }, goal);
  const best = [...tiles].sort((a, b) => distance(a, goal) - distance(b, goal))[0];
  if (best && distance(best, goal) < cur) {
    return { type: "move", unitId: unit.id, to: best };
  }
  return undefined;
}
