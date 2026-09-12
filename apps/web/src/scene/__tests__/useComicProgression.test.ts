import { describe, it, expect } from "vitest";
import type { ComicScene } from "@tk/data";
import { comicStep, autoAdvanceMs } from "../useComicProgression";

const scene: ComicScene = {
  kind: "comic",
  pages: [
    { image: "p1", panels: [
      { rect: [0, 0, 1, 1], lines: [{ text: "a" }, { text: "bb" }] },
      { rect: [0, 0, 0.5, 0.5] },
    ] },
    { image: "p2", panels: [{ rect: [0, 0, 1, 1], lines: [{ text: "c" }], hold: 500 }] },
  ],
};

describe("comicStep — 줄→칸→페이지→완료", () => {
  it("줄 남음 → 다음 줄", () => {
    expect(comicStep(scene, { pi: 0, ci: 0, li: 0 })).toEqual({ kind: "line", pos: { pi: 0, ci: 0, li: 1 } });
  });
  it("칸 끝 → 다음 칸(li 리셋)", () => {
    expect(comicStep(scene, { pi: 0, ci: 0, li: 1 })).toEqual({ kind: "panel", pos: { pi: 0, ci: 1, li: 0 } });
  });
  it("무대사 칸 끝 = 페이지 끝 → 다음 페이지", () => {
    expect(comicStep(scene, { pi: 0, ci: 1, li: 0 })).toEqual({ kind: "page", pos: { pi: 1, ci: 0, li: 0 } });
  });
  it("마지막 → complete", () => {
    expect(comicStep(scene, { pi: 1, ci: 0, li: 0 })).toEqual({ kind: "complete" });
  });
  it("범위 밖 pos 는 클램프(연타 가드)", () => {
    expect(comicStep(scene, { pi: 9, ci: 9, li: 9 })).toEqual({ kind: "complete" });
  });
});

describe("autoAdvanceMs — 무대사/hold/AUTO", () => {
  it("무대사 칸 = 기본 1200, hold 있으면 hold", () => {
    expect(autoAdvanceMs({ rect: [0, 0, 1, 1] }, 0, false)).toBe(1200);
    expect(autoAdvanceMs({ rect: [0, 0, 1, 1], hold: 800 }, 0, false)).toBe(800);
  });
  it("대사 줄: hold 우선, 없으면 AUTO 일 때만 text.length*45+900", () => {
    const p = { rect: [0, 0, 1, 1] as [number, number, number, number], lines: [{ text: "abcd" }] };
    expect(autoAdvanceMs(p, 0, false)).toBeNull();
    expect(autoAdvanceMs(p, 0, true)).toBe(4 * 45 + 900);
    expect(autoAdvanceMs({ ...p, hold: 300 }, 0, false)).toBe(300);
  });
});
