/**
 * 스위트 1 (설계 §7) — 입력 상태기계 전이 전수 검증.
 * 실제 ctx(gameData + 05-sishuiguan) 픽스처. 핵심 계약:
 *  - movePreview 취소 = 엔진 무호출 (커밋 effect 0건, store 수준에서 actionLog 불변까지)
 *  - from(프리뷰 좌표) 기준 공격 대상 산출
 *  - animating/enemyTurn 중 입력 무시, battleOver는 영구 잠금
 */
import { describe, expect, it } from "vitest";
import { createBattle, getAttackableTargets, getMovableTiles } from "@tk/engine";
import type { BattleState, Coord } from "@tk/engine";
import { reduceInput, type InputState, type UiEvent } from "../inputMachine";
import { BattleStore } from "../store";
import { findUnit, sishuiCtx, withUnit } from "./fixtures";

const SEED = 42;
const ctx = sishuiCtx;
const state0 = createBattle(ctx, SEED);

// 관우(경기병, move 6, 사거리 1)는 (50,15). 주변 y=14~16 x=44~55는 평지 — 맵 데이터 전제
const GUANYU = "관우";
const HUAXIONG = "화웅";
const guanyuPos: Coord = { x: 50, y: 15 };

/** 관우 기준 시나리오 상태: 화웅을 (48,15)로 — 현위치 사거리 밖(거리 2), 프리뷰 (49,15)에서 사거리 안 */
const nearState = withUnit(state0, HUAXIONG, { x: 48, y: 15 });
/** 화웅을 (51,15)로 — 현위치에서 즉시 공격 가능(거리 1) */
const adjacentState = withUnit(state0, HUAXIONG, { x: 51, y: 15 });

function select(battle: BattleState, unitId: string): InputState {
  const u = findUnit(battle, unitId);
  const r = reduceInput({ kind: "idle" }, { type: "tapTile", coord: { x: u.x, y: u.y } }, ctx, battle);
  expect(r.next.kind).toBe("selected");
  return r.next;
}

describe("idle", () => {
  it("미행동 아군 탭 → selected + 하이라이트 집합(movable/attackable) 보관 + focus", () => {
    const r = reduceInput({ kind: "idle" }, { type: "tapTile", coord: guanyuPos }, ctx, state0);
    expect(r.next).toMatchObject({ kind: "selected", unitId: GUANYU });
    if (r.next.kind !== "selected") throw new Error("unreachable");
    expect(r.next.movable).toEqual(getMovableTiles(ctx, state0, GUANYU));
    expect(r.next.movable.length).toBeGreaterThan(10);
    expect(r.next.attackable).toEqual([]); // 적은 맵 반대편 — 현위치 사거리 밖
    expect(r.effects).toEqual([{ type: "focus", coord: guanyuPos }]);
  });

  it("적 탭 → idle 유지 + 정보 표시(inspectedId), 커밋 없음", () => {
    const hx = findUnit(state0, HUAXIONG);
    const r = reduceInput({ kind: "idle" }, { type: "tapTile", coord: { x: hx.x, y: hx.y } }, ctx, state0);
    expect(r.next).toEqual({ kind: "idle", inspectedId: HUAXIONG });
    expect(r.effects).toEqual([]);
  });

  it("빈 타일 탭 → idle (정보 해제)", () => {
    const r = reduceInput(
      { kind: "idle", inspectedId: HUAXIONG },
      { type: "tapTile", coord: { x: 45, y: 15 } },
      ctx,
      state0,
    );
    expect(r.next).toEqual({ kind: "idle" });
  });

  it("행동 완료 아군 탭 → 선택 불가, 정보 표시만", () => {
    const acted = withUnit(state0, GUANYU, { acted: true });
    const r = reduceInput({ kind: "idle" }, { type: "tapTile", coord: guanyuPos }, ctx, acted);
    expect(r.next).toEqual({ kind: "idle", inspectedId: GUANYU });
  });

  it("적 페이즈에는 아군 탭도 선택 불가", () => {
    const enemyPhase: BattleState = { ...state0, phase: "enemy" };
    const r = reduceInput({ kind: "idle" }, { type: "tapTile", coord: guanyuPos }, ctx, enemyPhase);
    expect(r.next).toEqual({ kind: "idle", inspectedId: GUANYU });
  });

  it("endTurnPressed → 미행동 아군 전원 wait 순차 커밋 + animating", () => {
    const one = withUnit(state0, GUANYU, { acted: true });
    const r = reduceInput({ kind: "idle" }, { type: "endTurnPressed" }, ctx, one);
    expect(r.next).toEqual({ kind: "animating" });
    expect(r.effects).toEqual([
      {
        type: "commit",
        actions: [
          { type: "wait", unitId: "유비" },
          { type: "wait", unitId: "장비" },
          { type: "wait", unitId: "간옹" },
        ],
      },
    ]);
  });

  it("endTurnPressed — 전원 행동 완료/적 페이즈면 무시", () => {
    const allActed = state0.units
      .filter((u) => u.side === "player")
      .reduce((s, u) => withUnit(s, u.id, { acted: true }), state0);
    expect(reduceInput({ kind: "idle" }, { type: "endTurnPressed" }, ctx, allActed).next).toEqual({
      kind: "idle",
    });
    const enemyPhase: BattleState = { ...state0, phase: "enemy" };
    expect(reduceInput({ kind: "idle" }, { type: "endTurnPressed" }, ctx, enemyPhase).next).toEqual({
      kind: "idle",
    });
  });
});

