/**
 * FxLayer (설계 §2.2) — 데미지 팝업(월드 공간) + 배너(스크린 공간) 이펙트. Text 풀링.
 * world는 카메라 변환 컨테이너 아래에, screen은 stage 직속(카메라 무관)에 부착한다.
 */
import { Container, Graphics, Text } from "pixi.js";
import type { WorldPoint } from "../projection";
import type { TweenRunner } from "../tweens";

const POPUP_MS = 650;
const POPUP_RISE_PX = 28;
const COUNTER_TINT = 0xffb74d; // 반격 데미지 색 구분 (설계 §6)
const NORMAL_TINT = 0xffffff;
const HEAL_TINT = 0x7bd88f; // 회복 팝업 색 (초록)

// 격파/퇴각 VFX (§11 "흰빛+연두 파편으로 흩어지며 소멸") — 순수 표현, 게임상태 불변
const RETREAT_MS = 600;
const RETREAT_SHARDS = 10;
const RETREAT_SHARD_DIST = 34; // px — 파편 비산 거리
const RETREAT_FLASH_R = 24; // px — 중심 섬광 반경
const SHARD_LIGHT = 0xffffff; // 흰빛
const SHARD_GREEN = 0xa7e8b0; // 연두 파편

export class FxLayer {
  /** 카메라 변환 하 — 데미지 팝업 */
  readonly world = new Container();
  /** 스크린 고정 — 페이즈/일기토/종료 배너 */
  readonly screen = new Container();

  private readonly tweens: TweenRunner;
  private readonly popupPool: Text[] = [];
  private screenW = 0;
  private screenH = 0;

  constructor(tweens: TweenRunner) {
    this.tweens = tweens;
    this.world.sortableChildren = false;
    // 팝업/배너는 항상 유닛 위에 — zIndex 큰 값
    this.world.zIndex = 10_000;
  }

  resize(width: number, height: number): void {
    this.screenW = width;
    this.screenH = height;
  }

  /** 데미지 팝업 — 위로 떠오르며 페이드. counter면 색 구분 */
  damagePopup(at: WorldPoint, amount: number, counter: boolean): Promise<void> {
    let text = this.popupPool.find((t) => !t.visible);
    if (!text) {
      text = new Text({
        text: "",
        style: {
          fontFamily: "sans-serif",
          fontSize: 18,
          fontWeight: "bold",
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 4 },
        },
      });
      text.anchor.set(0.5);
      this.popupPool.push(text);
      this.world.addChild(text);
    }
    text.text = String(amount);
    text.tint = counter ? COUNTER_TINT : NORMAL_TINT;
    text.visible = true;
    text.alpha = 1;
    const startY = at.y - 18;
    text.position.set(at.x, startY);
    const captured = text;
    return this.tweens
      .run(POPUP_MS, (t) => {
        captured.position.y = startY - POPUP_RISE_PX * t;
        captured.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      })
      .then(() => {
        captured.visible = false;
      });
  }

  /** 회복 팝업 — damagePopup과 동형이나 "+N" 초록. 회복 책략/회복약 공용 */
  healPopup(at: WorldPoint, amount: number): Promise<void> {
    let text = this.popupPool.find((t) => !t.visible);
    if (!text) {
      text = new Text({
        text: "",
        style: {
          fontFamily: "sans-serif",
          fontSize: 18,
          fontWeight: "bold",
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 4 },
        },
      });
      text.anchor.set(0.5);
      this.popupPool.push(text);
      this.world.addChild(text);
    }
    text.text = `+${amount}`;
    text.tint = HEAL_TINT;
    text.visible = true;
    text.alpha = 1;
    const startY = at.y - 18;
    text.position.set(at.x, startY);
    const captured = text;
    return this.tweens
      .run(POPUP_MS, (t) => {
        captured.position.y = startY - POPUP_RISE_PX * t;
        captured.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      })
      .then(() => {
        captured.visible = false;
      });
  }

  /**
   * 격파/퇴각 버스트 (§11) — 중심 섬광 + 파편(흰빛/연두) 방사 흩어짐 + 페이드.
   * 월드 공간(카메라 변환 하). 순수 표현: 게임 상태 불변, TweenRunner 경유라 배속(timeScale) 존중.
   * 즉사 아님(설계 §10 퇴각만) — 톤은 "소멸"이되 잔혹X.
   */
  retreatBurst(at: WorldPoint): Promise<void> {
    const root = new Container();
    root.position.set(at.x, at.y);

    // 중심 섬광 (흰빛 원)
    const flash = new Graphics();
    flash.circle(0, 0, RETREAT_FLASH_R).fill({ color: SHARD_LIGHT, alpha: 0.9 });
    root.addChild(flash);

    // 파편 — 각도 균등 분산, 흰빛/연두 교차
    const shards: { g: Graphics; vx: number; vy: number }[] = [];
    for (let i = 0; i < RETREAT_SHARDS; i++) {
      const ang = (i / RETREAT_SHARDS) * Math.PI * 2 + (i % 2) * 0.4;
      const g = new Graphics();
      const size = 3 + (i % 3);
      g.rect(-size / 2, -size / 2, size, size).fill({
        color: i % 2 === 0 ? SHARD_GREEN : SHARD_LIGHT,
        alpha: 1,
      });
      g.rotation = ang;
      root.addChild(g);
      shards.push({ g, vx: Math.cos(ang) * RETREAT_SHARD_DIST, vy: Math.sin(ang) * RETREAT_SHARD_DIST });
    }

    this.world.addChild(root);
    return this.tweens
      .run(RETREAT_MS, (t) => {
        // 섬광: 빠르게 확장하며 사라짐
        const fs = 1 + t * 0.8;
        flash.scale.set(fs);
        flash.alpha = Math.max(0, 1 - t * 2.2);
        // 파편: 바깥으로 + 살짝 위로(중력 역) 비산하며 페이드
        const ease = 1 - (1 - t) * (1 - t); // ease-out
        for (const s of shards) {
          s.g.position.set(s.vx * ease, s.vy * ease - 6 * t);
          s.g.alpha = Math.max(0, 1 - t);
          s.g.scale.set(Math.max(0.2, 1 - t * 0.7));
        }
      })
      .then(() => {
        this.world.removeChild(root);
        root.destroy({ children: true });
      });
  }

  /** 중앙 배너 — ms 동안 표시 후 제거. 직렬 연출이라 동시 1개 가정 */
  banner(message: string, ms: number): Promise<void> {
    const container = new Container();
    const text = new Text({
      text: message,
      style: {
        fontFamily: "sans-serif",
        fontSize: 22,
        fontWeight: "bold",
        fill: 0xffffff,
        align: "center",
      },
    });
    text.anchor.set(0.5);
    const padX = 28;
    const padY = 12;
    const bg = new Graphics();
    bg.roundRect(
      -text.width / 2 - padX,
      -text.height / 2 - padY,
      text.width + padX * 2,
      text.height + padY * 2,
      10,
    ).fill({ color: 0x000000, alpha: 0.65 });
    container.addChild(bg, text);
    container.position.set(this.screenW / 2, this.screenH / 2);
    container.alpha = 0;
    this.screen.addChild(container);

    const fade = Math.min(120, ms / 4);
    return this.tweens
      .run(ms, (t) => {
        const elapsed = t * ms;
        const remain = ms - elapsed;
        container.alpha = Math.min(1, elapsed / fade, remain / fade);
      })
      .then(() => {
        this.screen.removeChild(container);
        container.destroy({ children: true });
      });
  }

  destroy(): void {
    this.world.destroy({ children: true });
    this.screen.destroy({ children: true });
  }
}
