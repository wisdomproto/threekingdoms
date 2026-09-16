import { describe, expect, it } from "vitest";
import { gameData } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyBattleScripts } from "../src/battleScripts";

describe("campaign environmental fires", () => {
  for (const id of ["07-luoyang", "18-bowangpo", "25-wulin", "26-chibi"]) {
    it(`${id} fires once, affects its area, and preserves the seed`, () => {
      const stage = gameData.stages[id]!;
      const map = gameData.maps[stage.mapId]!;
      const ctx = { stage, map, data: gameData };
      const script = stage.scriptEvents!.find(e => e.id === `campaign-fire-${id}`)!;
      const fire = script.actions.find(a => a.kind === "fire")!;
      const start = createBattle(ctx, 42);
      const enemy = start.units.find(u => u.side === "enemy")!;
      const turn = script.trigger.kind === "turn" ? script.trigger.turn : 0;
      const state = { ...start, turn, units: start.units.map(u => u.id === enemy.id ? { ...u, x: fire.area.x, y: fire.area.y } : u) };
      const result = applyBattleScripts(ctx, state);
      expect(result.state.rngState).toBe(state.rngState);
      expect(result.state.fires).toHaveLength(1);
      expect(result.events.some(e => e.type === "scriptDamage" && e.unitId === enemy.id && e.damage > 0)).toBe(true);
      expect(result.state.units.find(u => u.id === enemy.id)!.troops).toBeGreaterThan(0);
      expect(applyBattleScripts(ctx, result.state).events).toEqual([]);
      expect(applyBattleScripts(ctx, state)).toEqual(result);
    });
  }
  it("Chibi fire covers the linked decks instead of the northern camp", () => {
    const stage = gameData.stages['26-chibi']!;
    const map = gameData.maps[stage.mapId]!;
    const fire = stage.scriptEvents![0]!.actions.find(a=>a.kind==='fire')!;
    for(let y=fire.area.y;y<fire.area.y+fire.area.height;y++) for(let x=fire.area.x;x<fire.area.x+fire.area.width;x++) {
      expect(['bridge','fort']).toContain(map.tileLegend[map.tiles[y]![x]!]);
    }
  });
  for(const [id, scriptId, status] of [
    ['14-xiapi2','campaign-flood-14-xiapi2','immobilize'],
    ['21-changbanqiao','campaign-roar-21-changbanqiao','stun'],
  ] as const) it(`${id} applies its event only to enemies in the target area`, () => {
    const stage=gameData.stages[id]!;
    const ctx={stage,map:gameData.maps[stage.mapId]!,data:gameData};
    const script=stage.scriptEvents!.find(e=>e.id===scriptId)!;
    const action=script.actions.find(a=>a.kind==='status')!;
    const a=action.target.area!;
    const start=createBattle(ctx,42);
    const enemy=start.units.find(u=>u.side==='enemy')!;
    const ally=start.units.find(u=>u.side==='player')!;
    const state={...start,turn:script.trigger.kind==='turn'?script.trigger.turn:1,units:start.units.map(u=>u.id===enemy.id||u.id===ally.id?{...u,x:a.x,y:a.y}:u)};
    const result=applyBattleScripts(ctx,state);
    expect(result.events.some(e=>e.type==='statusApplied'&&e.unitId===enemy.id&&e.kind===status)).toBe(true);
    expect(result.state.units.find(u=>u.id===ally.id)).toEqual(state.units.find(u=>u.id===ally.id));
    expect(result.state.rngState).toBe(state.rngState);
    expect(applyBattleScripts(ctx,result.state).events).toEqual([]);
  });
});
