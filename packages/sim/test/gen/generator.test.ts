/**
 * 페이싱 생성기(§11-B) 테스트 — generate(결정론·구조) + autoTune(A 하네스 수렴).
 */
import { describe, it, expect } from "vitest";
import { gameData } from "@tk/data";
import type { Stage } from "@tk/data";
import { generate, autoTune, type GenSpec } from "../../src/gen/generator";
import { classify, runMatrixOnStage } from "../../src/reportCard";
import { totalForce } from "../../src/gen/force";

const SPEC: GenSpec = {
  mapId: "sishuiguan",
  spawn: { x: 50, y: 15 },
  goal: { x: 2, y: 14 },
  playerUnits: [
    { commanderId: "유비", classId: "lord", level: 6, troops: 130, items: [], side: "player", x: 50, y: 14 },
    { commanderId: "관우", classId: "lightCavalry", level: 6, troops: 130, items: ["청룡언월도"], side: "player", x: 50, y: 15 },
    { commanderId: "장비", classId: "lightCavalry", level: 6, troops: 130, items: ["사모"], side: "player", x: 50, y: 16 },
  ],
  mookPool: [
    { classId: "footman", troops: 90, level: 3 },
    { classId: "archer", troops: 80, level: 3 },
    { classId: "lightCavalry", troops: 85, level: 3 },
  ],
  boss: { classId: "lightCavalry", troops: 150, level: 5 },
  turnLimit: 30,
};

const enemies = (stage: Stage) => stage.units.filter((u) => u.side === "enemy");

describe("generate", () => {
  it("결정론 — 같은 레시피·knob이면 동일 스테이지", () => {
    expect(generate(SPEC, 1.0)).toEqual(generate(SPEC, 1.0));
  });

  it("보스를 goal 타일에 배치(적장-01)", () => {
    const stage = generate(SPEC, 1.0);
    const boss = stage.units.find((u) => u.commanderId === "적장-01");
    expect(boss).toBeDefined();
    expect({ x: boss!.x, y: boss!.y }).toEqual(SPEC.goal);
    expect(boss!.side).toBe("enemy");
  });

  it("플레이어 유닛 보존 + 적은 비중복 타일", () => {
    const stage = generate(SPEC, 1.0);
    expect(stage.units.filter((u) => u.side === "player").length).toBe(3);
    const ens = enemies(stage);
    expect(ens.length).toBeGreaterThan(1);
    const tiles = new Set(stage.units.map((u) => `${u.x},${u.y}`));
    expect(tiles.size).toBe(stage.units.length); // 전부 고유 타일
  });

  it("knob이 클수록 적 전력 증가(단조)", () => {
    const lo = totalForce(gameData, enemies(generate(SPEC, 0.5)));
    const hi = totalForce(gameData, enemies(generate(SPEC, 2.0)));
    expect(hi).toBeGreaterThan(lo);
  });

  it("생성 적 commanderId가 전부 유일(엔진 유닛 구분 보장)", () => {
    const ens = enemies(generate(SPEC, 1.5));
    const ids = ens.map((u) => u.commanderId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("autoTune", () => {
  it("난이도 노브를 스캔해 목표(HEALTHY) 또는 최선 후보로 수렴", () => {
    const res = autoTune(SPEC);
    expect(res.trace.length).toBeGreaterThan(0);
    // 반환 스테이지의 분류가 보고된 라벨과 일치(일관성)
    expect(classify(runMatrixOnStage(res.stage))).toBe(res.label);
    // 수렴했으면 HEALTHY
    if (res.converged) expect(res.label).toBe("HEALTHY");
    // 보스 포함
    expect(res.stage.units.some((u) => u.commanderId === "적장-01")).toBe(true);
  });
});