describe("selected", () => {
  it("이동 가능 타일 탭 → postMoveMenu(고스트=preview), attackable은 from=프리뷰 기준", () => {
    const sel = select(nearState, GUANYU);
    const preview: Coord = { x: 49, y: 15 };
    const r = reduceInput(sel, { type: "tapTile", coord: preview }, ctx, nearState);
    expect(r.next).toMatchObject({
      kind: "postMoveMenu",
      unitId: GUANYU,
      from: guanyuPos,
      preview,
      attackable: [HUAXIONG], // 현위치에선 빈 배열이지만 프리뷰 기준으론 사거리 안
    });
    if (sel.kind === "selected") expect(sel.attackable).toEqual([]);
    // 엔진 from 파라미터와 정합
    expect(getAttackableTargets(ctx, nearState, GUANYU, preview)).toEqual([HUAXIONG]);
    expect(r.effects).toEqual([{ type: "focus", coord: preview }]);
  });

  it("자기 자신 탭 → postMoveMenu(from=preview=현위치)", () => {
    const sel = select(state0, GUANYU);
    const r = reduceInput(sel, { type: "tapTile", coord: guanyuPos }, ctx, state0);
    expect(r.next).toMatchObject({ kind: "postMoveMenu", from: guanyuPos, preview: guanyuPos });
    expect(r.effects).toEqual([]);
  });

  it("현위치 사거리 내 적 탭 → attack 즉시 커밋 + animating", () => {
    const sel = select(adjacentState, GUANYU);
    if (sel.kind === "selected") expect(sel.attackable).toEqual([HUAXIONG]);
    const r = reduceInput(sel, { type: "tapTile", coord: { x: 51, y: 15 } }, ctx, adjacentState);
    expect(r.next).toEqual({ kind: "animating" });
    expect(r.effects).toEqual([
      { type: "commit", actions: [{ type: "attack", unitId: GUANYU, targetId: HUAXIONG }] },
    ]);
  });

  it("범위 밖 탭/cancel → idle 무손실 취소", () => {
    const sel = select(state0, GUANYU);
    expect(reduceInput(sel, { type: "tapTile", coord: { x: 10, y: 15 } }, ctx, state0).next).toEqual(
      { kind: "idle" },
    );
    expect(reduceInput(sel, { type: "cancel" }, ctx, state0).next).toEqual({ kind: "idle" });
  });
});

