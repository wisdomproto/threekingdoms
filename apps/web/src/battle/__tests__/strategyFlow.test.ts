/**
 * 계략 전체 경로 통합 — dispatchUi(계략 메뉴→선택→조준→시전)가 store.commit→applyAction까지
 * 흘러 책략이 실제로 발동(MP 소비·AoE 피해)하는지. 엔진/상태기계 단위테스트의 glue 검증.
 */
import { describe, expect, it } from "vitest";
import { gameData, type Stage } from "@tk/data";
import type { BattleContext } from "@tk/engine";
import { BattleStore } from "../store";
import { testMap } from "./fixtures";

// 간옹(책사) + 유비(군주, 페이즈 유지용) vs 화웅 — 간옹 사거리 안에 적 배치
const stage: Stage = {
  id: "strat-flow", name: "계략흐름", mapId: "testmap", turnLimit: 30,
  camera: undefined,
  units: [
    { commanderId: "간옹", classId: "strategist",  level: 1, troops: 80,  items: [], side: "player", x: 3, y: 4 },
    { commanderId: "유비", classId: "footman",      level: 1, troops: 100, items: [], side: "player", x: 2, y: 5 },
    { commanderId: "화웅", classId: "footman",      level: 3, troops: 120, items: [], side: "enemy",  x: 4, y: 4 },
  ],
  victory: { kind: "defeatAll" },
  defeat: { kind: "lordRetreat", unitId: "유비" },
  events: [],
};
const ctx: BattleContext = { data: gameData, stage, map: testMap };

describe("계략 UI 전체 경로", () => {
  it("간옹 선택 → 계략 → 업화 → 화웅 조준 → 시전: MP 소비 + 화웅 피해 + acted", async () => {
    const store = new BattleStore(ctx, 1);
    const gan0 = store.committedState.units.find((u) => u.id === "간옹")!;
    const hua0 = store.committedState.units.find((u) => u.id === "화웅")!;

    store.dispatchUi({ type: "tapTile", coord: { x: 3, y: 4 } });      // 간옹 선택
    expect(store.uiState.kind).toBe("selected");
    store.dispatchUi({ type: "tapTile", coord: { x: 3, y: 4 } });      // 제자리 → postMoveMenu
    expect(store.uiState.kind).toBe("postMoveMenu");
    const pm = store.uiState;
    if (pm.kind !== "postMoveMenu") throw new Error("unreachable");
    expect(pm.strategies).toContain("업화");                            // 계략 버튼 노출 조건

    store.dispatchUi({ type: "menuStrategy" });
    expect(store.uiState.kind).toBe("strategyMenu");
    store.dispatchUi({ type: "selectStrategy", strategyId: "업화" });
    expect(store.uiState.kind).toBe("strategyTarget");
    store.dispatchUi({ type: "tapTile", coord: { x: 4, y: 4 } });      // 화웅 조준 → 시전 커밋

    await store.whenIdle();

    const gan1 = store.committedState.units.find((u) => u.id === "간옹")!;
    const hua1 = store.committedState.units.find((u) => u.id === "화웅")!;
    expect(gan1.mp).toBe(gan0.mp - gameData.strategies["업화"]!.mp);   // MP 소비
    expect(hua1.troops).toBeLessThan(hua0.troops);                    // 화웅 피해
    expect(store.actionLog.some((a) => a.type === "strategy")).toBe(true);
  });
});
