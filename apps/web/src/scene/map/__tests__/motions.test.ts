import { describe,it,expect } from 'vitest';
import { frameAt,clipFor,validateLibrary,removeLegacyMotionMatte } from '../../motions';
import library from '../../../../public/assets/scene-motions/library.json';
describe('scene motion contract',()=>{
  it('preserves white clothing and soft edges in authored transparent artwork',()=>{
    const pixels = new Uint8ClampedArray([
      0,0,0,0, 240,240,240,255, 230,230,230,120,
      0,0,0,0, 80,40,20,255, 255,0,255,255,
    ]);
    const original = pixels.slice();
    removeLegacyMotionMatte(pixels,3,2);
    expect(pixels).toEqual(original);
  });
  it('removes opaque legacy backgrounds while retaining enclosed pale details',()=>{
    const pixels = new Uint8ClampedArray(5*5*4);
    for(let y=0;y<5;y++) for(let x=0;x<5;x++) {
      const value = x===0 || y===0 || x===4 || y===4 || (x===2 && y===2) ? 240 : 40;
      pixels.set([value,value,value,255],(y*5+x)*4);
    }
    removeLegacyMotionMatte(pixels,5,5);
    expect(pixels[3]).toBe(0);
    expect(pixels[(2*5+2)*4+3]).toBe(255);
    expect(pixels[(1*5+1)*4+3]).toBe(255);
  });
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
  it('accepts bounded mounted-actor scaling and rejects invalid scales',()=>{
    for(const scale of [0, -1, 2.1, NaN, Infinity]){
      const copy=structuredClone(library);Object.assign(copy.actors['liubei-foot'],{displayScale:scale});
      expect(validateLibrary(copy)).toBe(false);
    }
    expect(library.actors['zhaoyun-rescue'].displayScale).toBe(1.55);
  });
});
