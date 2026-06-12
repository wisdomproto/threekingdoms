import { describe, it, expect } from "vitest";
import { nextRandom } from "../src/rng";

describe("시드 RNG", () => {
  it("같은 상태 → 같은 결과 (결정론)", () => {
    const [v1, s1] = nextRandom(42);
    const [v2, s2] = nextRandom(42);
    expect(v1).toBe(v2);
    expect(s1).toBe(s2);
  });
  it("0 이상 1 미만 값을 내고 상태가 전진한다", () => {
    const [v, s] = nextRandom(42);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    expect(s).not.toBe(42);
  });
});
