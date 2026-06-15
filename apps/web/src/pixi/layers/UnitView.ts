/**
 * UnitView (설계 §2.2) — "애니메이션 시퀀스 재생기" 파사드.
 * play('idle'|'move'|'attack'|'hit'|'retreat') => Promise + setFacing/setGridPosition.
 *
 * v0.1(에셋 통합): 스프라이트 에셋이 있으면 수묵 SD 스프라이트 표시, 없으면 색 사각형 폴백(필수).
 * 방향(facing):
 *   - 좌우: scale.x = +1(우향) | -1(좌향) 미러링 — 코드에서만 처리, 에셋은 한 방향만
 *   - 앞뒤: 이동/공격 상대 방향이 뒤쪽(y가 현재보다 작아지는 방향)이면 "back" 뷰, 아니면 "front" 뷰.
 *          템플릿 유닛(front 뷰만 보유)은 항상 front 뷰 사용.
 * 스프라이트 anchor: (0.5, 1.0) — 발 위치 기준 타일 중앙 정렬.
 * 높이: 타일(48px) × 1.6 ≈ 77px — SD 비율 살리기, 인접 타일 살짝 겹침 허용 (zIndex 정렬로 해결).
 * 병력 바 / 이름 라벨은 스프라이트 위 배치 (스프라이트 사용 시 y오프셋 조정).
 *
 * CLAUDE.md §4: 에셋(Spine/스프라이트)이 교체돼도 인터페이스는 불변.
 * zIndex = depthOf(y) 선확보 — 아이소 전환 시 깊이 정렬 공짜.
 */
import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { Side } from "@tk/data";
import type { Coord } from "@tk/engine";
import { depthOf, gridToWorld, TILE_SIZE } from "../projection";
import { UNIT_BASE_SIZE, type TextureResolver } from "../textures";
import { easeInOut, easeOut, easeOutBack, type TweenRunner } from "../tweens";
import { resolveSpriteId } from "../spriteMap";
import { SkeletonView, type AttachmentTextureResolver } from "./SkeletonView";
import type { ClipName, Skeleton } from "../skeleton";

export type UnitSequence = "idle" | "move" | "attack" | "hit" | "retreat";

const BAR_WIDTH = UNIT_BASE_SIZE;
const BAR_HEIGHT = 5;
const MOVE_MS_PER_TILE = 150; // 설계 §6: unitMoved는 경로 타일당 150ms
const ATTACK_MS = 260; // 앤티시페이션+오버슈트+복귀 재배분 여유로 약간 늘림
const HIT_MS = 200;
const RETREAT_MS = 350;
const LUNGE_PX = 13; // 오버슈트 최대 전진(px) — 기존 10에서 상향(찰진 돌진)
const ANTICIPATE_PX = 5; // lunge 전 뒤로 당기는 거리(px)
const KNOCKBACK_PX = 9; // 피격 기본 넉백(px) — intensity로 가중

/** idle 호흡: 세로 진폭(±%)과 주기(ms). 조조전 온라인풍 "살아있는" 느낌 */
const BREATH_AMP = 0.03;
const BREATH_PERIOD_MS = 2600;

/**
 * 스프라이트 표시 높이: 타일의 1.25배 (세로 인접 유닛 겹침 완화).
 * 타일(48px) × 1.25 = 60px. SD 비율은 약간 희생하지만 가독성 우선.
 */
const SPRITE_DISPLAY_H = Math.round(TILE_SIZE * 1.25); // 60px

export interface UnitViewInit {
  id: string;
  commanderId: string;
  classId: string;
  name: string;
  side: Side;
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

  /** 발밑 그림자 (항상 표시) */
  private readonly shadow: Graphics;
  /** 폴백 색 사각형 (스프라이트 없을 때 표시) */
  private readonly fallbackBase: Sprite;
  /** 수묵 스프라이트 (에셋 로드 시 교체. null = 미보유 → 폴백 유지) */
  private readonly spriteBase: Sprite;
  /** 현재 실제로 화면에 보이는 베이스 (fallbackBase or spriteBase) */
  private get activeBase(): Sprite {
    return this.spriteBase.visible ? this.spriteBase : this.fallbackBase;
  }

