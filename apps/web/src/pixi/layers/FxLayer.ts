/**
 * FxLayer (설계 §2.2) — 데미지 팝업(월드 공간) + 배너(스크린 공간) 이펙트. Text 풀링.
 * world는 카메라 변환 컨테이너 아래에, screen은 stage 직속(카메라 무관)에 부착한다.
 */
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { WorldPoint } from "../projection";
import { easeOut, type TweenRunner } from "../tweens";
import type { TextureResolver } from "../textures";
import { FX, pickFlashKey } from "../fxKeys";

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

// ── 통상공격 타격 주스 (§4 절차적, 에셋 무의존 / 순수 표현) ──────────────────
const SLASH_MS = 200; // 슬래시 호 수명
const SLASH_LEN = 46; // 호의 호현(chord) 길이 (px, 타일≈48)
const SLASH_BOW = 16; // 호의 활 휘는 정도 (px)
const SLASH_GOLD = 0xfff2c4; // 흰금빛 베기
const PIERCE_TINT = 0x9fd8ff; // 간접(궁/포) 충격 — 차가운 청백
const FLASH_MS = 110; // 임팩트 플래시 수명
const FLASH_R = 22; // 임팩트 플래시 반경 (px)

export class FxLayer {
  /** 카메라 변환 하 — 데미지 팝업 */
  readonly world = new Container();
  /** 스크린 고정 — 페이즈/일기토/종료 배너 */
  readonly screen = new Container();

  private readonly tweens: TweenRunner;
  private readonly textures?: TextureResolver;
  private readonly popupPool: Text[] = [];
  private screenW = 0;
  private screenH = 0;

  constructor(tweens: TweenRunner, textures?: TextureResolver) {
    this.tweens = tweens;
    this.textures = textures;
    this.world.sortableChildren = false;
    // 팝업/배너는 항상 유닛 위에 — zIndex 큰 값
    this.world.zIndex = 10_000;
  }