describe("postMoveMenu", () => {
  const sel = select(nearState, GUANYU);
  const preview: Coord = { x: 49, y: 15 };
  const menu = reduceInput(sel, { type: "tapTile", coord: preview }, ctx, nearState).next;
  if (menu.kind !== "postMoveMenu") throw new Error("픽스처 구성 실패");

  it("menuAttack → targetSelect (대상 있을 때)", () => {
    const r = reduceInput(menu, { type: "menuAttack" }, ctx, nearState);
    expect(r.next).toMatchObject({ kind: "targetSelect", preview, attackable: [HUAXIONG] });
    expect(r.effects).toEqual([]);
  });

  it("menuAttack — 대상 없으면 무시 (버튼 비활성과 동일)", () => {
    const selFar = select(state0, GUANYU);
    const far = reduceInput(selFar, { type: "tapTile", coord: { x: 49, y: 15 } }, ctx, state0).next;
    if (far.kind !== "postMoveMenu") throw new Error("픽스처 구성 실패");
    expect(far.attackable).toEqual([]);
    expect(reduceInput(far, { type: "menuAttack" }, ctx, state0).next).toBe(far);
  });

  it("menuWait → move+wait 연쇄 커밋 (프리뷰≠현위치)", () => {
    const r = reduceInput(menu, { type: "menuWait" }, ctx, nearState);
    expect(r.next).toEqual({ kind: "animating" });
    expect(r.effects).toEqual([
      {
        type: "commit",
        actions: [
          { type: "move", unitId: GUANYU, to: preview },
          { type: "wait", unitId: GUANYU },
        ],
      },
    ]);
  });

  it("menuWait — 제자리(프리뷰=현위치)는 move 생략, wait만 커밋", () => {
    const selSame = select(state0, GUANYU);
    const same = reduceInput(selSame, { type: "tapTile", coord: guanyuPos }, ctx, state0).next;
    const r = reduceInput(same, { type: "menuWait" }, ctx, state0);
    expect(r.effects).toEqual([
      { type: "commit", actions: [{ type: "wait", unitId: GUANYU }] },
    ]);
  });

  it("menuCancel → selected 복귀, attackable은 현위치 기준 재계산", () => {
    const r = reduceInput(menu, { type: "menuCancel" }, ctx, nearState);
    expect(r.next).toMatchObject({ kind: "selected", unitId: GUANYU, attackable: [] });
    expect(r.effects).toEqual([]); // 커밋 없음
  });

  it("tapTile은 무시 — 메뉴는 모달", () => {
    expect(reduceInput(menu, { type: "tapTile", coord: { x: 45, y: 15 } }, ctx, nearState).next).toBe(
      menu,
    );
  });
});

describe("targetSelect", () => {
  const sel = select(nearState, GUANYU);
  const preview: Coord = { x: 49, y: 15 };
  const menu = reduceInput(sel, { type: "tapTile", coord: preview }, ctx, nearState).next;
  const ts = reduceInput(menu, { type: "menuAttack" }, ctx, nearState).next;
  if (ts.kind !== "targetSelect") throw new Error("픽스처 구성 실패");

  it("대상 탭 → move+attack 연쇄 커밋 + animating", () => {
    const r = reduceInput(ts, { type: "tapTile", coord: { x: 48, y: 15 } }, ctx, nearState);
    expect(r.next).toEqual({ kind: "animating" });
    expect(r.effects).toEqual([
      {
        type: "commit",
        actions: [
          { type: "move", unitId: GUANYU, to: preview },
          { type: "attack", unitId: GUANYU, targetId: HUAXIONG },
        ],
      },
    ]);
  });

  it("대상 아닌 타일/유닛 탭 → 무시", () => {
    expect(reduceInput(ts, { type: "tapTile", coord: { x: 45, y: 15 } }, ctx, nearState).next).toBe(ts);
    const lb = findUnit(nearState, "유비"); // 아군은 대상 불가
    expect(
      reduceInput(ts, { type: "tapTile", coord: { x: lb.x, y: lb.y } }, ctx, nearState).next,
    ).toBe(ts);
  });

  it("cancel → postMoveMenu 복귀", () => {
    const r = reduceInput(ts, { type: "cancel" }, ctx, nearState);
    expect(r.next).toMatchObject({ kind: "postMoveMenu", preview });
  });
});

