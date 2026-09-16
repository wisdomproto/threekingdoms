import { it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "@tk/engine";
import { applyBattleScripts } from "../../../../../packages/engine/src/battleScripts";
import { firedDialogues, toDialogueSnapshot } from "../dialogue/director";

for (const stage of Object.values(stages).filter(s => s.scriptEvents?.length)) {
  it(`${stage.id}: hazard dialogue follows engine execution exactly once`, () => {
    const ctx = { data: gameData, stage, map: gameData.maps[stage.mapId]! };
    for (const script of stage.scriptEvents!) {
      if (script.trigger.kind !== "turn") throw new Error("Extend the fixture for a non-turn campaign hazard");
      const state = { ...createBattle(ctx, 42), turn: script.trigger.turn, phase: script.trigger.phase };
      const before = toDialogueSnapshot(state);
      const fired = applyBattleScripts(ctx, state);
      const after = toDialogueSnapshot(fired.state);
      expect(fired.events.some(e => e.type === "scriptEffect")).toBe(true);
      const cues = firedDialogues(stage.dialogue ?? [], before, after, new Set());
      expect(cues.filter(d => d.trigger.kind === "scriptFired" && d.trigger.scriptId === script.id)).toHaveLength(1);
      expect(firedDialogues(stage.dialogue ?? [], after, after, new Set(cues.map(d => d.id)))).toEqual([]);
    }
  });
}

it("Bowangpo fire damages/stuns enemies in the zone and later burns allies too", () => {
  const stage = stages["18-bowangpo"]!;
  const ctx = { data: gameData, stage, map: gameData.maps[stage.mapId]! };
  const state = { ...createBattle(ctx, 42), turn: 4 };
  const enemy = state.units.find(u => u.side === "enemy")!;
  const ally = state.units.find(u => u.side === "player")!;
  enemy.x = 23; enemy.y = 12;
  ally.x = 24; ally.y = 12;
  const fired = applyBattleScripts(ctx, state);
  const damaged = fired.state.units.find(u => u.id === enemy.id)!;
  expect(damaged.troops).toBe(Math.max(1, enemy.troops - Math.floor(enemy.maxTroops * .12)));
  expect(damaged.statuses).toContainEqual({ kind: "stun", turns: 1 });
  expect(fired.state.units.find(u => u.id === ally.id)!.troops).toBe(ally.troops);
  const next = applyBattleScripts(ctx, { ...fired.state, turn: 5 });
  expect(next.state.units.find(u => u.id === ally.id)!.troops).toBe(ally.troops - Math.floor(ally.maxTroops * .05));
});
