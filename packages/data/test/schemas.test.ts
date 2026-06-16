import { describe, it, expect } from "vitest";
import {
  CommanderSchema, UnitClassSchema, TerrainSchema, ItemSchema,
  CombatConfigSchema, BattleMapSchema, StageSchema, StageEventSchema,
  StageDialogueSchema, ScenarioSceneSchema,
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

  it("C 대사: 5종 트리거 + 말풍선 라인 파싱", () => {
    expect(() => StageDialogueSchema.parse({
      id: "d1", trigger: { kind: "battleStart" },
      lines: [{ speaker: "원술", side: "ally", text: "대사" }],
    })).not.toThrow();
    expect(() => StageDialogueSchema.parse({
      id: "d2", trigger: { kind: "battleEnd", result: "victory" },
      lines: [{ speaker: "관우", text: "이겼다" }],
    })).not.toThrow();
    expect(() => StageDialogueSchema.parse({
      id: "d3", trigger: { kind: "turn", n: 3 },
      lines: [{ speaker: "x", text: "y", portraitId: "p1" }],
    })).not.toThrow();
    expect(() => StageDialogueSchema.parse({
      id: "d4", trigger: { kind: "duelOccurred", duelId: "duel_x" },
      lines: [{ speaker: "화웅", side: "enemy", text: "졸개" }],
    })).not.toThrow();
    expect(() => StageDialogueSchema.parse({
      id: "d5", trigger: { kind: "unitRetreated", unitId: "화웅" },
      lines: [{ speaker: "유비", side: "player", text: "물러섰군" }],
    })).not.toThrow();
    // 잘못된 트리거 종류
    expect(() => StageDialogueSchema.parse({
      id: "bad", trigger: { kind: "nope" }, lines: [{ speaker: "x", text: "y" }],
    })).toThrow();
    // lines 비어있으면 거부
    expect(() => StageDialogueSchema.parse({
      id: "empty", trigger: { kind: "battleStart" }, lines: [],
    })).toThrow();
  });

  it("시나리오 씬: 배경+대사 파싱, Stage.scenario optional 하위호환", () => {
    // ScenarioScene 단독 — bg 선택, lines 최소 1
    expect(() => ScenarioSceneSchema.parse({
      bg: "05-sishuiguan-intro",
      lines: [{ speaker: "유비", side: "player", portraitId: "유비", text: "관문을 넘는다." }],
    })).not.toThrow();
    expect(() => ScenarioSceneSchema.parse({ lines: [{ speaker: "x", text: "y" }] })).not.toThrow(); // bg 생략 가능
    expect(() => ScenarioSceneSchema.parse({ bg: "x", lines: [] })).toThrow(); // 빈 lines 거부

    // Stage.scenario(intro/outro) 통합
    expect(() => StageSchema.parse({
      id: "s", name: "s", mapId: "m", turnLimit: 30,
      units: [{ commanderId: "관우", classId: "lightCavalry", level: 1, troops: 100, items: [], side: "player", x: 0, y: 0 }],
      objectives: [{ kind: "defeatAll" }],
      scenario: {
        intro: { bg: "s-intro", lines: [{ speaker: "유비", text: "출진 전." }] },
        outro: { lines: [{ speaker: "관우", text: "승리 후." }] },
      },
      events: [],
    })).not.toThrow();
    // scenario 미지정 — 기존 스테이지 무파손
    expect(() => StageSchema.parse({
      id: "s2", name: "s2", mapId: "m", turnLimit: 30,
      units: [], victory: { kind: "defeatAll" }, events: [],
    })).not.toThrow();
  });

  it("C 대사: StageSchema에 dialogue 통합 + 하위호환(미지정 허용)", () => {
    // dialogue 포함 스테이지
    expect(() => StageSchema.parse({
      id: "s", name: "s", mapId: "m", turnLimit: 30,
      units: [{ commanderId: "관우", classId: "lightCavalry", level: 1, troops: 100,
                items: [], side: "player", x: 0, y: 0 }],
      objectives: [{ kind: "defeatAll" }],
      dialogue: [{ id: "intro", trigger: { kind: "battleStart" },
                  lines: [{ speaker: "유비", side: "player", text: "출진" }] }],
      events: [],
    })).not.toThrow();
    // dialogue 미지정 — 기존 스테이지 무파손
    expect(() => StageSchema.parse({
      id: "s2", name: "s2", mapId: "m", turnLimit: 30,
      units: [], victory: { kind: "defeatAll" }, events: [],
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

  it("CombatConfig.accuracy 기본값 (미지정 JSON 무파손)", () => {
    const cfg = CombatConfigSchema.parse({
      advantageDefFactor: 0.75, disadvantageDefFactor: 1.25, counterRatio: 0.5,
      minDamage: 1, maxTurns: 30, lineAdvantage: { cavalry: "infantry" },
    });
    expect(cfg.accuracy).toEqual({ missSlope: 0.5, floorPercent: 80 });
  });

  it("Commander.agility는 optional (기존 3스탯 JSON 통과)", () => {
    const c = CommanderSchema.parse({ id: "x", name: "x", leadership: 50, war: 50, intelligence: 50, faceId: 0 });
    expect(c.agility).toBeUndefined();
    const c2 = CommanderSchema.parse({ id: "y", name: "y", leadership: 50, war: 50, intelligence: 50, faceId: 0, agility: 68 });
    expect(c2.agility).toBe(68);
  });

  it("ItemEffects 전투 특성(Phase C) 파싱 + 미지정 무파손", () => {
    const e = ItemSchema.parse({
      id: "t", name: "t", category: "weapon", power: 255, bonusPercent: 0,
      effects: { noCounter: true, multiHit: 3, counterStrikes: 2, flatDamagePerLevel: 15, alwaysHit: true },
    });
    expect(e.effects).toMatchObject({ noCounter: true, multiHit: 3, counterStrikes: 2, flatDamagePerLevel: 15, alwaysHit: true });
    // 기존 effects(말) 무파손
    expect(ItemSchema.parse({ id: "m", name: "말", category: "horse", power: 255, bonusPercent: 0, effects: { move: 1 } }).effects?.multiHit).toBeUndefined();
  });
});
