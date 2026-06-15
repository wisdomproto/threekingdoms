import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import {
  adjustedStat, attackPower, defensePower, computeDamage, getAttackableTargets,
  flankingCount, flankMultiplier, chargeMultiplier, doubleStrikes, agilityPower, hitChance,
} from "../src/combat";
import { corpsStat } from "../src/growth";
import { testCtx } from "./fixtures";
import type { BattleState, UnitState } from "../src/types";

const state = createBattle(testCtx, 42);
const get = (id: string) => state.units.find((u) => u.id === id)!;

describe("agilityPower (순발력 ← 민첩)", () => {
  it("agilityPower = corpsStat(민첩, agility등급, Lv); spawnUnit이 agility 주입", () => {
    const u = get("관우");
    expect(u.agility).toBeGreaterThan(0);
    expect(agilityPower(u)).toBe(corpsStat(u.agility, u.grades.agility, u.level));
  });
});

describe("hitChance (명중/회피 — 완만)", () => {
  const cfg = { missSlope: 0.5, floorPercent: 80 };
  it("동급 → 100%", () => expect(hitChance(60, 60, cfg)).toBe(100));
  it("공격자 더 빠름 → 100%", () => expect(hitChance(80, 60, cfg)).toBe(100));
  it("방어자 10 빠름 → 95%", () => expect(hitChance(60, 70, cfg)).toBe(95));
  it("방어자 40 빠름 → 하한 80%", () => expect(hitChance(40, 80, cfg)).toBe(80));
  it("방어자 100 빠름 → floor 클램프 80%", () => expect(hitChance(0, 100, cfg)).toBe(80));
});

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

  it("상성: 기병→보병은 방어 0.75배 → 데미지 증가 (관우 청룡언월도 weaponBonus 1.12 반영, 보병 철벽 −15%)", () => {
    // 관우(기병)→유비(보병 footman): lineAdvantage cavalry→infantry → 방어 ×0.75
    // 관우 atk = 51 × 1.12(청룡언월도) = 57.12. 유비 통솔91 footman(def=S) Lv1 → base45, 구간0→S+2 = 47, ×0.75 = 35.25
    // raw = (57.12 − 35.25)/2 + 1 + 25 = 36.935. 유비=보병 → 철벽 ×0.85 → floor(31.39) = 31
    expect(computeDamage(testCtx, get("관우"), get("유비"))).toBe(31);
  });

  it("장비 런타임: weaponBonus가 부대 공격력에 곱해진다 (무기 미보유는 ×1 불변)", () => {
    // 같은 관우라도 무기 제거(weaponBonus 1.0)하면 데미지가 줄어든다 — 무기 보정이 실제 반영됨을 증명.
    // 유비=보병 → 둘 다 철벽 −15% 적용(armed 36.935→31, bare 33.875→28). 무기 보정 차이는 보존.
    const guanyuArmed = get("관우");                       // 청룡언월도 1.12
    const guanyuBare = { ...guanyuArmed, weaponBonus: 1 }; // 무기 없음
    const armed = computeDamage(testCtx, guanyuArmed, get("유비"));
    const bare = computeDamage(testCtx, guanyuBare, get("유비"));
    expect(armed).toBe(31);
    expect(bare).toBe(28); // 보정 없으면 더 낮음
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

describe("협공 (결정론 게임성 격상, CLAUDE.md §7)", () => {
  // 합성 시나리오: testMap(8×6) 안쪽에 적 방어자를 (4,3)에 두고 주변을 통제 배치.
  const scene = (units: UnitState[]): BattleState => ({ ...state, units });
  const atk = (): UnitState => ({ ...get("관우"), x: 5, y: 3 }); // player, 동쪽 인접
  const def = (): UnitState => ({ ...get("화웅"), x: 4, y: 3 }); // enemy 방어자
  const ally = (x: number, y: number, over: Partial<UnitState> = {}): UnitState =>
    ({ ...get("유비"), id: `ally_${x}_${y}`, x, y, ...over }); // player 측 (공격자 진영)

  describe("flankingCount — 포위도", () => {
    it("공격자만 인접 = 1 (협공 미발동 경계)", () => {
      expect(flankingCount(scene([atk(), def()]), atk(), def())).toBe(1);
    });
    it("공격자 + 반대편 아군 = 2 (협공 발동)", () => {
      expect(flankingCount(scene([atk(), def(), ally(3, 3)]), atk(), def())).toBe(2);
    });
    it("대각선 아군은 세지 않는다(4방만)", () => {
      expect(flankingCount(scene([atk(), def(), ally(3, 2)]), atk(), def())).toBe(1);
    });
    it("퇴각한 인접 아군은 제외", () => {
      const s = scene([atk(), def(), ally(3, 3, { retreated: true })]);
      expect(flankingCount(s, atk(), def())).toBe(1);
    });
    it("대상 인접의 적(공격자의 foe)은 포위로 세지 않는다", () => {
      const enemy2: UnitState = { ...get("화웅"), id: "enemy2", x: 4, y: 4 };
      expect(flankingCount(scene([atk(), def(), ally(3, 3), enemy2]), atk(), def())).toBe(2);
    });
    it("4방 전부 아군 점유 = 4 (완전 포위)", () => {
      const s = scene([atk(), def(), ally(3, 3), ally(4, 2), ally(4, 4)]);
      expect(flankingCount(s, atk(), def())).toBe(4);
    });
  });

  describe("flankMultiplier — 결정론 배율 (threshold 2 / step 20% / maxStacks 3)", () => {
    it("미발동(1) = 1.0", () => expect(flankMultiplier(testCtx, 1)).toBe(1));
    it("2기 포위 = +20%", () => expect(flankMultiplier(testCtx, 2)).toBeCloseTo(1.2));
    it("3기 = +40%", () => expect(flankMultiplier(testCtx, 3)).toBeCloseTo(1.4));
    it("4기 = +60%", () => expect(flankMultiplier(testCtx, 4)).toBeCloseTo(1.6));
    it("5기 이상은 maxStacks(3)로 캡 = +60%", () => expect(flankMultiplier(testCtx, 5)).toBeCloseTo(1.6));
  });

  it("computeDamage: 협공 배율이 피해를 결정론으로 키운다", () => {
    const a = atk();
    const d = def();
    const base = computeDamage(testCtx, a, d); // flankMult 기본 1
    const flanked = computeDamage(testCtx, a, d, 1, flankMultiplier(testCtx, 2));
    expect(computeDamage(testCtx, a, d, 1, 1)).toBe(base); // 1.0 = 무보너스 동일
    expect(flanked).toBeGreaterThan(base);
    expect(flanked).toBe(computeDamage(testCtx, a, d, 1, 1.2)); // 결정론 — 재현
  });
});

describe("병종 패시브 (결정론 게임성 격상, CLAUDE.md §7)", () => {
  // 상성을 고정하려고 공격자를 산적계(어떤 계열에도 상성 없음=1.0)로, 방어자도 보조계로 둬
  // 변수를 패시브 하나로 격리한다.
  it("보병 철벽: 방어자가 보병이면 피해 경감 (보조계 대비)", () => {
    const raider = { ...get("관우"), line: "bandit" as const }; // 상성 중립 공격자
    const inf = { ...get("유비"), line: "infantry" as const, x: 5, y: 1 }; // 평지
    const sup = { ...get("유비"), line: "support" as const, x: 5, y: 1 };
    const dmgInf = computeDamage(testCtx, raider, inf);
    const dmgSup = computeDamage(testCtx, raider, sup);
    expect(dmgInf).toBeLessThan(dmgSup); // 철벽 −15% 만큼 보병이 덜 맞는다
  });

  it("궁병 저격: 공격자가 궁병이면 대상 엄폐(지형 guard)를 관통 (엄폐 무시 → 더 큰 피해)", () => {
    // 방어자를 산지(2,3, guard 0.3) 보조계로 — 상성 1.0 고정, 지형만 변수
    const target = { ...get("유비"), line: "support" as const, x: 2, y: 3 };
    const cav = { ...get("관우"), line: "cavalry" as const }; // guard 전체 적용
    const arc = { ...get("관우"), line: "archer" as const }; // guard 50% 관통
    const dmgCav = computeDamage(testCtx, cav, target);
    const dmgArc = computeDamage(testCtx, arc, target);
    expect(dmgArc).toBeGreaterThan(dmgCav); // 저격이 엄폐를 깎아 피해 ↑
  });

  it("기병 돌격: 기병이 이동 후(moved) 공격 시에만 배율>1", () => {
    const cavMoved = { ...get("관우"), line: "cavalry" as const, moved: true };
    const cavStill = { ...get("관우"), line: "cavalry" as const, moved: false };
    const footMoved = { ...get("유비"), line: "infantry" as const, moved: true };
    expect(chargeMultiplier(testCtx, cavMoved)).toBeCloseTo(1.2); // 이동 기병 = +20%
    expect(chargeMultiplier(testCtx, cavStill)).toBe(1); // 제자리 기병 = 무
    expect(chargeMultiplier(testCtx, footMoved)).toBe(1); // 비기병 = 무
  });

  describe("연속공격(2중공격) — 이동력 우위", () => {
    it("이동력 차 ≥ moveGap(2)면 발동 (경기병6 → 보병4)", () => {
      expect(get("관우").move - get("유비").move).toBeGreaterThanOrEqual(2);
      expect(doubleStrikes(testCtx, get("관우"), get("유비"))).toBe(true);
    });
    it("동급 이동력은 미발동 (경기병 ↔ 경기병)", () => {
      expect(doubleStrikes(testCtx, get("관우"), get("화웅"))).toBe(false);
    });
    it("느린 공격자는 미발동 (보병 → 경기병)", () => {
      expect(doubleStrikes(testCtx, get("유비"), get("관우"))).toBe(false);
    });
    it("아이템 연속공격 부여: grantsDoubleStrike면 이동력 무관 발동", () => {
      const slow = { ...get("유비"), grantsDoubleStrike: true }; // 보병(느림)인데 부여
      expect(doubleStrikes(testCtx, slow, get("관우"))).toBe(true);
    });
  });

  describe("아이템 방어 효과 (§7 damageReduction)", () => {
    it("방어 보물 등의 damageReduction이 받는 피해를 경감", () => {
      const base = computeDamage(testCtx, get("화웅"), get("관우"));
      const guarded = { ...get("관우"), damageReduction: 0.3 };
      const reduced = computeDamage(testCtx, get("화웅"), guarded);
      expect(reduced).toBeLessThan(base);           // 경감 적용
      expect(reduced).toBeGreaterThanOrEqual(Math.floor(base * 0.7) - 1); // 대략 −30%
    });
  });
});
