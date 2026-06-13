import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import { adjustedStat, attackPower, defensePower, computeDamage, getAttackableTargets } from "../src/combat";
import { testCtx } from "./fixtures";

const state = createBattle(testCtx, 42);
const get = (id: string) => state.units.find((u) => u.id === id)!;

describe("조조전 공식 (docs/reference/sosoden-combat-formula.md)", () => {
  it("보정능력치(영걸전 레거시, 미사용) = 4000÷(140−x)", () => {
    expect(adjustedStat(100)).toBe(100);
    expect(adjustedStat(90)).toBe(80);
    expect(adjustedStat(40)).toBe(40);
  });

  it("부대 공격력 = floor(무력/2) + 성장(3×Lv)", () => {
    // 관우 무력98 Lv1: floor(98/2) + 3×1 = 49 + 3 = 52
    expect(attackPower(get("관우"))).toBe(52);
  });

  it("부대 방어력 = floor(통솔/2) + 성장(3×Lv)", () => {
    // 관우 통솔100 Lv1: floor(100/2) + 3×1 = 50 + 3 = 53
    expect(defensePower(get("관우"))).toBe(53);
  });

  it("데미지 = floor((공격력 − 방어력×상성)/2 + 공격Lv + 25), 명중 100% 결정론", () => {
    // 화웅(기병)→관우(기병): 동계열 상성 1.0
    // 화웅 무력88 Lv3 → atk = 44+9 = 53. 관우 def = 53.
    // dmg = floor((53 − 53×1.0)/2 + 3 + 25) = floor(0 + 28) = 28
    const a = computeDamage(testCtx, get("화웅"), get("관우"));
    const b = computeDamage(testCtx, get("화웅"), get("관우"));
    expect(a).toBe(28);
    expect(b).toBe(a); // RNG 없음 — 같은 입력 = 같은 값
  });

  it("상성: 기병→보병은 방어 0.75배 → 데미지 증가", () => {
    // 관우(기병)→유비(보병 footman): lineAdvantage cavalry→infantry → 방어 ×0.75
    // 관우 atk = 52. 유비 통솔91 Lv1 → def = 45+3 = 48, ×0.75 = 36
    // dmg = floor((52 − 36)/2 + 1 + 25) = floor(8 + 26) = 34
    expect(computeDamage(testCtx, get("관우"), get("유비"))).toBe(34);
  });

  it("지형 guard: 산지(0.3) 위 방어자는 데미지 30% 경감", () => {
    const onMountain = { ...get("관우"), x: 2, y: 3 }; // testMap (2,3)=m(mountain)
    const flat = computeDamage(testCtx, get("화웅"), get("관우"));
    const guarded = computeDamage(testCtx, get("화웅"), onMountain);
    expect(guarded).toBe(Math.floor(flat * 0.7));
  });

  it("최소 데미지 보장", () => {
    const weak = { ...get("유비"), war: 1, baseAtk: 1, level: 1, weaponBonus: 1 };
    expect(computeDamage(testCtx, weak, get("화웅"))).toBeGreaterThanOrEqual(testCtx.data.combat.minDamage);
  });
});

describe("getAttackableTargets (모델 무관 — 동작 유지)", () => {
  it("사거리 안의 적만", () => {
    expect(getAttackableTargets(testCtx, state, "관우", { x: 5, y: 2 })).toContain("화웅");
    expect(getAttackableTargets(testCtx, state, "관우", { x: 1, y: 4 })).toHaveLength(0);
  });
  it("궁병(2~2)은 인접 공격 불가", () => {
    expect(getAttackableTargets(testCtx, state, "이숙", { x: 5, y: 2 })).not.toContain("화웅"); // 거리 1
  });
});
