import {
  getAttackableTargets, getMovableTiles, distance, areFoes, pathCostField,
  computeDamage, flankingCount, flankMultiplier, chargeMultiplier, doubleStrikes,
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

  // ── 탈출 유닛은 *질주 우선* — 목표로 더 갈 수 있으면 인접 적과 싸우지 않고 빠져나간다 ──────
  // (단기필마·도하: 멈춰서 교전하면 추격대에 포위돼 즉사. 길이 막혀 더 못 가면 그때 평소 로직.)
  // 탈출 유닛에 한정 — 일반 전투 유닛은 종전대로 공격 우선(아래).
  const escapeGoal = !unit.moved ? escapeGoalFor(ctx, unit) : undefined;
  if (escapeGoal) {
    const dash = stepToward(ctx, state, unit, escapeGoal);
    if (dash) return dash;
    // 더 못 가까이 감(목표 도달/완전 차단) → 인접 적이 있으면 길을 트려 친다, 없으면 대기.
    const blockers = getAttackableTargets(ctx, state, unit.id);
    if (blockers.length > 0) {
      const weakest = blockers.map((id) => state.units.find((u) => u.id === id)!)
        .sort((a, b) => a.troops - b.troops)[0]!;
      return { type: "attack", unitId: unit.id, targetId: weakest.id };
    }
    return { type: "wait", unitId: unit.id };
  }

  // ── 이동+공격 탐색 (협공/돌격 활용) ──────────────────────────────────────────
  // 일반 전투 유닛은 제자리 공격뿐 아니라 *이동 후 공격*까지 실제 피해(협공·돌격 포함)로
  // 평가해 격파 > 최대피해 위치를 고른다. 그래야 결정론 보너스(협공/돌격)를 정책이 실제로 살린다.
  // 특수역(호위/보호/점령 지명)은 자기 분기(생존·라우팅)가 우선이므로 제외 — 기존 동작 보존.
  const special =
    isEscort(ctx, unit) ||
    isProtected(ctx, unit) ||
    (!unit.moved && captureGoalFor(ctx, state, unit) !== undefined);
  if (!special) {
    // 전진(이동 후 공격) 허용 여부: *생존(surviveTurns) 스테이지에서만* 금지(제자리 공격만).
    // 섬멸은 물론 *탈출(reachTile)* 스테이지에서도 호위 유닛은 전진해 적을 쳐 길을 열어야 한다 —
    // 묶어두면 탈출 유닛이 단신으로 적진에 갇혀 목표에 도달 못 한다(여남).
    const plan = bestAttackPlan(ctx, state, unit, !isHoldPosture(ctx));
    if (plan) return plan;
  }

  // 공격 가능하면 가장 약한 적 격파 우선 (특수역 폴백 — 제자리 사거리 내)
  const targets = getAttackableTargets(ctx, state, unit.id);
  if (targets.length > 0) {
    const weakest = targets
      .map((id) => state.units.find((u) => u.id === id)!)
      .sort((a, b) => a.troops - b.troops)[0]!;
    return { type: "attack", unitId: unit.id, targetId: weakest.id };
  }

  if (!unit.moved) {
    // (탈출 유닛 라우팅은 위 "질주 우선" 분기에서 이미 처리됨 — 여기 도달하면 비탈출 유닛.)

    // ── 목표 인식: 점령 목표의 *지명 돌격수* → 점령 칸으로 라우팅 ────────────────
    // captureTile은 unitId가 없어 "누가 점령하느냐"를 정책이 정한다. 보호 대상(군주)을
    // 자살시키지 않도록, 점령 칸에 가장 가까운 *비보호* 아군 1명만 돌격수로 지명한다(동탁
    // 추격전: 기병이 관문을 뚫고 점령). 나머지는 평소대로 길을 여는 그리디 교전을 한다.
    const captureTile = captureGoalFor(ctx, state, unit);
    if (captureTile) {
      const move = stepToward(ctx, state, unit, captureTile);
      if (move) return move;
      return { type: "wait", unitId: unit.id }; // 점령 칸 도달/정체 시 대기
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

      // ── 목표 인식: 보호 대상(군주/단신 방어자) → 안전거리 유지 ──────────────────────
      // 자세(posture)를 목표 타입으로 가른다:
      //  - 방어/탈출(surviveTurns·reachTile 등 비-섬멸)에선 보호 유닛이 **전진 금지** — 적과
      //    거리를 좁히면 단신 돌격해 즉사(장판교 장비·적벽 유비). 안전하면 버티고, 위험하면 카이팅.
      //  - 섬멸(defeatAll·defeatUnit)에선 *이겨야* 하므로 전열 뒤에서 안전거리를 두고 전진한다
      //    (군주도 막타·수적 우위에 기여). 단 SAFE_BUFFER 밖으로는 안 나간다.
      if (isProtected(ctx, unit)) {
        const SAFE_BUFFER = 3;
        const curDist = nearestEnemyDist({ x: unit.x, y: unit.y });
        if (isOffensivePosture(ctx)) {
          // 섬멸전: 안전권(≥BUFFER) 칸 중 적에 가장 가까운 칸으로 전진(전열 뒤를 따라감).
          const safe = tiles.filter((t) => nearestEnemyDist(t) >= SAFE_BUFFER);
          const pool = safe.length > 0 ? safe : tiles;
          const best = safe.length > 0
            ? [...pool].sort((a, b) => nearestEnemyDist(a) - nearestEnemyDist(b))[0]
            : [...pool].sort((a, b) => nearestEnemyDist(b) - nearestEnemyDist(a))[0];
          if (best && !(best.x === unit.x && best.y === unit.y)) {
            return { type: "move", unitId: unit.id, to: best };
          }
          return { type: "wait", unitId: unit.id };
        }
        // 방어/탈출: 전진 금지. 안전하면 hold, 위험하면 멀어지는 칸으로만 후퇴(카이팅).
        if (curDist >= SAFE_BUFFER) return { type: "wait", unitId: unit.id };
        const best = [...tiles].sort((a, b) => nearestEnemyDist(b) - nearestEnemyDist(a))[0];
        if (best && nearestEnemyDist(best) > curDist) {
          return { type: "move", unitId: unit.id, to: best };
        }
        return { type: "wait", unitId: unit.id };
      }

      // *생존(surviveTurns)* 스테이지만: 일반 유닛도 돌진 금지 — 안전하면 hold, 위험하면
      // 적에서 멀어지는 칸으로만 후퇴(스크린 유지). 탈출/섬멸은 전진(아래)으로 길을 연다.
      if (isHoldPosture(ctx)) {
        const SAFE = 2;
        const curDist = nearestEnemyDist({ x: unit.x, y: unit.y });
        if (curDist < SAFE) {
          const away = [...tiles].sort((a, b) => nearestEnemyDist(b) - nearestEnemyDist(a))[0];
          if (away && nearestEnemyDist(away) > curDist) {
            return { type: "move", unitId: unit.id, to: away };
          }
        }
        return { type: "wait", unitId: unit.id };
      }

      // 섬멸 자세: 가장 가까운 적과의 *맨해튼* 거리 최소화로 전진 (기존 동작 보존).
      const best = [...tiles].sort((a, b) => nearestEnemyDist(a) - nearestEnemyDist(b))[0];
      if (best && !(best.x === unit.x && best.y === unit.y)) {
        return { type: "move", unitId: unit.id, to: best };
      }
    }
  }

  return { type: "wait", unitId: unit.id };
}

