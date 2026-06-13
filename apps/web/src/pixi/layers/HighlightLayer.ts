/**
 * HighlightLayer (설계 §2.2) — 이동(청)/공격(적)/고스트/커서 하이라이트.
 * InputMachine 상태의 수동적 뷰: update(ui, battle)가 호출될 때마다 풀에서 스프라이트를
 * 꺼내 다시 그린다. 스프라이트 풀 재사용 — 백색 타일 텍스처를 tint+alpha로 변주.
 */
import { Container, Sprite } from "pixi.js";
import type { BattleState, Coord } from "@tk/engine";
import type { InputState } from "../../battle/inputMachine";
import { TILE_SIZE } from "../projection";
import { SIDE_COLORS, type TextureResolver } from "../textures";

const MOVE_TINT = 0x3a7bd5;
const MOVE_ALPHA = 0.35;
const ATTACK_TINT = 0xd54a3a;
const ATTACK_ALPHA = 0.45;
const CURSOR_TINT = 0xf2d35e;
const CURSOR_ALPHA = 0.4;
const STRATEGY_TINT = 0xb890ff; // 책략 시전 가능 칸 (보라)
const STRATEGY_ALPHA = 0.4;
const SUPPLY_TINT = 0x7bd88f; // 회복약 대상 아군 칸 (초록)
const SUPPLY_ALPHA = 0.45;
const GHOST_ALPHA = 0.55;
const ORIGIN_TINT = 0xaaaaaa; // 출발지 마커 — 원작: 유닛이 걸어간 뒤 출발지에 잔상
const ORIGIN_ALPHA = 0.4;

export class HighlightLayer extends Container {
  private readonly textures: TextureResolver;
  private readonly pool: Sprite[] = [];
  private used = 0;

  constructor(textures: TextureResolver) {
    super();
    this.textures = textures;
  }

  private place(coord: Coord, tint: number, alpha: number): void {
    let sprite = this.pool[this.used];
    if (!sprite) {
      sprite = new Sprite(this.textures.get("white", "tile"));
      this.pool.push(sprite);
      this.addChild(sprite);
    }
    this.used += 1;
    sprite.visible = true;
    sprite.tint = tint;
    sprite.alpha = alpha;
    sprite.position.set(coord.x * TILE_SIZE, coord.y * TILE_SIZE);
  }

  private releaseAll(): void {
    for (let i = 0; i < this.used; i++) {
      const s = this.pool[i];
      if (s) s.visible = false;
    }
    this.used = 0;
  }

  /** 공격 가능 대상 id → 좌표 (퇴각 유닛 제외) */
  private targetCoords(battle: BattleState, ids: readonly string[]): Coord[] {
    const out: Coord[] = [];
    for (const id of ids) {
      const u = battle.units.find((x) => x.id === id && !x.retreated);
      if (u) out.push({ x: u.x, y: u.y });
    }
    return out;
  }

  update(ui: InputState, battle: BattleState): void {
    this.releaseAll();
    switch (ui.kind) {
      case "selected": {
        for (const t of ui.movable) this.place(t, MOVE_TINT, MOVE_ALPHA);
        for (const t of this.targetCoords(battle, ui.attackable)) {
          this.place(t, ATTACK_TINT, ATTACK_ALPHA);
        }
        const u = battle.units.find((x) => x.id === ui.unitId);
        if (u) this.place({ x: u.x, y: u.y }, CURSOR_TINT, CURSOR_ALPHA);
        break;
      }
      case "postMoveMenu": {
        // 출발지 마커: 유닛이 걸어간 뒤 원위치에 잔상을 남긴다 (원작 문법).
        // preview=from(제자리)인 경우 마커는 불필요 — 유닛이 이동하지 않았으므로.
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        break;
      }
      case "targetSelect": {
        // targetSelect에서도 출발지 마커 유지 + 공격 범위 하이라이트
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        for (const t of this.targetCoords(battle, ui.attackable)) {
          this.place(t, ATTACK_TINT, ATTACK_ALPHA);
        }
        break;
      }
      case "strategyMenu": {
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        break;
      }
      case "strategyTarget": {
        // 출발지 마커 + 시전 가능 칸(보라) 하이라이트
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        for (const t of ui.castTiles) this.place(t, STRATEGY_TINT, STRATEGY_ALPHA);
        break;
      }
      case "itemMenu": {
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        break;
      }
      case "itemTarget": {
        // 출발지 마커 + 도구 대상 칸 (회복약=초록 아군 / 공격아이템=적 빨강)
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        const supply = ui.itemKind === "supplyItem";
        for (const t of ui.castTiles) {
          this.place(t, supply ? SUPPLY_TINT : ATTACK_TINT, supply ? SUPPLY_ALPHA : ATTACK_ALPHA);
        }
        break;
      }
      default:
        break; // idle/animating/enemyTurn/battleOver — 하이라이트 없음
    }
  }
}
