import { describe, it, expect } from "vitest";
import { unitStats } from "../unitStats";

describe("unitStats (전력 — 전투 엔진 재사용)", () => {
  it("결정론 + power = atk + def", () => {
    const base = unitStats("관우", "lightCavalry", 1, []);
    expect(unitStats("관우", "lightCavalry", 1, [])).toEqual(base); // 결정론
    expect(base.power).toBe(base.atk + base.def);
  });
  it("청룡언월도 장착 시 전력 ≥ 미장착(무기 보정)", () => {
    const bare = unitStats("관우", "lightCavalry", 1, []);
    const armed = unitStats("관우", "lightCavalry", 1, ["청룡언월도"]);
    expect(armed.power).toBeGreaterThanOrEqual(bare.power);
  });
});
