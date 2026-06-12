import { describe, it, expect } from "vitest";
import {
  TerrainSchema,
  UnitClassSchema,
  CommanderSchema,
  CombatConfigSchema,
  StageEventSchema,
  StageSchema,
} from "../src/schemas";

describe("스키마 검증", () => {
  it("지형: 정상 데이터 통과", () => {
    expect(() =>
      TerrainSchema.parse({
        id: "plain",
        name: "평지",
        guard: 0,
        moveCost: { default: 1 },
      })
    ).not.toThrow();
  });

  it("지형: guard 범위(0~0.9) 밖이면 거부", () => {
    expect(() =>
      TerrainSchema.parse({
        id: "x",
        name: "x",
        guard: 1.5,
        moveCost: { default: 1 },
      })
    ).toThrow();
  });

  it("병종: 사거리 min > max면 거부", () => {
    expect(() =>
      UnitClassSchema.parse({
        id: "archer",
        name: "궁병",
        move: 4,
        rangeMin: 2,
        rangeMax: 1,
      })
    ).toThrow();
  });

  it("장수: 음수 스탯 거부", () => {
    expect(() =>
      CommanderSchema.parse({
        id: "x",
        name: "x",
        classId: "infantry",
        level: 1,
        stats: { hp: -1, mp: 0, atk: 10, def: 10, int: 10 },
      })
    ).toThrow();
  });

  it("스테이지: 맵 타일 행 길이가 width와 다르면 거부", () => {
    expect(() =>
      StageSchema.parse({
        id: "s",
        name: "s",
        map: {
          width: 3,
          height: 1,
          tileLegend: { ".": "plain" },
          tiles: [".."],
        },
        units: [],
        victory: { kind: "defeatAll" },
        defeat: { kind: "lordRetreat", unitId: "liubei" },
        events: [],
      })
    ).toThrow();
  });

  it("전투 계수: 정상 데이터 통과", () => {
    expect(() =>
      CombatConfigSchema.parse({
        defFactor: 0.5,
        levelCoef: 0.05,
        minDamage: 1,
        varianceRatio: 0.1,
        classAdvantage: { cavalry: { infantry: 1.3 } },
      })
    ).not.toThrow();
  });

  it("전투 계수: 음수 defFactor 거부", () => {
    expect(() => CombatConfigSchema.parse({
      defFactor: -0.5, levelCoef: 0.05, minDamage: 1, varianceRatio: 0.1,
      classAdvantage: { cavalry: { infantry: 1.3 } },
    })).toThrow();
  });

  it("일기토 이벤트: winnerId가 참가자가 아니면 거부", () => {
    expect(() => StageEventSchema.parse({
      id: "e", type: "duel",
      trigger: { kind: "attack", attackerId: "guanyu", defenderId: "huaxiong" },
      outcome: { winnerId: "zhangfei", loserRetreats: true },
      once: true,
    })).toThrow();
  });
});
