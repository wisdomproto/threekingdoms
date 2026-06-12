/**
 * UnitView (설계 §2.2) — "애니메이션 시퀀스 재생기" 파사드.
 * play('idle'|'move'|'attack'|'hit'|'retreat') => Promise + setFacing/setGridPosition.
 * v0 구현은 색 사각형 + 장수명 Text + 병력 바. 인터페이스가 시퀀스 기반이라
 * Spine/스프라이트 에셋 도착 시 이 파일 내부만 교체된다 (CLAUDE.md §4 프레임 정책).
 * zIndex = depthOf(y) 선확보 — 아이소 전환 시 깊이 정렬 공짜.
 */
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { Coord } from "@tk/engine";
import { depthOf, gridToWorld, TILE_SIZE } from "../projection";
import { UNIT_BASE_SIZE, type TextureResolver } from "../textures";
import { easeInOut, type TweenRunner } from "../tweens";

export type UnitSequence = "idle" | "move" | "attack" | "hit" | "retreat";

const BAR_WIDTH = UNIT_BASE_SIZE;
const BAR_HEIGHT = 5;
const MOVE_MS_PER_TILE = 150; // 설계 §6: unitMoved는 경로 타일당 150ms
const ATTACK_MS = 220;
const HIT_MS = 180;
const RETREAT_MS = 350;
const LUNGE_PX = 10;

export interface UnitViewInit {
  id: string;
  name: string;
  side: "player" | "enemy";
  x: number;
  y: number;
  troops: number;
  maxTroops: number;
  retreated: boolean;
}

export class UnitView extends Container {
  readonly unitId: string;
  gridX: number;
  gridY: number;
  troops: number;
  readonly maxTroops: number;
  retreatedFlag: boolean;

  private readonly base: Sprite;
  private readonly barFill: Graphics;
  private readonly tweens: TweenRunner;
  private facing = 1; // 1=우, -1=좌

  constructor(init: UnitViewInit, textures: TextureResolver, tweens: TweenRunner) {
    super();
    this.unitId = init.id;
    this.gridX = init.x;
    this.gridY = init.y;
    this.troops = init.troops;
    this.maxTroops = init.maxTroops;
    this.retreatedFlag = init.retreated;
    this.tweens = tweens;

    // 베이스 (진영색 라운드 사각) — 컨테이너 중심 기준
    this.base = new Sprite(textures.get("side", init.side));
    this.base.anchor.set(0.5);
    this.addChild(this.base);

    // 병력 바 (배경 + 채움)
    const barBg = new Graphics();
    barBg.rect(0, 0, BAR_WIDTH, BAR_HEIGHT).fill(0x222222);
    barBg.position.set(-BAR_WIDTH / 2, UNIT_BASE_SIZE / 2 + 2);
    this.addChild(barBg);
    this.barFill = new Graphics();
    this.barFill.position.set(-BAR_WIDTH / 2, UNIT_BASE_SIZE / 2 + 2);
    this.addChild(this.barFill);

    // 장수명 — 유닛 ~7기라 Pixi Text 캐시로 충분 (설계 리스크 §7)
    const label = new Text({
      text: init.name,
      style: {
        fontFamily: "sans-serif",
        fontSize: 12,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -UNIT_BASE_SIZE / 2 - 2);
    this.addChild(label);

    this.redrawBar();
    this.snapTo(init.x, init.y);
    this.setRetreated(init.retreated);
  }

  // ── 상태 적용 (sync/연출 공용) ──────────────────────────────────────────
  snapTo(gx: number, gy: number): void {
    this.gridX = gx;
    this.gridY = gy;
    const w = gridToWorld({ x: gx, y: gy });
    this.position.set(w.x, w.y);
    this.zIndex = depthOf(gy);
  }

  setTroops(troops: number): void {
    this.troops = Math.max(0, troops);
    this.redrawBar();
  }

  setRetreated(retreated: boolean): void {
    this.retreatedFlag = retreated;
    this.visible = !retreated;
    if (!retreated) this.alpha = 1;
  }

  setFacing(dir: 1 | -1): void {
    this.facing = dir;
    this.base.scale.x = Math.abs(this.base.scale.x) * dir;
  }

  faceToward(target: Coord): void {
    if (target.x !== this.gridX) this.setFacing(target.x > this.gridX ? 1 : -1);
  }

  private redrawBar(): void {
    const ratio = this.maxTroops > 0 ? this.troops / this.maxTroops : 0;
    this.barFill.clear();
    if (ratio > 0) {
      const color = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xe6b042 : 0xd54a3a;
      this.barFill.rect(0, 0, BAR_WIDTH * ratio, BAR_HEIGHT).fill(color);
    }
  }

  // ── 시퀀스 재생기 ────────────────────────────────────────────────────────
  play(seq: UnitSequence): Promise<void> {
    switch (seq) {
      case "idle":
      case "move": // 이동 본체는 moveAlong이 담당 — 단독 호출은 즉시 완료
        return Promise.resolve();
      case "attack":
        return this.playAttack();
      case "hit":
        return this.playHit();
      case "retreat":
        return this.playRetreat();
    }
  }

  /** 경로(시작 타일 포함)를 따라 타일당 msPerTile 트윈. zIndex/facing을 타일마다 갱신 */
  async moveAlong(path: readonly Coord[], msPerTile: number = MOVE_MS_PER_TILE): Promise<void> {
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1];
      const to = path[i];
      if (!from || !to) continue;
      if (to.x !== from.x) this.setFacing(to.x > from.x ? 1 : -1);
      const wf = gridToWorld(from);
      const wt = gridToWorld(to);
      await this.tweens.run(msPerTile, (t) => {
        this.position.set(wf.x + (wt.x - wf.x) * t, wf.y + (wt.y - wf.y) * t);
      });
      this.gridX = to.x;
      this.gridY = to.y;
      this.zIndex = depthOf(to.y);
    }
  }

  private playAttack(): Promise<void> {
    const ox = this.position.x;
    const dir = this.facing;
    return this.tweens.run(ATTACK_MS, (t) => {
      // 전진 후 복귀 (0→1→0 왕복)
      const swing = t < 0.5 ? t * 2 : (1 - t) * 2;
      this.position.x = ox + dir * LUNGE_PX * easeInOut(swing);
    });
  }

  private playHit(): Promise<void> {
    const ox = this.position.x;
    this.base.tint = 0xff8080;
    return this.tweens
      .run(HIT_MS, (t) => {
        this.position.x = ox + Math.sin(t * Math.PI * 4) * 3 * (1 - t);
      })
      .then(() => {
        this.base.tint = 0xffffff;
        this.position.x = ox;
      });
  }

  private playRetreat(): Promise<void> {
    return this.tweens
      .run(RETREAT_MS, (t) => {
        this.alpha = 1 - t;
      })
      .then(() => {
        this.setTroops(0); // 일기토 패자 등 데미지 이벤트 없는 퇴각도 병력 0 — committed와 정합
        this.setRetreated(true);
      });
  }
}
