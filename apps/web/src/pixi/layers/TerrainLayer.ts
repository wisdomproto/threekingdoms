/**
 * TerrainLayer (설계 §2.2) — 1792타일(56×32)을 16×16 청크 8개로 분할,
 * 청크별 cacheAsTexture 베이크 + 청크 AABB 뷰포트 컬링.
 * cacheAsTexture 미지원 런타임이면 베이크 없이 컬링만 동작 (설계가 허용한 폴백과 동등 —
 * 직교 + 유닛 7기는 컬링 없이도 60fps).
 *
 * 타일 이미지 지원 (v0.2):
 *   - 각 스프라이트 텍스처는 textures.getTerrain(id, variant)으로 조회.
 *     variant = (gx*7 + gy*13) % variantCount — 단조롭지 않은 해시 배치.
 *   - loadTiles() 완료 후 rebake() 를 호출하면 이미지 텍스처로 교체하고 청크 캐시 재생성.
 */
import { Container, Sprite } from "pixi.js";
import type { BattleContext } from "@tk/engine";
import { terrainAt } from "@tk/engine";
import { TILE_SIZE } from "../projection";
import type { TextureResolver } from "../textures";

const CHUNK_TILES = 16;

interface Chunk {
  container: Container;
  /** 스프라이트 배열 (rebake 시 텍스처만 교체) */
  sprites: Array<{ sprite: Sprite; gx: number; gy: number; terrainId: string }>;
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
        const sprites: Chunk["sprites"] = [];
        for (let ty = 0; ty < tilesH; ty++) {
          for (let tx = 0; tx < tilesW; tx++) {
            const gx = cx * CHUNK_TILES + tx;
            const gy = cy * CHUNK_TILES + ty;
            const terrain = terrainAt(ctx, gx, gy);
            // 초기 텍스처: 단색 베이크 (getTerrain이 폴백 포함이므로 loadTiles 전에도 안전)
            const variant = (gx * 7 + gy * 13);
            const sprite = new Sprite(textures.getTerrain(terrain.id, variant));
            sprite.position.set(tx * TILE_SIZE, ty * TILE_SIZE);
            container.addChild(sprite);
            sprites.push({ sprite, gx, gy, terrainId: terrain.id });
          }
        }
        container.position.set(cx * CHUNK_TILES * TILE_SIZE, cy * CHUNK_TILES * TILE_SIZE);
        this.addChild(container);
        this.chunks.push({
          container,
          sprites,
          x: cx * CHUNK_TILES * TILE_SIZE,
          y: cy * CHUNK_TILES * TILE_SIZE,
          width: tilesW * TILE_SIZE,
          height: tilesH * TILE_SIZE,
        });
        this.applyChunkCache(container);
      }
    }
  }

  /**
   * loadTiles() 완료 후 BattleRenderer에서 호출 — 이미지 텍스처로 교체 + 청크 캐시 재생성.
   * 유닛 스프라이트의 refreshSprites() 패턴과 동일.
   */
  rebake(): void {
    for (const chunk of this.chunks) {
      // 캐시 무효화 (재베이크 전 필수)
      if (typeof chunk.container.cacheAsTexture === "function") {
        try {
          chunk.container.cacheAsTexture(false);
        } catch {
          /* 무시 */
        }
      }
      // 스프라이트 텍스처 교체
      for (const { sprite, gx, gy, terrainId } of chunk.sprites) {
        const variant = (gx * 7 + gy * 13);
        sprite.texture = this.textures.getTerrain(terrainId, variant);
      }
      // 캐시 재생성
      this.applyChunkCache(chunk.container);
    }
  }

  private applyChunkCache(container: Container): void {
    // pixi 8.6+ — 구버전/예외 시 베이크 없이 진행 (컬링은 그대로 유효)
    if (typeof container.cacheAsTexture === "function") {
      try {
        container.cacheAsTexture(true);
      } catch {
        /* 폴백: 미베이크 — v0 규모에선 성능 무해 */
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
