import { describe, it, expect } from "vitest";
import { gameData, type BattleMap, type Stage } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import type { BattleContext } from "../src/types";

/**
 * strategyConditions.unitReachedTile — unitId 생략 = **아무 아군(player)** 도달 충족(2026-07-04,
 * 보물창고 회수 §10). 지정 시 그 유닛만(기존 동작 회귀 가드). 적 도달은 미충족.
 */
const map: BattleMap = {
  id: "depotmap", name: "보물창고맵", width: 6, height: 4,
  tileLegend: { ".": "plain", "d": "depot" },
  tiles: ["......", "..d...", "......", "......"],
};

function makeStage(): Stage {
  return {
    id: "depot-test", name: "창고회수", mapId: "depotmap", turnLimit: 30,
    units: [
      { commanderId: "관우", classId: "footman", level: 5, troops: 1000, items: [], side: "player", x: 1, y: 1 },
      { commanderId: "화웅", classId: "footman", level: 3, troops: 1200, items: [], side: "enemy", x: 3, y: 1 },
    ],
    victory: { kind: "defeatAll" },
    defeat: { kind: "lordRetreat", unitId: "관우" },
    events: [],
    strategyConditions: [
      {
        id: "depot_any", description: "보물창고 회수(아무 아군)",
        trigger: { kind: "unitReachedTile", x: 2, y: 1 },
        reward: { treasures: ["상약"], gold: 250 },
      },
    ],
  };
}

const ctx: BattleContext = { data: gameData, stage: makeStage(), map };

describe("unitReachedTile — unitId 생략(아무 아군)", () => {
  it("아군이 그 칸에 도달하면 충족 + 보상 적립 + 이벤트", () => {
    const s = createBattle(ctx, 1);
    const r = applyAction(ctx, s, { type: "move", unitId: "관우", to: { x: 2, y: 1 } });
    expect(r.state.metStrategyConditions).toContain("depot_any");
    expect(r.state.pendingRewards).toContainEqual(
      { conditionId: "depot_any", treasures: ["상약"], gold: 250 },
    );
    expect(r.events).toContainEqual(
      { type: "strategyConditionMet", id: "depot_any", treasures: ["상약"], gold: 250 },
    );
  });

  it("적이 그 칸에 있어도 미충족(아군 한정)", () => {
    const stage = makeStage();
    stage.units = stage.units.map((u) => (u.commanderId === "화웅" ? { ...u, x: 2, y: 1 } : u));
    const c2: BattleContext = { ...ctx, stage };
    const s = createBattle(c2, 1);
    // 아군이 다른 칸으로 이동(트리거 평가 시점) — 적이 창고 위여도 발동 없음
    const r = applyAction(c2, s, { type: "move", unitId: "관우", to: { x: 1, y: 2 } });
    expect(r.state.metStrategyConditions).not.toContain("depot_any");
  });
});
