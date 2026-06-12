import { describe, it, expect } from "vitest";
import { gameData, stages } from "../src/index";

describe("게임 데이터 무결성", () => {
  it("모든 JSON이 스키마를 통과해 로드된다", () => {
    expect(Object.keys(gameData.terrains).length).toBeGreaterThan(0);
    expect(Object.keys(gameData.unitClasses).length).toBeGreaterThan(0);
    expect(Object.keys(gameData.commanders).length).toBeGreaterThan(0);
  });

  it("장수의 classId는 전부 병종 테이블에 존재한다", () => {
    for (const c of Object.values(gameData.commanders)) {
      expect(gameData.unitClasses[c.classId], `${c.id}.classId=${c.classId}`).toBeDefined();
    }
  });

  it("사수관: 배치 유닛의 commanderId가 전부 존재하고 맵 범위 안이다", () => {
    const stage = stages["05-sishuiguan"]!;
    for (const u of stage.units) {
      expect(gameData.commanders[u.commanderId], u.commanderId).toBeDefined();
      expect(u.x).toBeLessThan(stage.map.width);
      expect(u.y).toBeLessThan(stage.map.height);
    }
  });

  it("사수관: 타일 코드가 전부 legend에 있고 legend의 지형이 전부 존재한다", () => {
    const stage = stages["05-sishuiguan"]!;
    for (const row of stage.map.tiles) {
      for (const ch of row) expect(stage.map.tileLegend[ch], `tile '${ch}'`).toBeDefined();
    }
    for (const tid of Object.values(stage.map.tileLegend)) {
      expect(gameData.terrains[tid], tid).toBeDefined();
    }
  });

  it("사수관: 일기토 이벤트 참가자가 전부 배치되어 있다", () => {
    const stage = stages["05-sishuiguan"]!;
    const placed = new Set(stage.units.map((u) => u.commanderId));
    for (const e of stage.events) {
      expect(placed.has(e.trigger.attackerId)).toBe(true);
      expect(placed.has(e.trigger.defenderId)).toBe(true);
    }
  });

  it("사수관: victory/defeat의 unitId가 배치되어 있다", () => {
    const stage = stages["05-sishuiguan"]!;
    const placed = new Set(stage.units.map((u) => u.commanderId));
    if ("unitId" in stage.victory) expect(placed.has(stage.victory.unitId)).toBe(true);
    expect(placed.has(stage.defeat.unitId)).toBe(true);
  });

  it("전투 계수: classAdvantage의 classId가 전부 병종 테이블에 존재한다", () => {
    for (const [atkId, defs] of Object.entries(gameData.combat.classAdvantage)) {
      expect(gameData.unitClasses[atkId], `attacker ${atkId}`).toBeDefined();
      for (const defId of Object.keys(defs)) {
        expect(gameData.unitClasses[defId], `defender ${defId}`).toBeDefined();
      }
    }
  });

  it("레코드 키와 id 필드가 일치한다", () => {
    for (const [k, v] of Object.entries(gameData.terrains)) expect(v.id).toBe(k);
    for (const [k, v] of Object.entries(gameData.unitClasses)) expect(v.id).toBe(k);
    for (const [k, v] of Object.entries(gameData.commanders)) expect(v.id).toBe(k);
  });
});
