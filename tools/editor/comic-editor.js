// tools/editor/comic-editor.js — 만화 파트(ComicScene) 순수 헬퍼 (DOM 무관). spec 2026-09-12-story-editor-v2-comic-design §4
// 데이터 모양 = packages/data/src/schemas.ts ComicSceneSchema. DOM 편집부(renderComicPart)는 Chunk 3.

const MIN = 0.01;                                   // 칸 최소 변(정규화) — 클릭만 한 드래그도 스키마 유효(w,h>0)
const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/** [x,y,w,h] 를 0..1 안으로, w/h ≥ MIN, x+w·y+h ≤ 1 로 정리(소수 3자리). */
export function clampRect(r) {
  // 먼저 반올림, 그 다음 반올림된 변 기준으로 클램프 — 반올림을 뒤에 하면 3자리 타이(0.9895→0.99)에서 x+w 가 1을 넘는다
  let [x, y, w, h] = [r?.[0], r?.[1], r?.[2], r?.[3]].map((v) => r3(clamp01(v)));
  w = Math.max(MIN, w); h = Math.max(MIN, h);
  x = Math.min(x, r3(1 - w)); y = Math.min(y, r3(1 - h));
  return [x, y, w, h];
}

/**
 * 썸네일 위 드래그 → 정규화 rect. p0/p1 = 클라이언트 px {x,y}, box = 썸네일 getBoundingClientRect {left,top,width,height}.
 * 방향 무관(어느 모서리에서 시작해도 됨), 박스 밖은 클램프.
 */
export function rectFromDrag(p0, p1, box) {
  const nx = (px) => clamp01((px - box.left) / box.width);
  const ny = (py) => clamp01((py - box.top) / box.height);
  const x0 = nx(p0.x), x1 = nx(p1.x), y0 = ny(p0.y), y1 = ny(p1.y);
  return clampRect([Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)]);
}

/** 새 페이지 — 빈 image(validate 오류로 Publish/미리보기 차단) + 전체 지면 칸 1개. */
export function newPage() {
  return { image: "", panels: [{ rect: [0, 0, 1, 1] }] };
}

/** 새 만화 파트 — 페이지 1장. */
export function newComicPart() {
  return { kind: "comic", pages: [newPage()] };
}
