/**
 * TerrainLayer (설계 §2.2) — 1792타일(56×32)을 16×16 청크 8개로 분할,
 * 청크별 cacheAsTexture 베이크 + 청크 AABB 뷰포트 컬링.
 * cacheAsTexture 미지원 런타임이면 베이크 없이 컬링만 동작 (설계가 허용한 폴백과 동등 —
 * 직교 + 유닛 7기는 컬링 없이도 60fps).
 */
import { Container, Sprite } from "pixi.js";
import type { BattleContext } from "@tk/engine";
import { terrainAt } from "@tk/engine";
import { TILE_SIZE } from "../projection";
import type { TextureResolver } from "../textures";

const CHUNK_TILES = 16;

interface Chunk {
  container: Container;
  /** 월드 px AABB */
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

  constructor(ctx: BattleContext, textures: TextureResolver) {
    super();
    const { width, height } = ctx.map;
    const chunksX = Math.ceil(width / CHUNK_TILES);
    const chunksY = Math.ceil(height / CHUNK_TILES);

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const container = new Container();
        const tilesW = Math.min(CHUNK_TILES, width - cx * CHUNK_TILES);
        const tilesH = Math.min(CHUNK_TILES, height - cy * CHUNK_TILES);
        for (let ty = 0; ty < tilesH; ty++) {
          for (let tx = 0; tx < tilesW; tx++) {
            const gx = cx * CHUNK_TILES + tx;
            const gy = cy * CHUNK_TILES + ty;
            const terrain = terrainAt(ctx, gx, gy);
            const sprite = new Sprite(textures.get("terrain", terrain.id));
            sprite.position.set(tx * TILE_SIZE, ty * TILE_SIZE);
            container.addChild(sprite);
          }
        }
        container.position.set(cx * CHUNK_TILES * TILE_SIZE, cy * CHUNK_TILES * TILE_SIZE);
        // pixi 8.6+ — 구버전/예외 시 베이크 없이 진행 (컬링은 그대로 유효)
        if (typeof container.cacheAsTexture === "function") {
          try {
            container.cacheAsTexture(true);
          } catch {
            /* 폴백: 미베이크 — v0 규모에선 성능 무해 */
          }
        }
        this.addChild(container);
        this.chunks.push({
          container,
          x: cx * CHUNK_TILES * TILE_SIZE,
          y: cy * CHUNK_TILES * TILE_SIZE,
          width: tilesW * TILE_SIZE,
          height: tilesH * TILE_SIZE,
        });
      }
    }
  }

  /** 카메라 변경 시 호출 — 뷰포트(월드 좌표 rect)와 교차하지 않는 청크 숨김 */
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
