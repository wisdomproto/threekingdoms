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

  it("부대 공격력 = floor(무력/2) + 등급계수 누적성장 (기병 atk=S)", () => {
    // 관우 무력98 lightCavalry(atk=S) Lv1: base floor(98/2)=49, 구간0(0~48 경계 49)→S+2 = 51
    expect(attackPower(get("관우"))).toBe(51);
  });

  it("부대 방어력 = floor(통솔/2) + 등급계수 누적성장 (기병 def=A)", () => {
    // 관우 통솔100 lightCavalry(def=A) Lv1: base 50, 구간1(50~68)→A+3 = 53
    expect(defensePower(get("관우"))).toBe(53);
  });

  it("데미지 = floor((공격력 − 방어력×상성)/2 + 공격Lv + 25), 명중 100% 결정론", () => {
    // 화웅(기병)→관우(기병): 동계열 상성 1.0
    // 화웅 무력90 기병(atk=S) Lv3 → base45, 3레벨 전부 구간0 +2씩 = 51. 관우 def = 53.
    // dmg = floor((51 − 53)/2 + 3 + 25) = floor(-1 + 28) = 27
    const a = computeDamage(testCtx, get("화웅"), get("관우"));
    const b = computeDamage(testCtx, get("화웅"), get("관우"));
    expect(a).toBe(27);
    expect(b).toBe(a); // RNG 없음 — 같은 입력 = 같은 값
  });

  it("상성: 기병→보병은 방어 0.75배 → 데미지 증가 (관우 청룡언월도 weaponBonus 1.12 반영)", () => {
    // 관우(기병)→유비(보병 footman): lineAdvantage cavalry→infantry → 방어 ×0.75
    // 관우 atk = 51 × 1.12(청룡언월도) = 57.12. 유비 통솔91 footman(def=S) Lv1 → base45, 구간0→S+2 = 47, ×0.75 = 35.25
    // dmg = floor((57.12 − 35.25)/2 + 1 + 25) = floor(10.935 + 26) = 36
    expect(computeDamage(testCtx, get("관우"), get("유비"))).toBe(36);
  });

  it("장비 런타임: weaponBonus가 부대 공격력에 곱해진다 (무기 미보유는 ×1 불변)", () => {
    // 같은 관우라도 무기 제거(weaponBonus 1.0)하면 데미지가 줄어든다 — 무기 보정이 실제 반영됨을 증명
    const guanyuArmed = get("관우");                       // 청룡언월도 1.12
    const guanyuBare = { ...guanyuArmed, weaponBonus: 1 }; // 무기 없음
    const armed = computeDamage(testCtx, guanyuArmed, get("유비"));
    const bare = computeDamage(testCtx, guanyuBare, get("유비"));
    expect(armed).toBe(36);
    expect(bare).toBe(33); // 보정 없으면 기존 값
    expect(armed).toBeGreaterThan(bare);
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
