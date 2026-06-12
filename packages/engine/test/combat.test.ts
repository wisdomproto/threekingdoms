import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import { adjustedStat, attackPower, defensePower, computeDamage, getAttackableTargets } from "../src/combat";
import { testCtx } from "./fixtures";

const state = createBattle(testCtx, 42);
const get = (id: string) => state.units.find((u) => u.id === id)!;

describe("원작 공식 (레퍼런스 §6 검증 수치 고정)", () => {
  it("보정능력치 = 4000÷(140−x): 100→100, 90→80, 80→67, 60→50, 40→40", () => {
    expect(adjustedStat(100)).toBe(100);
    expect(adjustedStat(90)).toBe(80);
    expect(adjustedStat(80)).toBe(67);
    expect(adjustedStat(60)).toBe(50);
    expect(adjustedStat(40)).toBe(40);
  });

  it("공격력 = (병종공격 + 사기 + 보정무력) × (10+Lv)/10 × 무기보정", () => {
    // 관우 Lv1 경기병(120) 사기100 무력98→보정 round(4000/42)=95, 언월도 1.12
    // (120+100+95) × 1.1 × 1.12 = 315 × 1.1 × 1.12 = 388.08
    expect(attackPower(get("관우"))).toBeCloseTo(388.08, 2);
  });

  it("방어력 = (병종방어 + 사기 + 보정통솔) × (10+Lv)/10 (무기보정 없음)", () => {
    // 관우 Lv1 경기병(60) 사기100 통솔100→100: (60+100+100)×1.1 = 286
    expect(defensePower(get("관우"))).toBeCloseTo(286, 2);
  });

  it("데미지 = floor((공격력 − 방어력×상성÷2) × (1−지형guard)), 명중 100% 결정론", () => {
    // 화웅(경기병)→관우(경기병): 동계열 상성 1.0
    // 화웅 Lv3, 경기병(120), 사기100, 통솔88→보정 round(4000/52)=77, 무기없음=1.0
    // 화웅 atk = (120+100+round(4000/(140-90))=round(4000/50)=80) × 1.3 × 1.0 = 390
    // 관우 def = (60+100+100) × 1.1 = 286
    // dmg = floor((390 − 286×1.0/2) × 1) = floor(390−143) = floor(247) = 247
    const a = computeDamage(testCtx, get("화웅"), get("관우"));
    const b = computeDamage(testCtx, get("화웅"), get("관우"));
    expect(a).toBe(247);
    expect(b).toBe(a); // RNG 없음 — 같은 입력 = 같은 값
  });

  it("상성: 기병→보병은 방어 0.75배 → 데미지 증가", () => {
    // 관우(기병)→유비(단병 footman): lineAdvantage cavalry→infantry
    // 유비 Lv1, 단병(80/80), 통솔91→보정 round(4000/(140-91))=round(4000/49)=82
    // 유비 def = (80+100+82) × 1.1 = 288.2
    // 관우 atk = 388.08
    // dmg = floor((388.08 − 288.2×0.75/2)×1) = floor(388.08−108.075) = floor(280.005) = 280
    expect(computeDamage(testCtx, get("관우"), get("유비"))).toBe(280);
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