  private readonly barFill: Graphics;
  private readonly barBg: Graphics;
  private readonly nameLabel: Text;
  private readonly tweens: TweenRunner;
  private readonly textures: TextureResolver;
  private readonly spriteId: string | null;

  /** "front" | "back" — 현재 뷰 방향 */
  private view: "front" | "back" = "front";
  /** +1=우 | -1=좌 */
  private facing = 1;
  /**
   * 현재 포즈 — 미러 부호 보정용. 생성된 SD 아트가 idle/move=좌향인데 attack 포즈만
   * 우향으로 그려져 있어(관우·장비·화웅 등 일관), 포즈별로 미러 기준 방향이 다르다.
   */
  private pose: "idle" | "move" | "attack" = "idle";

  /** 스프라이트 기본 스케일(텍스처 높이 맞춤). 호흡은 이 값에 곱한다. */
  private baseScale = 1;
  /** idle 호흡 위상 — 유닛마다 달라 동기화 방지 */
  private breathPhase = 0;
  /** 현재 호흡 변위(-AMP..+AMP) */
  private breathV = 0;
  /** 호흡 on/off — 이동 중엔 끔 */
  private breathing = true;

  /**
   * 타격 주스용 스쿼시/스트레치 배율 (§4) — 공격 lunge·피격에 곱한다.
   * applyScale이 baseScale·미러·호흡과 함께 합성. 1=중립. 순수 표현(게임상태 무관).
   */
  private fxSquashX = 1;
  private fxSquashY = 1;

  /**
   * 자체 컷아웃 리그 (§4 "유닛 = 시퀀스 재생기"). null이면 기존 스프라이트/폴백 경로.
   * setSkeleton()으로 주입되면 renderMode='skeleton' — play()가 클립을 구동한다.
   */
  private skeletonView: SkeletonView | null = null;
  /** idle 클립 루프 위상(초) — tickIdle에서 진행. 클립 duration으로 wrap. */
  private skelIdlePhase = 0;
  /** idle 클립 duration(초) 캐시 — 0이면 정적 포즈. */
  private skelIdleDuration = 1;

  constructor(init: UnitViewInit, textures: TextureResolver, tweens: TweenRunner) {
    super();
    this.unitId = init.id;
    this.gridX = init.x;
    this.gridY = init.y;
    this.troops = init.troops;
    this.maxTroops = init.maxTroops;
    this.retreatedFlag = init.retreated;
    this.tweens = tweens;
    this.textures = textures;
    this.spriteId = resolveSpriteId(init.commanderId, init.classId, init.side);

    // 유닛 id 해시로 호흡 위상 분산 (전원이 같은 박자로 숨쉬지 않게)
    let hp = 0;
    for (let i = 0; i < init.id.length; i++) hp = (hp * 31 + init.id.charCodeAt(i)) >>> 0;
    this.breathPhase = ((hp % 1000) / 1000) * Math.PI * 2;

    // ── 발밑 그림자 (맨 뒤 — 유닛을 바닥에 붙인다) ──
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 0, UNIT_BASE_SIZE * 0.46, UNIT_BASE_SIZE * 0.2).fill({ color: 0x000000, alpha: 0.24 });
    this.addChild(this.shadow);

    // ── 폴백 색 사각형 (진영색 라운드 사각) ──
    this.fallbackBase = new Sprite(textures.get("side", init.side));
    this.fallbackBase.anchor.set(0.5);
    this.addChild(this.fallbackBase);

    // ── 스프라이트 슬롯 (초기에는 hidden, 에셋 로드 시 교체) ──
    this.spriteBase = new Sprite(Texture.EMPTY);
    this.spriteBase.anchor.set(0.5, 1.0); // 발 기준 정렬
    this.spriteBase.visible = false;
    this.addChild(this.spriteBase);

