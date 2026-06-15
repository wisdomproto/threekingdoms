/**
 * C→B→A 풀 합성(§11-C) 테스트 — 생성 지형(미등록 맵)에 B가 적 배치 + A가 분류.
 * mapOverride 스레딩으로 gameData.maps에 없는 맵을 측정.
 */
import { describe, it, expect } from "vitest";
import { generateMap } from "../../../src/gen/terrain/mapGen";
import { autoTune, generate, type GenSpec } from "../../../src/gen/generator";
import { classify, runMatrixOnStage } from "../../../src/reportCard";
import { runStage } from "../../../src/runner";

function specFor(): GenSpec {
  const gen = generateMap("gateBreakthrough", { width: 30, height: 18, seed: 1, chokeWidth: 4 });
  return {
    mapId: gen.map.id,
    map: gen.map, // 미등록 맵 — mapOverride로 측정
    spawn: gen.spawn,
    goal: gen.goal,
    playerUnits: [
      { commanderId: "유비", classId: "lord", level: 7, troops: 140, items: [], side: "player", x: gen.spawn.x, y: gen.spawn.y },
      { commanderId: "관우", classId: "lightCavalry", level: 7, troops: 140, items: ["청룡언월도"], side: "player", x: gen.spawn.x, y: gen.spawn.y - 1 },
      { commanderId: "장비", classId: "lightCavalry", level: 7, troops: 140, items: ["사모"], side: "player", x: gen.spawn.x, y: gen.spawn.y + 1 },
    ],
    mookPool: [
      { classId: "footman", troops: 90, level: 3 },
      { classId: "archer", troops: 80, level: 3 },
    ],
    boss: { classId: "lightCavalry", troops: 150, level: 5 },
    turnLimit: 30,
  };
}

describe("runStage mapOverride", () => {
  it("미등록 맵을 override로 실행", () => {
    const spec = specFor();
    const stage = generate(spec, 1.0);
    const r = runStage(stage, { mapOverride: spec.map });
    expect(["victory", "defeat", "timeout"]).toContain(r.result);
  });
});

describe("autoTune with generated map", () => {
  it("생성 지형에 적 배치 → 분류 라벨 수렴(C→B→A)", () => {
    const spec = specFor();
    const res = autoTune(spec);
    expect(res.trace.length).toBeGreaterThan(0);
    // 반환 스테이지가 spec.map override로 일관 분류
    expect(classify(runMatrixOnStage(res.stage, spec.map))).toBe(res.label);
    if (res.converged) expect(res.label).toBe("HEALTHY");
  });
});
