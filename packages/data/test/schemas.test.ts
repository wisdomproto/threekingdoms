import { describe, it, expect } from "vitest";
import {
  CommanderSchema, UnitClassSchema, TerrainSchema, ItemSchema,
  CombatConfigSchema, BattleMapSchema, StageSchema, StageEventSchema,
} from "../src/schemas";

describe("스키마 v2 (원작 모델)", () => {
  it("장수: 통솔/무력/지력 1~100", () => {
    expect(() => CommanderSchema.parse({
      id: "관우", name: "관우", leadership: 100, war: 98, intelligence: 80, faceId: 1,
    })).not.toThrow();
    expect(() => CommanderSchema.parse({
      id: "x", name: "x", leadership: 101, war: 50, intelligence: 50, faceId: 0,
    })).toThrow();
  });

  it("병종: 승급 라인/티어/지형등급/사거리", () => {
    expect(() => UnitClassSchema.parse({
      id: "lightCavalry", name: "경기병", code: 6, baseAtk: 120, baseDef: 60,
      move: 6, rangeMin: 1, rangeMax: 1, line: "cavalry", tier: 1, moveClass: "cavalry",
    })).not.toThrow();
    expect(() => UnitClassSchema.parse({
      id: "x", name: "x", code: 0, baseAtk: 80, baseDef: 80,
      move: 4, rangeMin: 2, rangeMax: 1, line: "infantry", tier: 1, moveClass: "foot",
    })).toThrow(); // rangeMin > rangeMax
  });

  it("아이템: 분류/효과치/% 보정", () => {
    expect(() => ItemSchema.parse({
      id: "청룡언월도", name: "청룡언월도", category: "weapon", power: 255, bonusPercent: 12,
    })).not.toThrow();
    expect(() => ItemSchema.parse({
      id: "x", name: "x", category: "snack", power: 0, bonusPercent: 0,
    })).toThrow(); // 잘못된 분류
  });

  it("전투 설정: 원작 상수 형태", () => {
    expect(() => CombatConfigSchema.parse({
      advantageDefFactor: 0.75, disadvantageDefFactor: 1.25,
      counterRatio: 0.5, minDamage: 1, maxTurns: 30,
      lineAdvantage: { cavalry: "infantry", infantry: "archer", archer: "cavalry" },
    })).not.toThrow();
  });

  it("맵: tiles 행 길이 검증 (v0 메커니즘 계승)", () => {
    expect(() => BattleMapSchema.parse({
      id: "m", name: "m", width: 3, height: 1,
      tileLegend: { ".": "plain" }, tiles: [".."],
    })).toThrow();
  });

  it("스테이지: 배치에 병종/레벨/병력 포함, 맵은 id 참조", () => {
    expect(() => StageSchema.parse({
      id: "s", name: "s", mapId: "sishuiguan", turnLimit: 30,
      units: [{ commanderId: "관우", classId: "lightCavalry", level: 1, troops: 1120,
                items: ["청룡언월도"], side: "player", x: 0, y: 0 }],
      victory: { kind: "defeatUnit", unitId: "화웅" },
      defeat: { kind: "lordRetreat", unitId: "유비" },
      events: [],
    })).not.toThrow();
  });

  it("M3① objectives/failConditions: 새 목표 시스템 파싱", () => {
    expect(() => StageSchema.parse({
      id: "s", name: "s", mapId: "m", turnLimit: 30,
      units: [{ commanderId: "관우", classId: "lightCavalry", level: 1, troops: 100,
                items: [], side: "player", x: 0, y: 0 }],
      objectives: [
        { kind: "reachTile", unitId: "관우", x: 5, y: 5 },
        { kind: "surviveTurns", turns: 10, optional: true },
        { kind: "captureTile", x: 3, y: 3 },
      ],
      failConditions: [
        { kind: "unitRetreated", unitId: "유비" },
        { kind: "allRetreated", unitIds: ["백성1", "백성2"] },
        { kind: "turnLimitExceeded" },
      ],
      events: [],
    })).not.toThrow();
  });

  it("M3① reinforcements/strategyConditions: 트리거·보상 파싱", () => {
    expect(() => StageSchema.parse({
      id: "s", name: "s", mapId: "m", turnLimit: 30,
      units: [{ commanderId: "관우", classId: "lightCavalry", level: 1, troops: 100,
                items: [], side: "player", x: 0, y: 0 }],
      objectives: [{ kind: "defeatAll" }],
      reinforcements: [{
        id: "r1", side: "enemy",
        trigger: { kind: "turn", turn: 6 },
        units: [{ commanderId: "태사자", classId: "lightCavalry", level: 5, troops: 120,
                  items: [], side: "enemy", x: 1, y: 1 }],
      }],
      strategyConditions: [{
        id: "sc1", description: "일기토 순서",
        trigger: { kind: "duelsInOrder", duelIds: ["dA", "dB"] },
        reward: { treasures: ["적로"], gold: 200 },
      }],
      events: [],
    })).not.toThrow();
  });

  it("M3① objectives도 victory도 없으면 거부 (승리 계약 필수)", () => {
    expect(() => StageSchema.parse({
      id: "s", name: "s", mapId: "m", turnLimit: 30, units: [], events: [],
    })).toThrow();
    // 빈 objectives 배열도 거부 (victory 없음)
    expect(() => StageSchema.parse({
      id: "s", name: "s", mapId: "m", turnLimit: 30, units: [], objectives: [], events: [],
    })).toThrow();
  });

  it("일기토 이벤트: winnerId 교차 검증 유지", () => {
    expect(() => StageEventSchema.parse({
      id: "e", type: "duel",
      trigger: { kind: "attack", attackerId: "관우", defenderId: "화웅" },
      outcome: { winnerId: "장비", loserRetreats: true }, once: true,
    })).toThrow();
  });

  it("lineAdvantage: 키와 값 모두 Line enum 검증", () => {
    // 유효: 모든 키·값이 Line enum 범위
    expect(() => CombatConfigSchema.parse({
      advantageDefFactor: 0.75, disadvantageDefFactor: 1.25,
      counterRatio: 0.5, minDamage: 0, maxTurns: 50,
      lineAdvantage: { cavalry: "infantry", infantry: "archer" },
    })).not.toThrow();

    // 키가 invalid Line → throw
    expect(() => CombatConfigSchema.parse({
      advantageDefFactor: 0.75, disadvantageDefFactor: 1.25,
      counterRatio: 0.5, minDamage: 0, maxTurns: 50,
      lineAdvantage: { notALine: "infantry" },
    })).toThrow();

    // 값이 invalid Line → throw
    expect(() => CombatConfigSchema.parse({
      advantageDefFactor: 0.75, disadvantageDefFactor: 1.25,
      counterRatio: 0.5, minDamage: 0, maxTurns: 50,
      lineAdvantage: { cavalry: "notALine" },
    })).toThrow();
  });

  it("lineAdvantage: 자기참조 금지 (k !== v)", () => {
    expect(() => CombatConfigSchema.parse({
      advantageDefFactor: 0.75, disadvantageDefFactor: 1.25,
      counterRatio: 0.5, minDamage: 0, maxTurns: 50,
      lineAdvantage: { cavalry: "cavalry" },
    })).toThrow("lineAdvantage must not be self-referential");
  });

  it("tileLegend: 키 길이 정확히 1글자", () => {
    // 유효: 1글자
    expect(() => BattleMapSchema.parse({
      id: "m", name: "m", width: 2, height: 2,
      tileLegend: { ".": "plain", "*": "wall" }, tiles: [".*", "*."],
    })).not.toThrow();

    // 2글자 키 → throw
    expect(() => BattleMapSchema.parse({
      id: "m", name: "m", width: 2, height: 2,
      tileLegend: { ".": "plain", "**": "wall" }, tiles: [".*", "*."],
    })).toThrow();

    // 0글자 키 → throw
    expect(() => BattleMapSchema.parse({
      id: "m", name: "m", width: 1, height: 1,
      tileLegend: { "": "plain" }, tiles: ["."],
    })).toThrow();
  });
});
