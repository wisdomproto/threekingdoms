/**
 * 모션코믹 칸 카메라 — 순수(spec 2026-09-12-story-editor-v2-comic-design §3).
 * 칸 rect(이미지 기준 정규화 [x,y,w,h])를 뷰포트에 contain-fit 하는 CSS transform 값.
 * 카메라 요소는 `transform-origin: 0 0`, 자연 px 폭으로 레이아웃(width: W)이라
 * `transform: translate(tx px, ty px) scale(s)` 로 칸 중심이 뷰 중심에 온다.
 */
export interface Size { w: number; h: number }
export interface Camera { scale: number; tx: number; ty: number }

/** @param pad 뷰포트 여백 비율(양쪽 합 2·pad). 기본 0.06. */
export function cameraFor(rect: readonly number[], img: Size, view: Size, pad = 0.06): Camera {
  const [x = 0, y = 0, w = 1, h = 1] = rect;
  const scale = Math.min((view.w * (1 - 2 * pad)) / ((w * img.w) || 1), (view.h * (1 - 2 * pad)) / ((h * img.h) || 1)); // 0 분모 가드
  const tx = view.w / 2 - (x + w / 2) * img.w * scale;
  const ty = view.h / 2 - (y + h / 2) * img.h * scale;
  return { scale, tx, ty };
}
