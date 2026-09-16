import { afterEach, describe, expect, it, vi } from "vitest";
import { Assets, type Texture } from "pixi.js";
import { TextureResolver } from "../textures";

function fixture() {
  const bake = vi.fn();
  const resolver: TextureResolver = Object.assign(Object.create(TextureResolver.prototype), {
    disposed: false, tileBase: "/tiles", bakeImageTile: bake,
    baked: new Map(), sprites: new Map(), tileTex: new Map(), macroTex: new Map(),
    macroSubCache: new Map(), tileMeta: new Map(),
    loadDecos: vi.fn().mockResolvedValue(undefined),
    loadObjects: vi.fn().mockResolvedValue(undefined),
    loadFx: vi.fn().mockResolvedValue(undefined),
    loadGround: vi.fn().mockResolvedValue(undefined),
  });
  return { resolver, bake };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("terrain loading during scene teardown", () => {
  it("does not bake late images against a destroyed renderer", async () => {
    const { resolver, bake } = fixture();
    let finish!: (textures: Record<string, Texture>) => void;
    const pending = new Promise<Record<string, Texture>>(resolve => { finish = resolve; });
    const load = vi.spyOn(Assets, "load").mockReturnValue(pending as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ plain: { kind: "tile", size: 1, count: 1 } }),
    }));
    const loading = resolver.loadTiles();
    await vi.waitFor(() => expect(load).toHaveBeenCalled());
    resolver.destroy();
    finish({ "/tiles/plain_0.webp": {} as Texture });
    await expect(loading).resolves.toBeUndefined();
    expect(bake).not.toHaveBeenCalled();
  });

  it("does not start more requests after disposal", async () => {
    const { resolver } = fixture();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    resolver.destroy();
    await resolver.loadTiles();
    expect(fetch).not.toHaveBeenCalled();
  });
});
