import { describe, it, expect } from "vitest";
import type { Stage } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import type { BattleContext, BattleState } from "../src/types";
import { testCtx, testMap } from "./fixtures";

/** testCtx 위에서 stage만 갈아끼운 컨텍스트. data/map은 픽스처 공유(관우/유비/화웅/이숙 + 8×6 맵). */
function withStage(stage: Stage): BattleContext {
  return { ...testCtx, stage };
}
const get = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;
function patch(s: BattleState, id: string, p: Partial<BattleState["units"][number]>): BattleState {
  return { ...s, units: s.units.map((u) => (u.id === id ? { ...u, ...p } : u)) };
}

/**
 * 5인 배치(유비·관우·간옹 player / 화웅·이숙 enemy). 간옹은 항상 살아있는 "구동용" 아군 —
 * 다른 유닛을 강제 퇴각시킨 뒤 player 페이즈에서 wait로 재판정을 유발하는 데 쓴다.
 * objectives만 교체해 재사용. testStage(픽스처)와 좌표 호환.
 */
const baseUnits: Stage["units"] = [
  { commanderId: "유비", classId: "footman",      level: 1, troops: 1120, items: [],            side: "player", x: 2, y: 5 },
  { commanderId: "관우", classId: "lightCavalry", level: 1, troops: 1120, items: ["청룡언월도"], side: "player", x: 1, y: 4 },
  { commanderId: "간옹", classId: "strategist",   level: 1, troops: 800,  items: [],            side: "player", x: 0, y: 5 },
  { commanderId: "화웅", classId: "lightCavalry", level: 3, troops: 1760, items: [],            side: "enemy",  x: 5, y: 1 },
  { commanderId: "이숙", classId: "archer",       level: 3, troops: 1760, items: [],            side: "enemy",  x: 6, y: 2 },
];

function stage(partial: Partial<Stage>): Stage {
  return {
    id: "obj-test", name: "obj", mapId: testMap.id, turnLimit: 30,
    units: baseUnits, events: [],
    objectives: [{ kind: "defeatAll", optional: false }],
    ...partial,
  } as Stage;
}

describe("objectives: reachTile", () => {
  it("지정 유닛이 목표 칸에 도달하면 victory (status 최상위 계약 보존)", () => {
    const ctx = withStage(stage({ objectives: [{ kind: "reachTile", unitId: "관우", x: 2, y: 4, optional: false }] }));
    const s0 = createBattle(ctx, 1);
    expect(s0.status).toBe("ongoing");
    // 관우 (1,4) → (2,4) 인접 평지 도달
    const { state, events } = applyAction(ctx, s0, { type: "move", unitId: "관우", to: { x: 2, y: 4 } });
    expect(state.status).toBe("victory");
    expect(events).toContainEqual({ type: "battleEnded", result: "victory" });
  });

  it("unitId 생략 시 아무 아군이 그 칸에 도달하면 victory", () => {
    const ctx = withStage(stage({ objectives: [{ kind: "reachTile", x: 2, y: 4, optional: false }] }));
    const s0 = createBattle(ctx, 1);
    const { state } = applyAction(ctx, s0, { type: "move", unitId: "관우", to: { x: 2, y: 4 } });
    expect(state.status).toBe("victory");
  });

  it("목표 칸이 아니면 ongoing 유지", () => {
    const ctx = withStage(stage({ objectives: [{ kind: "reachTile", unitId: "관우", x: 7, y: 5, optional: false }] }));
    const s0 = createBattle(ctx, 1);
    const { state } = applyAction(ctx, s0, { type: "move", unitId: "관우", to: { x: 2, y: 4 } });
    expect(state.status).toBe("ongoing");
  });
});

describe("objectives: captureTile", () => {
  it("player 진영 유닛이 점령 칸을 점유하면 victory", () => {
    const ctx = withStage(stage({ objectives: [{ kind: "captureTile", x: 2, y: 4, side: "player", optional: false }] }));
    const s0 = createBattle(ctx, 1);
    const { state } = applyAction(ctx, s0, { type: "move", unitId: "관우", to: { x: 2, y: 4 } });
    expect(state.status).toBe("victory");
  });
});