    // ── 병력 바 (배경 + 채움) ──
    this.barBg = new Graphics();
    this.barBg.rect(0, 0, BAR_WIDTH, BAR_HEIGHT).fill(0x222222);
    this.addChild(this.barBg);
    this.barFill = new Graphics();
    this.addChild(this.barFill);

    // ── 장수명 라벨 (기본 숨김 — 선택 시에만 표시) ──
    this.nameLabel = new Text({
      text: init.name,
      style: {
        fontFamily: "sans-serif",
        fontSize: 12,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    this.nameLabel.anchor.set(0.5, 1);
    this.nameLabel.visible = false; // setSelected(true) 시에만 표시
    this.addChild(this.nameLabel);

    // 스프라이트가 있으면 즉시 초기 포즈 적용 (loadSprites 완료 후 = 증원 스폰 시).
    // ⚠️ 반드시 bar/label 생성 *뒤*에 — applySpriteTexture가 repositionUI를 호출하므로
    //    UI 필드가 먼저 존재해야 한다(부팅 후 생성 시 barBg 미정의 크래시 방지).
    this.applySpriteTexture("front", "idle");

    this.redrawBar();
    this.repositionUI();
    this.snapTo(init.x, init.y);
    this.setRetreated(init.retreated);
  }

  // ── 스프라이트 텍스처 적용 ────────────────────────────────────────────────

  /** 에셋 로드 완료 후 외부(UnitLayer)에서 호출 — 현재 뷰의 idle 텍스처로 갱신, facing 보존 */
  refreshSprite(): void {
    if (this.skeletonView) {
      this.skeletonView.refresh();
      return;
    }
    this.applySpriteTexture(this.view, "idle");
    this.applyFacing();
  }

  /** 현재 렌더 모드 — 스켈레톤이 주입돼 있으면 'skeleton', 아니면 'sprite'(폴백 색사각 포함). */
  get renderMode(): "sprite" | "skeleton" {
    return this.skeletonView ? "skeleton" : "sprite";
  }

  /**
   * 자체 컷아웃 리그를 주입해 renderMode='skeleton'로 전환 (§4).
   * 스켈레톤이 있으면 SkeletonView가 베이스를 대체 — 스프라이트/폴백 사각형은 숨긴다.
   * resolveTexture: 어태치먼트 image → Texture (미로드면 null → 해당 슬롯 미표시).
   * 결정론·배속: 클립 진행은 play()가 TweenRunner로 구동(§ 기존 스프라이트 경로와 동일 규약).
   */
  setSkeleton(skeleton: Skeleton, resolveTexture: AttachmentTextureResolver): void {
    if (this.skeletonView) {
      this.removeChild(this.skeletonView);
      this.skeletonView.destroy({ children: true });
    }
    const sv = new SkeletonView(skeleton, resolveTexture);
    // 발 기준 정렬: 스켈레톤 원점(0,0)을 발끝(타일 하단)으로. 스프라이트 경로와 같은 feetY.
    sv.position.set(0, TILE_SIZE / 2);
    this.skeletonView = sv;
    this.skelIdleDuration = skeleton.clips.idle?.duration ?? 0;
    this.skelIdlePhase = 0;
    // 스프라이트/폴백 베이스 숨김 — 스켈레톤이 화면을 차지한다.
    this.spriteBase.visible = false;
    this.fallbackBase.visible = false;
    // 슬롯 정렬: 그림자(이미 addChild됨) 위, 바/라벨 아래에 끼우려 그림자 다음으로 올린다.
    this.addChildAt(sv, this.getChildIndex(this.shadow) + 1);
    sv.setPose("idle", 0);
    this.applySkeletonFacing();
    this.repositionUI();
  }

  /** 스켈레톤 좌우 미러 — 컨테이너 scale.x 부호로(스프라이트 미러와 동일 규약). */
  private applySkeletonFacing(): void {
    if (!this.skeletonView) return;
    this.skeletonView.scale.x = Math.abs(this.skeletonView.scale.x) * this.facing;
  }

  /**
   * 지정된 뷰+포즈 텍스처를 spriteBase에 적용.
   * 텍스처가 없으면 폴백(fallbackBase)을 표시.
   */
  private applySpriteTexture(view: "front" | "back", pose: "idle" | "move" | "attack"): void {
    if (this.skeletonView) return; // 스켈레톤 경로 — 스프라이트 포즈 텍스처 미사용
    this.pose = pose; // 미러 부호는 포즈에 따라 다름 (applyScale) — 폴백 경로에서도 추적
    if (!this.spriteId) return; // 매핑 없음 → 항상 폴백

    const tex = this.textures.getSprite(this.spriteId, view, pose);
    if (!tex) return; // 에셋 미로드 → 폴백 유지

    // 텍스처 높이를 SPRITE_DISPLAY_H에 맞게 스케일
    const src = tex.source;
    const srcH = src ? src.height : tex.height;
    this.baseScale = srcH > 0 ? SPRITE_DISPLAY_H / srcH : 1;

    this.spriteBase.texture = tex;
    this.spriteBase.visible = true;
    this.fallbackBase.visible = false;
    this.applyScale();
    this.repositionUI();
  }

  /** baseScale × facing × 호흡 변위를 spriteBase에 반영.
   *  idle/move 아트는 좌향(left-facing)이라 facing=+1(우향)일 때 미러(scale.x<0) → -facing.
   *  attack 아트는 우향으로 그려져 있어 부호가 반대 → +facing (적이 왼쪽이면 좌로 휘두름). */
  private applyScale(): void {
    if (this.skeletonView) return; // 스켈레톤은 자체 클립이 변형 담당 — 스프라이트 스쿼시 미적용
    const taller = (1 + this.breathV) * this.fxSquashY;
    const narrower = (1 - this.breathV * 0.5) * this.fxSquashX; // 부피 보존감 — 늘면 살짝 좁게
    const mirror = this.pose === "attack" ? this.facing : -this.facing;
    this.spriteBase.scale.set(this.baseScale * mirror * narrower, this.baseScale * taller);
  }

  /**
   * 현재 뷰+포즈를 유지한 채 방향(facing)만 변경.
   * scale.x 부호로 좌우 미러링.
   */
  private applyFacing(): void {
    if (this.skeletonView) {
      this.applySkeletonFacing();
      return;
    }
    if (this.spriteBase.visible) {
      this.applyScale();
    } else {
      this.fallbackBase.scale.x = Math.abs(this.fallbackBase.scale.x) * this.facing;
    }
  }

  /**
   * ticker에서 매 프레임 호출 — idle 호흡(세로 미세 스케일).
   * 스프라이트 표시 + 호흡 on + 미퇴각일 때만. 정지/이동 중엔 중립으로 복귀.
   */
  tickIdle(dtMS: number): void {
    // 스켈레톤 경로: idle 클립을 루프 위상으로 진행(결정론 — t는 위상/duration).
    if (this.skeletonView) {
      if (this.retreatedFlag || !this.breathing || this.skelIdleDuration <= 0) return;
      this.skelIdlePhase = (this.skelIdlePhase + dtMS / 1000) % this.skelIdleDuration;
      this.skeletonView.setPose("idle", this.skelIdlePhase / this.skelIdleDuration);
      return;
    }
    if (!this.spriteBase.visible || this.retreatedFlag || !this.breathing) {
      if (this.breathV !== 0) {
        this.breathV = 0;
        this.applyScale();
      }
      return;
    }
    this.breathPhase += (dtMS / BREATH_PERIOD_MS) * Math.PI * 2;
    this.breathV = BREATH_AMP * Math.sin(this.breathPhase);
    this.applyScale();
  }

  /**
   * 스켈레톤 1회 클립(attack/hit/move 등) 재생 — progress 0→1 트윈(TweenRunner 경유 → 배속 존중).
   * 끝나면 idle로 복귀. play() 내부 헬퍼.
   */
  private playSkeletonClip(clip: ClipName, durationMs: number): Promise<void> {
    const sv = this.skeletonView;
    if (!sv) return Promise.resolve();
    sv.setClip(clip);
    return this.tweens
      .run(durationMs, (t) => sv.setPose(clip, t))
      .then(() => {
        sv.setPose("idle", this.skelIdleDuration > 0 ? this.skelIdlePhase / this.skelIdleDuration : 0);
      });
  }

  /** 병력 바 / 라벨을 현재 활성 베이스 위에 배치 */
  private repositionUI(): void {
    if (this.skeletonView) {
      // 스켈레톤도 발 기준(원점=발끝, feetY=타일 하단). 바/라벨은 스프라이트 경로와 동일 위치.
      const feetY = TILE_SIZE / 2;
      const headY = feetY - SPRITE_DISPLAY_H;
      this.barBg.position.set(-BAR_WIDTH / 2, feetY + 2);
      this.barFill.position.set(-BAR_WIDTH / 2, feetY + 2);
      this.nameLabel.position.set(0, headY - 2);
      this.shadow.position.set(0, feetY);
      return;
    }
    if (this.spriteBase.visible) {
      // 컨테이너 원점 = 타일 중심(gridToWorld). 발끝을 타일 하단(+TILE_SIZE/2)으로 내려
      // 유닛이 위 칸에 뜨지 않고 자기 칸 안에 서도록 한다. anchor=(0.5,1.0)이므로 발=spriteBase.y.
      const feetY = TILE_SIZE / 2;
      this.spriteBase.position.set(0, feetY);
      const headY = feetY - SPRITE_DISPLAY_H;
      this.barBg.position.set(-BAR_WIDTH / 2, feetY + 2);          // 발 아래 2px
      this.barFill.position.set(-BAR_WIDTH / 2, feetY + 2);
      this.nameLabel.position.set(0, headY - 2);                   // 머리 위 2px
      this.shadow.position.set(0, feetY);                          // 발밑
    } else {
      // 폴백 색 사각형: anchor=(0.5, 0.5) → 중앙=0
      this.barBg.position.set(-BAR_WIDTH / 2, UNIT_BASE_SIZE / 2 + 2);
      this.barFill.position.set(-BAR_WIDTH / 2, UNIT_BASE_SIZE / 2 + 2);
      this.nameLabel.position.set(0, -UNIT_BASE_SIZE / 2 - 2);
      this.shadow.position.set(0, UNIT_BASE_SIZE / 2);
    }
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

  /**
   * 선택 상태를 설정합니다.
   * 선택 시: 이름 라벨 표시. 비선택 시: 이름 라벨 숨김.
   * 병력 바는 항상 표시 유지.
   */
  setSelected(selected: boolean): void {
    this.nameLabel.visible = selected;
  }

  setFacing(dir: 1 | -1): void {
    this.facing = dir;
    this.applyFacing();
  }

  faceToward(target: Coord): void {
    if (target.x !== this.gridX) this.setFacing(target.x > this.gridX ? 1 : -1);
  }

  /**
   * 뷰 방향 업데이트: 이동 벡터 dy < 0(위쪽)이면 back, 아니면 front.
   * 템플릿 유닛(back 뷰 미보유)은 front 유지.
   */
  private setView(fromY: number, toY: number): void {
    const newView: "front" | "back" = toY < fromY ? "back" : "front";
    if (newView !== this.view) {
      this.view = newView;
      this.applySpriteTexture(this.view, "idle");
    }
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
        this.applySpriteTexture(this.view, "idle");
        return Promise.resolve();
      case "move": // 이동 본체는 moveAlong이 담당 — 단독 호출은 즉시 완료
        return Promise.resolve();
      case "attack":
        return this.playAttack();
      case "hit":
        return this.playHit(); // 방향·강도 미지정 기본값 (직접 호출은 playHitFrom 사용)
      case "retreat":
        return this.playRetreat();
    }
  }

  /**
   * 방향·강도 지정 피격 (§4) — BattleRenderer.damageDealt가 공격 방향·피해비례 강도로 호출.
   * fromDir: 공격이 들어온 x방향(+1=오른쪽 공격자, -1=왼쪽). intensity: 0~1+ 넉백 가중.
   */
  playHitFrom(fromDir: 1 | -1, intensity: number): Promise<void> {
    return this.playHit(fromDir, intensity);
  }

  /** 경로(시작 타일 포함)를 따라 타일당 msPerTile 트윈. zIndex/facing을 타일마다 갱신 */
  async moveAlong(path: readonly Coord[], msPerTile: number = MOVE_MS_PER_TILE): Promise<void> {
    this.breathing = false; // 걷는 동안 호흡 정지
    this.applySpriteTexture(this.view, "move");
    if (this.skeletonView) this.skeletonView.setClip("move");
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1];
      const to = path[i];
      if (!from || !to) continue;
      if (to.x !== from.x) this.setFacing(to.x > from.x ? 1 : -1);
      this.setView(from.y, to.y);
      const wf = gridToWorld(from);
      const wt = gridToWorld(to);
      await this.tweens.run(msPerTile, (t) => {
        this.position.set(wf.x + (wt.x - wf.x) * t, wf.y + (wt.y - wf.y) * t);
        // move 클립을 타일당 1주기로 진행(걸음). 결정론 — t로 구동.
        if (this.skeletonView) this.skeletonView.setPose("move", t);
      });
      this.gridX = to.x;
      this.gridY = to.y;
      this.zIndex = depthOf(to.y);
    }
    this.applySpriteTexture(this.view, "idle");
    if (this.skeletonView) this.skeletonView.setPose("idle", this.idleT());
    this.breathing = true; // 도착 → 호흡 재개
  }

