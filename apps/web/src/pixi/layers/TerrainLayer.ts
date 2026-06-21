/**
 * TerrainLayer (설계 §2.2) — 56×32 타일을 16×16 청크로 분할 + 청크 AABB 뷰포트 컬링.
 *
 * 지형 표현 (v0.4 — 경계 페더링):
 *   - 베이스: 시임리스 바닥 텍스처 (textures.getGround, (gx,gy) wrap 서브렉트).
 *   - 특징 지형(숲/산)은 ① 밑에 평지 바닥을 깔고 ② 그 위에 특징 텍스처를 얹되,
 *     경계 칸(이웃이 다른 지형)은 가장자리 알파 페더 마스크로 부드럽게 → 하드 계단엣지 완화.
 *     내부 칸(사방이 같은 지형)은 풀타일 그대로(빠름, 솔리드).
 *   - 마스크 + cacheAsTexture는 충돌하므로 청크 캐시는 끈다(v0 규모는 컬링만으로 충분).
 *   - loadTiles() 완료 후 rebake() → 베이스 재생성.
 *   - 데코(산봉우리/구조물)는 ObjectLayer(zIndex 1.8)가 담당 — always-visible.
 */
import { Container, Sprite, Texture } from "pixi.js";
import type { BattleContext } from "@tk/engine";
import { terrainAt } from "@tk/engine";
import { TILE_SIZE } from "../projection";
import type { TextureResolver } from "../textures";

const CHUNK_TILES = 16;

/** 경계 페더링 대상 — 큰 지형 region. 밑에 평지를 깔고 가장자리를 페이드한다. */
const FEATURE_TERRAIN = new Set<string>(["forest", "mountain"]);
/** 페더 경계 칸의 특징 텍스처 오버사이즈 (이웃으로 살짝 번지게) */
const FEATURE_OVERSIZE = 1.3;

/** 가장자리 페이드 알파 마스크 (중앙 불투명 → 사방 가장자리 투명). 1회 생성 후 공유. */
let _featherTex: Texture | null | undefined;
function featherTexture(): Texture | null {
  if (_featherTex !== undefined) return _featherTex;
  if (typeof document === "undefined") {
    _featherTex = null;
    return null;
  }
  const S = 64;
  const margin = S * 0.26;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d");
  if (!ctx) {
    _featherTex = null;
    return null;
  }
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.min(x, y, S - 1 - x, S - 1 - y);
      let a = Math.max(0, Math.min(1, d / margin));
      a = a * a * (3 - 2 * a); // smoothstep
      const i = (y * S + x) * 4;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  _featherTex = Texture.from(cv);
  return _featherTex;
}

interface TileInfo {
  gx: number;
  gy: number;
  terrainId: string;
  tx: number;
  ty: number;
}

interface Chunk {
  container: Container;
  tiles: TileInfo[];
  /** 베이스 레이어(바닥/특징/마스크) — rebake 시 전부 제거 후 재생성 */
  bases: Container[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TerrainLayer extends Container {
  private readonly chunks: Chunk[] = [];
  private readonly ctx: BattleContext;
  private readonly textures: TextureResolver;

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
        const tiles: TileInfo[] = [];
        for (let ty = 0; ty < tilesH; ty++) {
          for (let tx = 0; tx < tilesW; tx++) {
            const gx = cx * CHUNK_TILES + tx;
            const gy = cy * CHUNK_TILES + ty;
            tiles.push({ gx, gy, terrainId: terrainAt(ctx, gx, gy).id, tx, ty });
          }
        }
        container.position.set(cx * CHUNK_TILES * TILE_SIZE, cy * CHUNK_TILES * TILE_SIZE);
        this.addChild(container);
        const chunk: Chunk = {
          container,
          tiles,
          bases: [],
          x: cx * CHUNK_TILES * TILE_SIZE,
          y: cy * CHUNK_TILES * TILE_SIZE,
          width: tilesW * TILE_SIZE,
          height: tilesH * TILE_SIZE,
        };
        this.chunks.push(chunk);
        this.buildBases(chunk);
      }
    }
  }

  /** loadTiles() 완료 후 호출 — 베이스 재생성 (바닥 텍스처 적용) */
  rebake(): void {
    for (const chunk of this.chunks) {
      this.buildBases(chunk);
    }
  }

  private ground(terrainId: string, gx: number, gy: number): Texture {
    return this.textures.getGround(terrainId, gx, gy) ?? this.textures.get("terrain", terrainId);
  }

  private sameTerrain(gx: number, gy: number, id: string): boolean {
    const { width, height } = this.ctx.map;
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) return true; // 맵 밖 = 같게 취급(경계 유지)
    return terrainAt(this.ctx, gx, gy).id === id;
  }

  /** 베이스 레이어 (재)생성 — 바닥 + 특징(경계 페더) */
  private buildBases(chunk: Chunk): void {
    for (const b of chunk.bases) b.destroy();
    chunk.bases.length = 0;

    for (const { gx, gy, terrainId, tx, ty } of chunk.tiles) {
      const px = tx * TILE_SIZE;
      const py = ty * TILE_SIZE;

      if (!FEATURE_TERRAIN.has(terrainId)) {
        const b = new Sprite(this.ground(terrainId, gx, gy));
        b.width = b.height = TILE_SIZE;
        b.position.set(px, py);
        chunk.container.addChild(b);
        chunk.bases.push(b);
        continue;
      }

      // 특징 지형: 밑에 평지를 깔고 특징을 얹는다
      const under = new Sprite(this.ground("plain", gx, gy));
      under.width = under.height = TILE_SIZE;
      under.position.set(px, py);
      chunk.container.addChild(under);
      chunk.bases.push(under);

      const ftex = this.ground(terrainId, gx, gy);
      const interior =
        this.sameTerrain(gx, gy - 1, terrainId) &&
        this.sameTerrain(gx, gy + 1, terrainId) &&
        this.sameTerrain(gx - 1, gy, terrainId) &&
        this.sameTerrain(gx + 1, gy, terrainId);
      const mask = interior ? null : featherTexture();

      if (!mask) {
        const f = new Sprite(ftex);
        f.width = f.height = TILE_SIZE;
        f.position.set(px, py);
        chunk.container.addChild(f);
        chunk.bases.push(f);
      } else {
        const size = TILE_SIZE * FEATURE_OVERSIZE;
        const cx = px + TILE_SIZE / 2;
        const cy = py + TILE_SIZE / 2;
        const m = new Sprite(mask);
        m.anchor.set(0.5);
        m.width = m.height = size;
        m.position.set(cx, cy);
        const f = new Sprite(ftex);
        f.anchor.set(0.5);
        f.width = f.height = size;
        f.position.set(cx, cy);
        chunk.container.addChild(m, f);
        f.mask = m;
        chunk.bases.push(m, f);
      }
    }
  }

  /** 카메라 변경 시 호출 — 뷰포트와 교차하지 않는 청크 숨김 */
  cull(view: WorldRect): void {
    for (const c of this.chunks) {
      c.container.visible =
        c.x < view.x + view.width &&
        c.x + c.width > view.x &&
        c.y < view.y + view.height &&
        c.y + c.height > view.y;
    }
  }
}
