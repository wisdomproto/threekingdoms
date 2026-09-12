import { describe, it, expect } from "vitest";
import { clampRect, rectFromDrag, newPage, newComicPart } from "../../../tools/editor/comic-editor.js";
import { isComicScene } from "../../../tools/editor/story-model.js";
import { ComicSceneSchema } from "../src/schemas";

describe("comic-editor — 순수 헬퍼 (spec §4)", () => {
  const box = { left: 100, top: 50, width: 300, height: 400 };
  it("rectFromDrag: 정규화·소수 3자리, 방향 무관", () => {
    expect(rectFromDrag({ x: 100, y: 50 }, { x: 250, y: 250 }, box)).toEqual([0, 0, 0.5, 0.5]);
    expect(rectFromDrag({ x: 250, y: 250 }, { x: 100, y: 50 }, box)).toEqual([0, 0, 0.5, 0.5]);
    expect(rectFromDrag({ x: 200, y: 183.3 }, { x: 300, y: 250 }, box)).toEqual([0.333, 0.333, 0.333, 0.167]);
  });
  it("rectFromDrag: 박스 밖은 클램프, 클릭만 해도 최소 변", () => {
    expect(rectFromDrag({ x: 0, y: 0 }, { x: 999, y: 999 }, box)).toEqual([0, 0, 1, 1]);
    const dot = rectFromDrag({ x: 400, y: 450 }, { x: 400, y: 450 }, box);
    expect(dot[2]).toBeGreaterThan(0); expect(dot[3]).toBeGreaterThan(0);
    expect(dot[0] + dot[2]).toBeLessThanOrEqual(1); expect(dot[1] + dot[3]).toBeLessThanOrEqual(1);
  });
  it("clampRect: 범위 밖·NaN 정리, x+w ≤ 1 — 결과는 항상 스키마 유효", () => {
    expect(clampRect([0.8, -0.2, 0.5, 1.5])).toEqual([0.5, 0, 0.5, 1]);
    expect(clampRect([Number.NaN, 0, 0, 0])).toEqual([0, 0, 0.01, 0.01]);
    for (const r of [[0.9895, 0, 0.0105, 1], [0, 0.0625, 1, 0.9375], [0.7, 0.2, 0.3000004, 0.1]]) { const c = clampRect(r); expect(c[0] + c[2]).toBeLessThanOrEqual(1 + 1e-6); expect(c[1] + c[3]).toBeLessThanOrEqual(1 + 1e-6); } // 3자리 타이에서도 refine 통과
    for (const r of [[0.8, -0.2, 0.5, 1.5], [0.99999, 0.99999, 0.00001, 0.00001], [0.1234567, 0.2, 0.3, 0.4]]) {
      const c = clampRect(r);
      expect(() => ComicSceneSchema.parse({ kind: "comic", pages: [{ image: "p", panels: [{ rect: c }] }] })).not.toThrow();
    }
  });
  it("newPage/newComicPart: 빈 image + 전체 칸 1개 / kind comic", () => {
    expect(newPage()).toEqual({ image: "", panels: [{ rect: [0, 0, 1, 1] }] });
    const part = newComicPart();
    expect(part).toEqual({ kind: "comic", pages: [{ image: "", panels: [{ rect: [0, 0, 1, 1] }] }] });
    expect(isComicScene(part)).toBe(true);
    expect(isComicScene({ lines: [] })).toBe(false);
    expect(isComicScene({ map: "m" })).toBe(false);
    expect(isComicScene(null)).toBe(false);
  });
});
