/**
 * 입력 상태기계 (설계 §5) — 7상태 순수 리듀서.
 * 모든 전이는 (현재상태, 이벤트, ctx, battleState)의 순수 함수. 엔진 조회(getMovableTiles 등)는
 * 읽기 전용이며 커밋은 절대 하지 않는다 — 커밋은 effects로 산출해 store가 실행한다.
 *
 * movePreview 지연 커밋: selected에서 이동 가능 타일 탭 → 엔진 무커밋 상태로 고스트 좌표(preview)를
 * 들고 즉시 postMoveMenu로 진입한다(§5 표의 "movePreview → 즉시 postMoveMenu"를 한 전이로 구현).
 * 취소(menuCancel)는 커밋이 없었으므로 무손실로 selected에 복귀한다.
 */
import {
  getAttackableTargets, getMovableTiles, getStrategyTargets, unitAt,
  flankingCount, flankMultiplier, canUltimate,
} from "@tk/engine";
import type { Action, BattleContext, BattleState, Coord } from "@tk/engine";

/** preview(또는 현위치)에서 시전 가능한 책략 id 목록 — MP 충분 + 사정거리 내 표적 존재 */
function castableStrategies(
  ctx: BattleContext, battle: BattleState, unitId: string, from: Coord,
): string[] {
  const u = battle.units.find((x) => x.id === unitId);
  const cls = u ? ctx.data.unitClasses[u.classId] : undefined;
  if (!u || !cls) return [];
  return cls.strategies.filter((id) => getStrategyTargets(ctx, battle, unitId, id, from).length > 0);
}

/**
 * 유닛이 들고 있는 사용 가능한 소모품(supplyItem/attackItem) id 목록 — 중복 보유 dedupe.
 * weapon/book/horse/treasure 등 비소모성은 제외(useItem이 거부하는 category). 도구 버튼 표시 조건.
 */
export function usableItems(ctx: BattleContext, battle: BattleState, unitId: string): string[] {
  const u = battle.units.find((x) => x.id === unitId);
  if (!u) return [];
  const out: string[] = [];
  for (const id of u.items) {
    if (out.includes(id)) continue;
    const item = ctx.data.items[id];
    if (item && (item.category === "supplyItem" || item.category === "attackItem")) out.push(id);
  }
  return out;
}

/** SP 가득 + 공격 가능 대상 1기 이상 (필살 버튼 점등 조건). */
function ultimateReady(battle: BattleState, unitId: string, attackable: string[]): boolean {
  if (attackable.length === 0) return false;
  const u = battle.units.find((x) => x.id === unitId);
  return u !== undefined && canUltimate(u);
}

/**
 * preview 위치에서 협공 가능한 적이 1기 이상인가 (협공 버튼 점등 조건).
 * 공격자를 from(이동 후 칸)에 가상 배치한 state로 포위도를 세 엔진 처리와 일치시킨다.
 */
function flankOpportunity(
  ctx: BattleContext, battle: BattleState, unitId: string, from: Coord, attackable: string[],
): boolean {
  if (attackable.length === 0) return false;
  const u = battle.units.find((x) => x.id === unitId);
  if (!u) return false;
  const moved = u.x !== from.x || u.y !== from.y;
  const fState: BattleState = moved
    ? { ...battle, units: battle.units.map((x) => (x.id === unitId ? { ...x, x: from.x, y: from.y } : x)) }
    : battle;
  const attacker = moved ? fState.units.find((x) => x.id === unitId)! : u;
  return attackable.some((id) => {
    const t = fState.units.find((x) => x.id === id && !x.retreated);
    return t !== undefined && flankMultiplier(ctx, flankingCount(fState, attacker, t)) > 1;
  });
}

/**
 * 선택한 도구의 사용 가능 대상 칸 목록 — supplyItem=아군, attackItem=적 (퇴각 제외).
 * 엔진 useItem은 사거리 게이팅이 없으므로(좌표에 유닛이 있고 진영만 맞으면 OK) 맵 전역 후보를 돌려준다.
 * 검증과 하이라이트 공용. 미지/비소모 item은 빈 배열.
 */
