/**
 * ThreatLayer (Tier 1-3) — 조회 중인 적의 위협 범위(다음 1행동으로 공격 가능한 칸)를
 * 반투명 빨강으로 칠하고 **외곽선**을 둘러 기존 공격 하이라이트(솔리드 빨강 타깃)와 구분한다.
 *
 * - HighlightLayer와 분리: 위협범위는 입력 상태기계(selected/targetSelect…)가 아니라 조회 채널
 *   (store.inspectedId)에 의해 구동되므로 별도 레이어로 둔다. HighlightLayer는 건드리지 않는다.
 * - 산출은 순수함수 threatTiles(렌더러가 호버 변경 시 1회 계산해 좌표 배열로 넘긴다).
 *   이 레이어는 그리기만 — 매 프레임 재계산 없음.
 * - 시각 구분: 채움 alpha를 낮추고(0.22) 합집합 **경계선**만 진하게(외곽 ring). 솔리드 공격칸과 혼동 방지.
 */
import { Container, Graphics, Sprite } from "pixi.js";
import type { Coord } from "@tk/engine";
import { TILE_SIZE } from "../projection";
import type { TextureResolver } from "../textures";

const THREAT_TINT = 0xff3b3b;
const THREAT_FILL_ALPHA = 0.22; // 채움은 옅게 — 솔리드 공격칸(0.45)과 대비
const OUTLINE_COLOR = 0xff5d5d;
const OUTLINE_ALPHA = 0.85;
const OUTLINE_WIDTH = 2;

export class ThreatLayer extends Container {
  private readonly textures: TextureResolver;
  private readonly pool: Sprite[] = [];
  private used = 0;
  private readonly outline = new Graphics();

  constructor(textures: TextureResolver) {
    super();
    this.textures = textures;
    this.addChild(this.outline);
  }

  private place(coord: Coord): void {
    let sprite = this.pool[this.used];
    if (!sprite) {
      sprite = new Sprite(this.textures.get("white", "tile"));
      this.pool.push(sprite);
      this.addChild(sprite);
    }
    this.used += 1;
    sprite.visible = true;
    sprite.tint = THREAT_TINT;
    sprite.alpha = THREAT_FILL_ALPHA;
    sprite.position.set(coord.x * TILE_SIZE, coord.y * TILE_SIZE);
  }

  /** 위협 칸 집합을 그린다. 빈 배열이면 전부 숨김(조회 해제·아군 조회 등). */
  setTiles(tiles: readonly Coord[]): void {
    // 채움
    for (let i = 0; i < this.used; i++) {
      const s = this.pool[i];
      if (s) s.visible = false;
    }
    this.used = 0;
    for (const t of tiles) this.place(t);

    // 합집합 경계선: 이웃이 집합에 없는 변만 긋는다 (외곽 ring 효과)
    this.outline.clear();
    if (tiles.length > 0) {
      const set = new Set(tiles.map((t) => `${t.x},${t.y}`));
      const has = (x: number, y: number): boolean => set.has(`${x},${y}`);
      for (const t of tiles) {
        const x0 = t.x * TILE_SIZE;
        const y0 = t.y * TILE_SIZE;
        const x1 = x0 + TILE_SIZE;
        const y1 = y0 + TILE_SIZE;
        if (!has(t.x, t.y - 1)) this.outline.moveTo(x0, y0).lineTo(x1, y0); // top
        if (!has(t.x, t.y + 1)) this.outline.moveTo(x0, y1).lineTo(x1, y1); // bottom
        if (!has(t.x - 1, t.y)) this.outline.moveTo(x0, y0).lineTo(x0, y1); // left
        if (!has(t.x + 1, t.y)) this.outline.moveTo(x1, y0).lineTo(x1, y1); // right
      }
      this.outline.stroke({ width: OUTLINE_WIDTH, color: OUTLINE_COLOR, alpha: OUTLINE_ALPHA });
    }
    // 외곽선을 채움 위로
    this.outline.zIndex = 1;
  }
}
