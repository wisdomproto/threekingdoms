/**
 * 도구(아이템) + 회복 책략 UI 전체 경로 통합 (W4 전투 중 UI).
 * dispatchUi(메뉴→선택→대상)가 store.commit→applyAction까지 흘러
 *  ① supplyItem(쌀): 부상 아군 회복 + 소모
 *  ② attackItem(폭탄): 적 피해 + 소모
 *  ③ 회복 책략(회복): 아군 타깃 회복 + MP 소비
 * 이 실제로 발동하는지. 엔진/상태기계 단위테스트의 glue 검증(strategyFlow.test.ts와 동형).
 */
import { describe, expect, it } from "vitest";
import { gameData, type Stage } from "@tk/data";
import type { BattleContext } from "@tk/engine";
import { BattleStore } from "../store";
import { testMap } from "./fixtures";

// 간옹(책사, 회복 보유) + 유비(군주, 부상 아군 겸 회복 대상) + 관우(도구 보유) vs 화웅
function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: "item-flow", name: "도구흐름", mapId: "testmap", turnLimit: 30,
    camera: undefined,
    units: [
      { commanderId: "간옹", classId: "strategist",  level: 5, troops: 80,  items: [],                side: "player", x: 3, y: 4 },
      { commanderId: "관우", classId: "lightCavalry", level: 1, troops: 100, items: ["쌀", "폭탄"],   side: "player", x: 2, y: 5 },
      { commanderId: "유비", classId: "footman",      level: 1, troops: 40,  items: [],                side: "player", x: 3, y: 5 },
      { commanderId: "화웅", classId: "footman",      level: 3, troops: 120, items: [],                side: "enemy",  x: 4, y: 5 },
    ],
    victory: { kind: "defeatAll" },
    defeat: { kind: "lordRetreat", unitId: "유비" },
    events: [],
    ...overrides,
  };
}

function ctxOf(stage: Stage): BattleContext {
  return { data: gameData, stage, map: testMap };
}

describe("도구 UI 전체 경로", () => {
  it("supplyItem(쌀): 관우 → 도구 → 쌀 → 아군(자기) 조준 → 소모 + acted, 피해 없음", async () => {
    // 회복량 자체는 engine useItem.test.ts가 검증(maxTroops=초기troops라 store에선 클램프).
    // 여기선 UI→commit→소모 glue만 본다 — 대상은 시전자 자신(관우 2,5).
    const store = new BattleStore(ctxOf(makeStage()), 1);
    const guan0 = store.committedState.units.find((u) => u.id === "관우")!;

    store.dispatchUi({ type: "tapTile", coord: { x: 2, y: 5 } });   // 관우 선택
    store.dispatchUi({ type: "tapTile", coord: { x: 2, y: 5 } });   // 제자리 → postMoveMenu
    const pm = store.uiState;
    if (pm.kind !== "postMoveMenu") throw new Error("unreachable");
    expect(pm.items).toEqual(["쌀", "폭탄"]);                       // 도구 버튼 노출 조건

    store.dispatchUi({ type: "menuItem" });
    expect(store.uiState.kind).toBe("itemMenu");
    store.dispatchUi({ type: "selectItem", itemId: "쌀" });
    const it = store.uiState;
    if (it.kind !== "itemTarget") throw new Error("unreachable");
    expect(it.itemKind).toBe("supplyItem");
    // 회복 대상 후보엔 아군(자기 포함)만 — 적 화웅(4,5)은 제외
    expect(it.castTiles.some((c) => c.x === 2 && c.y === 5)).toBe(true);
    expect(it.castTiles.some((c) => c.x === 4 && c.y === 5)).toBe(false);
    store.dispatchUi({ type: "tapTile", coord: { x: 2, y: 5 } });   // 자기 조준 → 사용 커밋

    await store.whenIdle();

    const guan = store.committedState.units.find((u) => u.id === "관우")!;
    expect(guan.troops).toBe(guan0.troops);                         // 만피 → 클램프(피해 아님)
    expect(guan.items).toEqual(["폭탄"]);                           // 쌀 1개 소모
    expect(guan.acted).toBe(true);
    expect(store.actionLog.some((a) => a.type === "useItem")).toBe(true);
  });

  it("attackItem(폭탄): 관우 → 도구 → 폭탄 → 화웅 조준 → 피해 + 소모", async () => {
    const store = new BattleStore(ctxOf(makeStage()), 1);
    const hua0 = store.committedState.units.find((u) => u.id === "화웅")!;

    store.dispatchUi({ type: "tapTile", coord: { x: 2, y: 5 } });
    store.dispatchUi({ type: "tapTile", coord: { x: 2, y: 5 } });
    store.dispatchUi({ type: "menuItem" });
    store.dispatchUi({ type: "selectItem", itemId: "폭탄" });
    const it = store.uiState;
    if (it.kind !== "itemTarget") throw new Error("unreachable");
    expect(it.itemKind).toBe("attackItem");
    store.dispatchUi({ type: "tapTile", coord: { x: 4, y: 5 } });   // 화웅 조준

    await store.whenIdle();

    const guan = store.committedState.units.find((u) => u.id === "관우")!;
    const hua1 = store.committedState.units.find((u) => u.id === "화웅")!;
    expect(hua1.troops).toBe(hua0.troops - 50);                     // 폭탄 power50 고정
    expect(guan.items).toEqual(["쌀"]);                             // 폭탄 1개 소모
    expect(store.actionLog.some((a) => a.type === "useItem")).toBe(true);
  });

  it("도구 메뉴 취소 → postMoveMenu 복귀, 커밋 없음", () => {
    const store = new BattleStore(ctxOf(makeStage()), 1);
    store.dispatchUi({ type: "tapTile", coord: { x: 2, y: 5 } });
    store.dispatchUi({ type: "tapTile", coord: { x: 2, y: 5 } });
    store.dispatchUi({ type: "menuItem" });
    expect(store.uiState.kind).toBe("itemMenu");
    store.dispatchUi({ type: "menuCancel" });
    expect(store.uiState.kind).toBe("postMoveMenu");
    expect(store.actionLog).toEqual([]);
  });
});