export function itemTargetTiles(
  ctx: BattleContext, battle: BattleState, unitId: string, itemId: string,
): Coord[] {
  const u = battle.units.find((x) => x.id === unitId);
  const item = ctx.data.items[itemId];
  if (!u || !item) return [];
  if (item.category !== "supplyItem" && item.category !== "attackItem") return [];
  const wantAlly = item.category === "supplyItem";
  return battle.units
    .filter((t) => !t.retreated && (wantAlly ? t.side === u.side : t.side !== u.side))
    .map((t) => ({ x: t.x, y: t.y }));
}

export type InputState =
  | { kind: "idle"; inspectedId?: string }
  | { kind: "selected"; unitId: string; movable: Coord[]; attackable: string[] }
  | {
      kind: "postMoveMenu";
      unitId: string;
      /** 이동 전 원위치 */
      from: Coord;
      /** 고스트(이동 예정) 좌표 — from과 같으면 제자리 */
      preview: Coord;
      /** selected 복귀용 */
      movable: Coord[];
      /** preview 좌표 기준 공격 가능 대상 */
      attackable: string[];
      /** preview 기준 시전 가능 책략 id (계략 버튼 표시 조건) */
      strategies: string[];
      /** 보유 소모품 id 목록 (도구 버튼 표시 조건) */
      items: string[];
      /** preview 위치에서 협공 가능한 적이 1기 이상 (협공 버튼 점등 조건) */
      canFlank: boolean;
      /** SP 가득 + 공격 가능 대상 있음 (필살 버튼 점등 조건) */
      canUltimate: boolean;
    }
  | {
      kind: "targetSelect";
      unitId: string;
      from: Coord;
      preview: Coord;
      movable: Coord[];
      attackable: string[];
      strategies: string[];
      items: string[];
      /** 필살 조준 중이면 true — 대상 확정 시 attack 대신 ultimate 커밋 */
      ultimate?: boolean;
    }
  /** 계략: 책략 목록에서 선택 */
  | {
      kind: "strategyMenu";
      unitId: string;
      from: Coord;
      preview: Coord;
      movable: Coord[];
      attackable: string[];
      strategies: string[];
      items: string[];
    }
  /** 계략: 선택한 책략의 대상 칸 조준 */
  | {
      kind: "strategyTarget";
      unitId: string;
      from: Coord;
      preview: Coord;
      movable: Coord[];
      attackable: string[];
      strategies: string[];
      items: string[];
      strategyId: string;
      /** 시전 가능 대상 칸 (하이라이트) */
      castTiles: Coord[];
    }
  /** 도구: 소지 소모품 목록에서 선택 */
  | {
      kind: "itemMenu";
      unitId: string;
      from: Coord;
      preview: Coord;
      movable: Coord[];
      attackable: string[];
      strategies: string[];
      /** 사용 가능한 소모품 id 목록 (도구 버튼 진입 조건) */
      items: string[];
    }
  /** 도구: 선택한 도구의 대상 칸 조준 (supplyItem=아군, attackItem=적) */
  | {
      kind: "itemTarget";
      unitId: string;
      from: Coord;
      preview: Coord;
      movable: Coord[];
      attackable: string[];
      strategies: string[];
      items: string[];
      itemId: string;
      /** 회복약/공격아이템 = supplyItem/attackItem */
      itemKind: "supplyItem" | "attackItem";
      /** 사용 가능 대상 칸 (하이라이트) */
      castTiles: Coord[];
    }
  | { kind: "animating" }
  | { kind: "enemyTurn" }
  /** 자동전투 진행 중(아군 페이즈) — enemyTurn처럼 입력을 잠그고 그리디 드라이버가 구동 */
  | { kind: "autoTurn" }
  /** 턴 종료 확인 (§11 "전부대 명령 끝냅니까?") — 미행동 부대가 남아 있을 때만 진입 */
  | { kind: "confirmEndTurn"; remaining: number }
  | { kind: "battleOver"; result: "victory" | "defeat" };

