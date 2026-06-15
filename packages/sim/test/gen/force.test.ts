/**
 * 전력 측정(§11-B) 테스트 — spawnUnit 합성 후 attackPower+defensePower × troops 스케일.
 * 위치·맵 무관(공식이 troops·위치 무관, balance.ts 동일 전제).
 */
import { describe, it, expect } from "vitest";
import { gameData } from "@tk/data";
import type { StageUnit } from "@tk/data";
import { unitForce, totalForce } from "../../src/gen/force";

function enemy(classId: string, level: number, troops: number): StageUnit {
  return { commanderId: "화웅", classId, level, troops, items: [], side: "enemy", x: 0, y: 0 };
}

describe("unitForce", () => {
  it("양수 전력 산출", () => {
    expect(unitForce(gameData, enemy("footman", 1, 100))).toBeGreaterThan(0);
  });

  it("레벨이 높을수록 전력 단조 증가", () => {
    const lo = unitForce(gameData, enemy("footman", 1, 100));
    const hi = unitForce(gameData, enemy("footman", 10, 100));
    expect(hi).toBeGreaterThan(lo);
  });

  it("병력이 많을수록 전력 단조 증가", () => {
    const lo = unitForce(gameData, enemy("footman", 5, 80));
    const hi = unitForce(gameData, enemy("footman", 5, 160));
    expect(hi).toBeGreaterThan(lo);
  });
});

describe("totalForce", () => {
  it("유닛 전력 합", () => {
    const a = enemy("footman", 3, 100);
    const b = enemy("archer", 3, 90);
    expect(totalForce(gameData, [a, b])).toBeCloseTo(
      unitForce(gameData, a) + unitForce(gameData, b),
      5,
    );
  });
});
