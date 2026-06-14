/**
 * HighlightLayer (설계 §2.2) — 이동(청)/공격(적)/고스트/커서 하이라이트.
 * InputMachine 상태의 수동적 뷰: update(ui, battle)가 호출될 때마다 풀에서 스프라이트를
 * 꺼내 다시 그린다. 스프라이트 풀 재사용 — 백색 타일 텍스처를 tint+alpha로 변주.
 */
import { Container, Graphics, Sprite } from "pixi.js";
import type { BattleState, Coord } from "@tk/engine";
import type { InputState } from "../../battle/inputMachine";
import { TILE_SIZE } from "../projection";
import { SIDE_COLORS, type TextureResolver } from "../textures";

const MOVE_TINT = 0x3a7bd5;
const MOVE_ALPHA = 0.35;
const ATTACK_TINT = 0xd54a3a;
const ATTACK_ALPHA = 0.45;
// 선택 유닛 커서 — 레퍼런스(§10) "흰 사각 테두리". 채움 칸(이동/공격/위협)과 톤 분리.
const CURSOR_COLOR = 0xffffff;
const CURSOR_INSET = 2; // px — 타일 안쪽으로 들여 그려 인접 칸과 겹침 방지
const CURSOR_THICK = 3; // px — 외곽선 두께
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
  /** 선택 유닛 커서 — 흰 사각 테두리(§10). 풀과 별개의 단일 Graphics, 항상 맨 위 */
  private readonly selectCursor = new Graphics();

  constructor(textures: TextureResolver) {
    super();
    this.textures = textures;
    this.sortableChildren = true; // 커서(zIndex 1000)를 풀 스프라이트(기본 0) 위로 보장
    // 외곽선 사각형 한 번만 그려두고 position/visible만 토글 (매 update 재드로 회피)
    const inner = CURSOR_INSET;
    const span = TILE_SIZE - CURSOR_INSET * 2;
    this.selectCursor
      .rect(inner, inner, span, span)
      .stroke({ width: CURSOR_THICK, color: CURSOR_COLOR, alpha: 0.95, alignment: 0.5 });
    this.selectCursor.visible = false;
    this.selectCursor.zIndex = 1000; // 풀 스프라이트 위
    this.addChild(this.selectCursor);
  }

  /** 선택 유닛 칸에 흰 사각 커서 배치 (없으면 숨김) */
  private placeCursor(coord: Coord | null): void {
    if (!coord) {
      this.selectCursor.visible = false;
      return;
    }
    this.selectCursor.visible = true;
    this.selectCursor.position.set(coord.x * TILE_SIZE, coord.y * TILE_SIZE);
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
    this.placeCursor(null); // 기본 숨김 — 선택/행동 흐름에서만 표시
    switch (ui.kind) {
      case "selected": {
        for (const t of ui.movable) this.place(t, MOVE_TINT, MOVE_ALPHA);
        for (const t of this.targetCoords(battle, ui.attackable)) {
          this.place(t, ATTACK_TINT, ATTACK_ALPHA);
        }
        const u = battle.units.find((x) => x.id === ui.unitId);
        // 선택 유닛 = 흰 사각 테두리 커서 (§10). 채움 칸과 톤 분리.
        this.placeCursor(u ? { x: u.x, y: u.y } : null);
        break;
      }
      case "postMoveMenu": {
        // 출발지 마커: 유닛이 걸어간 뒤 원위치에 잔상을 남긴다 (원작 문법).
        // preview=from(제자리)인 경우 마커는 불필요 — 유닛이 이동하지 않았으므로.
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        // 흰 커서는 현재(프리뷰) 위치 — 행동 메뉴 중 활성 유닛 위치 명확화
        this.placeCursor(ui.preview);
        break;
      }
      case "targetSelect": {
        // targetSelect에서도 출발지 마커 유지 + 공격 범위 하이라이트
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        for (const t of this.targetCoords(battle, ui.attackable)) {
          this.place(t, ATTACK_TINT, ATTACK_ALPHA);
        }
        this.placeCursor(ui.preview);
        break;
      }
      case "strategyMenu": {
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        this.placeCursor(ui.preview);
        break;
      }
      case "strategyTarget": {
        // 출발지 마커 + 시전 가능 칸(보라) 하이라이트
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        for (const t of ui.castTiles) this.place(t, STRATEGY_TINT, STRATEGY_ALPHA);
        this.placeCursor(ui.preview);
        break;
      }
      case "itemMenu": {
        const moved = ui.preview.x !== ui.from.x || ui.preview.y !== ui.from.y;
        if (moved) this.place(ui.from, ORIGIN_TINT, ORIGIN_ALPHA);
        this.placeCursor(ui.preview);
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
        this.placeCursor(ui.preview);
        break;
      }
      default:
        break; // idle/animating/enemyTurn/battleOver — 하이라이트 없음
    }
  }
}
