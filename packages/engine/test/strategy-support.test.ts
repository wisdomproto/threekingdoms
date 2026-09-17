import { describe, expect, it } from "vitest";
import { gameData, StrategySchema, type Stage } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import { getStrategyTargets, attackPower } from "../src/combat";
import { tickStatuses } from "../src/status";
import { testMap } from "./fixtures";
import type { BattleContext, BattleState } from "../src/types";
const stage: Stage = {id:"support",name:"support",mapId:testMap.id,turnLimit:20,events:[],victory:{kind:"defeatAll"},units:[
 {commanderId:"간옹",classId:"strategist",level:30,troops:100,items:[],side:"player",x:2,y:4},
 {commanderId:"유비",classId:"lord",level:30,troops:100,items:[],side:"player",x:3,y:4},
 {commanderId:"화웅",classId:"footman",level:30,troops:100,items:[],side:"enemy",x:4,y:4},
]};
const ctx:BattleContext={map:testMap,stage,data:{...gameData,unitClasses:{...gameData.unitClasses,strategist:{...gameData.unitClasses.strategist!,strategies:Object.keys(gameData.strategies)}}}};
function cast(s:BattleState,id:string){return applyAction(ctx,s,{type:"strategy",unitId:"간옹",strategyId:id,target:{x:3,y:4}});}
describe("strategy tiers and support effects",()=>{
 it("preserves metadata through schema parsing and gates unlearned casts",()=>{
  const raw=gameData.strategies['구원군']!; expect(StrategySchema.parse(raw)).toEqual(raw);
  const s=createBattle(ctx,1);s.units[0]={...s.units[0]!,level:1};
  expect(getStrategyTargets(ctx,s,'간옹','화룡')).toEqual([]);
  expect(()=>cast(s,'화룡')).toThrow();
 });
 it("heals all friendly cross targets without healing the enemy",()=>{
  const s=createBattle(ctx,1);s.units=s.units.map(u=>({...u,troops:10}));
  const r=cast(s,'구원군');
  expect(r.events.filter(e=>e.type==='troopsHealed').map(e=>e.unitId).sort()).toEqual(['간옹','유비']);
  expect(r.state.units.find(u=>u.id==='화웅')!.troops).toBe(10);
 });
 it("restores MP, not troops, and emits the actual clamped amount",()=>{
  const s=createBattle(ctx,1); const u=s.units[1]!;s.units[1]={...u,mp:u.maxMp-3,troops:10};
  const r=cast(s,'헌책');expect(r.state.units[1]!.mp).toBe(u.maxMp);expect(r.state.units[1]!.troops).toBe(10);
  expect(r.events).toContainEqual({type:'supportResolved',unitId:'유비',effect:'mp',amount:3});
 });
 it("cleanses harmful statuses while retaining beneficial effects",()=>{
  const s=createBattle(ctx,1);s.units[1]={...s.units[1]!,statuses:[{kind:'poison',turns:3},{kind:'attackUp',turns:3}]};
  const r=cast(s,'각성');expect(r.state.units[1]!.statuses).toEqual([{kind:'attackUp',turns:3}]);
  expect(r.events).toContainEqual({type:'statusExpired',unitId:'유비',kind:'poison'});
 });
 it("buffs expire after three owner-phase ticks",()=>{
  const s=createBattle(ctx,1),base=attackPower(s.units[1]!); const r=cast(s,'분기');
  expect(attackPower(r.state.units[1]!)).toBe(Math.floor(base*1.2));
  let next=r.state;for(let i=0;i<3;i++)next=tickStatuses(ctx,next,'player').state;
  expect(attackPower(next.units[1]!)).toBe(base);
 });
 it("refresh permits another ally to act, never the caster",()=>{
  const s=createBattle(ctx,1);s.units[1]={...s.units[1]!,moved:true,acted:true};
  const r=cast(s,'회귀');expect(r.state.units[1]!.acted).toBe(false);expect(r.state.units[0]!.acted).toBe(true);
  expect(getStrategyTargets(ctx,s,'간옹','회귀')).not.toContainEqual({x:2,y:4});
 });
});
