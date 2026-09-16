import { describe, expect, it } from "vitest";
import type { Texture } from "pixi.js";
import { TextureResolver } from "../textures";

function fixture(poses: Map<string, Texture>): TextureResolver {
  return Object.assign(Object.create(TextureResolver.prototype), { sprites: new Map([["liubei", poses]]) });
}
describe("sprite clip fallback", () => {
  it("tracks native direction on the exact loaded frame, including static fallback", () => {
    const right = {} as Texture, left = {} as Texture;
    const resolver = fixture(new Map([["back_idle", right]]));
    Object.assign(resolver, { rightFacingTextures: new WeakSet([right]) });
    expect(resolver.spriteNativeFacing(resolver.getSprite("liubei", "back", "missing")!)).toBe(1);
    expect(resolver.spriteNativeFacing(left)).toBe(-1);
    expect(resolver.spriteNativeFacing(right) * -1).toBe(-1);
    expect(resolver.spriteNativeFacing(left) * -1).toBe(1);
  });
  it("waits for every frame and preserves the static drawing during partial loading", () => {
    const idle = {} as Texture, first = {} as Texture, second = {} as Texture;
    const poses = new Map([["front_idle", idle], ["front_idle_0", first]]);
    const resolver = fixture(poses);
    expect(resolver.getSpriteClip("liubei", "front", "idle")).toBeNull();
    expect(resolver.getSprite("liubei", "front", "idle")).toBe(idle);
    poses.set("front_idle_1", second);
    expect(resolver.getSpriteClip("liubei", "front", "idle")).toEqual([first, second]);
  });
  it("does not mix front animation into a missing rear or promotion clip", () => {
    const poses = new Map([["front_idle_0", {} as Texture], ["front_idle_1", {} as Texture]]);
    const resolver = fixture(poses);
    expect(resolver.getSpriteClip("liubei", "back", "idle")).toBeNull();
    expect(resolver.getSpriteClip("liubei/t2", "front", "idle")).toBeNull();
  });
});