  /**
   * fx 텍스처를 additive 스프라이트로 1회 재생. update(t, sprite)로 트윈, ms 후 제거.
   * 텍스처 미보유 시 null 반환 → 호출자가 절차적 폴백으로 이어진다.
   */
  private playFxSprite(
    key: string, at: WorldPoint, ms: number,
    update: (t: number, s: Sprite) => void, baseRot = 0,
  ): Promise<void> | null {
    const tex = this.textures?.getFx(key);
    if (!tex) return null; // 폴백 신호
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.blendMode = "add";
    s.position.set(at.x, at.y);
    s.rotation = baseRot;
    this.world.addChild(s);
    return this.tweens.run(ms, (t) => update(t, s)).then(() => {
      this.world.removeChild(s);
      s.destroy(); // texture는 공유 캐시라 파기 안 함
    });
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

  /** 빗나감 팝업 — 명중 실패(§2-1 시드확률). damagePopup 동형, "빗나감" 회색. */
  missPopup(at: WorldPoint): Promise<void> {
    let text = this.popupPool.find((t) => !t.visible);
    if (!text) {
      text = new Text({
        text: "",
        style: {
          fontFamily: "sans-serif", fontSize: 16, fontWeight: "bold",
          fill: 0xffffff, stroke: { color: 0x000000, width: 4 },
        },
      });
      text.anchor.set(0.5);
      this.popupPool.push(text);
      this.world.addChild(text);
    }
    text.text = "빗나감";
    text.tint = 0xaab2bd;
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
    const img = this.playFxSprite(FX.coin, { x: at.x, y: at.y - 4 }, RETREAT_MS, (t, s) => {
      const e = 1 - (1 - t) * (1 - t);              // ease-out
      s.position.y = at.y - 4 - 18 * e;             // 튀어오름
      s.scale.set(0.6 + e * 0.7);
      s.alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
    });
    if (img) return img;
    // ── 폴백: 기존 흰/연두 파편 ──
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

  /**
   * 슬래시 아크 (§4 타격 주스) — 공격자→방어자 방향으로 휘두르는 흰금빛 호(arc) 1회.
   * 방어자 칸 위에 절차적 Graphics로 그리고, 휘두르는 방향으로 쓸고 지나가며 페이드.
   * indirect=true(궁/포)면 베기 대신 차가운 청백 "관통/충격" 톤 + 직선형 스트로크.
   * 월드 공간(카메라 변환 하). 순수 표현 — 게임 상태 불변, TweenRunner로 배속 존중.
   */
  slashArc(from: WorldPoint, to: WorldPoint, indirect = false): Promise<void> {
    const dx0 = to.x - from.x, dy0 = to.y - from.y;
    const ang0 = Math.atan2(dy0, dx0);   // 공격 방향
    const img = this.playFxSprite(FX.slash, { x: to.x, y: to.y - 8 }, SLASH_MS, (t, s) => {
      const e = easeOut(t);
      s.rotation = ang0 + (e - 0.5) * 0.9;          // 휘두르는 쓸기
      s.scale.set(0.8 + e * 0.5);
      s.alpha = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      if (indirect) s.tint = 0x9fd8ff;              // 간접=청백(PIERCE_TINT 톤)
    }, ang0);
    if (img) return img;
    // ── 폴백: 기존 절차적 호 ──
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx); // 공격 진행 방향
    const color = indirect ? PIERCE_TINT : SLASH_GOLD;

    const root = new Container();
    // 타격점을 방어자 몸통 높이(타일 중심보다 살짝 위)에 둔다
    root.position.set(to.x - (dx / len) * 6, to.y - (dy / len) * 6 - 8);
    root.rotation = ang;

    const g = new Graphics();
    root.addChild(g);
    this.world.addChild(root);

    const drawArc = (progress: number, alpha: number): void => {
      g.clear();
      if (indirect) {
        // 관통: 진행 방향 짧은 창 스트로크 + 충격 점
        const half = SLASH_LEN * 0.5;
        g.moveTo(-half * (1 - progress) - 4, 0)
          .lineTo(half, 0)
          .stroke({ width: 4, color, alpha });
        g.circle(half, 0, 3 + 4 * (1 - progress)).fill({ color, alpha: alpha * 0.8 });
      } else {
        // 베기: 호현 SLASH_LEN, 활 SLASH_BOW. progress로 호를 "쓸어내리며" 회전 인상.
        const sweep = (progress - 0.5) * 0.9; // -0.45..+0.45 rad 회전
        g.rotation = sweep;
        const half = SLASH_LEN * 0.5;
        const bow = SLASH_BOW * (0.6 + 0.4 * Math.sin(progress * Math.PI));
        // 두 겹 호: 굵은 안쪽 + 가는 바깥 잔상으로 속도감
        g.moveTo(-half, half * 0.18)
          .quadraticCurveTo(0, -bow, half, half * 0.18)
          .stroke({ width: 5, color, alpha });
        g.moveTo(-half, half * 0.18 + 5)
          .quadraticCurveTo(0, -bow + 5, half, half * 0.18 + 5)
          .stroke({ width: 2, color: 0xffffff, alpha: alpha * 0.7 });
      }
    };

    return this.tweens
      .run(SLASH_MS, (t) => {
        const e = easeOut(t);
        drawArc(e, t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65);
      })
      .then(() => {
        this.world.removeChild(root);
        root.destroy({ children: true });
      });
  }

  /**
   * 임팩트 플래시 (§4 타격 주스) — 타격점에 짧고 강한 흰빛 원 1회(빠르게 확장·소멸).
   * 묵직한 "맞았다" 신호. 월드 공간, 순수 표현, 배속 존중.
   */
  impactFlash(at: WorldPoint, big = false): Promise<void> {
    const key = pickFlashKey(big);                  // big→sparkle, else flash
    const scaleTo = big ? 2.0 : 1.3;
    const img = this.playFxSprite(key, { x: at.x, y: at.y - 6 }, big ? 220 : FLASH_MS, (t, s) => {
      s.scale.set(0.5 + t * scaleTo);
      s.alpha = Math.max(0, 1 - t);
    });
    if (img) return img;
    // ── 폴백: 기존 흰 원 ──
    const flash = new Graphics();
    flash.circle(0, 0, FLASH_R).fill({ color: 0xffffff, alpha: 1 });
    flash.position.set(at.x, at.y - 6);
    this.world.addChild(flash);
    return this.tweens
      .run(FLASH_MS, (t) => {
        flash.scale.set(0.5 + t * 1.1);
        flash.alpha = Math.max(0, 1 - t);
      })
      .then(() => {
        this.world.removeChild(flash);
        flash.destroy();
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
