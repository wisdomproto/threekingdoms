import { describe, it, expect } from "vitest";
import { gameData, type Stage } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import { spiritPower } from "../src/combat";
import { testMap } from "./fixtures";
import type { BattleContext, BattleState } from "../src/types";

/**
 * W4 전투 깊이 — 도구(아이템) 사용 + 회복 책략. 전부 결정론(난수 없음).
 * 합성 스테이지: 책사 간옹(회복약·공격아이템 소지) + 아군 유봉(피해 입은 상태) + 적 화웅/이숙.
 */
function makeStage(): Stage {
  return {
    id: "item-test", name: "도구테스트", mapId: "testmap", turnLimit: 30,
    camera: undefined,
    units: [
      // 간옹: 회복약 2개(쌀 40) + 공격아이템(폭탄 50) 소지, 정신력 가산 검증용 책사
      { commanderId: "간옹", classId: "strategist", level: 1, troops: 80, items: ["쌀", "쌀", "폭탄"], side: "player", x: 2, y: 4 },
      // 유봉: 회복 대상 (maxTroops=100, 테스트에서 damaged()로 현재 병력을 깎아 회복 여지 확보)
      { commanderId: "유봉", classId: "footman", level: 1, troops: 100, items: [], side: "player", x: 3, y: 4 },
      { commanderId: "화웅", classId: "footman", level: 3, troops: 120, items: [], side: "enemy", x: 2, y: 5 },
    ],
    victory: { kind: "defeatAll" },
    defeat: { kind: "lordRetreat", unitId: "간옹" },
    events: [],
  };
}

const ctx: BattleContext = { data: gameData, stage: makeStage(), map: testMap };
const get = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;

/**
 * 전투 시작 시 maxTroops = 초기 troops 이므로, "병력이 깎인 아군" 상태를 만들려면
 * createBattle 후 current troops를 낮춰 maxTroops 아래로 떨어뜨린다 (회복 여지 확보).
 */
function damaged(s: BattleState, id: string, troops: number): BattleState {
  return { ...s, units: s.units.map((u) => (u.id === id ? { ...u, troops } : u)) };
}

describe("useItem: supplyItem (회복약)", () => {
  it("대상 아군 병력을 power만큼 회복 + 아이템 1개 소모 + acted + itemUsed 이벤트", () => {
    const s = damaged(createBattle(ctx, 1), "유봉", 50); // maxTroops 100, 현재 50
    const before = get(s, "유봉").troops; // 50
    const r = applyAction(ctx, s, { type: "useItem", unitId: "간옹", itemId: "쌀", target: { x: 3, y: 4 } });
    expect(get(r.state, "유봉").troops).toBe(before + 40); // 쌀 power 40 (50→90, 상한 100 미만)
    expect(get(r.state, "간옹").items).toEqual(["쌀", "폭탄"]); // 쌀 1개만 소모
    expect(get(r.state, "간옹").acted).toBe(true);
    const evt = r.events.find((e) => e.type === "itemUsed");
    expect(evt).toMatchObject({ type: "itemUsed", unitId: "간옹", itemId: "쌀", target: { x: 3, y: 4 }, amount: 40 });
  });

  it("회복은 maxTroops를 넘지 않는다 (amount = 실제 회복량)", () => {
    const s = damaged(createBattle(ctx, 1), "유봉", 90); // maxTroops 100, 현재 90 → +40이지만 10만 회복
    const r = applyAction(ctx, s, { type: "useItem", unitId: "간옹", itemId: "쌀", target: { x: 3, y: 4 } });
    expect(get(r.state, "유봉").troops).toBe(100); // 상한 클램프
    expect(r.events.find((e) => e.type === "itemUsed")).toMatchObject({ amount: 10 });
  });

  it("target 생략 시 시전자 자신을 회복", () => {
    const s = createBattle(ctx, 1);
    // 간옹 troops 80, maxTroops 80 → 회복량 0이지만 소모·acted는 정상
    const r = applyAction(ctx, s, { type: "useItem", unitId: "간옹", itemId: "쌀" });
    expect(get(r.state, "간옹").items).toEqual(["쌀", "폭탄"]);
    expect(r.events.find((e) => e.type === "itemUsed")).toMatchObject({ target: undefined, amount: 0 });
  });

  it("결정론: 같은 입력은 반복해도 같은 결과", () => {
    const s = createBattle(ctx, 1);
    const a = applyAction(ctx, s, { type: "useItem", unitId: "간옹", itemId: "쌀", target: { x: 3, y: 4 } });
    const b = applyAction(ctx, s, { type: "useItem", unitId: "간옹", itemId: "쌀", target: { x: 3, y: 4 } });
    expect(a.state.units).toEqual(b.state.units);
    expect(a.events).toEqual(b.events);
  });

  it("supplyItem을 적에게 쓰면 에러", () => {
    const s = createBattle(ctx, 1);
    expect(() => applyAction(ctx, s, { type: "useItem", unitId: "간옹", itemId: "쌀", target: { x: 2, y: 5 } })).toThrow();
  });

  it("소지하지 않은 아이템은 에러", () => {
    const s = createBattle(ctx, 1);
    expect(() => applyAction(ctx, s, { type: "useItem", unitId: "유봉", itemId: "쌀", target: { x: 3, y: 4 } })).toThrow();
  });
});