describe("animating / enemyTurn — drained 분기", () => {
  it.each([
    ["animating", { kind: "animating" } satisfies InputState],
    ["enemyTurn", { kind: "enemyTurn" } satisfies InputState],
  ] as const)("%s: ongoing+player → idle / enemy → enemyTurn / 종료 → battleOver", (_n, st) => {
    expect(reduceInput(st, { type: "drained" }, ctx, state0).next).toEqual({ kind: "idle" });
    const enemyPhase: BattleState = { ...state0, phase: "enemy" };
    expect(reduceInput(st, { type: "drained" }, ctx, enemyPhase).next).toEqual({ kind: "enemyTurn" });
    const won: BattleState = { ...state0, status: "victory" };
    expect(reduceInput(st, { type: "drained" }, ctx, won).next).toEqual({
      kind: "battleOver",
      result: "victory",
    });
    const lost: BattleState = { ...state0, status: "defeat", phase: "enemy" };
    expect(reduceInput(st, { type: "drained" }, ctx, lost).next).toEqual({
      kind: "battleOver",
      result: "defeat",
    });
  });
});

describe("전이 전수 — 모든 (상태, 이벤트) 조합이 던지지 않고 허용 전이표를 따른다", () => {
  const sel = select(nearState, GUANYU);
  const menu = reduceInput(sel, { type: "tapTile", coord: { x: 49, y: 15 } }, ctx, nearState).next;
  const ts = reduceInput(menu, { type: "menuAttack" }, ctx, nearState).next;
  // 계략 상태는 합성 — 픽스처 유닛(관우)은 책략이 없어 전이는 대부분 noop(시전 불가).
  // strategyTarget의 castTiles에 빈 평지 탭 좌표를 넣어 commit→animating 경로만 활성화.
  const C = { x: 50, y: 15 };
  const stratMenu: InputState = { kind: "strategyMenu", unitId: GUANYU, from: C, preview: C, movable: [], attackable: [], strategies: ["업화"] };
  const stratTarget: InputState = { kind: "strategyTarget", unitId: GUANYU, from: C, preview: C, movable: [], attackable: [], strategies: ["업화"], strategyId: "업화", castTiles: [{ x: 45, y: 20 }] };

  const states: InputState[] = [
    { kind: "idle" },
    sel,
    menu,
    ts,
    stratMenu,
    stratTarget,
    { kind: "animating" },
    { kind: "enemyTurn" },
    { kind: "autoTurn" },
    { kind: "battleOver", result: "victory" },
  ];
  const events: UiEvent[] = [
    { type: "tapTile", coord: { x: 45, y: 20 } }, // 빈 평지 — 어떤 하이라이트에도 안 걸림 (단 stratTarget.castTiles엔 포함)
    { type: "cancel" },
    { type: "menuAttack" },
    { type: "menuStrategy" },
    { type: "selectStrategy", strategyId: "업화" },
    { type: "menuWait" },
    { type: "menuCancel" },
    { type: "endTurnPressed" },
    { type: "autoStart" },
    { type: "drained" },
  ];

  /**
   * 허용 전이표: 상태 kind → 이벤트 type → 기대 kind.
   * nearState는 아군 페이즈·진행 중이므로 auto=false(기본) drained는 idle로, idle×autoStart는 autoTurn.
   * 관우는 책략 미보유 → menuStrategy(postMoveMenu.strategies=[])·selectStrategy는 시전 불가라 noop.
   */
  const table: Record<InputState["kind"], Record<UiEvent["type"], InputState["kind"]>> = {
    idle: { tapTile: "idle", cancel: "idle", menuAttack: "idle", menuStrategy: "idle", selectStrategy: "idle", menuWait: "idle", menuCancel: "idle", endTurnPressed: "animating", autoStart: "autoTurn", drained: "idle" },
    selected: { tapTile: "idle", cancel: "idle", menuAttack: "selected", menuStrategy: "selected", selectStrategy: "selected", menuWait: "selected", menuCancel: "selected", endTurnPressed: "selected", autoStart: "selected", drained: "selected" },
    postMoveMenu: { tapTile: "postMoveMenu", cancel: "selected", menuAttack: "targetSelect", menuStrategy: "postMoveMenu", selectStrategy: "postMoveMenu", menuWait: "animating", menuCancel: "selected", endTurnPressed: "postMoveMenu", autoStart: "postMoveMenu", drained: "postMoveMenu" },
    targetSelect: { tapTile: "targetSelect", cancel: "postMoveMenu", menuAttack: "targetSelect", menuStrategy: "targetSelect", selectStrategy: "targetSelect", menuWait: "targetSelect", menuCancel: "postMoveMenu", endTurnPressed: "targetSelect", autoStart: "targetSelect", drained: "targetSelect" },
    strategyMenu: { tapTile: "strategyMenu", cancel: "postMoveMenu", menuAttack: "strategyMenu", menuStrategy: "strategyMenu", selectStrategy: "strategyMenu", menuWait: "strategyMenu", menuCancel: "postMoveMenu", endTurnPressed: "strategyMenu", autoStart: "strategyMenu", drained: "strategyMenu" },
    strategyTarget: { tapTile: "animating", cancel: "strategyMenu", menuAttack: "strategyTarget", menuStrategy: "strategyTarget", selectStrategy: "strategyTarget", menuWait: "strategyTarget", menuCancel: "strategyMenu", endTurnPressed: "strategyTarget", autoStart: "strategyTarget", drained: "strategyTarget" },
    animating: { tapTile: "animating", cancel: "animating", menuAttack: "animating", menuStrategy: "animating", selectStrategy: "animating", menuWait: "animating", menuCancel: "animating", endTurnPressed: "animating", autoStart: "animating", drained: "idle" },
    enemyTurn: { tapTile: "enemyTurn", cancel: "enemyTurn", menuAttack: "enemyTurn", menuStrategy: "enemyTurn", selectStrategy: "enemyTurn", menuWait: "enemyTurn", menuCancel: "enemyTurn", endTurnPressed: "enemyTurn", autoStart: "enemyTurn", drained: "idle" },
    autoTurn: { tapTile: "autoTurn", cancel: "autoTurn", menuAttack: "autoTurn", menuStrategy: "autoTurn", selectStrategy: "autoTurn", menuWait: "autoTurn", menuCancel: "autoTurn", endTurnPressed: "autoTurn", autoStart: "autoTurn", drained: "idle" },
    battleOver: { tapTile: "battleOver", cancel: "battleOver", menuAttack: "battleOver", menuStrategy: "battleOver", selectStrategy: "battleOver", menuWait: "battleOver", menuCancel: "battleOver", endTurnPressed: "battleOver", autoStart: "battleOver", drained: "battleOver" },
  };

  for (const st of states) {
    for (const ev of events) {
      it(`${st.kind} × ${ev.type} → ${table[st.kind][ev.type]}`, () => {
        const r = reduceInput(st, ev, ctx, nearState);
        expect(r.next.kind).toBe(table[st.kind][ev.type]);
        // 커밋 effect는 animating 전이에서만 허용
        if (r.next.kind !== "animating" || st.kind === "animating") {
          expect(r.effects.filter((e) => e.type === "commit")).toEqual([]);
        }
      });
    }
  }
});

