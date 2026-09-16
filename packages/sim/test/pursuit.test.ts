import {describe,it,expect} from 'vitest';
import {gameData,stages} from '@tk/data';
import {createBattle,applyAction} from '@tk/engine';
import {greedyPolicy} from '../src/policy';
describe('bridge pursuit',()=>{
 it('reaches the defending army at Xiaopei instead of ending without combat',()=>{
  const stage=stages['11-xiaopei']!;const ctx={data:gameData,stage,map:gameData.maps[stage.mapId]!};
  let state=createBattle(ctx,42),hits=0;
  for(let i=0;i<5000&&state.status==='ongoing';i++){
   const a=greedyPolicy(ctx,state);if(!a)break;
   const next=applyAction(ctx,state,a);hits+=next.events.filter(e=>e.type==='damageDealt').length;state=next.state;
  }
  expect(hits).toBeGreaterThan(0);
 });
});
