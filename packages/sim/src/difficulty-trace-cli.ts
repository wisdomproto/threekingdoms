import { readFileSync, writeFileSync } from 'node:fs';
import { gameData, type Stage } from '@tk/data';
import { createBattle, applyAction, pathCostField, type BattleContext } from '@tk/engine';
import { greedyPolicy } from './policy';
const snapshot=JSON.parse(readFileSync('../../.studio/game/active.json','utf8'));
const data={...gameData,maps:snapshot.maps,commanders:snapshot.commanders,items:snapshot.items};
const traces=[];
for(const id of ['04-zhangjue','06-huluguan','08-dongzhuo-chase','11-xiaopei','17-runan','21-changbanqiao','26-chibi']) {
 const measured=JSON.parse(readFileSync(`../../.studio/difficulty-audit/${id}.json`,'utf8'));
 const runs=measured.cells.find((c:any)=>c.mode==='auto'&&c.offset===0).runs;
 const seed=runs.find((r:any)=>r.result!=='victory')?.seed??1;
 const stage: Stage=snapshot.stages[id];const ctx:BattleContext={data,stage,map:data.maps[stage.mapId]};
 let state=createBattle(ctx,seed), attacks=0;const rounds=[],events=[];
 for(let guard=0;state.status==='ongoing'&&state.turn<=stage.turnLimit+1&&guard<100000;guard++){
  const action=greedyPolicy(ctx,state);if(!action)break;
  const next=applyAction(ctx,state,action);
  attacks+=next.events.filter(e=>e.type==='damageDealt').length;
  for(const e of next.events)if(['duelTriggered','unitRetreated','scriptMessage','battleEnded'].includes(e.type))events.push({turn:state.turn,...e});
  if(next.state.turn!==state.turn)rounds.push({turn:state.turn,attacks,positions:next.state.units.map(u=>({id:u.id,side:u.side,x:u.x,y:u.y,hp:u.troops,retreated:u.retreated}))});
  state=next.state;
 }
 const players=state.units.filter(u=>u.side==='player'&&!u.retreated);
 const paths=state.units.filter(u=>u.side==='enemy'&&!u.retreated).map(u=>({id:u.id,x:u.x,y:u.y,costsToPlayers:players.map(p=>({id:p.id,cost:pathCostField(ctx,p,u.moveClass).get(`${u.x},${u.y}`)??'unreachable'}))}));
 traces.push({id,seed,result:state.status,turn:state.turn,attacks,objectives:stage.objectives,events,rounds,paths});
 console.log(JSON.stringify({id,seed,result:state.status,turn:state.turn,attacks,events}));
}
writeFileSync('../../.studio/difficulty-audit/traces.json',JSON.stringify(traces,null,2));
