import { describe,it,expect } from 'vitest';
import { initialMeta,selectRoster,rosterTrainingLevel } from '../metaStore';
import { gameData } from '@tk/data';
describe('reserve training',()=>{
 it('keeps new games at level one and counts each cleared stage once',()=>{
  expect(rosterTrainingLevel(initialMeta())).toBe(1);
  expect(rosterTrainingLevel({...initialMeta(),clearedStages:['a','a','b']})).toBe(3);
 });
 it('catches up new recruits and supports without reducing trained veterans or equipment',()=>{
  const s={...initialMeta(),clearedStages:Array.from({length:9},(_,i)=>String(i)),rosterProgress:{유비:{level:2,exp:80,equipped:['쌍고검']},관우:{level:14,exp:90,equipped:['청룡언월도']}}};
  const units=selectRoster(s,gameData.rosters,3);
  expect(units.find(u=>u.commanderId==='조운')?.level).toBe(10);
  expect(units.find(u=>u.commanderId==='유비')).toMatchObject({level:10,exp:0,equipped:['쌍고검']});
  expect(units.find(u=>u.commanderId==='관우')).toMatchObject({level:14,exp:90,equipped:['청룡언월도']});
  expect(s.rosterProgress.유비.level).toBe(2);
 });
});
