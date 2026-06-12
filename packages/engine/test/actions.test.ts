import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import type { BattleContext, BattleState, UnitState } from "../src/types";

const ctx: BattleContext = { data: gameData, stage: stages["05-sishuiguan"]! };
const fresh = () => createBattle(ctx.stage, ctx.data, 42);
const get = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;

/** 테스트용: 유닛을 강제로 특정 위치/상태로 옮긴 사본 */
function patchUnit(s: BattleState, id: string, patch: Partial<UnitState>): BattleState {
  return { ...s, units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) };
}

describe("applyAction: move", () => {
  it("이동하면 위치가 바뀌고 unitMoved 이벤트, moved=true", () => {
    const s0 = fresh();
    const g0 = get(s0, "guanyu");
    const { state, events } = applyAction(ctx, s0, { type: "move", unitId: "guanyu", to: { x: 4, y: 7 } });
    expect(get(state, "guanyu")).toMatchObject({ x: 4, y: 7, moved: true, acted: false });
    expect(events).toContainEqual({ type: "unitMoved", unitId: "guanyu", from: { x: g0.x, y: g0.y }, to: { x: 4, y: 7 } });
    expect(s0).toEqual(fresh()); // 원본 불변
  });

  it("이동 불가 타일이면 에러", () => {
    expect(() => applyAction(ctx, fresh(), { type: "move", unitId: "guanyu", to: { x: 0, y: 0 } })).toThrow();
  });

  it("이미 행동한 유닛은 이동 불가", () => {
    const s = patchUnit(fresh(), "guanyu", { acted: true });
    expect(() => applyAction(ctx, s, { type: "move", unitId: "guanyu", to: { x: 4, y: 9 } })).toThrow();
  });

  it("같은 턴에 이동 후 공격이 가능하고 이동한 위치 기준으로 사거리 판정한다", () => {
    let s = fresh();
    // 관우(4,10) → (4,5)로 이동 (dong_inf1 (4,4) 인접). 이동력 6, plain 경로 비용 5
    s = applyAction(ctx, s, { type: "move", unitId: "guanyu", to: { x: 4, y: 5 } }).state;
    const { state } = applyAction(ctx, s, { type: "attack", unitId: "guanyu", targetId: "dong_inf1" });
    expect(get(state, "guanyu").acted).toBe(true);
    expect(get(state, "dong_inf1").hp).toBeLessThan(50);
  });
});

describe("applyAction: attack", () => {
  it("공격하면 피해·반격이 일어나고 acted=true", () => {
    // 관우를 dong_inf1(4,4) 옆에 배치
    const s = patchUnit(fresh(), "guanyu", { x: 4, y: 5 });
    const { state, events } = applyAction(ctx, s, { type: "attack", unitId: "guanyu", targetId: "dong_inf1" });
    const dmg = events.filter((e) => e.type === "damageDealt");
    expect(dmg.length).toBeGreaterThanOrEqual(1);
    expect(dmg[0]).toMatchObject({ attackerId: "guanyu", defenderId: "dong_inf1", counter: false });
    expect(get(state, "dong_inf1").hp).toBeLessThan(50);
    expect(get(state, "guanyu").acted).toBe(true);
    // 보병(rangeMax 1)이 살아 있으면 반격 — 관우 HP도 깎인다
    if (!get(state, "dong_inf1").retreated) {
      expect(dmg.some((e) => e.type === "damageDealt" && e.counter)).toBe(true);
      expect(get(state, "guanyu").hp).toBeLessThan(64);
    }
  });

  it("궁병 공격(거리 2)에는 근접 유닛이 반격하지 못한다", () => {
    // 적 궁병의 공격이므로 적 페이즈로 전환해 테스트
    const s = { ...patchUnit(fresh(), "dong_arc1", { x: 4, y: 8 }), phase: "enemy" as const }; // 관우(4,10)와 거리 2
    const { events } = applyAction(ctx, s, { type: "attack", unitId: "dong_arc1", targetId: "guanyu" });
    expect(events.filter((e) => e.type === "damageDealt" && e.counter)).toHaveLength(0);
  });

  it("HP 0이 되면 퇴각(unitRetreated), 사망 없음", () => {
    const s = patchUnit(patchUnit(fresh(), "guanyu", { x: 4, y: 5 }), "dong_inf1", { hp: 1 });
    const { state, events } = applyAction(ctx, s, { type: "attack", unitId: "guanyu", targetId: "dong_inf1" });
    expect(get(state, "dong_inf1")).toMatchObject({ retreated: true, hp: 0 });
    expect(events).toContainEqual({ type: "unitRetreated", unitId: "dong_inf1" });
  });

  it("사거리 밖 공격은 에러", () => {
    expect(() => applyAction(ctx, fresh(), { type: "attack", unitId: "guanyu", targetId: "huaxiong" })).toThrow();
  });
});