describe("useItem: attackItem (공격아이템)", () => {
  it("대상 적 병력을 power 고정 감소 (반격 없음) + 소모 + acted", () => {
    const s = createBattle(ctx, 1);
    const before = get(s, "화웅").troops; // 120
    const r = applyAction(ctx, s, { type: "useItem", unitId: "간옹", itemId: "폭탄", target: { x: 2, y: 5 } });
    expect(get(r.state, "화웅").troops).toBe(before - 50); // 폭탄 power 50 고정
    expect(get(r.state, "간옹").items).toEqual(["쌀", "쌀"]); // 폭탄 소모
    expect(get(r.state, "간옹").acted).toBe(true);
    // 반격(counter) 없음
    expect(r.events.some((e) => e.type === "damageDealt" && e.counter)).toBe(false);
    expect(r.events.find((e) => e.type === "itemUsed")).toMatchObject({ itemId: "폭탄", amount: 50 });
  });

  it("병력보다 큰 피해는 0에서 멈추고 퇴각 (amount = 실제 가한 피해)", () => {
    const stage = makeStage();
    stage.units = stage.units.map((u) => (u.commanderId === "화웅" ? { ...u, troops: 30 } : u));
    const c2: BattleContext = { ...ctx, stage };
    const s = createBattle(c2, 1);
    const r = applyAction(c2, s, { type: "useItem", unitId: "간옹", itemId: "폭탄", target: { x: 2, y: 5 } });
    expect(get(r.state, "화웅").troops).toBe(0);
    expect(get(r.state, "화웅").retreated).toBe(true);
    expect(r.events.find((e) => e.type === "itemUsed")).toMatchObject({ amount: 30 });
    expect(r.events.some((e) => e.type === "unitRetreated" && e.unitId === "화웅")).toBe(true);
  });

  it("attackItem을 아군에게 쓰면 에러", () => {
    const s = createBattle(ctx, 1);
    expect(() => applyAction(ctx, s, { type: "useItem", unitId: "간옹", itemId: "폭탄", target: { x: 3, y: 4 } })).toThrow();
  });
});

describe("회복 책략 (heal strategy)", () => {
  it("회복: 대상 아군 회복 = power + round(정신력×power/10), MP 소비, 무피해", () => {
    const s = damaged(createBattle(ctx, 1), "유봉", 50); // maxTroops 100, 현재 50 (회복 여지 충분)
    const gan0 = get(s, "간옹");
    const before = get(s, "유봉").troops; // 50
    const power = gameData.strategies["회복"]!.power; // 10
    const expectHeal = power + Math.round((spiritPower(gan0) * power) / 10);

    const r = applyAction(ctx, s, { type: "strategy", unitId: "간옹", strategyId: "회복", target: { x: 3, y: 4 } });
    expect(get(r.state, "유봉").troops).toBe(before + expectHeal);
    expect(get(r.state, "간옹").mp).toBe(gan0.mp - gameData.strategies["회복"]!.mp);
    expect(get(r.state, "간옹").acted).toBe(true);
    // 회복은 damageDealt 이벤트를 만들지 않는다
    expect(r.events.some((e) => e.type === "damageDealt")).toBe(false);
    expect(r.events.some((e) => e.type === "strategyCast")).toBe(true);
  });

  it("회복은 maxTroops를 넘지 않는다", () => {
    const s = createBattle(ctx, 1);
    // 간옹 자신(troops 80 = maxTroops 80) 회복 — 상한이라 변화 없음, but 책략은 castRange 내 self 가능
    const r = applyAction(ctx, s, { type: "strategy", unitId: "간옹", strategyId: "회복", target: { x: 2, y: 4 } });
    expect(get(r.state, "간옹").troops).toBe(80);
  });

  it("정신력이 높을수록 회복량이 크다 (결정론 공식)", () => {
    const s = createBattle(ctx, 1);
    const power = gameData.strategies["회복"]!.power;
    const lowSpirit = { ...get(s, "간옹"), intelligence: 1 };
    const a = power + Math.round((spiritPower(get(s, "간옹")) * power) / 10);
    const b = power + Math.round((spiritPower(lowSpirit) * power) / 10);
    expect(a).toBeGreaterThan(b);
  });

  it("화계(fire)는 회복 분기에 영향받지 않고 여전히 피해를 준다", () => {
    const s = createBattle(ctx, 1);
    // 간옹이 적 화웅(2,5)에게 업화 — heal 분기가 아닌 데미지 분기로 동작
    const r = applyAction(ctx, s, { type: "strategy", unitId: "간옹", strategyId: "업화", target: { x: 2, y: 5 } });
    expect(get(r.state, "화웅").troops).toBeLessThan(get(s, "화웅").troops);
    expect(r.events.some((e) => e.type === "damageDealt")).toBe(true);
  });

  it("결정론: 회복 책략 반복 일치", () => {
    const s = createBattle(ctx, 1);
    const a = applyAction(ctx, s, { type: "strategy", unitId: "간옹", strategyId: "회복", target: { x: 3, y: 4 } });
    const b = applyAction(ctx, s, { type: "strategy", unitId: "간옹", strategyId: "회복", target: { x: 3, y: 4 } });
    expect(a.state.units).toEqual(b.state.units);
    expect(a.events).toEqual(b.events);
  });
});