export type UiEvent =
  | { type: "tapTile"; coord: Coord }
  | { type: "cancel" }
  | { type: "menuAttack" }
  | { type: "menuUltimate" }
  | { type: "menuStrategy" }
  | { type: "selectStrategy"; strategyId: string }
  | { type: "menuItem" }
  | { type: "selectItem"; itemId: string }
  | { type: "menuWait" }
  | { type: "menuCancel" }
  | { type: "endTurnPressed" }
  /** 턴 종료 확인 다이얼로그에서 "예" — 미행동 부대를 일괄 대기 처리 */
  | { type: "endTurnConfirm" }
  /** 자동전투 ON 진입 — idle(아군 페이즈)에서 autoTurn으로 전이 */
  | { type: "autoStart" }
  /** EventPlayer 큐 소진 시 store가 내부 발행 */
  | { type: "drained" };

export type UiEffect =
  /** 연쇄 원자 커밋 — store가 순서대로 applyAction하고 events를 이어붙여 한 번에 큐 투입 */
  | { type: "commit"; actions: Action[] }
  | { type: "focus"; coord: Coord };

export interface ReduceResult {
  next: InputState;
  effects: UiEffect[];
}

const noop = (state: InputState): ReduceResult => ({ next: state, effects: [] });

/**
 * 드레인 직후 공통 분기: 종료 → battleOver / AI 구동 페이즈(우군·적) → enemyTurn / 아군 페이즈 → idle.
 * auto=true(자동전투 ON)이고 아군 페이즈면 idle 대신 autoTurn으로 — 드레인마다 자동 구동을 이어간다.
 * 우군(ally) 페이즈는 플레이어 조종 불가 → enemyTurn처럼 입력을 잠그고 그리디 드라이버가 구동한다
 * (라벨/연출은 TurnBanner·BattleRenderer가 phase로 구분).
 */
function afterDrain(battle: BattleState, auto: boolean): InputState {
  if (battle.status !== "ongoing") return { kind: "battleOver", result: battle.status };
  if (battle.phase !== "player") return { kind: "enemyTurn" }; // ally·enemy = AI 페이즈
  return auto ? { kind: "autoTurn" } : { kind: "idle" };
}

function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

/** preview≠from이면 move+후속, 같으면 후속만 — 제자리는 이동 커밋 생략 (원작 문법) */
function chainActions(
  unitId: string,
  from: Coord,
  preview: Coord,
  final: Action,
): Action[] {
  return sameCoord(from, preview)
    ? [final]
    : [{ type: "move", unitId, to: preview }, final];
}

