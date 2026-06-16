import { describe, it, expect } from "vitest";
import { gameData } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { testCtx, testStage, testMap } from "./fixtures";

describe("createBattle v2 (원작 모델)", () => {
  const state = createBattle(testCtx, 42);

  it("병력/사기/레벨이 스테이지 배치대로 해석된다", () => {
    const guanyu = state.units.find((u) => u.id === "관우")!;
    expect(guanyu).toMatchObject({ troops: 1120, maxTroops: 1120, morale: 100, level: 1, side: "player" });
  });

  it("장수 3능력치 + 병종 기초치가 유닛에 들어간다", () => {
    const guanyu = state.units.find((u) => u.id === "관우")!;
    expect(guanyu).toMatchObject({ war: 98, leadership: 100, intelligence: 80 }); // 관우 원작 수치
    expect(guanyu).toMatchObject({ baseAtk: 120, baseDef: 60, move: 6, line: "cavalry", moveClass: "cavalry" }); // 경기병
  });

  it("무기 보정: 청룡언월도 +12% → weaponBonus 1.12, 무기 없으면 1.0", () => {
    expect(state.units.find((u) => u.id === "관우")!.weaponBonus).toBeCloseTo(1.12, 5);
    expect(state.units.find((u) => u.id === "유비")!.weaponBonus).toBe(1.0);
  });

  it("책략치 MP = (레벨+10)×지력÷40 내림 (레퍼런스 §6)", () => {
    // 관우 Lv1 지력 80 → 11×80/40 = 22
    expect(state.units.find((u) => u.id === "관우")!.mp).toBe(22);
  });

  it("턴 1, 아군 페이즈, ongoing, rngState=seed", () => {
    expect(state).toMatchObject({ turn: 1, phase: "player", status: "ongoing", rngState: 42 });
  });

  it("미지의 commanderId/classId/mapId는 에러", () => {
    const bad = { ...testStage, units: [{ ...testStage.units[0]!, commanderId: "없는장수" }] };
    expect(() => createBattle({ data: gameData, stage: bad, map: testMap }, 1)).toThrow("없는장수");
  });

  it("아이템 효과(§7): 적토마 장착 시 이동력 +2", () => {
    // 유비(보병 move4)에게 적토마 부여 → move 6, 미장착 유비는 4
    const stage2 = {
      ...testStage,
      units: testStage.units.map((u) => (u.commanderId === "유비" ? { ...u, items: ["적토마"] } : u)),
    };
    const s2 = createBattle({ ...testCtx, stage: stage2 }, 42);
    const yoo = s2.units.find((u) => u.id === "유비")!;
    expect(yoo.move).toBe(5); // footman 4 + 적토마 1 (이동 범위)
    expect(yoo.baseMove).toBe(4); // 연속공격 판정은 병종 기본(말 보너스 제외)
    expect(state.units.find((u) => u.id === "유비")!.move).toBe(4); // 미장착 = 기본
  });

  it("전투 특성(Phase C): 아이템 effects가 UnitState에 집약된다", () => {
    const item = {
      id: "관통검", name: "관통검", category: "weapon" as const, power: 255, bonusPercent: 0,
      effects: { noCounter: true, multiHit: 3, counterStrikes: 2, flatDamagePerLevel: 15, alwaysHit: true },
    };
    const data = { ...gameData, items: { ...gameData.items, 관통검: item } };
    const stage = { ...testStage, units: testStage.units.map((u) => (u.commanderId === "관우" ? { ...u, items: ["관통검"] } : u)) };
    const u = createBattle({ data, stage, map: testMap }, 1).units.find((x) => x.id === "관우")!;
    expect(u).toMatchObject({ noCounter: true, multiHit: 3, counterStrikes: 2, flatDamagePerLevel: 15, alwaysHit: true });
    // 미보유 유닛은 트레잇 미설정(기본 동작)
    const plain = createBattle(testCtx, 1).units.find((x) => x.id === "유비")!;
    expect(plain.multiHit).toBeUndefined();
    expect(plain.noCounter).toBeUndefined();
  });
});
