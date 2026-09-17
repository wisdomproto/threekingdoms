import { describe, expect, it } from "vitest";
import { Texture, TextureSource, Sprite } from "pixi.js";
import { FxLayer } from "../layers/FxLayer";
import type { TweenRunner } from "../tweens";
import type { TextureResolver } from "../textures";
describe("combat artwork before its first animation tick", () => {
  for (const kind of ["slash", "thrust", "arrow", "critical"] as const) it(`${kind} never renders the full-size source sheet`, () => {
    const texture=new Texture({source:new TextureSource({width:1024,height:1024})});
    const fx=new FxLayer({run:()=>new Promise(()=>{})} as unknown as TweenRunner,{getFx:()=>texture} as unknown as TextureResolver);
    const a={x:200,y:200},b={x:248,y:200};
    if(kind==="arrow") void fx.arrowShot(a,b);
    else if(kind==="critical") void fx.specialImpact("critical",b,a);
    else void fx.slashArc(a,b,kind);
    const sprite=fx.world.children.find(c=>c instanceof Sprite) as Sprite;
    expect(sprite.width).toBeGreaterThan(0);
    expect(sprite.width).toBeLessThanOrEqual(48);
    expect(sprite.height).toBeLessThanOrEqual(48);
    expect(sprite.x).toBeGreaterThan(0);
    fx.world.destroy({children:true}); texture.destroy(true);
  });
});