describe("objectives: surviveTurns", () => {
  it("그 턴까지 패배조건에 안 걸리면 충족 → victory (turn > turns 시점)", () => {
    // 적을 전부 미리 퇴각시켜 두면(공격 안 함) 적 페이즈가 비어 빠르게 턴이 흐른다.
    // surviveTurns:1 → turn이 2가 되는 순간(라운드 1 종료 직후) 충족.
    const ctx = withStage(stage({
      objectives: [{ kind: "surviveTurns", turns: 1, optional: false }],
      turnLimit: 30,
    }));
    let s = createBattle(ctx, 1);
    // 아군 전원 wait → 적 전원 wait → player로 복귀하며 turn=2
    s = applyAction(ctx, s, { type: "wait", unitId: "유비" }).state;
    s = applyAction(ctx, s, { type: "wait", unitId: "관우" }).state;
    s = applyAction(ctx, s, { type: "wait", unitId: "간옹" }).state;
    // 이제 enemy 페이즈. 적 전원 wait
    s = applyAction(ctx, s, { type: "wait", unitId: "화웅" }).state;
    const last = applyAction(ctx, s, { type: "wait", unitId: "이숙" });
    expect(last.state.turn).toBeGreaterThan(1);
    expect(last.state.status).toBe("victory");
  });
});

describe("failConditions", () => {
  it("allRetreated: 호위 대상 전원 퇴각 시 defeat", () => {
    const ctx = withStage(stage({
      objectives: [{ kind: "defeatAll", optional: false }],
      failConditions: [{ kind: "allRetreated", unitIds: ["유비", "관우"] }],
    }));
    let s = createBattle(ctx, 1);
    // 호위 대상(유비·관우) 전원 강제 퇴각 → 살아있는 간옹 wait로 재판정 유발
    s = patch(s, "유비", { troops: 0, retreated: true });
    s = patch(s, "관우", { troops: 0, retreated: true });
    const { state } = applyAction(ctx, s, { type: "wait", unitId: "간옹" });
    expect(state.status).toBe("defeat");
  });

  it("allRetreated: 일부만 퇴각하면 ongoing", () => {
    const ctx = withStage(stage({
      objectives: [{ kind: "reachTile", unitId: "관우", x: 7, y: 0, optional: false }],
      failConditions: [{ kind: "allRetreated", unitIds: ["유비", "관우"] }],
    }));
    let s = createBattle(ctx, 1);
    s = patch(s, "유비", { troops: 0, retreated: true }); // 관우는 생존
    const { state } = applyAction(ctx, s, { type: "wait", unitId: "간옹" });
    expect(state.status).toBe("ongoing");
  });

  it("turnLimitExceeded 명시: turnLimit 초과 시 defeat", () => {
    const ctx = withStage(stage({
      objectives: [{ kind: "reachTile", unitId: "관우", x: 7, y: 0, optional: false }],
      failConditions: [{ kind: "turnLimitExceeded" }],
      turnLimit: 1,
    }));
    let s = createBattle(ctx, 1);
    s = applyAction(ctx, s, { type: "wait", unitId: "유비" }).state;
    s = applyAction(ctx, s, { type: "wait", unitId: "관우" }).state;
    s = applyAction(ctx, s, { type: "wait", unitId: "간옹" }).state;
    s = applyAction(ctx, s, { type: "wait", unitId: "화웅" }).state;
    const { state } = applyAction(ctx, s, { type: "wait", unitId: "이숙" });
    // turn이 2가 되어 turnLimit(1) 초과 → defeat
    expect(state.turn).toBeGreaterThan(1);
    expect(state.status).toBe("defeat");
  });
});