  /**
   * 통상공격 모션 (§4 타격 주스): 앤티시페이션(살짝 뒤로) → 오버슈트 돌진(easeBack) → 복귀.
   * 돌진 정점에 스쿼시/스트레치(가로로 늘고 세로로 눌림)로 "찰진" 무게감.
   * 순수 표현 — 게임상태 불변, TweenRunner 경유라 배속 존중.
   */
  private playAttack(): Promise<void> {
    if (this.skeletonView) {
      // 스켈레톤: attack 클립을 ATTACK_MS 동안 1회 재생 + 컨테이너 lunge(위치)는 그대로 유지.
      this.skeletonView.setClip("attack");
    }
    this.applySpriteTexture(this.view, "attack");
    const ox = this.position.x;
    const dir = this.facing;
    // 구간 비율: 0~ANT_END 당김 / ANT_END~LUNGE_END 돌진 / 이후 복귀
    const ANT_END = 0.22;
    const LUNGE_END = 0.5;
    return this.tweens
      .run(ATTACK_MS, (t) => {
        let dx: number;
        let stretch = 0; // -1(눌림)~+1(늘어남)
        if (t < ANT_END) {
          const k = easeInOut(t / ANT_END);
          dx = -ANTICIPATE_PX * k; // 뒤로 당김
          stretch = -0.18 * k; // 웅크림(세로 눌림)
        } else if (t < LUNGE_END) {
          const k = easeOutBack((t - ANT_END) / (LUNGE_END - ANT_END), 2.2);
          dx = -ANTICIPATE_PX + (LUNGE_PX + ANTICIPATE_PX) * k; // 오버슈트 돌진
          stretch = 0.22 * Math.min(1, k); // 앞으로 쭉(가로 늘림)
        } else {
          const k = easeInOut((t - LUNGE_END) / (1 - LUNGE_END));
          dx = LUNGE_PX * (1 - k); // 복귀
          stretch = 0.22 * (1 - k);
        }
        this.position.x = ox + dir * dx;
        // 스켈레톤: 같은 t로 attack 클립 진행(배속 존중 — TweenRunner가 t를 구동).
        if (this.skeletonView) this.skeletonView.setPose("attack", t);
        // 가로 늘면 세로 눌림(부피 보존). 돌진=가로 강조.
        this.fxSquashX = 1 + stretch * 0.5;
        this.fxSquashY = 1 - stretch * 0.35;
        this.applyScale();
      })
      .then(() => {
        this.position.x = ox;
        this.fxSquashX = 1;
        this.fxSquashY = 1;
        this.applyScale();
        this.applySpriteTexture(this.view, "idle");
        if (this.skeletonView) this.skeletonView.setPose("idle", this.idleT());
      });
  }

