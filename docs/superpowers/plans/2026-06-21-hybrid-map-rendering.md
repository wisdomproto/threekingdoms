# Hybrid Map Rendering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a distinct, always-visible top-down **ObjectLayer** between ground and units that renders terrain-driven map objects (autotiled walls, gates, and the existing decos like huts/peaks), so structures read clearly as tactical objects on both painted-background and tile-fallback grounds.

**Architecture:** Pure, pixi-free logic modules (`autotile.ts`, `objectModel.ts`) compute *which* object a cell shows and *which wall segment/rotation* — unit-tested in vitest (node). A new Pixi `ObjectLayer` (mirrors `TerrainLayer`'s chunk/cull) consumes that logic to draw sprites at zIndex 1.8 (above highlights, below units), **always visible** regardless of painted background. The existing terrain-deco rendering is **migrated out of `TerrainLayer.buildDecos` into ObjectLayer** (fixes a latent bug where a painted background hides decos via `terrain.visible=false`), and walls are newly added.

**Tech Stack:** TypeScript, PixiJS 8, Vitest, pnpm monorepo (`apps/web`). Spec: `docs/superpowers/specs/2026-06-21-hybrid-map-rendering-design.md`.

> **Status (2026-06-21):** ✅ **Chunk 1·2 구현·커밋** (autotile/objectModel 순수+TDD, ObjectLayer, TerrainLayer 데코 흡수, BattleRenderer 배선) — typecheck/test 515/build 전부 green, 렌더러 가동(기존 데코 always-visible). ✅ **Chunk 3 컷 도구** `tools/sprite-pipeline/cut_object_sheet.py`(합성 검증). ⏳ 미착수: 벽이 보이려면 K-4 top-down 시트 생성→컷 / 보드 📤-오브젝트 자동컷 배선 / 성문 상태 이벤트 / `decorations` 데이터 / yingchuan 맵 수정.

---

## File Structure

| File | Responsibility | Kind |
|---|---|---|
| `apps/web/src/pixi/objects/autotile.ts` (create) | Pure: 4-neighbor wall bitmask → `{seg, rot}` segment + rotation. No pixi. | logic |
| `apps/web/src/pixi/objects/objectModel.ts` (create) | Pure: terrain id → object kind (`wall`/`gate`/`deco`/null). No pixi. | logic |
| `apps/web/src/pixi/objects/__tests__/autotile.test.ts` (create) | Exhaustive 16-case bitmask test. | test |
| `apps/web/src/pixi/objects/__tests__/objectModel.test.ts` (create) | Terrain→kind mapping test. | test |
| `apps/web/src/pixi/layers/ObjectLayer.ts` (create) | Pixi: chunked, reads `terrainAt`, draws wall/gate/deco sprites, `cull()`, `setObjectState()`. zIndex 1.8, always visible. | render |
| `apps/web/src/pixi/textures.ts` (modify) | Add `OBJECT_FILES` + `loadObjects()` + `getObject(key)`; keep `DECO_FILES`/`getDeco` (reused by ObjectLayer). | render |
| `apps/web/src/pixi/layers/TerrainLayer.ts` (modify) | Remove `buildDecos`/`chunk.decos` (migrated to ObjectLayer). TerrainLayer = pure ground. | render |
| `apps/web/src/pixi/BattleRenderer.ts` (modify) | Construct ObjectLayer (zIndex 1.8), `loadObjects().then(rebake)`, `cull`. Always visible (do NOT hide on painted bg). | render |

**Chunks:** Chunk 1 = pure logic (TDD). Chunk 2 = ObjectLayer + textures + TerrainLayer migration + BattleRenderer wiring (integration, verified via build/typecheck + app run). Chunk 3 (outlined, follow-on) = gate/wall destructible state events, `decorations` data field, object-sheet cut tool + asset generation.

**Convention notes (read before coding):**
- Terrain access: `import { terrainAt } from "@tk/engine";` → `terrainAt(ctx, gx, gy).id` (string). See `TerrainLayer.ts:121`.
- `TILE_SIZE = 48` from `../projection`. Cell center: `gridToWorld({x,y})`.
- Existing decos use `anchor.set(0.5, 1)` (bottom-center, upright billboard) + ellipse shadow — preserve this look in ObjectLayer (`TerrainLayer.ts:219-254`).
- `textures.getDeco(terrainId)` already returns gate/village/barracks/depot/bridge/mountain textures (`textures.ts:72-80`). Ground terrains return null.
- Pure modules MUST NOT import pixi.js (so vitest node can run them) — mirror `projection.ts:6` rule.

---

## Chunk 1: Pure logic (autotile + object model)

### Task 1: Wall autotile bitmask

**Files:**
- Create: `apps/web/src/pixi/objects/autotile.ts`
- Test: `apps/web/src/pixi/objects/__tests__/autotile.test.ts`

Bitmask: `N=1, E=2, S=4, W=8` (set bit = that orthogonal neighbor is also a wall). Base sprites and clockwise rotation:
- `straight` base connects {E,W} (rot 0 horizontal; rot 90 → vertical {N,S}).
- `corner` base connects {S,E} (rot 0); rot 90→{S,W}, 180→{N,W}, 270→{N,E}.
- `end` base connects {E} (rot 0); rot 90→{S}, 180→{W}, 270→{N}.
- `tee` base connects {E,S,W} (missing N, rot 0); rot 90→missing E, 180→missing S, 270→missing W.
- `cross` {N,E,S,W} (rot 0). `single` {} (rot 0).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/pixi/objects/__tests__/autotile.test.ts
import { describe, it, expect } from "vitest";
import { wallTile, type WallTile } from "../autotile";

const N = 1, E = 2, S = 4, W = 8;

describe("wallTile", () => {
  const cases: Array<[number, WallTile]> = [
    [0,        { seg: "single",   rot: 0 }],
    [N,        { seg: "end",      rot: 270 }],
    [E,        { seg: "end",      rot: 0 }],
    [S,        { seg: "end",      rot: 90 }],
    [W,        { seg: "end",      rot: 180 }],
    [E | W,    { seg: "straight", rot: 0 }],
    [N | S,    { seg: "straight", rot: 90 }],
    [S | E,    { seg: "corner",   rot: 0 }],
    [S | W,    { seg: "corner",   rot: 90 }],
    [N | W,    { seg: "corner",   rot: 180 }],
    [N | E,    { seg: "corner",   rot: 270 }],
    [E | S | W,        { seg: "tee",   rot: 0 }],
    [N | S | W,        { seg: "tee",   rot: 90 }],
    [N | E | W,        { seg: "tee",   rot: 180 }],
    [N | E | S,        { seg: "tee",   rot: 270 }],
    [N | E | S | W,    { seg: "cross", rot: 0 }],
  ];
  it.each(cases)("mask %i → segment", (mask, expected) => {
    expect(wallTile(mask)).toEqual(expected);
  });
  it("masks the low 4 bits only", () => {
    expect(wallTile(0b10000 | E)).toEqual({ seg: "end", rot: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tk/web test -- autotile`
Expected: FAIL ("Cannot find module '../autotile'").

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/pixi/objects/autotile.ts
/** 성벽 오토타일 — 4-이웃 비트마스크(N=1,E=2,S=4,W=8) → 세그먼트 + 시계방향 회전. pixi-free(순수). */
export type WallSeg = "single" | "end" | "straight" | "corner" | "tee" | "cross";
export interface WallTile { seg: WallSeg; rot: 0 | 90 | 180 | 270; }

const TABLE: Record<number, WallTile> = {
  0:  { seg: "single",   rot: 0 },
  1:  { seg: "end",      rot: 270 }, // N
  2:  { seg: "end",      rot: 0 },   // E
  4:  { seg: "end",      rot: 90 },  // S
  8:  { seg: "end",      rot: 180 }, // W
  10: { seg: "straight", rot: 0 },   // E+W
  5:  { seg: "straight", rot: 90 },  // N+S
  6:  { seg: "corner",   rot: 0 },   // S+E
  12: { seg: "corner",   rot: 90 },  // S+W
  9:  { seg: "corner",   rot: 180 }, // N+W
  3:  { seg: "corner",   rot: 270 }, // N+E
  14: { seg: "tee",      rot: 0 },   // E+S+W (missing N)
  13: { seg: "tee",      rot: 90 },  // N+S+W (missing E)
  11: { seg: "tee",      rot: 180 }, // N+E+W (missing S)
  7:  { seg: "tee",      rot: 270 }, // N+E+S (missing W)
  15: { seg: "cross",    rot: 0 },
};

export function wallTile(mask: number): WallTile {
  return TABLE[mask & 0b1111];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tk/web test -- autotile`
Expected: PASS (17 assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pixi/objects/autotile.ts apps/web/src/pixi/objects/__tests__/autotile.test.ts
git commit -m "feat(map): wall autotile bitmask (pure)"
```

### Task 2: Terrain → object kind

**Files:**
- Create: `apps/web/src/pixi/objects/objectModel.ts`
- Test: `apps/web/src/pixi/objects/__tests__/objectModel.test.ts`

`objectKind(terrainId)`: `wall`→"wall", `gate`→"gate", everything else→"deco" (ObjectLayer's `getDeco` returns null for ground terrains, so they draw nothing). This keeps the module pure and lets the texture layer decide what actually has art.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/pixi/objects/__tests__/objectModel.test.ts
import { describe, it, expect } from "vitest";
import { objectKind } from "../objectModel";

describe("objectKind", () => {
  it("wall → wall (autotiled)", () => expect(objectKind("wall")).toBe("wall"));
  it("gate → gate (stateful)", () => expect(objectKind("gate")).toBe("gate"));
  it.each(["mountain", "village", "barracks", "depot", "bridge", "plain", "grass"])(
    "%s → deco (texture layer decides)", (t) => expect(objectKind(t)).toBe("deco"),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tk/web test -- objectModel`
Expected: FAIL ("Cannot find module '../objectModel'").

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/pixi/objects/objectModel.ts
/** 지형 id → 오브젝트 종류. wall/gate는 특수 렌더, 그 외는 deco(텍스처 유무로 그릴지 결정). pixi-free. */
export type ObjectKind = "wall" | "gate" | "deco";
export function objectKind(terrainId: string): ObjectKind {
  if (terrainId === "wall") return "wall";
  if (terrainId === "gate") return "gate";
  return "deco";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tk/web test -- objectModel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pixi/objects/objectModel.ts apps/web/src/pixi/objects/__tests__/objectModel.test.ts
git commit -m "feat(map): terrain→object-kind mapping (pure)"
```

### Chunk 1 review gate
- [ ] Run full web test suite: `pnpm --filter @tk/web test` — Expected: all pass (new + existing).
- [ ] Run typecheck: `pnpm --filter @tk/web typecheck` — Expected: clean.

---

## Chunk 2: ObjectLayer + textures + TerrainLayer migration + wiring

### Task 3: Object texture loading (textures.ts)

**Files:**
- Modify: `apps/web/src/pixi/textures.ts` (add after `DECO_FILES`, ~line 80; new getter near `getDeco` ~line 382; loader near `loadDecos` ~line 251 and its call in the tiles-load path ~line 406)

Add wall-segment + gate-state object textures under `/assets/objects/`. Until the Chunk-3 cut tool produces the art, the load batch throws (caught) and these stay unloaded; ObjectLayer skips on `getObject()===null` (graceful, no crash — art arrives later).

- [ ] **Step 1: Add `OBJECT_FILES` map** (after `DECO_FILES`)

```ts
/** 맵 구조물 오브젝트 텍스처 (ObjectLayer). 성벽 세그먼트(오토타일) + 성문 상태. /assets/objects/.
 *  미보유 키는 로드 실패 → null, ObjectLayer가 스킵(아트는 Chunk 3 컷 도구로 채움). */
const OBJECT_FILES: Record<string, string> = {
  wall_single: "wall_single.png", wall_end: "wall_end.png", wall_straight: "wall_straight.png",
  wall_corner: "wall_corner.png", wall_tee: "wall_tee.png", wall_cross: "wall_cross.png",
  gate_closed: "gate_closed.png", gate_open: "gate_open.png", gate_destroyed: "gate_destroyed.png",
};
const OBJECT_BASE = assetUrl("/assets/objects");
```

- [ ] **Step 2: Add `objectTex` store + `getObject` getter** (mirror `decoTex`/`getDeco` at ~line 151/382)

```ts
// near `private readonly decoTex = new Map<string, Texture>();`
private readonly objectTex = new Map<string, Texture>();
```
```ts
// near getDeco
/** 구조물 오브젝트 텍스처(없으면 null → ObjectLayer 스킵). */
getObject(key: string): Texture | null {
  return this.objectTex.get(key) ?? null;
}
```

- [ ] **Step 3: Add `loadObjects()` + call it** (mirror `loadDecos` at `textures.ts:251-264`; call alongside `loadDecos()` in the tiles-ready path ~line 406)

```ts
private async loadObjects(): Promise<void> {
  const entries = Object.entries(OBJECT_FILES);
  const urls = entries.map(([, f]) => `${OBJECT_BASE}/${f}`);
  try {
    const loaded = await Assets.load<Texture>(urls);
    for (const [key, f] of entries) {
      const tex = loaded[`${OBJECT_BASE}/${f}`];
      if (tex) this.objectTex.set(key, tex);
    }
  } catch (e) {
    console.warn("[TextureResolver] 구조물 오브젝트 로드 오류(아트 미보유 단계 정상):", e);
  }
}
```
> Uses the SAME `Assets.load<Texture>(urls)` batch form as `loadDecos`/`loadGround` (`textures.ts:251-264, 366-379`) — `Assets` and `Texture` are already imported there. ⚠ `Assets.load` **rejects the whole batch if any URL 404s** (not per-item null), exactly like the existing deco/ground loaders — hence the try/catch: until the Chunk-3 cut tool produces `/assets/objects/*.png`, the batch throws and `objectTex` stays empty, and ObjectLayer skips walls/gate-states on `getObject()===null` (no crash). Add `await this.loadObjects();` next to the existing `await this.loadDecos();` (~line 406).

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @tk/web typecheck`
Expected: clean (no unused, types OK).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pixi/textures.ts
git commit -m "feat(map): object texture loading (wall segments + gate states)"
```

### Task 4: ObjectLayer (render terrain-driven objects)

**Files:**
- Create: `apps/web/src/pixi/layers/ObjectLayer.ts`

Mirrors `TerrainLayer`'s chunk + `cull`. Per cell: `objectKind(terrainId)` → wall (autotiled `getObject('wall_'+seg)`, rotated), gate (`getObject('gate_'+state)`, default closed), or deco (`getDeco(terrainId)`, upright billboard + shadow — the logic lifted from `TerrainLayer.buildDecos`). Missing textures skip. Wall neighbor mask via `terrainAt`.

- [ ] **Step 1: Write ObjectLayer**

```ts
// apps/web/src/pixi/layers/ObjectLayer.ts
/** ObjectLayer (설계 2026-06-21-hybrid-map-rendering §3·§5) — 바닥 위·유닛 아래(zIndex 1.8)의
 *  구별되는 top-down 오브젝트. 지형 구동: wall=오토타일, gate=상태별, 그 외=데코(빌보드).
 *  painted 배경과 무관하게 항상 표시. TerrainLayer의 청크/cull 패턴 재사용. */
import { Container, Graphics, Sprite } from "pixi.js";
import type { BattleContext } from "@tk/engine";
import { terrainAt } from "@tk/engine";
import { TILE_SIZE } from "../projection";
import type { TextureResolver } from "../textures";
import type { WorldRect } from "./TerrainLayer";
import { wallTile } from "../objects/autotile";
import { objectKind } from "../objects/objectModel";

const CHUNK_TILES = 16;
const N = 1, E = 2, S = 4, W = 8;

interface Cell { gx: number; gy: number; terrainId: string; tx: number; ty: number; }
interface Chunk { container: Container; cells: Cell[]; sprites: Container[]; x: number; y: number; width: number; height: number; }

export class ObjectLayer extends Container {
  private readonly chunks: Chunk[] = [];
  private readonly ctx: BattleContext;
  private readonly textures: TextureResolver;
  /** 칸별 성문/성벽 상태 ("gate"→closed/open/destroyed). 키=`${gx},${gy}` */
  private readonly state = new Map<string, string>();

  constructor(ctx: BattleContext, textures: TextureResolver) {
    super();
    this.ctx = ctx;
    this.textures = textures;
    const { width, height } = ctx.map;
    const chunksX = Math.ceil(width / CHUNK_TILES);
    const chunksY = Math.ceil(height / CHUNK_TILES);
    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const container = new Container();
        const tilesW = Math.min(CHUNK_TILES, width - cx * CHUNK_TILES);
        const tilesH = Math.min(CHUNK_TILES, height - cy * CHUNK_TILES);
        const cells: Cell[] = [];
        for (let ty = 0; ty < tilesH; ty++)
          for (let tx = 0; tx < tilesW; tx++) {
            const gx = cx * CHUNK_TILES + tx, gy = cy * CHUNK_TILES + ty;
            cells.push({ gx, gy, terrainId: terrainAt(ctx, gx, gy).id, tx, ty });
          }
        container.position.set(cx * CHUNK_TILES * TILE_SIZE, cy * CHUNK_TILES * TILE_SIZE);
        this.addChild(container);
        const chunk: Chunk = { container, cells, sprites: [],
          x: cx * CHUNK_TILES * TILE_SIZE, y: cy * CHUNK_TILES * TILE_SIZE,
          width: tilesW * TILE_SIZE, height: tilesH * TILE_SIZE };
        this.chunks.push(chunk);
        this.build(chunk);
      }
    }
  }

  /** loadObjects()/loadDecos() 완료 후 호출 — 텍스처 적용 재생성. */
  rebake(): void { for (const c of this.chunks) this.build(c); }

  /** 성문/성벽 상태 변경(관문돌파·화공 이벤트) — 해당 칸 청크만 재생성. */
  setObjectState(gx: number, gy: number, st: string): void {
    this.state.set(`${gx},${gy}`, st);
    const c = this.chunks.find((c) =>
      gx >= c.x / TILE_SIZE && gx < (c.x + c.width) / TILE_SIZE &&
      gy >= c.y / TILE_SIZE && gy < (c.y + c.height) / TILE_SIZE);
    if (c) this.build(c);
  }

  private isWall(gx: number, gy: number): boolean {
    const { width, height } = this.ctx.map;
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) return false;
    return terrainAt(this.ctx, gx, gy).id === "wall";
  }

  private build(chunk: Chunk): void {
    for (const s of chunk.sprites) s.destroy();
    chunk.sprites.length = 0;
    for (const { gx, gy, terrainId, tx, ty } of chunk.cells) {
      const kind = objectKind(terrainId);
      if (kind === "wall") this.addWall(chunk, gx, gy, tx, ty);
      else if (kind === "gate") this.addGate(chunk, gx, gy, tx, ty);
      else this.addDeco(chunk, terrainId, tx, ty);
    }
  }

  private addWall(chunk: Chunk, gx: number, gy: number, tx: number, ty: number): void {
    const mask = (this.isWall(gx, gy - 1) ? N : 0) | (this.isWall(gx + 1, gy) ? E : 0) |
                 (this.isWall(gx, gy + 1) ? S : 0) | (this.isWall(gx - 1, gy) ? W : 0);
    const { seg, rot } = wallTile(mask);
    const tex = this.textures.getObject(`wall_${seg}`);
    if (!tex || tex.width === 0) return;
    const sp = new Sprite(tex);
    sp.anchor.set(0.5, 0.5);
    sp.width = sp.height = TILE_SIZE;
    sp.angle = rot;
    sp.position.set(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2);
    chunk.container.addChild(sp);
    chunk.sprites.push(sp);
  }

  private addGate(chunk: Chunk, gx: number, gy: number, tx: number, ty: number): void {
    const st = this.state.get(`${gx},${gy}`) ?? "closed";
    const tex = this.textures.getObject(`gate_${st}`) ?? this.textures.getDeco("gate");
    if (!tex || tex.width === 0) return;
    const sp = new Sprite(tex);
    sp.anchor.set(0.5, 1);
    const s = TILE_SIZE / tex.width;
    sp.scale.set(s);
    sp.position.set(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE - 1);
    chunk.container.addChild(sp);
    chunk.sprites.push(sp);
  }

  // TerrainLayer.buildDecos 에서 이관(빌보드 + 그림자). organic 산포는 후속(우선 1:1).
  private addDeco(chunk: Chunk, terrainId: string, tx: number, ty: number): void {
    const tex = this.textures.getDeco(terrainId);
    if (!tex || tex.width === 0) return;
    const s = (TILE_SIZE * 1.18) / tex.width;
    const cx = tx * TILE_SIZE + TILE_SIZE / 2;
    const cy = ty * TILE_SIZE + TILE_SIZE - 1;
    const shadow = new Graphics();
    shadow.ellipse(0, 0, tex.width * s * 0.32, TILE_SIZE * 0.16).fill({ color: 0x000000, alpha: 0.18 });
    shadow.position.set(cx, cy - 2);
    chunk.container.addChild(shadow);
    chunk.sprites.push(shadow);
    const deco = new Sprite(tex);
    deco.anchor.set(0.5, 1);
    deco.scale.set(s);
    deco.position.set(cx, cy);
    chunk.container.addChild(deco);
    chunk.sprites.push(deco);
  }

  cull(view: WorldRect): void {
    for (const c of this.chunks)
      c.container.visible = c.x < view.x + view.width && c.x + c.width > view.x &&
        c.y < view.y + view.height && c.y + c.height > view.y;
  }
}
```
> NOTE: This intentionally drops `TerrainLayer`'s organic mountain jitter/density/flip for the first pass (1:1 deco). Re-add `DECO_DENSITY`/`ORGANIC_DECO` behavior in a follow-up if mountains look too uniform — keep it out of the MVP. Also: `addWall`'s mask counts only `wall` cells, so a wall adjacent to a `gate` caps with an `end` facing the gate (cosmetic; make `isWall` treat `gate` as connective in Chunk-3 polish if rampart-through-gate looks broken).

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @tk/web typecheck`
Expected: clean. (Fix import of `WorldRect` — it's `export interface WorldRect` in `TerrainLayer.ts:91`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pixi/layers/ObjectLayer.ts
git commit -m "feat(map): ObjectLayer — terrain-driven walls/gates/decos (always-visible)"
```

### Task 5: Migrate decos out of TerrainLayer

**Files:**
- Modify: `apps/web/src/pixi/layers/TerrainLayer.ts` (remove `buildDecos` + `chunk.decos` + deco constants now owned by ObjectLayer)

- [ ] **Step 1: Remove deco rendering from TerrainLayer**
  - Delete `buildDecos(chunk)` method (`:219-255`) and both call sites (`:138`, `:147`).
  - Delete `decos: Container[]` from `Chunk` (`:84`) and its init (`:130`).
  - Delete now-unused deco constants: `DECO_WIDTH_RATIO`, `ORGANIC_WIDTH_RATIO`, `DECO_DENSITY`, `ORGANIC_DECO`, `rand01` (if unused after) (`:21-25`, `:32-36`). Keep `FEATURE_TERRAIN`/feather (ground feature blending stays).
  - Update the class doc comment (`:9`) — remove the "데코" bullet.

- [ ] **Step 2: Verify typecheck + tests**

Run: `pnpm --filter @tk/web typecheck && pnpm --filter @tk/web test`
Expected: clean + all pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pixi/layers/TerrainLayer.ts
git commit -m "refactor(map): move terrain decos from TerrainLayer to ObjectLayer"
```

### Task 6: Wire ObjectLayer into BattleRenderer

**Files:**
- Modify: `apps/web/src/pixi/BattleRenderer.ts` (`Scene` interface `:96-112`; construction `:192-218`; tiles-ready rebake `:214-216`; cull in tick `:362`)

- [ ] **Step 1: Construct + add ObjectLayer (zIndex 1.8, always visible)**

After the `units` layer is created (~`:203`) and before `world.addChild(...)` (`:218`):
```ts
import { ObjectLayer } from "./layers/ObjectLayer";
// ...
const objects = new ObjectLayer(this.ctx, textures);
objects.zIndex = 1.8; // highlights(1)/threat(1.5) 위, units(2) 아래
```
Change `world.addChild(terrain, highlights, threat, units, fx.world);` (`:218`) to include `objects`:
```ts
world.addChild(terrain, highlights, threat, objects, units, fx.world);
```

- [ ] **Step 2: Rebake objects when tiles load; cull each tick; keep always-visible**

In the `tilesReady.then(...)` block (`:214-216`) add an objects rebake (objects share the tiles/deco/object texture phase):
```ts
tilesReady
  .then(() => { terrain.rebake(); objects.rebake(); })
  .catch((e) => console.warn("[BattleRenderer] loadTiles 예외 (단색 폴백 유지):", e));
```
In `tick` (`:362`), add `objects.cull(camera.viewWorldRect());` next to `terrain.cull(...)`.
In the painted-bg `loadMapBackground(...).then` (`:246`) — **do NOT touch `objects.visible`**. Leave a comment: `// objects 레이어는 painted 배경과 무관하게 항상 표시(설계 §3) — terrain만 끈다.`

- [ ] **Step 3: Add `objects` to the `Scene` interface + assignment**

`Scene` interface (`:96-112`): add `objects: ObjectLayer;`. The `this.scene = { ... }` assignment (`:395-398`): add `objects`.

- [ ] **Step 4: Verify typecheck + build**

Run: `pnpm --filter @tk/web typecheck && pnpm --filter @tk/web build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pixi/BattleRenderer.ts
git commit -m "feat(map): wire ObjectLayer into renderer (zIndex 1.8, always-visible)"
```

### Task 7: Manual verification (app run)

- [ ] **Step 1: Run dev server** (`pnpm --filter @tk/web dev`) and open a stage with gate/village/mountain terrain (e.g. a 성문 stage). Use preview tools if available.
- [ ] **Step 2: Verify** — gate/hut/peak objects render on the map, sit above the ground and below units, and **remain visible if that stage has a painted `assets/maps/{id}.webp`** (the latent bug fix). Walls render once `assets/objects/wall_*.png` exist (Chunk 3); until then wall cells show ground only (no crash).
- [ ] **Step 3: Screenshot/log proof** and note any visual issues for follow-up (organic mountain scatter, wall art).

### Chunk 2 review gate
- [ ] `pnpm --filter @tk/web typecheck` clean, `pnpm --filter @tk/web test` all pass, `pnpm --filter @tk/web build` succeeds.
- [ ] App renders objects always-visible; no regression to units/highlights/move.

---

## Chunk 3 (follow-on — outline only, spec it before building)

These are **not** part of this plan's working deliverable; each needs its own spec/plan pass:

1. **Object-sheet cut tool + asset generation** — cut the K-4~K-7 board sheets (top-down) into `/assets/objects/wall_*.png`, `gate_*.png`, and `/assets/tiles/` deco art. Mirror `cut_posesheet.py` (grid cut). Until this lands, ObjectLayer walls are texture-less (graceful skip). This is the practical unblock for *seeing* walls.
2. **Gate/wall destructible state events** — wire engine events (관문돌파 §5, 화공) → `ObjectLayer.setObjectState(gx,gy,'open'|'destroyed')` + terrain passability change + K-8 dust/smoke VFX. Renderer half (`setObjectState`) is already built here; the engine trigger/event schema is the open design item.
3. **`decorations` data field** — optional `decorations: [{cell,kind,variant,flip}]` in stage/map JSON for non-terrain scatter (banners, debris, extra trees from K-5/K-6); ObjectLayer reads + renders them.
4. **Organic deco polish** — re-introduce `DECO_DENSITY`/jitter/flip for mountains if uniform 1:1 looks too regular.
5. **CLAUDE.md §3-1 doc edit** — apply the §12 revision text from the spec (2-layer → 3-layer hybrid).
