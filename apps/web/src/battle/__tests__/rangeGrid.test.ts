/**
 * rangeGrid 단위 테스트 (Tier 2-2 공격범위 그리드 §8-7).
 *
 * 계약:
 *  - 격자 한 변 = 2*radius+1 (홀수), radius = max(2, rangeMax). 근접도 최소 5×5.
 *  - 정중앙(dx=dy=0) = "center" 정확히 1개.
 *  - "donut" = rangeMin ≤ manhattan ≤ rangeMax 인 칸. 나머지 = "blank".
 *  - 간접공격(rangeMin>1): 도넛 안쪽 근접 칸은 blank.
 *  - 입력 정규화: 음수/NaN/역전(min>max) 방어.
 */
import { describe, expect, it } from "vitest";
import { rangeGrid } from "../rangeGrid";
import type { RangeCell } from "../rangeGrid";

function cellAt(cells: RangeCell[], dx: number, dy: number): RangeCell | undefined {
  return cells.find((c) => c.dx === dx && c.dy === dy);
}

describe("rangeGrid", () => {
  it("근접(1~1)은 5×5, 중앙 1개 + 상하좌우 4칸이 donut", () => {
    const g = rangeGrid(1, 1);
    expect(g.size).toBe(5);
    expect(g.radius).toBe(2);
    expect(g.cells.length).toBe(25);

    const center = g.cells.filter((c) => c.kind === "center");
    expect(center.length).toBe(1);
    expect(cellAt(g.cells, 0, 0)?.kind).toBe("center");

    // 4이웃 = donut
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      expect(cellAt(g.cells, dx, dy)?.kind).toBe("donut");
    }
    expect(g.cells.filter((c) => c.kind === "donut").length).toBe(4);
  });

  it("궁병(2~3)은 7×7, donut = 거리 2·3 칸만, 거리1은 blank(도넛 안쪽)", () => {
    const g = rangeGrid(2, 3);
    expect(g.radius).toBe(3);
    expect(g.size).toBe(7);

    // 거리1 인접 = blank
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      expect(cellAt(g.cells, dx, dy)?.kind).toBe("blank");
    }
    // 거리2·3 = donut
    expect(cellAt(g.cells, 2, 0)?.kind).toBe("donut");
    expect(cellAt(g.cells, 0, 3)?.kind).toBe("donut");
    // 거리4 = blank(사정권 밖)
    // (radius 3 격자엔 (3,1)이 거리4 — 존재함)
    expect(cellAt(g.cells, 3, 1)?.kind).toBe("blank");

    // 모든 donut은 정확히 거리 2~3
    for (const c of g.cells.filter((x) => x.kind === "donut")) {
      const d = Math.abs(c.dx) + Math.abs(c.dy);
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(3);
    }
  });

  it("rangeMax<=2면 5×5로 고정(근접·단사정 동일 틀)", () => {
    expect(rangeGrid(1, 1).size).toBe(5);
    expect(rangeGrid(2, 2).size).toBe(5);
    expect(rangeGrid(1, 2).size).toBe(5);
  });

  it("입력 정규화: 음수·역전·NaN 방어", () => {
    // 역전(min>max) → max를 min까지 끌어올림
    const rev = rangeGrid(3, 1);
    expect(rev.rangeMin).toBe(3);
    expect(rev.rangeMax).toBe(3);
    expect(rev.radius).toBe(3);

    // 음수 → 0
    const neg = rangeGrid(-5, -1);
    expect(neg.rangeMin).toBe(0);
    expect(neg.rangeMax).toBe(0);

    // NaN → 0 (center만, donut 없음)
    const nan = rangeGrid(Number.NaN, Number.NaN);
    expect(nan.rangeMin).toBe(0);
    expect(nan.cells.filter((c) => c.kind === "donut").length).toBe(0);
  });

  it("cells는 행 우선 평탄화, 길이 = size*size", () => {
    const g = rangeGrid(2, 3);
    expect(g.cells.length).toBe(g.size * g.size);
    // 첫 셀 = 좌상단(-radius,-radius), 마지막 = 우하단(radius,radius)
    expect(g.cells[0]).toMatchObject({ dx: -g.radius, dy: -g.radius });
    expect(g.cells[g.cells.length - 1]).toMatchObject({ dx: g.radius, dy: g.radius });
  });
});
