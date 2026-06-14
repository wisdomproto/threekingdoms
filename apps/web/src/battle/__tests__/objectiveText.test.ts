/**
 * 목표→한국어 명령형 텍스트 순수 로직 테스트 (인배틀 목표 오버레이).
 * ObjectiveBanner 연출은 React라 제외 — 텍스트/조사/표시모델 산출만 검증.
 */
import { describe, it, expect } from "vitest";
import type { Objective, FailCondition } from "@tk/data";
import {
  hasFinalConsonant,
  objectParticle,
  directionParticle,
  objectiveText,
  failConditionText,
  legacyVictoryText,
  legacyDefeatText,
  turnLimitText,
  buildObjectiveDisplay,
} from "../objectiveText";

describe("한국어 조사 처리", () => {
  it("받침 유무 판정", () => {
    expect(hasFinalConsonant("화웅")).toBe(true); // ㅇ 받침
    expect(hasFinalConsonant("유비")).toBe(false); // 받침 없음
    expect(hasFinalConsonant("관우")).toBe(false);
    expect(hasFinalConsonant("동탁")).toBe(true);
    expect(hasFinalConsonant("")).toBe(false);
    expect(hasFinalConsonant("Lu Bu")).toBe(false); // 비한글 → 받침 없음
  });

  it("목적격 을/를", () => {
    expect(objectParticle("화웅")).toBe("을");
    expect(objectParticle("유비")).toBe("를");
    expect(objectParticle("적")).toBe("을");
  });

  it("방향격 으로/로", () => {
    expect(directionParticle("성문")).toBe("으로"); // ㄴ 받침
    expect(directionParticle("나루")).toBe("로"); // 받침 없음
    expect(directionParticle("강하")).toBe("로");
    expect(directionParticle("관문")).toBe("으로");
    // 받침 ㄹ 예외 → '로'
    expect(directionParticle("서울")).toBe("로");
  });
});

describe("objectiveText — 명령형", () => {
  it("defeatUnit → 쓰러뜨려라", () => {
    expect(objectiveText({ kind: "defeatUnit", unitId: "화웅", optional: false })).toBe(
      "화웅을 쓰러뜨려라!",
    );
    expect(objectiveText({ kind: "defeatUnit", unitId: "여포", optional: false })).toBe(
      "여포를 쓰러뜨려라!",
    );
  });

  it("nameOf로 이름 해석", () => {
    const nameOf = (id: string) => ({ lubu: "여포" })[id] ?? id;
    expect(
      objectiveText({ kind: "defeatUnit", unitId: "lubu", optional: false }, { nameOf }),
    ).toBe("여포를 쓰러뜨려라!");
  });

  it("defeatAll → 전멸", () => {
    expect(objectiveText({ kind: "defeatAll", optional: false })).toBe("적을 전멸시켜라!");
  });

  it("surviveTurns → 버텨라", () => {
    expect(objectiveText({ kind: "surviveTurns", turns: 20, optional: false })).toBe(
      "20턴을 버텨라!",
    );
  });

  it("reachTile (unitId 있음) → 탈출시켜라 + 지명", () => {
    const tileNameOf = () => "성문";
    expect(
      objectiveText({ kind: "reachTile", unitId: "유비", x: 3, y: 4, optional: false }, { tileNameOf }),
    ).toBe("유비를 성문으로 탈출시켜라!");
  });

  it("reachTile (지명 없음) → 좌표 라벨", () => {
    expect(
      objectiveText({ kind: "reachTile", unitId: "유비", x: 3, y: 4, optional: false }),
    ).toBe("유비를 (3, 4)로 탈출시켜라!");
  });

  it("reachTile (unitId 없음) → 진군하라", () => {
    const tileNameOf = () => "관문";
    expect(
      objectiveText({ kind: "reachTile", x: 1, y: 2, optional: false }, { tileNameOf }),
    ).toBe("관문으로 진군하라!");
  });

  it("captureTile → 점령하라", () => {
    const tileNameOf = () => "성채";
    expect(
      objectiveText({ kind: "captureTile", x: 0, y: 0, side: "player", optional: false }, { tileNameOf }),
    ).toBe("성채를 점령하라!");
  });
});

