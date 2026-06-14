/**
 * SkeletonView — 자체 컷아웃(강체) 리그의 **Pixi 렌더 계층**.
 * 순수 계산(apps/web/src/pixi/skeleton.ts)의 PosedSlot[]을 받아 슬롯별 Sprite에 행렬을 박는다.
 *
 * 설계 §4 "유닛 = 애니메이션 시퀀스 재생기": UnitView가 renderMode='skeleton'일 때
 * 스프라이트 베이스 대신 이 컨테이너를 표시한다. 스켈레톤 데이터가 없으면 UnitView는 'sprite'로 폴백.
 *
 * 결정론 불변: setClip()/setProgress()는 t에 대해 순수(skeleton.poseSkeleton 위임).
 * 배속 존중: 시간 진행은 UnitView가 TweenRunner로 구동 — 이 클래스는 t(0..1)만 받는다.
 * 무기 슬롯 교체(§13): setAttachment(slot, name)로 실시간 교체, 다음 pose에 반영.
 */
import { Container, Matrix, Sprite, Texture } from "pixi.js";
import {
  type ClipName,
  type PosedSlot,
  type Skeleton,
  poseSkeleton,
} from "../skeleton";

/** 어태치먼트 image → Texture 해석기 (null = 미로드 → 슬롯 미표시). */
export type AttachmentTextureResolver = (image: string) => Texture | null;

export class SkeletonView extends Container {
  private readonly skeleton: Skeleton;
  private readonly resolveTexture: AttachmentTextureResolver;
  /** slot name → Sprite (재사용 풀 — pose마다 재생성하지 않는다). */
  private readonly slotSprites = new Map<string, Sprite>();
  /** 무기 슬롯 등 런타임 어태치먼트 교체 오버라이드. */
  private readonly attachmentOverride: Record<string, string | null> = {};
  /** setFromMatrix 재사용 인스턴스 — pose마다 할당하지 않는다. */
  private readonly scratch = new Matrix();

  private clipName: ClipName = "idle";
  private progress = 0;

  constructor(skeleton: Skeleton, resolveTexture: AttachmentTextureResolver) {
    super();
    this.skeleton = skeleton;
    this.resolveTexture = resolveTexture;
    this.sortableChildren = true;
    this.apply();
  }

  /** 현재 클립 변경(진행도는 0으로 리셋하지 않음 — 호출측이 setProgress로 제어). */
  setClip(clip: ClipName): void {
    if (clip === this.clipName) return;
    this.clipName = clip;
    this.apply();
  }

  /** 진행도 t(0..1) — idle/move는 위상, attack/hit는 1회 진행. */
  setProgress(t: number): void {
    this.progress = t;
    this.apply();
  }

  /** 클립+진행도 동시 설정(공통 경로). */
  setPose(clip: ClipName, t: number): void {
    this.clipName = clip;
    this.progress = t;
    this.apply();
  }

  /**
   * 무기 슬롯 실시간 교체(§13 BM) — attachmentName=null이면 해당 슬롯 숨김.
   * 다음 apply()에 반영. 같은 골격을 공유하는 유닛이 무기만 바꾸는 경로.
   */
  setAttachment(slot: string, attachmentName: string | null): void {
    this.attachmentOverride[slot] = attachmentName;
    this.apply();
  }

  /** 현재 클립/진행도/오버라이드로 PosedSlot[]을 산출해 슬롯 스프라이트에 반영. */
  private apply(): void {
    const posed = poseSkeleton(this.skeleton, this.clipName, this.progress, this.attachmentOverride);
    const seen = new Set<string>();

    for (const p of posed) {
      const sprite = this.ensureSprite(p);
      seen.add(p.slot);
      this.applyPosed(sprite, p);
    }

    // pose에 없는 슬롯(어태치먼트 null 등)은 숨긴다 — 스프라이트는 풀에 남겨 재사용.
    for (const [slot, sprite] of this.slotSprites) {
      if (!seen.has(slot)) sprite.visible = false;
    }
  }

  private ensureSprite(p: PosedSlot): Sprite {
    let sprite = this.slotSprites.get(p.slot);
    if (!sprite) {
      sprite = new Sprite();
      sprite.anchor.set(0.5, 0.5); // 어태치먼트 앵커=중심 (skeleton 규약)
      this.addChild(sprite);
      this.slotSprites.set(p.slot, sprite);
    }
    return sprite;
  }

  private applyPosed(sprite: Sprite, p: PosedSlot): void {
    const tex = this.resolveTexture(p.image);
    if (!tex) {
      sprite.visible = false; // 텍스처 미로드 — 슬롯 비표시(폴백 견고성)
      return;
    }
    sprite.visible = true;
    sprite.zIndex = p.z;
    if (sprite.texture !== tex) sprite.texture = tex;
    // 이미지 원본 픽셀을 어태치먼트 width/height로 정규화 → world 행렬은 그 정규화된 사각형에 적용.
    const tw = tex.width || p.width || 1;
    const th = tex.height || p.height || 1;
    const nx = p.width / tw;
    const ny = p.height / th;
    // PosedSlot.world(a,b,c,d,tx,ty)에 어태치먼트 정규화 스케일을 곱해 sprite 로컬 변환에 박는다.
    // anchor=(0.5,0.5)라 world.tx/ty는 어태치먼트 중심이 된다(skeleton 규약).
    this.scratch.set(p.world.a * nx, p.world.b * nx, p.world.c * ny, p.world.d * ny, p.world.tx, p.world.ty);
    sprite.setFromMatrix(this.scratch);
  }

  /** 텍스처가 뒤늦게 로드되면(비동기) 다시 호출해 슬롯을 채운다. */
  refresh(): void {
    this.apply();
  }
}