export function reduceInput(
  state: InputState,
  event: UiEvent,
  ctx: BattleContext,
  battle: BattleState,
  auto = false,
): ReduceResult {
  switch (state.kind) {
    case "idle": {
      if (event.type === "tapTile") {
        const u = unitAt(battle, event.coord.x, event.coord.y);
        const selectable =
          u !== undefined &&
          u.side === "player" &&
          !u.acted &&
          !u.retreated &&
          battle.phase === "player" &&
          battle.status === "ongoing";
        if (u && selectable) {
          const pos = { x: u.x, y: u.y };
          // 이미 이동한(moved) 유닛은 재이동 금지 — 제자리서 행동만(조조전 문법).
          // (자동전투를 유닛 이동 직후 끄거나 체인 일부만 커밋된 경우 moved=true·acted=false로
          //  남을 수 있다. 이때 다시 선택해 이동하면 chain의 move가 assertCanAct에서 터졌다.)
          if (u.moved) {
            return {
              next: {
                kind: "postMoveMenu",
                unitId: u.id,
                from: pos,
                preview: pos,
                movable: [pos],
                attackable: getAttackableTargets(ctx, battle, u.id),
                strategies: castableStrategies(ctx, battle, u.id, pos),
                items: usableItems(ctx, battle, u.id),
                canFlank: flankOpportunity(ctx, battle, u.id, pos, getAttackableTargets(ctx, battle, u.id)),
                canUltimate: ultimateReady(battle, u.id, getAttackableTargets(ctx, battle, u.id)),
              },
              effects: [{ type: "focus", coord: event.coord }],
            };
          }
          return {
            next: {
              kind: "selected",
              unitId: u.id,
              movable: getMovableTiles(ctx, battle, u.id),
              attackable: getAttackableTargets(ctx, battle, u.id),
            },
            effects: [{ type: "focus", coord: event.coord }],
          };
        }
        // 적/행동 완료 아군 → 정보 표시만. 빈 타일 → 해제
        return { next: { kind: "idle", ...(u ? { inspectedId: u.id } : {}) }, effects: [] };
      }
      if (event.type === "endTurnPressed") {
        if (battle.phase !== "player" || battle.status !== "ongoing") return noop(state);
        const remaining = battle.units.filter(
          (u) => u.side === "player" && !u.retreated && !u.acted,
        ).length;
        // 미행동 부대가 없으면 종료할 게 없음(noop). 남아 있으면 확인 다이얼로그(§11).
        if (remaining === 0) return noop(state);
        return { next: { kind: "confirmEndTurn", remaining }, effects: [] };
      }
      // 자동전투 ON 진입 — 아군 페이즈·진행 중이면 autoTurn으로 (store가 드라이버 기동)
      if (event.type === "autoStart") {
        if (battle.phase === "player" && battle.status === "ongoing") {
          return { next: { kind: "autoTurn" }, effects: [] };
        }
        return noop(state);
      }
      return noop(state);
    }
    case "confirmEndTurn": {
      if (event.type === "endTurnConfirm") {
        if (battle.phase !== "player" || battle.status !== "ongoing") {
          return { next: { kind: "idle" }, effects: [] };
        }
        const waits: Action[] = battle.units
          .filter((u) => u.side === "player" && !u.retreated && !u.acted)
          .map((u) => ({ type: "wait", unitId: u.id }));
        if (waits.length === 0) return { next: { kind: "idle" }, effects: [] };
        return { next: { kind: "animating" }, effects: [{ type: "commit", actions: waits }] };
      }
      // "아니오" — 취소하고 아군 페이즈로 복귀
      if (event.type === "cancel" || event.type === "menuCancel") {
        return { next: { kind: "idle" }, effects: [] };
      }
      return noop(state);
    }

    case "selected": {
      if (event.type === "cancel") return { next: { kind: "idle" }, effects: [] };
      if (event.type !== "tapTile") return noop(state);

      const unit = battle.units.find((u) => u.id === state.unitId);
      if (!unit) return { next: { kind: "idle" }, effects: [] }; // 방어적 — 정상 흐름에선 불가
      const pos = { x: unit.x, y: unit.y };

      // ① 자기 자신(제자리) → postMoveMenu(from=preview=현위치)
      if (sameCoord(event.coord, pos)) {
        return {
          next: {
            kind: "postMoveMenu",
            unitId: state.unitId,
            from: pos,
            preview: pos,
            movable: state.movable,
            attackable: state.attackable,
            strategies: castableStrategies(ctx, battle, state.unitId, pos),
            items: usableItems(ctx, battle, state.unitId),
            canFlank: flankOpportunity(ctx, battle, state.unitId, pos, state.attackable),
            canUltimate: ultimateReady(battle, state.unitId, state.attackable),
          },
          effects: [],
        };
      }

      // ② 현위치 사거리 내 적 → 즉시 attack 커밋
      const target = unitAt(battle, event.coord.x, event.coord.y);
      if (target && state.attackable.includes(target.id)) {
        return {
          next: { kind: "animating" },
          effects: [
            {
              type: "commit",
              actions: [{ type: "attack", unitId: state.unitId, targetId: target.id }],
            },
          ],
        };
      }

      // ③ 이동 가능 타일 → movePreview(엔진 무커밋) → 즉시 postMoveMenu
      if (state.movable.some((t) => sameCoord(t, event.coord))) {
        return {
          next: {
            kind: "postMoveMenu",
            unitId: state.unitId,
            from: pos,
            preview: event.coord,
            movable: state.movable,
            attackable: getAttackableTargets(ctx, battle, state.unitId, event.coord),
            strategies: castableStrategies(ctx, battle, state.unitId, event.coord),
            items: usableItems(ctx, battle, state.unitId),
            canFlank: flankOpportunity(
              ctx, battle, state.unitId, event.coord,
              getAttackableTargets(ctx, battle, state.unitId, event.coord),
            ),
            canUltimate: ultimateReady(
              battle, state.unitId, getAttackableTargets(ctx, battle, state.unitId, event.coord),
            ),
          },
          effects: [{ type: "focus", coord: event.coord }],
        };
      }

      // ④ 범위 밖 → 무손실 취소
      return { next: { kind: "idle" }, effects: [] };
    }

    case "postMoveMenu": {
      if (event.type === "menuAttack") {
        if (state.attackable.length === 0) return noop(state); // 대상 없음 — 버튼 비활성과 동일
        return { next: { ...state, kind: "targetSelect", ultimate: false }, effects: [] };
      }
      if (event.type === "menuUltimate") {
        if (!state.canUltimate) return noop(state); // SP 미충전 또는 대상 없음 — 버튼 dim
        return { next: { ...state, kind: "targetSelect", ultimate: true }, effects: [] };
      }
      if (event.type === "menuStrategy") {
        if (state.strategies.length === 0) return noop(state); // 시전 가능 책략 없음
        return { next: { ...state, kind: "strategyMenu" }, effects: [] };
      }
      if (event.type === "menuItem") {
        if (state.items.length === 0) return noop(state); // 사용 가능 소모품 없음
        return { next: { ...state, kind: "itemMenu" }, effects: [] };
      }
      if (event.type === "menuWait") {
        return {
          next: { kind: "animating" },
          effects: [
            {
              type: "commit",
              actions: chainActions(state.unitId, state.from, state.preview, {
                type: "wait",
                unitId: state.unitId,
              }),
            },
          ],
        };
      }
      if (event.type === "menuCancel" || event.type === "cancel") {
        // 커밋이 없었으므로 무손실 복귀 — battle은 selected 진입 시점과 동일
        return {
          next: {
            kind: "selected",
            unitId: state.unitId,
            movable: state.movable,
            attackable: getAttackableTargets(ctx, battle, state.unitId),
          },
          effects: [],
        };
      }
      return noop(state); // tapTile 포함 — 메뉴는 모달
    }

    case "targetSelect": {
      if (event.type === "cancel" || event.type === "menuCancel") {
        return {
          next: {
            ...state,
            kind: "postMoveMenu",
            canFlank: flankOpportunity(ctx, battle, state.unitId, state.preview, state.attackable),
            canUltimate: ultimateReady(battle, state.unitId, state.attackable),
          },
          effects: [],
        };
      }
      if (event.type === "tapTile") {
        const target = unitAt(battle, event.coord.x, event.coord.y);
        if (!target || !state.attackable.includes(target.id)) return noop(state);
        // 필살 조준이면 ultimate, 아니면 일반 attack 커밋.
        const final: Action = state.ultimate
          ? { type: "ultimate", unitId: state.unitId, targetId: target.id }
          : { type: "attack", unitId: state.unitId, targetId: target.id };
        return {
          next: { kind: "animating" },
          effects: [{ type: "commit", actions: chainActions(state.unitId, state.from, state.preview, final) }],
        };
      }
      return noop(state);
    }

    case "strategyMenu": {
      if (event.type === "selectStrategy") {
        if (!state.strategies.includes(event.strategyId)) return noop(state);
        const castTiles = getStrategyTargets(ctx, battle, state.unitId, event.strategyId, state.preview);
        if (castTiles.length === 0) return noop(state);
        return { next: { ...state, kind: "strategyTarget", strategyId: event.strategyId, castTiles }, effects: [] };
      }
      if (event.type === "cancel" || event.type === "menuCancel") {
        return {
          next: {
            ...state,
            kind: "postMoveMenu",
            canFlank: flankOpportunity(ctx, battle, state.unitId, state.preview, state.attackable),
            canUltimate: ultimateReady(battle, state.unitId, state.attackable),
          },
          effects: [],
        };
      }
      return noop(state); // tapTile 등 무시 — 모달
    }

    case "strategyTarget": {
      if (event.type === "cancel" || event.type === "menuCancel") {
        return { next: { ...state, kind: "strategyMenu" }, effects: [] };
      }
      if (event.type === "tapTile") {
        if (!state.castTiles.some((t) => sameCoord(t, event.coord))) return noop(state);
        return {
          next: { kind: "animating" },
          effects: [
            {
              type: "commit",
              actions: chainActions(state.unitId, state.from, state.preview, {
                type: "strategy",
                unitId: state.unitId,
                strategyId: state.strategyId,
                target: event.coord,
              }),
            },
          ],
        };
      }
      return noop(state);
    }

    case "itemMenu": {
      if (event.type === "selectItem") {
        if (!state.items.includes(event.itemId)) return noop(state);
        const item = ctx.data.items[event.itemId];
        if (!item || (item.category !== "supplyItem" && item.category !== "attackItem")) {
          return noop(state);
        }
        const castTiles = itemTargetTiles(ctx, battle, state.unitId, event.itemId);
        if (castTiles.length === 0) return noop(state); // 대상 없음 — 사용 불가
        return {
          next: {
            ...state,
            kind: "itemTarget",
            itemId: event.itemId,
            itemKind: item.category,
            castTiles,
          },
          effects: [],
        };
      }
      if (event.type === "cancel" || event.type === "menuCancel") {
        return {
          next: {
            ...state,
            kind: "postMoveMenu",
            canFlank: flankOpportunity(ctx, battle, state.unitId, state.preview, state.attackable),
            canUltimate: ultimateReady(battle, state.unitId, state.attackable),
          },
          effects: [],
        };
      }
      return noop(state); // tapTile 등 무시 — 모달
    }

    case "itemTarget": {
      if (event.type === "cancel" || event.type === "menuCancel") {
        return { next: { ...state, kind: "itemMenu" }, effects: [] };
      }
      if (event.type === "tapTile") {
        if (!state.castTiles.some((t) => sameCoord(t, event.coord))) return noop(state);
        return {
          next: { kind: "animating" },
          effects: [
            {
              type: "commit",
              actions: chainActions(state.unitId, state.from, state.preview, {
                type: "useItem",
                unitId: state.unitId,
                itemId: state.itemId,
                target: event.coord,
              }),
            },
          ],
        };
      }
      return noop(state);
    }

    case "animating": {
      if (event.type === "drained") return { next: afterDrain(battle, auto), effects: [] };
      return noop(state); // 재생 중 모든 입력 무시 (카메라는 InputAdapter 단계에서 별도 처리)
    }

    case "enemyTurn": {
      if (event.type === "drained") return { next: afterDrain(battle, auto), effects: [] };
      return noop(state);
    }

    case "autoTurn": {
      // 자동전투 구동 중 — 드레인마다 분기 재평가. auto OFF가 되면 afterDrain이 idle로 돌려준다.
      if (event.type === "drained") return { next: afterDrain(battle, auto), effects: [] };
      return noop(state); // 그 외 입력 무시 (enemyTurn과 동일)
    }

    case "battleOver":
      return noop(state);
  }
}
