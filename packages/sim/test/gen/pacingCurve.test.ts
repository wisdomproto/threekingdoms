/**
 * 페이싱 커브 예산 할당(§11-B) 테스트 — 순수, 엔진 무관.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CURVE, bandBudgets } from "../../src/gen/pacingCurve";

describe("bandBudgets", () => {
  it("기본 커브 [[20,15],[50,40],[90,100]]는 밴드 전력을 차분으로 배분(합=total)", () => {
    const bands = bandBudgets(DEFAULT_CURVE, 100);
    expect(bands.map((b) => b.atPercent)).toEqual([20, 50, 90]);
    // 누적 15/40/100 → 차분 15/25/60
    expect(bands.map((b) => b.force)).toEqual([15, 25, 60]);
    expect(bands.reduce((a, b) => a + b.force, 0)).toBe(100);
  });

  it("total 스케일에 비례", () => {
    const bands = bandBudgets(DEFAULT_CURVE, 200);
    expect(bands.map((b) => b.force)).toEqual([30, 50, 120]);
    expect(bands.reduce((a, b) => a + b.force, 0)).toBe(200);
  });

  it("마지막 누적이 100 미만이면 마지막 밴드가 잔여 흡수(합 정확)", () => {
    const bands = bandBudgets([[30, 20], [80, 70]], 100);
    // 차분 20 / (70-20=50) 이지만 마지막은 잔여 흡수 → 20 / 80
    expect(bands.map((b) => b.force)).toEqual([20, 80]);
    expect(bands.reduce((a, b) => a + b.force, 0)).toBe(100);
  });

  it("atPercent 오름차순 보장", () => {
    const bands = bandBudgets(DEFAULT_CURVE, 100);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.atPercent).toBeGreaterThan(bands[i - 1]!.atPercent);
    }
  });
});
