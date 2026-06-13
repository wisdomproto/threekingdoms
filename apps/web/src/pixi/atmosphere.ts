/**
 * AtmosphereLayer — 스크린 공간 분위기 오버레이 (설계 §2.2 보강).
 * 카메라/맵과 무관하게 화면 전체에 깔리는 한 장짜리 오버레이:
 *   - 가장자리 비네팅(어둡게) → 시선을 중앙으로 모은다
 *   - 따뜻한 중앙 글로우(아주 옅게) → 수묵 새벽 톤 보강
 * 입력은 차단하지 않는다(eventMode="none"). 맵 위·스크린FX 아래에 배치.
 *
 * 오버레이는 Canvas2D 방사 그라데이션으로 1회 생성 → Sprite를 화면에 맞춰 비균등 스트레치
 * (정사각 방사가 화면비에 맞는 타원 비네팅이 되어 네 모서리가 가장 어둡다).
 */
import { Container, Sprite, Texture } from "pixi.js";

function makeOverlayTexture(): Texture | null {
  if (typeof document === "undefined") return null;
  const size = 512;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, size * 0.14, c, c, size * 0.62);
  g.addColorStop(0, "rgba(255,226,172,0.06)"); // 따뜻한 중앙 글로우
  g.addColorStop(0.58, "rgba(0,0,0,0)"); // 중간 = 무간섭
  g.addColorStop(1, "rgba(22,16,32,0.5)"); // 가장자리 비네팅(차가운 어둠)
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(cv);
}

export class AtmosphereLayer extends Container {
  private readonly overlay: Sprite | null;

  constructor() {
    super();
    this.eventMode = "none"; // 밑 레이어가 입력을 받도록 통과
    const tex = makeOverlayTexture();
    this.overlay = tex ? new Sprite(tex) : null;
    if (this.overlay) {
      this.overlay.anchor.set(0.5);
      this.addChild(this.overlay);
    }
  }

  /** 화면 크기에 맞춰 비균등 스트레치 — 타원 비네팅이 화면을 정확히 덮는다 */
  resize(width: number, height: number): void {
    if (!this.overlay) return;
    this.overlay.width = width;
    this.overlay.height = height;
    this.overlay.position.set(width / 2, height / 2);
  }
}