describe("movePreview 취소 = 엔진 무호출 (store 통합)", () => {
  it("선택→프리뷰→취소→취소: actionLog 비고 committed 참조 불변", () => {
    const store = new BattleStore(ctx, SEED);
    const before = store.committedState;
    store.dispatchUi({ type: "tapTile", coord: guanyuPos });
    store.dispatchUi({ type: "tapTile", coord: { x: 49, y: 15 } }); // 프리뷰 (postMoveMenu)
    expect(store.uiState.kind).toBe("postMoveMenu");
    store.dispatchUi({ type: "menuCancel" });
    expect(store.uiState.kind).toBe("selected");
    store.dispatchUi({ type: "cancel" });
    expect(store.uiState.kind).toBe("idle");
    expect(store.actionLog).toEqual([]);
    expect(store.committedState).toBe(before); // 참조 동일 — applyAction 자체가 안 불림
    expect(store.settledState).toBe(before);
  });
});

describe("previewWalking 플래그 (원작 UX §수정명세)", () => {
  it("preview≠from 이동 탭 → previewWalking=true, 워크 완료 후 false", async () => {
    let walkResolve!: () => void;
    const walkPromise = new Promise<void>((r) => { walkResolve = r; });
    let walkCalled = false;
    const store = new BattleStore(ctx, SEED, {
      onPreviewWalk: () => { walkCalled = true; return walkPromise; },
    });
    store.dispatchUi({ type: "tapTile", coord: guanyuPos }); // idle → selected
    expect(store.previewWalking).toBe(false);
    store.dispatchUi({ type: "tapTile", coord: { x: 49, y: 15 } }); // → postMoveMenu (이동)
    expect(store.uiState.kind).toBe("postMoveMenu");
    expect(walkCalled).toBe(true);
    expect(store.previewWalking).toBe(true); // 워크 중
    walkResolve();
    await walkPromise;
    // Promise.then이 마이크로태스크 큐에서 실행되므로 한 틱 기다린다
    await Promise.resolve();
    expect(store.previewWalking).toBe(false); // 워크 완료
  });

  it("preview=from(제자리) → previewWalking 발동 안 함", () => {
    let walkCalled = false;
    const store = new BattleStore(ctx, SEED, {
      onPreviewWalk: () => { walkCalled = true; return Promise.resolve(); },
    });
    store.dispatchUi({ type: "tapTile", coord: guanyuPos }); // idle → selected
    store.dispatchUi({ type: "tapTile", coord: guanyuPos }); // 제자리 → postMoveMenu(from=preview)
    expect(store.uiState.kind).toBe("postMoveMenu");
    expect(walkCalled).toBe(false);
    expect(store.previewWalking).toBe(false);
  });

  it("previewWalking 중 menuCancel → previewWalking=false + onPreviewCancel 호출", () => {
    let cancelCalled = false;
    const store = new BattleStore(ctx, SEED, {
      onPreviewWalk: () => new Promise(() => {}), // 절대 resolve 안 함 — 워크 중 상태 유지
      onPreviewCancel: () => { cancelCalled = true; },
    });
    store.dispatchUi({ type: "tapTile", coord: guanyuPos });
    store.dispatchUi({ type: "tapTile", coord: { x: 49, y: 15 } }); // postMoveMenu
    expect(store.previewWalking).toBe(true);
    store.dispatchUi({ type: "menuCancel" }); // → selected
    expect(store.uiState.kind).toBe("selected");
    expect(store.previewWalking).toBe(false); // 취소로 플래그 리셋
    expect(cancelCalled).toBe(true);
  });

  it("previewWalking은 getSnapshot에 반영된다", async () => {
    let walkResolve!: () => void;
    const walkPromise = new Promise<void>((r) => { walkResolve = r; });
    const store = new BattleStore(ctx, SEED, {
      onPreviewWalk: () => walkPromise,
    });
    store.dispatchUi({ type: "tapTile", coord: guanyuPos });
    store.dispatchUi({ type: "tapTile", coord: { x: 49, y: 15 } });
    expect(store.getSnapshot().previewWalking).toBe(true);
    walkResolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getSnapshot().previewWalking).toBe(false);
  });
});
