import { describe, it, expect } from "vitest";
import { gameData } from "../src/index";

describe("게임 데이터 v2 무결성", () => {
  it("영걸전 병종 19종(코드 0~18) + 조조전 추가 병종(19+, 책사 등)", () => {
    const codes = Object.values(gameData.unitClasses).map((c) => c.code).sort((a, b) => a - b);
    // 코드 0~18 = 영걸전 19종 전부 존재
    for (let i = 0; i < 19; i++) expect(codes).toContain(i);
    // 책사(조조전 caster, code 19) = 책략 보유 병종
    expect(gameData.unitClasses["strategist"]!.code).toBe(19);
    expect(gameData.unitClasses["strategist"]!.strategies.length).toBeGreaterThan(0);
    // 코드 중복 없음
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("병종의 책략은 strategies.json에 존재 (참조 무결성)", () => {
    for (const cls of Object.values(gameData.unitClasses)) {
      for (const sid of cls.strategies) {
        expect(gameData.strategies[sid], `${cls.id} → ${sid}`).toBeDefined();
      }
    }
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

  it("장수 데이터가 조조전 스탯으로 이식됨 (관우/여포, ×2 스케일)", () => {
    // 맵=영걸전 / 시스템=조조전 (CLAUDE.md §2-9). commanders 스탯은 조조전 DATA.E5 값 ×2.
    expect(gameData.commanders["관우"]).toMatchObject({ leadership: 98, war: 96, intelligence: 90 });
    expect(gameData.commanders["여포"]!.war).toBe(100);
    expect(Object.keys(gameData.commanders).length).toBeGreaterThan(300);
  });

  it("초기 편성의 classId·아이템이 전부 실존 참조", () => {
    for (const f of Object.values(gameData.initialForces)) {
      expect(gameData.unitClasses[f.classId], f.commanderId).toBeDefined();
      expect(gameData.commanders[f.commanderId]).toBeDefined();
      for (const it of f.items) expect(gameData.items[it], it).toBeDefined();
    }
  });

  it("사수관 맵: 56×32, legend의 지형이 전부 실존", () => {
    const m = gameData.maps["sishuiguan"]!;
    expect(m.width).toBe(56);
    expect(m.height).toBe(32);
    for (const tid of Object.values(m.tileLegend)) expect(gameData.terrains[tid], tid).toBeDefined();
  });

  it("사수관 스테이지: 참조 무결성 (장수/병종/아이템/맵/이벤트)", () => {
    const s = gameData.stages["05-sishuiguan"]!;
    const m = gameData.maps[s.mapId]!;
    expect(m).toBeDefined();
    const placed = new Set(s.units.map((u) => u.commanderId));
    for (const u of s.units) {
      expect(gameData.commanders[u.commanderId], u.commanderId).toBeDefined();
      expect(gameData.unitClasses[u.classId], u.classId).toBeDefined();
      for (const it of u.items) expect(gameData.items[it], it).toBeDefined();
      expect(u.x).toBeLessThan(m.width);
      expect(u.y).toBeLessThan(m.height);
      // 배치 타일이 통행 가능해야 한다 (성벽/하천 위 배치 금지)
      const terrainId = m.tileLegend[m.tiles[u.y]![u.x]!]!;
      expect(gameData.terrains[terrainId]!.moveCost.default).toBeLessThan(99);
    }
    if ("unitId" in s.victory) expect(placed.has(s.victory.unitId)).toBe(true);
    expect(placed.has(s.defeat.unitId)).toBe(true);
    for (const e of s.events) {
      expect(placed.has(e.trigger.attackerId)).toBe(true);
      expect(placed.has(e.trigger.defenderId)).toBe(true);
    }
  });

  it("사수관: 아군 병종은 원작 편성과 일치, 병력은 조조전 스케일(~100)", () => {
    // 병종(classId)은 원작 초기 편성 유지. 병력(troops)은 조조전 hp 스케일(~100~150)로
    // 재조정됨 — 영걸전 천 단위가 아님 (combat.ts 조조전 공식과 짝). docs/reference/sosoden-combat-formula.md
    const s = gameData.stages["05-sishuiguan"]!;
    for (const name of ["유비", "관우", "장비"]) {
      const u = s.units.find((x) => x.commanderId === name)!;
      const f = gameData.initialForces[name]!;
      expect(u.classId).toBe(f.classId);
      expect(u.troops).toBeGreaterThan(0);
      expect(u.troops).toBeLessThanOrEqual(300); // 조조전 스케일
    }
  });
});