/**
 * pos(이동 후 칸)에서 target을 칠 때의 실제 피해 — 엔진 attack 처리와 동일하게
 * 협공(포위도) × 돌격(기병 이동공격)을 반영한다. 이동이면 공격자를 pos에 moved=true로 가상 배치.
 */
function attackDamageFrom(
  ctx: BattleContext, state: BattleState, unit: UnitState, pos: Coord, target: UnitState,
): number {
  const moving = pos.x !== unit.x || pos.y !== unit.y;
  const atkAt: UnitState = moving ? { ...unit, x: pos.x, y: pos.y, moved: true } : unit;
  const st: BattleState = moving
    ? { ...state, units: state.units.map((u) => (u.id === unit.id ? atkAt : u)) }
    : state;
  const mult = flankMultiplier(ctx, flankingCount(st, atkAt, target)) * chargeMultiplier(ctx, atkAt);
  const dmg1 = computeDamage(ctx, atkAt, target, 1, mult);
  // 연속공격: 1타로 격파 안 되고 이동력 우위면 2타 합산(정책이 빠른 병종 공격을 제대로 평가).
  if (target.troops - dmg1 > 0 && doubleStrikes(ctx, atkAt, target)) {
    return dmg1 + computeDamage(ctx, atkAt, target, ctx.data.combat.doubleStrike.secondHitPercent / 100, mult);
  }
  return dmg1;
}

