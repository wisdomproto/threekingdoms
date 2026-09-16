import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gameData, MapSceneSchema } from '../src';
import library from '../../../apps/web/public/assets/scene-motions/library.json';

describe('complete campaign story staging', () => {
  it('covers all 54 slots and resolves every actor, image and reachable action', () => {
    let count=0;
    for (const stage of Object.values(gameData.stages)) for (const slot of ['intro','outro'] as const) {
      const parts=stage.scenario?.[slot];
      expect(Array.isArray(parts),stage.id+slot).toBe(true);
      if (!Array.isArray(parts)) continue;
      expect(parts.some(p=>'map' in p),stage.id+slot).toBe(true); count++;
      // Chapter one has its own detailed contract and legacy opening.
      if (Number(stage.id.slice(0,2))<5) continue;
      for (const raw of parts) {
        if (!('map' in raw)) continue;
        const part=MapSceneSchema.parse(raw), map=gameData.maps[part.map]!;
        expect(map,part.map).toBeDefined();
        // The scene renderer supports WebP first and PNG for legacy scene sets.
        expect(['.webp', '.png'].some(ext => existsSync(resolve('../../apps/web/public/assets/maps',part.map+ext))), part.map).toBe(true);
        const clear=(cell: readonly number[])=>{
          const [x,y]=cell as [number,number];
          return x>=0&&x<map.width&&y>=0&&y<map.height&&map.tileLegend[map.tiles[y]![x]!]==='plain';
        };
        const path=(from: readonly number[],to: readonly number[])=>{
          const seen=new Set([from.join(',')]),queue=[from];
          for(let i=0;i<queue.length;i++){
            const [x,y]=queue[i] as [number,number];if(x===to[0]&&y===to[1])return true;
            for(const cell of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(clear(cell)&&!seen.has(cell.join(','))){seen.add(cell.join(','));queue.push(cell);}
          }return false;
        };
        const actors=library.actors as Record<string,{name:string;clips:Record<string,{frames:{image:string}[]}>}>;
        const state=new Map(part.units.map(u=>[u.id,{cell:u.cell,hidden:!!u.hidden,sprite:u.sprite}]));
        for(const u of part.units){
          expect(clear(u.cell),`${stage.id} initial ${u.id}`).toBe(true);
          expect(actors[u.sprite],u.sprite).toBeDefined();
          for(const clip of Object.values(actors[u.sprite]!.clips))for(const f of clip.frames)expect(existsSync(resolve('../../apps/web/public',f.image.slice(1))),f.image).toBe(true);
        }
        for(const line of part.lines){
          for(const key of ['exit','move','enter'] as const)for(const action of line[key]??[]){
            const s=state.get(action.id)!;expect(s,action.id).toBeDefined();
            const from='from' in action && Array.isArray(action.from)?action.from as number[]:s.cell;
            expect(path(from,action.to),`${stage.id} ${slot} ${action.id} ${key}`).toBe(true);
            s.cell=action.to;if(key==='exit')s.hidden=true;if(key==='enter')s.hidden=false;
          }
          for(const action of line.pose??[]){
            const s=state.get(action.id)!;expect(s).toBeDefined();
            expect(actors[s.sprite]!.clips['left.'+action.pose],`${s.sprite} ${action.pose}`).toBeDefined();
          }
          if(line.speaker){const matching=[...state.values()].filter(s=>actors[s.sprite]!.name===line.speaker);expect(matching.some(s=>!s.hidden),`${stage.id} hidden speaker ${line.speaker}`).toBe(true);}
          const visible=[...state.values()].filter(s=>!s.hidden).map(s=>s.cell.join(','));
          expect(new Set(visible).size,`${stage.id} overlapping units`).toBe(visible.length);
        }
      }
    }
    expect(count).toBe(54);
  });
});
