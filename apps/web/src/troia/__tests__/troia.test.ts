import { describe,it,expect } from 'vitest';
import { applyAction,createBattle,getMovableTiles,computeDamage,type Action } from '@tk/engine';
import { chooseAction } from '@tk/sim';
import { gameData } from '@tk/data';
import { content,context,newBattle } from '../content';
import { BattleStore } from '../../battle/store';
import { spriteCandidates } from '../../pixi/spriteMap';
import manifest from '../../../public/assets/sprites/manifest.json';
import { SPRITE_CLIPS } from '../../pixi/spriteClips';

describe('Troy content on the shared battle engine',()=>{
  it('connects the enlarged landing, skirmish and beacon on traversable ground',()=>{
    expect([content.map.width,content.map.height]).toEqual([40,24]);
    expect(content.stage.camera?.zoom).toBe(1.6);
    const open=(x:number,y:number)=>x>=0&&y>=0&&x<40&&y<24&&!['r','#'].includes(content.map.tiles[y]![x]!);
    const pending=[[10,12]],seen=new Set(['10,12']);
    for(let i=0;i<pending.length;i++){
      const [x,y]=pending[i]!;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x!+dx!,ny=y!+dy!,key=`${nx},${ny}`;
        if(open(nx,ny)&&!seen.has(key)){seen.add(key);pending.push([nx,ny]);}
      }
    }
    expect(seen.has('34,8')).toBe(true);
    for(const unit of content.stage.units)expect(seen.has(`${unit.x},${unit.y}`)).toBe(true);
    for(const deco of content.stage.decorations??[])expect(open(...deco.cell)).toBe(true);
    expect(new Set(content.stage.units.map(u=>`${u.x},${u.y}`)).size).toBe(content.stage.units.length);
  });
  it('uses full-body animation sets and the complete strategy catalog',()=>{
    for (const unit of content.stage.units) {
      const id = spriteCandidates(unit.commanderId,unit.classId,unit.side)[0]!;
      expect(id).toMatch(/^troia-/);
      const entry = (manifest as Record<string, {poses: string[]}>)[id];
      for (const view of ['front', 'back']) for (const clip of ['idle', 'move', 'attack', 'hit', 'guard'] as const) {
        for (let frame=0;frame<SPRITE_CLIPS[clip].length;frame++) expect(entry?.poses).toContain(`${view}_${clip}_${frame}`);
      }
    }
    for (const cls of Object.values(context.data.unitClasses)) {
      for (const id of cls.strategies ?? []) expect(context.data.strategies[id]).toBeDefined();
    }
    expect(context.data.unitClasses.strategist?.strategies).toContain('초열');
  });
  it('casts through the same strategy menu and BattleStore event stream',async()=>{
    const ctx={...context,stage:{...context.stage,units:context.stage.units.map(u=>u.commanderId==='trojan-spear-1'?{...u,x:11,y:13}:u)}};
    const store=new BattleStore(ctx,content.seed);
    const before=store.committedState.units.find(u=>u.id==='patroclus')!;
    store.dispatchUi({type:'tapTile',coord:{x:9,y:13}});
    store.dispatchUi({type:'tapTile',coord:{x:9,y:13}});
    store.dispatchUi({type:'menuStrategy'});
    expect(store.uiState.kind).toBe('strategyMenu');
    store.dispatchUi({type:'selectStrategy',strategyId:'초열'});
    store.dispatchUi({type:'tapTile',coord:{x:11,y:13}});
    store.dispatchUi({type:'tapTile',coord:{x:11,y:13}});
    await store.whenIdle();
    expect(store.actionLog).toContainEqual({type:'strategy',unitId:'patroclus',strategyId:'초열',target:{x:11,y:13}});
    expect(store.committedState.units.find(u=>u.id==='patroclus')!.mp).toBe(before.mp-context.data.strategies['초열']!.mp);
  });
  it('emits the shared flank and ultimate presentation events',()=>{
    const s=newBattle();
    Object.assign(s.units.find(u=>u.id==='achilles')!,{x:16,y:11,sp:255});
    Object.assign(s.units.find(u=>u.id==='patroclus')!,{x:17,y:10});
    const normal=applyAction(context,s,{type:'attack',unitId:'achilles',targetId:'trojan-spear-1'});
    expect(normal.events.some(e=>e.type==='flank')).toBe(true);
    const special=applyAction(context,s,{type:'ultimate',unitId:'achilles',targetId:'trojan-spear-1'});
    expect(special.events.some(e=>e.type==='ultimate')).toBe(true);
    expect(special.state.units.find(u=>u.id==='achilles')!.sp).toBeLessThan(255);
  });
  it('keeps campaign catalogs separate and uses the existing defense item and supply pool',()=>{
    const s=newBattle();
    expect(s.units).toHaveLength(10);
    expect(s.sharedItems.friendly).toEqual(['linen-bandage','linen-bandage','linen-bandage']);
    expect(s.units.find(u=>u.id==='achilles')?.damageReduction).toBe(.3);
    expect(gameData.commanders.achilles).toBeUndefined();
    expect(context.data.combat).toBe(gameData.combat);
    expect(context.data.terrains).toBe(gameData.terrains);
    for(const u of s.units)expect(getMovableTiles(context,s,u.id).every(p=>!['r','#'].includes(content.map.tiles[p.y]![p.x]!))).toBe(true);
  });
  it('reduces actual shared-engine weapon damage through the shell item',()=>{
    const s=newBattle(),a=s.units.find(u=>u.id==='diores')!,b=s.units.find(u=>u.id==='achilles')!;
    const plain=computeDamage(context,a,{...b,damageReduction:0});
    expect(computeDamage(context,a,b)).toBeLessThan(plain);
  });
  it('captures immediately on the last allowed turn and never requires annihilation',()=>{
    const s=newBattle();s.turn=context.stage.turnLimit;
    const a=s.units.find(u=>u.id==='achilles')!;a.x=34;a.y=7;
    const r=applyAction(context,s,{type:'move',unitId:a.id,to:{x:34,y:8}});
    expect(r.state.status).toBe('victory');
    expect(r.state.units.filter(u=>u.side==='enemy'&&!u.retreated)).toHaveLength(6);
    expect(r.events.filter(e=>e.type==='battleEnded')).toHaveLength(1);
  });
  it('enforces an essential hero defeat and heals without exceeding max health',()=>{
    const s=newBattle();s.units.find(u=>u.id==='achilles')!.retreated=true;
    expect(applyAction(context,s,{type:'wait',unitId:'patroclus'}).state.status).toBe('defeat');
    const healthy=newBattle();const a=healthy.units.find(u=>u.id==='achilles')!;a.troops-=60;
    const healed=applyAction(context,healthy,{type:'useItem',unitId:'patroclus',itemId:'linen-bandage',target:{x:a.x,y:a.y}});
    expect(healed.state.units.find(u=>u.id===a.id)!.troops).toBe(a.maxTroops);
    expect(healed.events).toContainEqual({type:'itemUsed',unitId:'patroclus',itemId:'linen-bandage',target:{x:a.x,y:a.y},amount:60});
    expect(healed.state.sharedItems.friendly).toHaveLength(2);
  });
  it('can complete the full battle with the existing policy across fixed seeds',()=>{
    const results=[];
    for(const seed of [content.seed,1,2,3,4,5,6,7,8,9]){
      let s=createBattle(context,seed),steps=0;
      while(s.status==='ongoing'&&steps<600){
        const a=chooseAction(context,s);
        expect(a).toBeDefined();
        s=applyAction(context,s,a!).state;steps++;
      }
      results.push({seed,status:s.status,turn:s.turn,alive:s.units.filter(u=>u.side==='player'&&!u.retreated).length});
    }
    console.log('Troy shared-engine completion:',results);
    expect(results[0]?.status).toBe('victory');
    expect(results.every(r=>r.status!=='ongoing')).toBe(true);
    expect(results.every(r=>r.status==='victory')).toBe(true);
  });
});