describe("회복 책략 UI 전체 경로 (아군 타깃)", () => {
  it("간옹 → 계략 → 회복 → 아군 유비 조준 → MP 소비 + 피해 이벤트 없음 (아군 타깃 분기)", async () => {
    // 회복 공식·정신력비례는 engine useItem.test.ts가 검증. 여기선 ally 타깃 책략이
    // strategyTarget 경로로 commit까지 가고 MP를 소비하는 glue를 본다(troops는 만피 클램프).
    const store = new BattleStore(ctxOf(makeStage()), 1);
    const gan0 = store.committedState.units.find((u) => u.id === "간옹")!;
    const liu0 = store.committedState.units.find((u) => u.id === "유비")!;

    store.dispatchUi({ type: "tapTile", coord: { x: 3, y: 4 } });   // 간옹 선택
    store.dispatchUi({ type: "tapTile", coord: { x: 3, y: 4 } });   // 제자리 → postMoveMenu
    const pm = store.uiState;
    if (pm.kind !== "postMoveMenu") throw new Error("unreachable");
    expect(pm.strategies).toContain("회복");                        // 아군 사거리 내 → 회복 시전 가능

    store.dispatchUi({ type: "menuStrategy" });
    store.dispatchUi({ type: "selectStrategy", strategyId: "회복" });
    const st = store.uiState;
    if (st.kind !== "strategyTarget") throw new Error("unreachable");
    // 회복(target:ally) 후보엔 아군(유비 3,5)이 포함, 적 화웅(4,5)은 제외 — ally 분기 증명
    expect(st.castTiles.some((c) => c.x === 3 && c.y === 5)).toBe(true);
    expect(st.castTiles.some((c) => c.x === 4 && c.y === 5)).toBe(false);
    store.dispatchUi({ type: "tapTile", coord: { x: 3, y: 5 } });   // 유비 조준 → 시전

    await store.whenIdle();

    const gan1 = store.committedState.units.find((u) => u.id === "간옹")!;
    const liu1 = store.committedState.units.find((u) => u.id === "유비")!;
    expect(gan1.mp).toBe(gan0.mp - gameData.strategies["회복"]!.mp);  // MP 소비
    expect(liu1.troops).toBe(liu0.troops);                           // 만피 클램프 — 피해 아님
    expect(store.actionLog.some((a) => a.type === "strategy")).toBe(true);
  });
});
