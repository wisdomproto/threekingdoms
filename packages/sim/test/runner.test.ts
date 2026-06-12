import { describe, it, expect } from "vitest";
import { runBattle } from "../src/runner";

describe("runBattle", () => {
  it("같은 시드 = 같은 결과 (결정론 회귀 방지)", () => {
    const a = runBattle("05-sishuiguan", 42);
    const b = runBattle("05-sishuiguan", 42);
    expect(a).toEqual(b);
  });

  it("결과는 victory/defeat/timeout 중 하나이고 턴 수가 기록된다", () => {
    const r = runBattle("05-sishuiguan", 7);
    expect(["victory", "defeat", "timeout"]).toContain(r.result);
    expect(r.turns).toBeGreaterThanOrEqual(1);
    expect(r.playerRetreats).toBeGreaterThanOrEqual(0);
  });

  it("maxTurns에 걸리면 timeout", () => {
    const r = runBattle("05-sishuiguan", 42, 1); // 1턴 제한
    expect(["victory", "defeat", "timeout"]).toContain(r.result);
    expect(r.turns).toBeLessThanOrEqual(2);
  });
});