describe("failConditionText", () => {
  it("unitRetreated → 퇴각 시 패배", () => {
    expect(failConditionText({ kind: "unitRetreated", unitId: "유비" })).toBe("유비 퇴각 시 패배");
  });

  it("allRetreated (다수) → 등 전멸", () => {
    expect(failConditionText({ kind: "allRetreated", unitIds: ["백성1", "백성2"] })).toBe(
      "백성1 등 전멸 시 패배",
    );
  });

  it("allRetreated (단일)", () => {
    expect(failConditionText({ kind: "allRetreated", unitIds: ["백성"] })).toBe("백성 전멸 시 패배");
  });

  it("turnLimitExceeded", () => {
    expect(failConditionText({ kind: "turnLimitExceeded" })).toBe("제한 턴 초과 시 패배");
  });
});

describe("레거시 victory/defeat", () => {
  it("legacyVictoryText", () => {
    expect(legacyVictoryText({ kind: "defeatAll" })).toBe("적을 전멸시켜라!");
    expect(legacyVictoryText({ kind: "defeatUnit", unitId: "화웅" })).toBe("화웅을 쓰러뜨려라!");
  });
  it("legacyDefeatText", () => {
    expect(legacyDefeatText({ kind: "lordRetreat", unitId: "유비" })).toBe("유비 퇴각 시 패배");
  });
});

describe("turnLimitText", () => {
  it("제한 N턴", () => {
    expect(turnLimitText(20)).toBe("제한 20턴");
  });
});

describe("buildObjectiveDisplay", () => {
  it("objectives 기반 (사수관 형태): 필수+패배+제한턴", () => {
    const objectives: Objective[] = [{ kind: "defeatUnit", unitId: "화웅", optional: false }];
    const failConditions: FailCondition[] = [{ kind: "unitRetreated", unitId: "유비" }];
    const d = buildObjectiveDisplay({ turnLimit: 30, objectives, failConditions });
    expect(d.primary).toEqual(["화웅을 쓰러뜨려라!"]);
    expect(d.bonus).toEqual([]);
    expect(d.fails).toEqual(["유비 퇴각 시 패배"]);
    expect(d.turnLimit).toBe("제한 30턴");
  });

  it("optional 목표는 bonus로 분리", () => {
    const objectives: Objective[] = [
      { kind: "defeatAll", optional: false },
      { kind: "captureTile", x: 1, y: 1, side: "player", optional: true },
    ];
    const d = buildObjectiveDisplay({ turnLimit: 20, objectives });
    expect(d.primary).toEqual(["적을 전멸시켜라!"]);
    // 좌표 라벨 끝(`)`)은 비한글 → 받침 없음 → "를"
    expect(d.bonus).toEqual(["(1, 1)를 점령하라!"]);
  });

  it("objectives 없으면 레거시 victory/defeat 폴백", () => {
    const d = buildObjectiveDisplay({
      turnLimit: 15,
      victory: { kind: "defeatAll" },
      defeat: { kind: "lordRetreat", unitId: "유비" },
    });
    expect(d.primary).toEqual(["적을 전멸시켜라!"]);
    expect(d.fails).toEqual(["유비 퇴각 시 패배"]);
  });

  it("nameOf 주입 전달", () => {
    const objectives: Objective[] = [{ kind: "defeatUnit", unitId: "lubu", optional: false }];
    const failConditions: FailCondition[] = [{ kind: "unitRetreated", unitId: "lord" }];
    const nameOf = (id: string) => ({ lubu: "여포", lord: "유비" })[id] ?? id;
    const d = buildObjectiveDisplay({ turnLimit: 20, objectives, failConditions }, { nameOf });
    expect(d.primary).toEqual(["여포를 쓰러뜨려라!"]);
    expect(d.fails).toEqual(["유비 퇴각 시 패배"]);
  });
});