describe("reinforcements", () => {
  it("turn 트리거: 지정 턴 도달 시 units 스폰 + reinforcementArrived 이벤트", () => {
    const ctx = withStage(stage({
      objectives: [{ kind: "reachTile", unitId: "관우", x: 7, y: 0, optional: false }], // 잘 안 끝나는 목표
      turnLimit: 30,
      reinforcements: [{
        id: "r1", side: "enemy", once: true,
        trigger: { kind: "turn", turn: 2 },
        units: [{ commanderId: "이숙", classId: "archer", level: 2, troops: 100, items: [], side: "enemy", x: 7, y: 1 }],
      }],
    }));
    // ⚠️ 이숙은 baseUnits에도 있으므로 중복 id 회피 위해 증원은 다른 commander가 이상적이나,
    // 픽스처 commander 한정 → 동일 id 스폰을 허용하되 존재 검증만 한다(엔진은 id 유일성 강제 안 함).
    let s = createBattle(ctx, 1);
    const before = s.units.length;
    s = applyAction(ctx, s, { type: "wait", unitId: "유비" }).state;
    s = applyAction(ctx, s, { type: "wait", unitId: "관우" }).state;
    s = applyAction(ctx, s, { type: "wait", unitId: "간옹" }).state;
    s = applyAction(ctx, s, { type: "wait", unitId: "화웅" }).state;
    const last = applyAction(ctx, s, { type: "wait", unitId: "이숙" }); // turn→2 전환
    expect(last.state.turn).toBe(2);
    expect(last.state.spawnedReinforcements).toContain("r1");
    expect(last.state.units.length).toBe(before + 1);
    expect(last.events.some((e) => e.type === "reinforcementArrived" && e.reinforcementId === "r1")).toBe(true);
  });

  it("once: 같은 증원은 한 번만 투입된다", () => {
    const ctx = withStage(stage({
      objectives: [{ kind: "reachTile", unitId: "관우", x: 7, y: 0, optional: false }],
      turnLimit: 30,
      reinforcements: [{
        id: "r1", side: "enemy", once: true,
        trigger: { kind: "turn", turn: 1 }, // 즉시 충족 — 매 액션 평가돼도 1회만
        units: [{ commanderId: "이숙", classId: "archer", level: 2, troops: 100, items: [], side: "enemy", x: 7, y: 1 }],
      }],
    }));
    let s = createBattle(ctx, 1);
    const r1 = applyAction(ctx, s, { type: "wait", unitId: "유비" });
    s = r1.state;
    expect(s.spawnedReinforcements).toContain("r1");
    const cnt = s.units.length;
    s = applyAction(ctx, s, { type: "wait", unitId: "관우" }).state;
    expect(s.units.length).toBe(cnt); // 두 번째 액션에서 재스폰 안 됨
  });
});

