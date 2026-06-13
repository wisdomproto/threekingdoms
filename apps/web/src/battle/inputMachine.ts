/**
 * 입력 상태기계 (설계 §5) — 7상태 순수 리듀서.
 * 모든 전이는 (현재상태, 이벤트, ctx, battleState)의 순수 함수. 엔진 조회(getMovableTiles 등)는
 * 읽기 전용이며 커밋은 절대 하지 않는다 — 커밋은 effects로 산출해 store가 실행한다.
 *
 * movePreview 지연 커밋: selected에서 이동 가능 타일 탭 → 엔진 무커밋 상태로 고스트 좌표(preview)를
 * 들고 즉시 postMoveMenu로 진입한다(§5 표의 "movePreview → 즉시 postMoveMenu"를 한 전이로 구현).
 * 취소(menuCancel)는 커밋이 없었으므로 무손실로 selected에 복귀한다.
 */
import { getAttackableTargets, getMovableTiles, unitAt } from "@tk/engine";
import type { Action, BattleContext, BattleState, Coord } from "@tk/engine";

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
    }
  | {
      kind: "targetSelect";
      unitId: string;
      from: Coord;
      preview: Coord;
      movable: Coord[];
      attackable: string[];
    }
  | { kind: "animating" }
  | { kind: "enemyTurn" }
  /** 자동전투 진행 중(아군 페이즈) — enemyTurn처럼 입력을 잠그고 그리디 드라이버가 구동 */
  | { kind: "autoTurn" }
  | { kind: "battleOver"; result: "victory" | "defeat" };

export type UiEvent =
  | { type: "tapTile"; coord: Coord }
  | { type: "cancel" }
  | { type: "menuAttack" }
  | { type: "menuWait" }
  | { type: "menuCancel" }
  | { type: "endTurnPressed" }
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
 * 드레인 직후 공통 분기: 종료 → battleOver / 적 페이즈 → enemyTurn / 그 외 → idle.
 * auto=true(자동전투 ON)이고 아군 페이즈면 idle 대신 autoTurn으로 — 드레인마다 자동 구동을 이어간다.
 */
function afterDrain(battle: BattleState, auto: boolean): InputState {
  if (battle.status !== "ongoing") return { kind: "battleOver", result: battle.status };
  if (battle.phase === "enemy") return { kind: "enemyTurn" };
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
        const waits: Action[] = battle.units
          .filter((u) => u.side === "player" && !u.retreated && !u.acted)
          .map((u) => ({ type: "wait", unitId: u.id }));
        if (waits.length === 0) return noop(state);
        return { next: { kind: "animating" }, effects: [{ type: "commit", actions: waits }] };
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
        return { next: { ...state, kind: "targetSelect" }, effects: [] };
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
        return { next: { ...state, kind: "postMoveMenu" }, effects: [] };
      }
      if (event.type === "tapTile") {
        const target = unitAt(battle, event.coord.x, event.coord.y);
        if (!target || !state.attackable.includes(target.id)) return noop(state);
        return {
          next: { kind: "animating" },
          effects: [
            {
              type: "commit",
              actions: chainActions(state.unitId, state.from, state.preview, {
                type: "attack",
                unitId: state.unitId,
                targetId: target.id,
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
