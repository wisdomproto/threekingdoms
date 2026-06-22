import { describe, it, expect } from "vitest";
import { gameData, type Stage } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import { getStrategyTargets, strategyDamage } from "../src/combat";
import { testMap } from "./fixtures";
import type { BattleContext } from "../src/types";

// 간옹(책사, 초열/업화) + 적 2기를 십자 AoE 안에 배치한 합성 스테이지
const stage: Stage = {
  id: "strat-test", name: "책략테스트", mapId: "testmap", turnLimit: 30,
  camera: undefined,
  units: [
    { commanderId: "간옹", classId: "strategist",  level: 1, troops: 80,  items: [], side: "player", x: 2, y: 4 },
    { commanderId: "화웅", classId: "footman",      level: 3, troops: 120, items: [], side: "enemy",  x: 4, y: 4 },
    { commanderId: "이숙", classId: "footman",      level: 3, troops: 120, items: [], side: "enemy",  x: 4, y: 5 },
  ],
  victory: { kind: "defeatAll" },
  defeat: { kind: "lordRetreat", unitId: "간옹" },
  events: [],
};
const ctx: BattleContext = { data: gameData, stage, map: testMap };

describe("책략 (strategy) 액션", () => {
  it("책사는 자신의 책략 목록을 가진다 + MP 보유", () => {
    const s = createBattle(ctx, 1);
    const gan = s.units.find((u) => u.id === "간옹")!;
    expect(gameData.unitClasses["strategist"]!.strategies).toContain("업화");
    expect(gan.mp).toBeGreaterThanOrEqual(gameData.strategies["업화"]!.mp); // 시전 가능
  });

  it("getStrategyTargets: 사거리 안 + AoE에 적 있는 칸만", () => {
    const s = createBattle(ctx, 1);
    const tiles = getStrategyTargets(ctx, s, "간옹", "업화");
    expect(tiles.some((t) => t.x === 4 && t.y === 4)).toBe(true); // 적 위치
    expect(tiles.some((t) => t.x === 0 && t.y === 0)).toBe(false); // 빈 구석
  });

  it("업화 시전: 십자 AoE로 적 2기 피해 + MP 소비 + acted, 무반격", () => {
    const s = createBattle(ctx, 1);
    const gan0 = s.units.find((u) => u.id === "간옹")!;
    const hua0 = s.units.find((u) => u.id === "화웅")!;
    const yi0 = s.units.find((u) => u.id === "이숙")!;
    const expectHua = strategyDamage(gan0, hua0, gameData.strategies["업화"]!.power);

    const r = applyAction(ctx, s, { type: "strategy", unitId: "간옹", strategyId: "업화", target: { x: 4, y: 4 } });
    const gan1 = r.state.units.find((u) => u.id === "간옹")!;
    const hua1 = r.state.units.find((u) => u.id === "화웅")!;
    const yi1 = r.state.units.find((u) => u.id === "이숙")!;

    expect(gan1.mp).toBe(gan0.mp - gameData.strategies["업화"]!.mp); // MP 소비
    expect(gan1.acted).toBe(true);
    expect(hua1.troops).toBe(hua0.troops - expectHua); // 공식대로 화웅 피해
    expect(yi1.troops).toBeLessThan(yi0.troops);        // 인접 이숙도 AoE 피해
    // 시전 이벤트 + 피해 이벤트, 반격(counter=true) 없음
    expect(r.events.some((e) => e.type === "strategyCast")).toBe(true);
    expect(r.events.filter((e) => e.type === "damageDealt").length).toBe(2);
    expect(r.events.some((e) => e.type === "damageDealt" && e.counter)).toBe(false);
  });

  it("회복 책략은 회복량을 troopsHealed 이벤트로 서술한다 (자기서술 계약 — 드레인 정합)", () => {
    // 회복 경로가 troops만 늘리고 이벤트를 안 내면 presenter 투영이 옛 값에 머물러
    // 드레인 정합 단언(presented<committed)이 터진다 — 흡혈과 동일하게 troopsHealed로 서술해야 한다.
    const s = createBattle(ctx, 1);
    // 간옹을 부상 상태로(troops 20) 만들고 자기 칸(2,4)에 헌책(회복·단일·사거리3·target ally) 자가 시전
    const wounded = { ...s, units: s.units.map((u) => (u.id === "간옹" ? { ...u, troops: 20 } : u)) };
    const before = wounded.units.find((u) => u.id === "간옹")!.troops;
    const r = applyAction(ctx, wounded, { type: "strategy", unitId: "간옹", strategyId: "헌책", target: { x: 2, y: 4 } });
    const after = r.state.units.find((u) => u.id === "간옹")!.troops;
    expect(after).toBeGreaterThan(before); // 실제 회복됨
    const healEvents = r.events.filter((e) => e.type === "troopsHealed");
    expect(healEvents).toHaveLength(1);
    expect(healEvents[0]).toMatchObject({ type: "troopsHealed", unitId: "간옹", amount: after - before });
  });

  it("MP 부족이면 시전 불가 (throw)", () => {
    const s = createBattle(ctx, 1);
    const drained = {
      ...s,
      units: s.units.map((u) => (u.id === "간옹" ? { ...u, mp: 0 } : u)),
    };
    expect(() =>
      applyAction(ctx, drained, { type: "strategy", unitId: "간옹", strategyId: "업화", target: { x: 4, y: 4 } }),
    ).toThrow();
  });
});