/**
 * 일반 전투 유닛의 최적 공격 계획 — 제자리 ∪ 이동가능 칸 각각에서 사거리 내 대상별 실제 피해를
 * 평가해 **격파 > 최대피해** 위치를 고른다. 이동이 필요하면 그 이동을 반환(다음 호출에서 공격).
 * 협공/돌격이 피해에 반영되므로 정책이 자연히 포위·돌격 위치를 선호하게 된다. 대상이 없으면 undefined.
 * 동률은 제자리(불필요 이동 방지)를 우선한다.
 */
function bestAttackPlan(
  ctx: BattleContext, state: BattleState, unit: UnitState, mayAdvance: boolean,
): Action | undefined {
  const positions: Array<{ pos: Coord; moving: boolean }> = [
    { pos: { x: unit.x, y: unit.y }, moving: false },
  ];
  if (mayAdvance && !unit.moved) {
    for (const t of getMovableTiles(ctx, state, unit.id)) {
      if (t.x === unit.x && t.y === unit.y) continue;
      positions.push({ pos: t, moving: true });
    }
  }
  let best: { action: Action; score: number } | undefined;
  for (const { pos, moving } of positions) {
    for (const tid of getAttackableTargets(ctx, state, unit.id, pos)) {
      const target = state.units.find((u) => u.id === tid);
      if (!target) continue;
      const dmg = attackDamageFrom(ctx, state, unit, pos, target);
      const kill = target.troops - dmg <= 0;
      // 격파 최우선(+1e6), 그다음 피해. 제자리는 +0.5 가산해 동률·근소차에서 이동을 억제.
      const score = (kill ? 1_000_000 : 0) + dmg + (moving ? 0 : 0.5);
      if (!best || score > best.score) {
        best = {
          action: moving
            ? { type: "move", unitId: unit.id, to: pos }
            : { type: "attack", unitId: unit.id, targetId: tid },
          score,
        };
      }
    }
  }
  return best?.action;
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

/**
 * 이 유닛이 non-optional captureTile 목표의 *지명 돌격수*면 그 점령 칸. 아니면 undefined.
 * captureTile은 점령 주체(unitId)가 없으므로 정책이 한 명을 고른다:
 *  - 대상 진영(o.side)이고, 보호 대상(unitRetreated 군주)이 아니며, 아직 퇴각 안 한 유닛 중
 *    점령 칸에 맨해튼 거리상 가장 가까운 1명(동률은 id 사전순 — 결정론적).
 *  - 비보호 후보가 하나도 없으면(예: 군주만 남음) 보호 무시하고 군주라도 보냄(교착 방지).
 * 그 돌격수만 점령 칸으로 라우팅하고, 나머지는 평소대로 그리디 교전(길 열기)을 한다.
 */
function captureGoalFor(ctx: BattleContext, state: BattleState, unit: UnitState): Coord | undefined {
  for (const o of ctx.stage.objectives ?? []) {
    if (o.kind !== "captureTile" || o.optional) continue;
    if (unit.side !== o.side) continue;
    const goal = { x: o.x, y: o.y };
    const candidates = state.units.filter((u) => u.side === o.side && !u.retreated);
    const unprotected = candidates.filter((u) => !isProtected(ctx, u));
    const pool = unprotected.length > 0 ? unprotected : candidates;
    const captor = [...pool].sort((a, b) => {
      const d = distance({ x: a.x, y: a.y }, goal) - distance({ x: b.x, y: b.y }, goal);
      return d !== 0 ? d : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    })[0];
    if (captor && captor.id === unit.id) return goal;
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

/**
 * 이 스테이지가 *섬멸 자세*인가 — 필수 목표가 적 격파(defeatAll/defeatUnit) 위주면 true.
 * surviveTurns·reachTile·captureTile 등 비-섬멸 필수 목표가 하나라도 있으면 *방어/탈출 자세*
 * (false)로 본다 — 보호 유닛이 전진하면 안 되는 국면. objectives 없으면(레거시 victory) 섬멸로
 * 간주(기존 동작 보존).
 */
function isOffensivePosture(ctx: BattleContext): boolean {
  const objs = ctx.stage.objectives;
  if (!objs || objs.length === 0) return true; // 레거시 = 섬멸
  const required = objs.filter((o) => !o.optional);
  if (required.length === 0) return true;
  // 필수 목표가 전부 defeat 계열이어야 섬멸 자세. 하나라도 방어/탈출/점령이면 비섬멸.
  return required.every((o) => o.kind === "defeatAll" || o.kind === "defeatUnit");
}

/**
 * *수성(hold) 자세* — 필수 목표에 surviveTurns가 있으면 true(장판교 5턴 방어 등).
 * 이때만 일반 유닛도 전진/돌진을 멈추고 스크린·생존을 우선한다. 탈출(reachTile)은 hold가 아니다 —
 * 호위 유닛이 전진해 적을 쳐 길을 열어야 탈출 유닛이 목표에 닿는다.
 */
function isHoldPosture(ctx: BattleContext): boolean {
  const objs = ctx.stage.objectives;
  if (!objs) return false;
  return objs.some((o) => !o.optional && o.kind === "surviveTurns");
}

/** 이 유닛이 unitRetreated 패배조건(보호 대상 군주)이면 true — 단신 돌격 금지. */
function isProtected(ctx: BattleContext, unit: UnitState): boolean {
  for (const f of ctx.stage.failConditions ?? []) {
    if (f.kind === "unitRetreated" && f.unitId === unit.id) return true;
  }
  return false;
}

/**
 * 이동 가능 타일 중 goal 까지 **지형비용 최단거리**(pathCostField)를 최소화하는 칸으로 한 걸음.
 * 맨해튼이 아니라 실제 경로 비용을 써서 강·협곡을 다리로 우회하는 길을 인식한다(한진·여남 등
 * 도하/탈출 스테이지에서 강에 막혀 정체하던 버그 해결). 더 못 가까이 가면 undefined(정체 → 대기).
 * 동률은 맨해튼 거리로 타이브레이크(다리 입구에서 직선 접근 우선).
 */
function stepToward(
  ctx: BattleContext, state: BattleState, unit: UnitState, goal: Coord,
): Action | undefined {
  const tiles = getMovableTiles(ctx, state, unit.id);
  const field = pathCostField(ctx, goal, unit.moveClass);
  const cost = (c: Coord) => field.get(`${c.x},${c.y}`) ?? Infinity;
  const cur = cost({ x: unit.x, y: unit.y });
  // 목표가 도달 불가(통행불가에 둘러싸임)면 맨해튼 폴백 — 최소한의 안전망
  if (cur === Infinity) {
    const md = (c: Coord) => distance(c, goal);
    const curMd = md({ x: unit.x, y: unit.y });
    const b = [...tiles].sort((a, c) => md(a) - md(c))[0];
    return b && md(b) < curMd ? { type: "move", unitId: unit.id, to: b } : undefined;
  }
  const best = [...tiles].sort((a, b) => {
    const d = cost(a) - cost(b);
    return d !== 0 ? d : distance(a, goal) - distance(b, goal);
  })[0];
  if (best && cost(best) < cur) {
    return { type: "move", unitId: unit.id, to: best };
  }
  return undefined;
}
