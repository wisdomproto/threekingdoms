import { describe, it, expect } from "vitest";
import { gameData } from "../src/index";

describe("게임 데이터 v2 무결성", () => {
  it("병종 19종이 원작 코드 0~18과 1:1", () => {
    const codes = Object.values(gameData.unitClasses).map((c) => c.code).sort((a, b) => a - b);
    expect(codes).toEqual(Array.from({ length: 19 }, (_, i) => i));
  });

  it("원작 명시 기초치 스팟 체크 (레퍼런스 §5)", () => {
    const c = gameData.unitClasses;
    expect(c["footman"]).toMatchObject({ baseAtk: 80, baseDef: 80, move: 4 });
    expect(c["chariot"]).toMatchObject({ baseAtk: 120, baseDef: 160 });
    expect(c["lightCavalry"]).toMatchObject({ baseAtk: 120, baseDef: 60, move: 6 });
    expect(c["guardCavalry"]).toMatchObject({ baseAtk: 160, baseDef: 120, move: 6 });
    expect(c["catapult"]).toMatchObject({ move: 3, rangeMax: 3 });
    expect(c["archer"]).toMatchObject({ rangeMin: 2, rangeMax: 2 });
  });

  it("승급 라인이 3단계로 완결된다", () => {
    for (const line of ["infantry", "archer", "cavalry", "bandit"] as const) {
      const tiers = Object.values(gameData.unitClasses)
        .filter((c) => c.line === line).map((c) => c.tier).sort();
      expect(tiers).toEqual([1, 2, 3]);
    }
  });

  it("지형: 원작 guard/이동 수치 (레퍼런스 §5 지형 표)", () => {
    const t = gameData.terrains;
    expect(t["plain"]!.guard).toBe(0);
    expect(t["forest"]!).toMatchObject({ guard: 0.2, moveCost: expect.objectContaining({ default: 2, archerFoot: 3 }) });
    expect(t["mountain"]!).toMatchObject({ guard: 0.3, moveCost: expect.objectContaining({ default: 2, cavalry: 3, bandit: 1 }) });
    expect(t["river"]!.moveCost.default).toBeGreaterThanOrEqual(99);
    expect(t["barracks"]!.healTroopsRatio).toBe(0.1);
  });

  it("전투 설정: 원작 상수", () => {
    expect(gameData.combat).toMatchObject({
      advantageDefFactor: 0.75, disadvantageDefFactor: 1.25, counterRatio: 0.5, maxTurns: 30,
    });
    expect(gameData.combat.lineAdvantage).toEqual({
      cavalry: "infantry", infantry: "archer", archer: "cavalry",
    });
  });

  it("레코드 키와 id 필드가 일치한다", () => {
    for (const [k, v] of Object.entries(gameData.terrains)) expect(v.id).toBe(k);
    for (const [k, v] of Object.entries(gameData.unitClasses)) expect(v.id).toBe(k);
  });
});
