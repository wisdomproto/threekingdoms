import { describe, expect, it } from "vitest";
import { TILE_SIZE, depthOf, gridToWorld, worldToGrid } from "../projection";

describe("projection", () => {
  it("TILE_SIZE는 48 (설계 §1)", () => {
    expect(TILE_SIZE).toBe(48);
  });

  it("gridToWorld는 타일 중심을 반환한다", () => {
    expect(gridToWorld({ x: 0, y: 0 })).toEqual({ x: 24, y: 24 });
    expect(gridToWorld({ x: 3, y: 2 })).toEqual({ x: 3 * 48 + 24, y: 2 * 48 + 24 });
  });

  it("worldToGrid ∘ gridToWorld 항등 — 경계 (0,0)·(55,31) 포함 (사수관 56×32)", () => {
    const cases = [
      { x: 0, y: 0 },
      { x: 55, y: 31 },
      { x: 55, y: 0 },
      { x: 0, y: 31 },
      { x: 17, y: 9 },
    ];
    for (const c of cases) {
      expect(worldToGrid(gridToWorld(c))).toEqual(c);
    }
  });

  it("worldToGrid는 타일 내부 임의 점을 해당 타일로 분류한다 (floor 경계 포함)", () => {
    expect(worldToGrid({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(worldToGrid({ x: 47.999, y: 47.999 })).toEqual({ x: 0, y: 0 });
    expect(worldToGrid({ x: 48, y: 48 })).toEqual({ x: 1, y: 1 });
    expect(worldToGrid({ x: 55 * 48 + 47, y: 31 * 48 + 1 })).toEqual({ x: 55, y: 31 });
  });

  it("depthOf는 y에 대해 단조 증가 (zIndex 정렬 계약)", () => {
    for (let y = 0; y < 31; y++) {
      expect(depthOf(y + 1)).toBeGreaterThan(depthOf(y));
    }
  });
});