describe("applyAction: 일기토", () => {
  it("관우→화웅 공격 시 일기토 발동: 화웅 퇴각, 일반 데미지 교환 없음", () => {
    const s = patchUnit(fresh(), "guanyu", { x: 6, y: 3 }); // 화웅(6,2) 인접
    const { state, events } = applyAction(ctx, s, { type: "attack", unitId: "guanyu", targetId: "huaxiong" });
    expect(events).toContainEqual({
      type: "duelTriggered", eventId: "duel_guanyu_huaxiong",
      attackerId: "guanyu", defenderId: "huaxiong", winnerId: "guanyu",
    });
    expect(events.filter((e) => e.type === "damageDealt")).toHaveLength(0);
    expect(get(state, "huaxiong").retreated).toBe(true);
    expect(state.firedEvents).toContain("duel_guanyu_huaxiong");
  });

  it("화웅 퇴각으로 승리 조건(defeatUnit) 충족 → battleEnded(victory)", () => {
    const s = patchUnit(fresh(), "guanyu", { x: 6, y: 3 });
    const { state, events } = applyAction(ctx, s, { type: "attack", unitId: "guanyu", targetId: "huaxiong" });
    expect(state.status).toBe("victory");
    expect(events).toContainEqual({ type: "battleEnded", result: "victory" });
  });

  it("일기토에서 공격자가 패자: 공격자 퇴각, 방어자 생존", () => {
    const loseCtx: BattleContext = {
      ...ctx,
      stage: {
        ...ctx.stage,
        events: [{
          id: "duel_guanyu_huaxiong", type: "duel" as const,
          trigger: { kind: "attack" as const, attackerId: "guanyu", defenderId: "huaxiong" },
          outcome: { winnerId: "huaxiong", loserRetreats: true },
          once: true,
        }],
      },
    };
    const s = patchUnit(fresh(), "guanyu", { x: 6, y: 3 });
    const { state } = applyAction(loseCtx, s, { type: "attack", unitId: "guanyu", targetId: "huaxiong" });
    expect(get(state, "guanyu").retreated).toBe(true);
    expect(get(state, "huaxiong").retreated).toBe(false);
    expect(state.status).toBe("ongoing"); // 관우는 군주가 아니므로 패배 아님
  });

  it("loserRetreats=false면 일기토 후 양측 모두 생존", () => {
    const noRetreatCtx: BattleContext = {
      ...ctx,
      stage: {
        ...ctx.stage,
        events: [{
          id: "duel_guanyu_huaxiong", type: "duel" as const,
          trigger: { kind: "attack" as const, attackerId: "guanyu", defenderId: "huaxiong" },
          outcome: { winnerId: "guanyu", loserRetreats: false },
          once: true,
        }],
      },
    };
    const s = patchUnit(fresh(), "guanyu", { x: 6, y: 3 });
    const { state, events } = applyAction(noRetreatCtx, s, { type: "attack", unitId: "guanyu", targetId: "huaxiong" });
    expect(get(state, "huaxiong").retreated).toBe(false);
    expect(get(state, "guanyu").retreated).toBe(false);
    expect(events.filter((e) => e.type === "unitRetreated")).toHaveLength(0);
    expect(state.firedEvents).toContain("duel_guanyu_huaxiong");
  });
});

describe("페이즈 전환", () => {
  it("아군 전원이 행동하면 적 페이즈로 넘어간다", () => {
    let s = fresh();
    const players = s.units.filter((u) => u.side === "player").map((u) => u.id);
    let last: ReturnType<typeof applyAction> | undefined;
    for (const id of players) {
      last = applyAction(ctx, s, { type: "wait", unitId: id });
      s = last.state;
    }
    expect(s.phase).toBe("enemy");
    expect(last!.events).toContainEqual({ type: "phaseChanged", phase: "enemy", turn: 1 });
    // 적 유닛의 moved/acted가 리셋되어 있어야 한다
    for (const u of s.units.filter((u) => u.side === "enemy")) {
      expect(u.acted).toBe(false);
    }
  });

  it("적 전원이 행동하면 턴이 증가하고 아군 페이즈로 돌아온다", () => {
    let s = fresh();
    for (const id of s.units.filter((u) => u.side === "player").map((u) => u.id)) {
      s = applyAction(ctx, s, { type: "wait", unitId: id }).state;
    }
    for (const id of s.units.filter((u) => u.side === "enemy").map((u) => u.id)) {
      s = applyAction(ctx, s, { type: "wait", unitId: id }).state;
    }
    expect(s.phase).toBe("player");
    expect(s.turn).toBe(2);
  });

  it("자기 페이즈가 아닌 유닛의 행동은 에러", () => {
    expect(() => applyAction(ctx, fresh(), { type: "wait", unitId: "huaxiong" })).toThrow();
  });
});

describe("패배 조건", () => {
  it("유비(군주) 퇴각 시 defeat", () => {
    // (4,11)은 빈 평지 — 다른 유닛과 겹치지 않게 배치
    const s = patchUnit(patchUnit(fresh(), "dong_cav1", { x: 4, y: 11 }), "liubei", { hp: 1, x: 5, y: 11 });
    // 적 페이즈로 강제 전환해 dong_cav1이 유비를 공격
    const enemyPhase = { ...s, phase: "enemy" as const };
    const { state, events } = applyAction(ctx, enemyPhase, { type: "attack", unitId: "dong_cav1", targetId: "liubei" });
    expect(state.status).toBe("defeat");
    expect(events).toContainEqual({ type: "battleEnded", result: "defeat" });
  });
});
