import { describe, expect, it } from "vitest";
import { gameData, StageSchema } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import { testMap, testStage } from "./fixtures";
import type { BattleContext } from "../src/types";

describe("authoring input and strategy rewards", () => {
  it("rejects duplicate commanders before the battle starts, including reinforcements", () => {
    const unit = testStage.units[0]!;
    for (const stage of [
      { ...testStage, units: [...testStage.units, { ...unit, x: 0, y: 0 }] },
      { ...testStage, reinforcements: [{ id: "duplicate", side: unit.side, once: true as const, trigger: { kind: "turn" as const, turn: 2 }, units: [unit] }] },
    ]) {
      expect(StageSchema.safeParse(stage).success).toBe(false);
      expect(() => createBattle({ data: gameData, map: testMap, stage }, 1)).toThrow("duplicate commanderId");
    }
  });

  it("awards experience and one combo per AoE kill without mutating the input", () => {
    const ctx: BattleContext = { data: gameData, map: testMap, stage: {
      id: "strategy-rewards", name: "test", mapId: testMap.id, turnLimit: 30,
      units: [
        { commanderId: "간옹", classId: "strategist", level: 8, troops: 80, items: [], side: "player", x: 2, y: 4 },
        { commanderId: "화웅", classId: "footman", level: 3, troops: 1, items: [], side: "enemy", x: 4, y: 4 },
        { commanderId: "이숙", classId: "footman", level: 3, troops: 1, items: [], side: "enemy", x: 4, y: 5 },
      ], victory: { kind: "defeatAll" }, events: [],
    } };
    const before = createBattle(ctx, 1), copy = structuredClone(before);
    const action = { type: "strategy" as const, unitId: "간옹", strategyId: "화진", target: { x: 4, y: 4 } };
    const result = applyAction(ctx, before, action);
    expect(before).toEqual(copy);
    expect(applyAction(ctx, before, action)).toEqual(result);
    expect(result.state.status).toBe("victory");
    expect(result.state.units[0]!.exp).toBeGreaterThan(before.units[0]!.exp);
    expect(result.events.filter(e => e.type === "combo").map(e => e.count)).toEqual([1, 2]);
    expect(result.state.pendingRewards.reduce((sum, r) => sum + (r.gold ?? 0), 0)).toBe(gameData.combat.combo.goldPerStack * 3);
    expect(() => applyAction(ctx, result.state, action)).toThrow("battle already ended");
  });
});