describe("strategyConditions", () => {
  it("duelOccurred: 일기토 발동 시 보상 적립 + strategyConditionMet 이벤트", () => {
    const ctx = withStage(stage({
      objectives: [{ kind: "reachTile", unitId: "관우", x: 7, y: 0, optional: false }],
      events: [{
        id: "duel_관우_화웅", type: "duel",
        trigger: { kind: "attack", attackerId: "관우", defenderId: "화웅" },
        outcome: { winnerId: "관우", loserRetreats: true }, once: true,
      }],
      strategyConditions: [{
        id: "sc1", description: "관우 일기토",
        trigger: { kind: "duelOccurred", duelId: "duel_관우_화웅" },
        reward: { treasures: ["무술교본"], gold: 100 },
      }],
    }));
    let s = createBattle(ctx, 1);
    // 관우를 화웅 인접(5,1 옆 = 4,1)로 이동시키고 공격 → 일기토 발동
    s = applyAction(ctx, s, { type: "move", unitId: "관우", to: { x: 4, y: 1 } }).state;
    const { state, events } = applyAction(ctx, s, { type: "attack", unitId: "관우", targetId: "화웅" });
    expect(state.duelHistory).toContain("duel_관우_화웅");
    expect(state.metStrategyConditions).toContain("sc1");
    expect(state.pendingRewards).toContainEqual({ conditionId: "sc1", treasures: ["무술교본"], gold: 100 });
    expect(events).toContainEqual({ type: "strategyConditionMet", id: "sc1", treasures: ["무술교본"], gold: 100 });
  });

  it("unitReachedTile: 인물이 칸에 도달하면 보상 적립 (승패 무관 — ongoing 유지)", () => {
    const ctx = withStage(stage({
      objectives: [{ kind: "defeatAll", optional: false }],
      strategyConditions: [{
        id: "sc2", description: "유비 피신",
        trigger: { kind: "unitReachedTile", unitId: "유비", x: 2, y: 4 },
        reward: { treasures: ["쌀"] },
      }],
    }));
    let s = createBattle(ctx, 1);
    const { state } = applyAction(ctx, s, { type: "move", unitId: "유비", to: { x: 2, y: 4 } });
    expect(state.metStrategyConditions).toContain("sc2");
    expect(state.pendingRewards[0]).toMatchObject({ conditionId: "sc2", treasures: ["쌀"], gold: 0 });
    expect(state.status).toBe("ongoing"); // 전략조건은 승패에 영향 없음
  });

  it("duelsInOrder: 순서대로 발동해야 충족", () => {
    // 두 일기토를 순서대로: 먼저 관우→이숙(duelA), 다음 관우→화웅(duelB). 관우는 기병(이동6).
    const ctx = withStage(stage({
      objectives: [{ kind: "reachTile", unitId: "유비", x: 7, y: 5, optional: false }], // 잘 안 끝남
      turnLimit: 30,
      events: [
        { id: "duelA", type: "duel", trigger: { kind: "attack", attackerId: "관우", defenderId: "이숙" },
          outcome: { winnerId: "관우", loserRetreats: true }, once: true },
        { id: "duelB", type: "duel", trigger: { kind: "attack", attackerId: "관우", defenderId: "화웅" },
          outcome: { winnerId: "관우", loserRetreats: true }, once: true },
      ],
      strategyConditions: [{
        id: "order", description: "순서 일기토",
        trigger: { kind: "duelsInOrder", duelIds: ["duelA", "duelB"] },
        reward: { treasures: ["적로"] },
      }],
    }));
    let s = createBattle(ctx, 1);
    // 턴1 duelA: 관우(1,4) → 이숙(6,2) 인접(6,3) 이동 후 공격
    s = applyAction(ctx, s, { type: "move", unitId: "관우", to: { x: 6, y: 3 } }).state;
    s = applyAction(ctx, s, { type: "attack", unitId: "관우", targetId: "이숙" }).state;
    expect(s.duelHistory).toEqual(["duelA"]);
    expect(s.metStrategyConditions).not.toContain("order"); // 아직 duelB 안 봄
    // 나머지 아군·적 페이즈 소진 → 턴2 복귀
    s = applyAction(ctx, s, { type: "wait", unitId: "유비" }).state;
    s = applyAction(ctx, s, { type: "wait", unitId: "간옹" }).state;
    s = applyAction(ctx, s, { type: "wait", unitId: "화웅" }).state;
    // 턴2 duelB: 관우(6,3) → 화웅(5,1) 인접(5,2) 이동 후 공격
    s = applyAction(ctx, s, { type: "move", unitId: "관우", to: { x: 5, y: 2 } }).state;
    const { state } = applyAction(ctx, s, { type: "attack", unitId: "관우", targetId: "화웅" });
    expect(state.duelHistory).toEqual(["duelA", "duelB"]);
    expect(state.metStrategyConditions).toContain("order");
  });
});

describe("legacy victory/defeat 폴백 (하위호환)", () => {
  it("objectives 없이 victory/defeat만 있으면 기존대로 동작", () => {
    const ctx = withStage({
      id: "legacy", name: "legacy", mapId: testMap.id, turnLimit: 30,
      units: baseUnits, events: [],
      victory: { kind: "defeatUnit", unitId: "화웅" },
      defeat: { kind: "lordRetreat", unitId: "유비" },
    } as Stage);
    let s = createBattle(ctx, 1);
    // 유비 강제 퇴각 → 살아있는 간옹 wait로 재판정 → defeat (lordRetreat)
    s = patch(s, "유비", { troops: 0, retreated: true });
    const { state } = applyAction(ctx, s, { type: "wait", unitId: "간옹" });
    expect(state.status).toBe("defeat");
  });
});
