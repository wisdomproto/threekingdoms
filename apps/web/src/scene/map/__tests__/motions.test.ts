import { describe,it,expect } from 'vitest';
import { frameAt,clipFor,validateLibrary } from '../../motions';
import library from '../../../../public/assets/scene-motions/library.json';
describe('scene motion contract',()=>{
  it('validates the shipped actors and covers four-way walking',()=>{
    expect(validateLibrary(library)).toBe(true);
    for(const actor of [library.actors["liubei-foot"], library.actors["guanyu-foot"], library.actors["zhangfei-foot"]]) for(const dir of ['left','right','up','down'] as const){
      expect(clipFor(actor,'move',dir)!.frames.length).toBeGreaterThan(1);
    }
  });
  it('mirrors the side track and holds the last oath pose',()=>{
    const a=library.actors['liubei-foot'];
    expect(clipFor(a,'move','right')).toBe(clipFor(a,'move','left'));
    const kneel=a.clips['left.kneel'];
    expect(frameAt(kneel,999999)).toBe(kneel.frames.at(-1));
    const walk=a.clips['up.move'];
    expect(frameAt(walk,walk.frames.reduce((n,f)=>n+f.ms,0))).toBe(walk.frames[0]);
  });
  it('rejects zero duration, path traversal and malformed frame grids',()=>{
    for(const change of [{ms:0},{image:'/assets/../secret.png'},{columns:0},{col:99}]){
      const copy=structuredClone(library);Object.assign(copy.actors['liubei-foot'].clips['left.idle'].frames[0]!,change);
      expect(validateLibrary(copy)).toBe(false);
    }
  });
});
