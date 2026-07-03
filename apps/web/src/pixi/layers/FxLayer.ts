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

// ── 책략 카테고리별 대표 VFX (§8, 절차적 — 에셋 0, 전투 타격 FX와 동형. 생성 FX 드롭인 여지) ──
const STRATEGY_MS = 640;
type StrategyMotion = "rise" | "ripple" | "spiral" | "shards" | "sink";
interface StrategyFxSpec {
  motion: StrategyMotion;
  /** 파티클 색 순환. */
  colors: number[];
  /** 확장 링 색. */
  ring: number;
  count: number;
}
const STRATEGY_FX: Record<string, StrategyFxSpec> = {
  fire: { motion: "rise", colors: [0xff7a2a, 0xffc24a, 0xff4530], ring: 0xff8a3a, count: 14 },
  water: { motion: "ripple", colors: [0x6ec6ff, 0xbfe9ff, 0x3aa0e0], ring: 0x7cc6ff, count: 12 },
  wind: { motion: "spiral", colors: [0xeaf6ff, 0xa9e0ff, 0xffffff], ring: 0xcfeaff, count: 16 },
  earth: { motion: "shards", colors: [0xb78a4a, 0x8a5a2a, 0xd9b079], ring: 0x9a7038, count: 12 },
  heal: { motion: "rise", colors: [0x8be79a, 0xc8ffd0, 0x5fd07a], ring: 0x8be79a, count: 12 },
  debuff: { motion: "sink", colors: [0xb070ff, 0x7a4ad0, 0x5a3a90], ring: 0x9a6aff, count: 12 },
  special: { motion: "ripple", colors: [0xffe08a, 0xfff2c4, 0xffc24a], ring: 0xffe08a, count: 12 },
};

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

  /** 데미지 팝업 — 위로 떠오르며 페이드. counter면 색 구분. crit=회심(금빛 확대) / guarded=가드(강청색 「막음」). */
  damagePopup(at: WorldPoint, amount: number, counter: boolean, crit = false, guarded = false): Promise<void> {
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
    text.text = crit ? `회심! ${amount}` : guarded ? `막음 ${amount}` : String(amount);
    text.tint = crit ? 0xffd75e : guarded ? 0x9fd8ff : counter ? COUNTER_TINT : NORMAL_TINT;
    text.scale.set(crit ? 1.3 : 1); // 풀 공유라 매 사용 시 리셋
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

  /** 레벨업 팝업(§12 — 원작 「레벨 업!」 순간). 금빛 텍스트 상승 + 유닛 자리 반짝임. */
  levelUpPopup(at: WorldPoint, newLevel: number): Promise<void> {
    let text = this.popupPool.find((t) => !t.visible);
    if (!text) {
      text = new Text({
        text: "",
        style: {
          fontFamily: "sans-serif", fontSize: 18, fontWeight: "bold",
          fill: 0xffffff, stroke: { color: 0x000000, width: 4 },
        },
      });
      text.anchor.set(0.5);
      this.popupPool.push(text);
      this.world.addChild(text);
    }
    text.text = `레벨 업! Lv.${newLevel}`;
    text.tint = 0xffe27a;
    text.scale.set(1.15);
    text.visible = true;
    text.alpha = 1;
    const startY = at.y - 30; // 데미지 팝업과 겹치지 않게 한 단 위
    text.position.set(at.x, startY);
    const captured = text;
    void this.impactFlash(at, false); // 가벼운 반짝임 동반
    return this.tweens
      .run(POPUP_MS * 1.4, (t) => {
        captured.position.y = startY - POPUP_RISE_PX * t;
        captured.alpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
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
   * coin=true(기본)면 코인팝 이미지(§12 도파민 — **적 격파 전용**). 아군/우군 퇴각은 coin=false로
   * 호출해 파편 버스트만 — 아군이 쓰러졌는데 금화가 튀던 문제(2026-07-03) 방지.
   */
  retreatBurst(at: WorldPoint, opts?: { coin?: boolean }): Promise<void> {
    const img = (opts?.coin ?? true)
      ? this.playFxSprite(FX.coin, { x: at.x, y: at.y - 4 }, RETREAT_MS, (t, s) => {
          const e = 1 - (1 - t) * (1 - t);              // ease-out
          s.position.y = at.y - 4 - 18 * e;             // 튀어오름
          s.scale.set(0.6 + e * 0.7);
          s.alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
        })
      : null;
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
   * 화살 투사체 (공격 종류별 FX, 2026-07-03) — 공격자→방어자로 화살이 날아가 명중.
   * FX.arrow 스프라이트(있으면) 또는 절차적 화살(축선+촉). Promise는 **명중 순간** resolve —
   * 호출측(BattleRenderer)이 임팩트(섬광/흔들림/SFX)를 이어 발사한다. 배속 존중.
   */
  arrowShot(from: WorldPoint, to: WorldPoint): Promise<void> {
    const sx = from.x, sy = from.y - 14; // 발사 높이(상체)
    const ex = to.x, ey = to.y - 10;
    const dx = ex - sx, dy = ey - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    const ms = Math.max(120, Math.min(320, dist * 0.55)); // 거리 비례 비행(1~4칸)
    const tex = this.textures?.getFx(FX.arrow);
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.rotation = ang;
      s.blendMode = "add";
      // 생성 시트는 고해상(수백 px) — 월드 화살 길이 ~44px(타일 미만)로 정규화
      const k = 44 / Math.max(1, tex.width);
      this.world.addChild(s);
      return this.tweens.run(ms, (t) => {
        // 얕은 포물선(아치) — 중간에서 살짝 떠오른다
        const arc = Math.sin(t * Math.PI) * Math.min(14, dist * 0.12);
        s.position.set(sx + dx * t, sy + dy * t - arc);
        s.scale.set(k);
      }).then(() => { this.world.removeChild(s); s.destroy(); });
    }
    // ── 폴백: 절차적 화살(황갈 축선 + 백색 촉) ──
    const g = new Graphics();
    g.moveTo(-9, 0).lineTo(6, 0).stroke({ width: 2, color: 0xd8b46a, alpha: 1 });
    g.poly([9, 0, 4, -2.6, 4, 2.6]).fill({ color: 0xf3ead2 });
    g.rotation = ang;
    this.world.addChild(g);
    return this.tweens.run(ms, (t) => {
      const arc = Math.sin(t * Math.PI) * Math.min(14, dist * 0.12);
      g.position.set(sx + dx * t, sy + dy * t - arc);
    }).then(() => { this.world.removeChild(g); g.destroy(); });
  }

  /**
   * 슬래시 아크 (§4 타격 주스) — 공격 종류별 3톤(2026-07-03 다양화):
   *  - "slash"  베기(보병·산적): 금빛 호를 휘둘러 쓸기 (기존).
   *  - "thrust" 찌르기(기병계): 진행 방향 직선 런지 — FX.thrust 스프라이트 or 금빛 창 스트로크.
   *  - "pierce" 관통(원거리 임팩트 톤): 청백 직선 스트로크 (기존 indirect).
   * 방어자 칸 위 절차적 Graphics/스프라이트. 월드 공간, 순수 표현, 배속 존중.
   */
  slashArc(from: WorldPoint, to: WorldPoint, kind: "slash" | "pierce" | "thrust" = "slash"): Promise<void> {
    const indirect = kind === "pierce";
    const dx0 = to.x - from.x, dy0 = to.y - from.y;
    const ang0 = Math.atan2(dy0, dx0);   // 공격 방향
    if (kind === "thrust") {
      // 찌르기: 전용 스프라이트(있으면) — 방향 고정 + 전진 스트레치. 없으면 절차적 창 스트로크(아래).
      // 생성 시트는 고해상 — 월드 창광 길이 ~64px 기준으로 텍스처 폭 정규화 후 런지 스트레치.
      const img = this.playFxSprite(FX.thrust, { x: to.x, y: to.y - 8 }, SLASH_MS, (t, s) => {
        const e = easeOut(t);
        const k = 64 / Math.max(1, s.texture.width);
        s.rotation = ang0;
        s.scale.set(k * (0.7 + e * 0.65), k * 0.9);
        s.alpha = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
      }, ang0);
      if (img) return img;
    } else {
      const img = this.playFxSprite(FX.slash, { x: to.x, y: to.y - 8 }, SLASH_MS, (t, s) => {
        const e = easeOut(t);
        s.rotation = ang0 + (e - 0.5) * 0.9;          // 휘두르는 쓸기
        s.scale.set(0.8 + e * 0.5);
        s.alpha = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
        if (indirect) s.tint = 0x9fd8ff;              // 간접=청백(PIERCE_TINT 톤)
      }, ang0);
      if (img) return img;
    }
    // ── 폴백: 절차적 (베기=호 / 찌르기·관통=직선 스트로크) ──
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx); // 공격 진행 방향
    const straight = indirect || kind === "thrust"; // 직선 스트로크 계열
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
      if (straight) {
        // 찌르기/관통: 진행 방향 창 스트로크 + 충격 점 (thrust=금빛·pierce=청백)
        const half = SLASH_LEN * (kind === "thrust" ? 0.62 : 0.5);
        g.moveTo(-half * (1 - progress) - 4, 0)
          .lineTo(half, 0)
          .stroke({ width: kind === "thrust" ? 5 : 4, color, alpha });
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

  /**
   * 책략 시전 VFX (§8 — 카테고리별 대표 연출). 절차적 Graphics, 월드 공간, 순수 표현(상태 불변).
   * category(fire/water/wind/earth/heal/debuff/special)별 색·모션으로 차별화 — 미지의 카테고리는 special.
   * 데미지/회복 수치는 후속 damageDealt/troopsHealed가 처리 — 여기선 "주문이 펼쳐졌다" 연출만.
   */
  strategyEffect(category: string, at: WorldPoint): Promise<void> {
    const spec = STRATEGY_FX[category] ?? STRATEGY_FX.special!;
    const root = new Container();
    root.position.set(at.x, at.y - 8);
    this.world.addChild(root);

    const ring = new Graphics();
    root.addChild(ring);

    const parts: { g: Graphics; ang: number; spd: number }[] = [];
    for (let i = 0; i < spec.count; i++) {
      const g = new Graphics();
      const color = spec.colors[i % spec.colors.length] ?? spec.ring;
      const size = 2.5 + (i % 3);
      g.circle(0, 0, size).fill({ color, alpha: 1 });
      root.addChild(g);
      parts.push({ g, ang: (i / spec.count) * Math.PI * 2 + (i % 2) * 0.5, spd: 26 + (i % 4) * 7 });
    }

    const RING_R = 30;
    return this.tweens
      .run(STRATEGY_MS, (t) => {
        const e = easeOut(t);
        const fade = Math.max(0, 1 - t);
        ring.clear();
        ring.circle(0, 0, RING_R * (0.25 + e)).stroke({ width: 3, color: spec.ring, alpha: fade * 0.9 });
        for (const p of parts) {
          let x = 0;
          let y = 0;
          switch (spec.motion) {
            case "rise": // 불·회복 — 위로 솟구치며 흩어짐
              x = Math.cos(p.ang) * p.spd * e * 0.45;
              y = -p.spd * e - 8 * t;
              break;
            case "ripple": // 물·special — 사방으로 퍼지는 물보라/광채
              x = Math.cos(p.ang) * p.spd * e * 1.5;
              y = Math.sin(p.ang) * p.spd * e * 1.5;
              break;
            case "spiral": { // 바람 — 회전하며 바깥으로
              const a = p.ang + e * 3.2;
              const r = p.spd * e;
              x = Math.cos(a) * r;
              y = Math.sin(a) * r;
              break;
            }
            case "shards": // 땅 — 위로 튄 뒤 낙하(중력)
              x = Math.cos(p.ang) * p.spd * e;
              y = -Math.abs(Math.sin(p.ang)) * p.spd * e + 36 * t * t;
              break;
            case "sink": // 디버프 — 가라앉는 어두운 기운
              x = Math.cos(p.ang) * p.spd * e * 0.55;
              y = p.spd * e * 0.55 + 10 * t;
              break;
          }
          p.g.position.set(x, y);
          p.g.alpha = fade;
          p.g.scale.set(Math.max(0.2, 1 - t * 0.55));
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
