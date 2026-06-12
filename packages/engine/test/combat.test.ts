import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { computeDamage, getAttackableTargets } from "../src/combat";
import type { BattleContext } from "../src/types";

const ctx: BattleContext = { data: gameData, stage: stages["05-sishuiguan"]! };

function unitsOf(state: ReturnType<typeof createBattle>) {
  const get = (id: string) => state.units.find((u) => u.id === id)!;
  return { get };
}

describe("computeDamage", () => {
  it("같은 입력 + 같은 rngState = 같은 데미지 (결정론)", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const { get } = unitsOf(state);
    const a = computeDamage(ctx, state, get("guanyu"), get("dong_inf1"));
    const b = computeDamage(ctx, state, get("guanyu"), get("dong_inf1"));
    expect(a.damage).toBe(b.damage);
    expect(a.nextRngState).toBe(b.nextRngState);
  });

  it("상성 우위(기병→보병)가 비우위(기병→기병)보다 큰 데미지", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const { get } = unitsOf(state);
    // 분산 영향을 없애기 위해 varianceRatio 0인 설정으로 비교
    const ctx0: BattleContext = {
      ...ctx, data: { ...ctx.data, combat: { ...ctx.data.combat, varianceRatio: 0 } },
    };
    const vsInf = computeDamage(ctx0, state, get("guanyu"), get("dong_inf1")).damage;
    const vsCav = computeDamage(ctx0, state, get("guanyu"), get("dong_cav1")).damage;
    expect(vsInf).toBeGreaterThan(0);
    // dong_inf1(def 13) vs dong_cav1(def 12): 방어가 더 높아도 상성 1.3배가 이긴다
    expect(vsInf).toBeGreaterThan(vsCav);
  });

  it("최소 데미지가 보장된다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const { get } = unitsOf(state);
    const weak = { ...get("jianyong"), atk: 1 };
    const r = computeDamage(ctx, state, weak, get("huaxiong"));
    expect(r.damage).toBeGreaterThanOrEqual(ctx.data.combat.minDamage);
  });

  it("분산이 [1-vr, 1+vr) 범위 안이다", () => {
    const { get } = unitsOf(createBattle(ctx.stage, ctx.data, 42));
    const noVar: BattleContext = {
      ...ctx, data: { ...ctx.data, combat: { ...ctx.data.combat, varianceRatio: 0 } },
    };
    for (const seed of [0, 1, 42, 12345]) {
      const state = createBattle(ctx.stage, ctx.data, seed);
      const base = computeDamage(noVar, state, get("guanyu"), get("dong_inf1")).damage;
      const withVar = computeDamage(ctx, state, get("guanyu"), get("dong_inf1")).damage;
      expect(withVar).toBeGreaterThanOrEqual(Math.floor(base * 0.9));
      expect(withVar).toBeLessThanOrEqual(Math.ceil(base * 1.1));
    }
  });
});

describe("getAttackableTargets", () => {
  it("사거리 안의 적만 반환한다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    // 관우(rangeMin=rangeMax=1)를 dong_inf1 (4,4) 옆 (4,5)에 둔 가상 위치에서 판정
    const ids = getAttackableTargets(ctx, state, "guanyu", { x: 4, y: 5 });
    expect(ids).toContain("dong_inf1");
    expect(ids).not.toContain("huaxiong"); // 멀리 있음
  });

  it("궁병은 인접(거리 1) 적을 공격할 수 없다 (rangeMin=2)", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const ids = getAttackableTargets(ctx, state, "dong_arc1", { x: 4, y: 5 }); // dong_inf1과 거리 1
    expect(ids).not.toContain("dong_inf1");
  });
});
