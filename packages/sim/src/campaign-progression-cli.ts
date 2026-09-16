import { writeFileSync, mkdirSync } from 'node:fs';
import { gameData, stages } from '@tk/data';
import { createBattle, applyAction } from '@tk/engine';
import { greedyPolicy } from './policy';
import { initialMeta, selectRoster, reduceApplyRosterProgress, reduceMarkCleared, reduceTriggerDepartures } from '../../../apps/web/src/meta/metaStore';
import { autoFormation } from '../../../apps/web/src/meta/autoFormation';
import { applySortieToStage } from '../../../apps/web/src/meta/sortie';
const runs=[];
for(let seed=1;seed<=Number(process.env.CAMPAIGN_SEEDS??5);seed++){
 let meta=initialMeta();const rows=[];
 for(const base of Object.values(stages).sort((a,b)=>a.id.localeCompare(b.id))){
  const n=parseInt(base.id), chapter=n<=4?1:n<=9?2:n<=15?3:n<=22?4:5;
  const roster=selectRoster(meta,gameData.rosters,chapter);
  const members=autoFormation(roster,base);
  const stage={...base,units:applySortieToStage(base,members)};
  const ctx={data:gameData,stage,map:gameData.maps[stage.mapId]!};
  let state=createBattle(ctx,seed);let guard=0;
  while(state.status==='ongoing'&&state.turn<=stage.turnLimit+1&&++guard<100000){const a=greedyPolicy(ctx,state);if(!a)break;state=applyAction(ctx,state,a).state;}
  rows.push({id:base.id,levels:members.map(m=>`${m.commanderId}:${m.level}`),result:state.status,turn:state.turn,retreats:state.units.filter(u=>u.side==='player'&&u.retreated).length});
  if(state.status!=='victory'&&!process.env.CAMPAIGN_CHECKPOINTS)break;
  if(state.status==='victory')meta=reduceApplyRosterProgress(meta,state.units.filter(u=>u.side==='player').map(u=>({commanderId:u.id,level:u.level,exp:u.exp})),gameData.rosters);
  meta=reduceTriggerDepartures(reduceMarkCleared(meta,base.id),base.id,gameData.rosters);
 }
 runs.push({seed,rows});console.log(JSON.stringify({seed,last:rows.at(-1)}));
}
mkdirSync('../../.studio/difficulty-tuning',{recursive:true});
writeFileSync('../../.studio/difficulty-tuning/campaign-progression.json',JSON.stringify(runs,null,2));
