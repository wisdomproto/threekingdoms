import { expect, it } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "@tk/engine";
import { greedyPolicy } from "../src/policy";

it("advances a fighting army but withdraws an explicitly escorted subset", () => {
  const stage = structuredClone(stages["28-nanjun"]!);
  const ctx = { data: gameData, stage, map: gameData.maps[stage.mapId]! };
  const state = createBattle(ctx, 42);
  const leader = state.units.find(u => u.side === "player")!;
  const attack = greedyPolicy(ctx, state);
  expect(attack?.type).toBe("move");
  if (attack?.type === "move") expect(attack.to.x).toBeGreaterThan(leader.x);
  stage.failConditions = [{ kind: "allRetreated", unitIds: [leader.id] }];
  const escort = greedyPolicy(ctx, state);
  expect(escort?.type).toBe("move");
  if (escort?.type === "move") expect(escort.to.x).toBeLessThan(leader.x);
});
