import { describe, it, expect } from "vitest";
import { gameData, type BattleMap, type Stage } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import type { BattleContext, BattleState } from "../src/types";

/**
 * 지형 회복(§10 원작 재현) — 촌락(v)=병력 10%+책략치 / 병영(b)=병력 10%.
 * 페이즈 시작 시 그 진영 유닛만, troopsHealed 이벤트 서술(드레인 정합 계약). 전부 결정론.
 * terrains.json의 healTroopsRatio(0.1)·healMp를 엔진이 소비하는 계약 테스트.
 */
const healMap: BattleMap = {
  id: "healmap", name: "회복테스트맵", width: 8, height: 4,
  tileLegend: { ".": "plain", "v": "village", "b": "barracks" },
  tiles: [
    "........",
    ".v.b....",
    "........",
    "........",
  ],
};

function makeStage(): Stage {
  return {
    id: "heal-test", name: "지형회복", mapId: "healmap", turnLimit: 30,
    units: [
      // 촌락(1,1): 병력+MP 회복 대상 / 병영(3,1): 병력만 / 평지(5,1): 회복 없음 대조군
      { commanderId: "관우", classId: "footman", level: 5, troops: 1000, items: [], side: "player", x: 1, y: 1 },
      { commanderId: "장비", classId: "footman", level: 5, troops: 1000, items: [], side: "player", x: 3, y: 1 },
      { commanderId: "유비", classId: "footman", level: 5, troops: 1000, items: [], side: "player", x: 5, y: 1 },
      { commanderId: "화웅", classId: "footman", level: 3, troops: 1200, items: [], side: "enemy", x: 7, y: 3 },
    ],
    victory: { kind: "defeatAll" },
    defeat: { kind: "lordRetreat", unitId: "유비" },
    events: [],
  };
}

const ctx: BattleContext = { data: gameData, stage: makeStage(), map: healMap };
const get = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;

/** 병력/MP를 깎아 회복 여지를 만든다(테스트 셋업 — maxTroops/maxMp는 유지). */
function damaged(s: BattleState, id: string, troops: number, mp?: number): BattleState {
  return {
    ...s,
    units: s.units.map((u) => (u.id === id ? { ...u, troops, ...(mp != null ? { mp } : {}) } : u)),
  };
}

/** 아군 전원 대기 → 적 페이즈 → 적 대기 → 아군 페이즈(턴 2) 시작까지 진행. 마지막 결과를 반환. */
function advanceToPlayerPhase(state: BattleState) {
  let s = state;
  let events: ReturnType<typeof applyAction>["events"] = [];
  for (const id of ["관우", "장비", "유비"]) {
    const r = applyAction(ctx, s, { type: "wait", unitId: id });
    s = r.state; events = r.events;
  }
  // 아군 전원 소진 → 적 페이즈로 전환됐고, 적이 대기하면 아군 페이즈(턴2) 시작 + 지형 회복.
  const r = applyAction(ctx, s, { type: "wait", unitId: "화웅" });
  return { state: r.state, events: r.events };
}

describe("지형 회복 (촌락/병영 — 페이즈 시작)", () => {
  it("촌락=병력 10%+MP, 병영=병력 10%, 평지=회복 없음 + troopsHealed 이벤트 서술", () => {
    const s0 = createBattle(ctx, 1);
    const guanMax = get(s0, "관우").maxTroops;
    const jangMax = get(s0, "장비").maxTroops;
    // 셋 다 절반 병력, 관우는 MP도 0으로
    let s = damaged(s0, "관우", Math.floor(guanMax / 2), 0);
    s = damaged(s, "장비", Math.floor(jangMax / 2));
    s = damaged(s, "유비", Math.floor(get(s0, "유비").maxTroops / 2));

    const before = {
      관우: get(s, "관우").troops, 장비: get(s, "장비").troops, 유비: get(s, "유비").troops,
    };
    const { state: after, events } = advanceToPlayerPhase(s);

    const healGuan = Math.max(1, Math.floor(guanMax * 0.1));
    const healJang = Math.max(1, Math.floor(jangMax * 0.1));
    expect(get(after, "관우").troops).toBe(before.관우 + healGuan); // 촌락
    expect(get(after, "장비").troops).toBe(before.장비 + healJang); // 병영
    expect(get(after, "유비").troops).toBe(before.유비);            // 평지 — 불변
    // 촌락은 MP도 회복(healMp), 병영은 병력만
    expect(get(after, "관우").mp).toBeGreaterThan(0);
    // 이벤트 서술 계약 — 회복 유닛 수만큼 troopsHealed
    const healEvts = events.filter((e) => e.type === "troopsHealed");
    expect(healEvts).toContainEqual({ type: "troopsHealed", unitId: "관우", amount: healGuan });
    expect(healEvts).toContainEqual({ type: "troopsHealed", unitId: "장비", amount: healJang });
    expect(healEvts.some((e) => e.type === "troopsHealed" && e.unitId === "유비")).toBe(false);
  });

  it("만피 유닛은 회복도 이벤트도 없다(노이즈 방지) + maxTroops 상한 클램프", () => {
    const s0 = createBattle(ctx, 1);
    const max = get(s0, "관우").maxTroops;
    // 관우 만피 유지, 장비는 상한 직전(회복량이 클램프되게)
    const s = damaged(s0, "장비", max - 3);
    const { state: after, events } = advanceToPlayerPhase(s);
    expect(get(after, "관우").troops).toBe(max); // 불변
    expect(events.some((e) => e.type === "troopsHealed" && e.unitId === "관우")).toBe(false);
    expect(get(after, "장비").troops).toBe(get(after, "장비").maxTroops); // 클램프
    expect(events).toContainEqual({ type: "troopsHealed", unitId: "장비", amount: 3 });
  });

  it("결정론 — 같은 입력 반복 시 동일 결과", () => {
    const s0 = damaged(createBattle(ctx, 1), "관우", 500, 0);
    const a = advanceToPlayerPhase(s0);
    const b = advanceToPlayerPhase(s0);
    expect(a.state.units).toEqual(b.state.units);
    expect(a.events).toEqual(b.events);
  });
});
