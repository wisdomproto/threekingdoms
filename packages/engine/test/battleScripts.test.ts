import { describe, it, expect } from "vitest";
import { BattleScriptSchema } from "@tk/data";
import { testCtx } from "./fixtures";
import { createBattle } from "../src/createBattle";
import { applyBattleScripts } from "../src/battleScripts";
import { applyAction } from "../src/actions";

describe("battle scripts", () => {
  const fire = BattleScriptSchema.parse({ id: "fire", name: "Fire", trigger: { kind: "turn", turn: 2, phase: "player" }, actions: [
    { kind: "effect", effect: "fire", area: { x: 4, y: 0, width: 4, height: 4 } },
    { kind: "damage", target: { side: "enemy" }, amount: 30, percent: true, nonlethal: true },
    { kind: "status", target: { side: "enemy" }, status: "stun", turns: 2 },
  ] });
  it("is deterministic, preserves input and fires once with self-describing damage", () => {
    const ctx = { ...testCtx, stage: { ...testCtx.stage, scriptEvents: [fire] } };
    const start = { ...createBattle(ctx, 42), turn: 2 };
    const before = JSON.stringify(start);
    const result = applyBattleScripts(ctx, start);
    expect(applyBattleScripts(ctx, start)).toEqual(result);
    expect(JSON.stringify(start)).toBe(before);
    expect(result.state.rngState).toBe(start.rngState);
    for (const unit of start.units.filter(u => u.side === "enemy")) {
      const after = result.state.units.find(u => u.id === unit.id)!;
      expect(after.troops).toBe(unit.troops - Math.floor(unit.maxTroops * .3));
      expect(after.statuses).toEqual([{ kind: "stun", turns: 2 }]);
      expect(result.events).toContainEqual({ type: "scriptDamage", unitId: unit.id, damage: unit.troops - after.troops });
    }
    expect(applyBattleScripts(ctx, JSON.parse(JSON.stringify(result.state))).events).toEqual([]);
  });
  it("skips fully stunned enemy phases and expires after two action opportunities", () => {
    const ctx = { ...testCtx, stage: { ...testCtx.stage, scriptEvents: [fire] } };
    let state = applyBattleScripts(ctx, { ...createBattle(ctx, 1), turn: 2 }).state;
    for (let round = 0; round < 2; round++) {
      for (const id of ["유비", "관우"]) state = applyAction(ctx, state, { type: "wait", unitId: id }).state;
      expect(state.phase).toBe("player");
    }
    expect(state.units.find(u => u.id === "화웅")?.statuses).toEqual([]);
    for (const id of ["유비", "관우"]) state = applyAction(ctx, state, { type: "wait", unitId: id }).state;
    expect(state.phase).toBe("enemy");
  });
  it("resolves reverse-order dependencies once and evaluates outcome after lethal damage", () => {
    const follow = BattleScriptSchema.parse({ id: "follow", name: "Follow", trigger: { kind: "eventFired", eventId: "fire" }, actions: [{ kind: "damage", target: { side: "enemy" }, amount: 99999 }] });
    const ctx = { ...testCtx, stage: { ...testCtx.stage, scriptEvents: [follow, fire] } };
    const result = applyAction(ctx, { ...createBattle(ctx, 1), turn: 2 }, { type: "wait", unitId: "유비" });
    expect(result.state.status).toBe("victory");
    expect(result.state.firedScripts).toEqual(["fire", "follow"]);
    expect(result.events.at(-1)).toEqual({ type: "battleEnded", result: "victory" });
  });
});

it("ticks persistent fire once per turn, spreads one cell, expires and survives serialization", () => {
  const script=BattleScriptSchema.parse({id:'burn',name:'Burn',trigger:{kind:'turn',turn:1},actions:[{kind:'fire',area:{x:1,y:1,width:1,height:1},duration:2,damagePercent:10,spread:true,flammableOnly:false}]});
  const ctx={...testCtx,stage:{...testCtx.stage,scriptEvents:[script]}};
  const start=createBattle(ctx,1);start.units[0]={...start.units[0]!,x:1,y:1};
  const lit=applyBattleScripts(ctx,start);
  expect(lit.state.units[0]!.troops).toBe(start.units[0]!.troops);
  expect(start.fires).toBeUndefined();
  const tick=applyBattleScripts(ctx,{...lit.state,turn:2});
  expect(tick.state.units[0]!.troops).toBe(start.units[0]!.troops-Math.floor(start.units[0]!.maxTroops*.1));
  expect(tick.state.fires![0]!.cells).toContainEqual({x:2,y:1});
  expect(tick.state.fires![0]!.cells).not.toContainEqual({x:3,y:1});
  expect(tick.state.fires![0]!.cells).not.toContainEqual({x:1,y:0});
  expect(applyBattleScripts(ctx,JSON.parse(JSON.stringify(tick.state))).events).toEqual([]);
  expect(applyBattleScripts(ctx,{...tick.state,turn:3}).state.fires).toEqual([]);
  const rain=applyBattleScripts(ctx,{...lit.state,weather:'rain' as const,turn:2});
  expect(rain.state.fires).toEqual([]);expect(rain.events).toEqual([]);
  expect(applyBattleScripts(ctx,{...lit.state,turn:2})).toEqual(tick);
});
it("restricts spread to flammable terrain and does not stack overlapping fire damage", () => {
  const script=BattleScriptSchema.parse({id:'burn',name:'Burn',trigger:{kind:'turn',turn:1},actions:[{kind:'fire',area:{x:4,y:2,width:1,height:1},duration:2,damagePercent:10,spread:true}]});
  const ctx={...testCtx,stage:{...testCtx.stage,scriptEvents:[script]}};
  const start=createBattle(ctx,1);start.units[0]={...start.units[0]!,x:4,y:2};
  const lit=applyBattleScripts(ctx,start).state;
  lit.fires!.push(structuredClone(lit.fires![0]!));
  const tick=applyBattleScripts(ctx,{...lit,turn:2});
  expect(tick.state.fires![0]!.cells).toEqual([{x:4,y:2},{x:5,y:2}]);
  expect(tick.events.filter(e=>e.type==='scriptDamage'&&e.unitId===start.units[0]!.id)).toHaveLength(1);
});