  /** 현재 idle 위상의 정규화 t(0..1) — 클립 복귀 시 매끄러운 idle 재개용. */
  private idleT(): number {
    return this.skelIdleDuration > 0 ? this.skelIdlePhase / this.skelIdleDuration : 0;
  }

  /**
   * 피격 모션 (§4): 빨강 틴트 + 공격 반대 방향 넉백(intensity 비례) → 탄성 복귀 + 잔진동.
   * 피격 순간 세로로 눌리는 스쿼시. intensity: 0~1+ (피해/퇴각임박으로 호출측이 가중).
   * @param fromDir  공격이 들어온 방향(+1=오른쪽에서, -1=왼쪽에서). 넉백은 그 반대로.
   * @param intensity 넉백/스쿼시 가중 (기본 0.4). 1+면 강한 타격.
   */
  private playHit(fromDir: 1 | -1 = 1, intensity = 0.4): Promise<void> {
    const ox = this.position.x;
    const push = -fromDir; // 맞은 쪽 반대로 밀림
    const dist = KNOCKBACK_PX * (0.5 + intensity); // intensity로 넉백 거리 가중
    this.activeBase.tint = 0xff8080;
    if (this.skeletonView) this.skeletonView.setClip("hit");
    return this.tweens
      .run(HIT_MS, (t) => {
        if (this.skeletonView) this.skeletonView.setPose("hit", t);
        // 0~0.3 급격히 밀림(easeOut) → 0.3~1 탄성 복귀 + 감쇠 진동
        let dx: number;
        if (t < 0.3) {
          dx = dist * easeOut(t / 0.3);
        } else {
          const u = (t - 0.3) / 0.7;
          const settle = (1 - easeOut(u)); // 1→0
          const jitter = Math.sin(u * Math.PI * 5) * 2 * (1 - u);
          dx = dist * settle + jitter;
        }
        this.position.x = ox + push * dx;
        // 피격 순간 세로 눌림(움찔). 초반에 깊고 빠르게 회복.
        const squash = (1 - t) * 0.18 * (0.6 + intensity);
        this.fxSquashY = 1 - squash;
        this.fxSquashX = 1 + squash * 0.6;
        this.applyScale();
      })
      .then(() => {
        this.activeBase.tint = 0xffffff;
        this.position.x = ox;
        this.fxSquashX = 1;
        this.fxSquashY = 1;
        this.applyScale();
        if (this.skeletonView) this.skeletonView.setPose("idle", this.idleT());
      });
  }

  /**
   * 임팩트 화이트 플래시 (§4) — 피격 프레임에 베이스를 잠깐 흰색으로 띄웠다 본색 복귀.
   * playHit의 빨강 틴트보다 "맞은 순간" 신호가 강하다. 짧게(부분 구간) 깔고 빠진다.
   * 순수 표현. 단독 Promise라 호출측이 hit와 병행/직전 배치 가능.
   */
  flash(): Promise<void> {
    const base = this.activeBase;
    base.tint = 0xffffff; // 흰 플래시 (가산 느낌)
    base.alpha = 1;
    return this.tweens
      .run(90, (t) => {
        // 흰색에서 빠르게 빠지며 피격 틴트(빨강)로 자연 인계 — playHit가 동시 진행
        base.alpha = 1 - 0.15 * t;
      })
      .then(() => {
        base.alpha = 1;
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
