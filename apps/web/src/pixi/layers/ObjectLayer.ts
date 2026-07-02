/** ObjectLayer (설계 2026-06-21-hybrid-map-rendering §3·§5) — 바닥 위·유닛 아래(zIndex 1.8)의
 *  구별되는 top-down 오브젝트. 지형 구동: wall=오토타일, gate=상태별, 그 외=데코(빌보드).
 *  + 스테이지 정밀 데코(§5.2 stage.decorations — 진영 깃발·모닥불·잔해 등 서사 소품, 순수 시각).
 *  painted 배경과 무관하게 항상 표시. TerrainLayer의 청크/cull 패턴 재사용. */
import { Container, Graphics, Sprite } from "pixi.js";
import type { Texture } from "pixi.js";
import type { BattleContext } from "@tk/engine";
import type { Decoration } from "@tk/data";
import { terrainAt } from "@tk/engine";
import { TILE_SIZE } from "../projection";
import type { TextureResolver } from "../textures";
import type { WorldRect } from "./TerrainLayer";
import { wallTile } from "../objects/autotile";
import { objectKind, decoObjectKey } from "../objects/objectModel";

const CHUNK_TILES = 16;
const N = 1, E = 2, S = 4, W = 8;

interface Cell { gx: number; gy: number; terrainId: string; tx: number; ty: number; }
interface Chunk { container: Container; cells: Cell[]; sprites: Container[]; x: number; y: number; width: number; height: number; }

export class ObjectLayer extends Container {
  private readonly chunks: Chunk[] = [];
  private readonly ctx: BattleContext;
  private readonly textures: TextureResolver;
  /** 칸별 성문/성벽 상태. 키=`${gx},${gy}` */
  private readonly state = new Map<string, string>();
  /** 스테이지 정밀 데코(§5.2) — 청크 rebuild 때마다 소속 칸 기준으로 얹는다. */
  private readonly decorations: readonly Decoration[];

  constructor(ctx: BattleContext, textures: TextureResolver) {
    super();
    this.ctx = ctx;
    this.textures = textures;
    this.decorations = ctx.stage.decorations ?? [];
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
    // 스테이지 정밀 데코(§5.2) — 이 청크에 속한 칸만. 지형 자동 데코 위에 얹는다(순수 시각).
    const ox = chunk.x / TILE_SIZE, oy = chunk.y / TILE_SIZE;
    const tw = chunk.width / TILE_SIZE, th = chunk.height / TILE_SIZE;
    for (const d of this.decorations) {
      const [gx, gy] = d.cell;
      if (gx < ox || gx >= ox + tw || gy < oy || gy >= oy + th) continue;
      const tex = this.textures.getObject(d.kind);
      if (!tex || tex.width === 0) continue; // 미보유 키 = 조용히 생략(드롭인)
      this.placeDeco(chunk, tex, gx - ox, gy - oy, d.flip, d.scale);
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

  private addDeco(chunk: Chunk, terrainId: string, tx: number, ty: number): void {
    // 새 K-5/K-6 오브젝트 우선(decoObjectKey), 미보유 시 옛 DECO_FILES 폴백.
    const objKey = decoObjectKey(terrainId);
    const tex = (objKey ? this.textures.getObject(objKey) : null) ?? this.textures.getDeco(terrainId);
    if (!tex || tex.width === 0) return;
    this.placeDeco(chunk, tex, tx, ty);
  }

  /** 데코 스프라이트 1개 배치(그림자 타원 + 바닥 앵커 빌보드) — 지형 자동 데코·정밀 데코 공용. */
  private placeDeco(
    chunk: Chunk,
    tex: Texture,
    tx: number,
    ty: number,
    flip?: boolean,
    scaleMul = 1,
  ): void {
    const s = ((TILE_SIZE * 1.18) / tex.width) * scaleMul;
    const cx = tx * TILE_SIZE + TILE_SIZE / 2;
    const cy = ty * TILE_SIZE + TILE_SIZE - 1;
    const shadow = new Graphics();
    shadow.ellipse(0, 0, tex.width * s * 0.32, TILE_SIZE * 0.16).fill({ color: 0x000000, alpha: 0.18 });
    shadow.position.set(cx, cy - 2);
    chunk.container.addChild(shadow);
    chunk.sprites.push(shadow);
    const deco = new Sprite(tex);
    deco.anchor.set(0.5, 1);
    deco.scale.set(flip ? -s : s, s);
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
