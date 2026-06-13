import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import { expForNextLevel, attackPower } from "../src/combat";
import { evaluateStage } from "../src/grade";
import { corpsStat, growthCoeff } from "../src/growth";
import type { BattleContext, BattleState, UnitState } from "../src/types";
import { testCtx } from "./fixtures";

const fresh = () => createBattle(testCtx, 42);
const get = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;
function patchUnit(s: BattleState, id: string, patch: Partial<UnitState>): BattleState {
  return { ...s, units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) };
}

describe("성장 (exp/levelUp)", () => {
  it("createBattle은 exp=0으로 초기화한다", () => {
    expect(get(fresh(), "관우").exp).toBe(0);
  });

  it("expForNextLevel(level) = level×50", () => {
    expect(expForNextLevel(1)).toBe(50);
    expect(expForNextLevel(3)).toBe(150);
  });

  it("공격 시 데미지 절반만큼 경험치를 얻는다 (격파 아님)", () => {
    // 유비(footman) → 이숙(archer) 인접 공격, 이숙 궁병이라 반격 없음
    const s = patchUnit(fresh(), "유비", { x: 6, y: 3 });
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "유비", targetId: "이숙" });
    const dmg = events.find((e) => e.type === "damageDealt" && e.attackerId === "유비")! as { damage: number };
    const yubi = get(state, "유비");
    // 데미지 절반 < 50이면 레벨업 없음
    expect(yubi.exp).toBe(Math.round(dmg.damage / 2));
    expect(yubi.level).toBe(1);
    expect(events.some((e) => e.type === "levelUp")).toBe(false);
  });

  it("격파 시 추가 경험치(defenderLevel×10+20) + 누적 레벨업 emit", () => {
    // 이숙 병력 1로 만들어 유비 공격 한 방에 퇴각시킴. 이숙 Lv3 → kill보너스 = 50
    const s = patchUnit(patchUnit(fresh(), "유비", { x: 6, y: 3, exp: 49 }), "이숙", { troops: 1 });
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "유비", targetId: "이숙" });
    expect(get(state, "이숙").retreated).toBe(true);
    expect(events.some((e) => e.type === "levelUp" && e.unitId === "유비")).toBe(true);
    expect(get(state, "유비").level).toBeGreaterThan(1);
  });

  it("levelCap에 도달하면 더 이상 레벨업하지 않는다", () => {
    const capCtx: BattleContext = { ...testCtx, stage: { ...testCtx.stage, levelCap: 1 } };
    const s = patchUnit(patchUnit(fresh(), "유비", { x: 6, y: 3, exp: 9999 }), "이숙", { troops: 1 });
    const { state, events } = applyAction(capCtx, s, { type: "attack", unitId: "유비", targetId: "이숙" });
    expect(get(state, "유비").level).toBe(1);
    expect(events.some((e) => e.type === "levelUp")).toBe(false);
  });

  it("결정론 — 같은 입력은 같은 exp 결과", () => {
    const s = patchUnit(fresh(), "유비", { x: 6, y: 3 });
    const a = applyAction(testCtx, s, { type: "attack", unitId: "유비", targetId: "이숙" });
    const b = applyAction(testCtx, s, { type: "attack", unitId: "유비", targetId: "이숙" });
    expect(get(a.state, "유비").exp).toBe(get(b.state, "유비").exp);
  });
});

describe("등급계수 성장 (corpsStat / growthCoeff — sosoden-class-grades.md §2)", () => {
  it("구간표 룩업: 등급×현재값 구간 → 레벨당 가산치", () => {
    // S: 0~48 +2 / 50~68 +3 / 70~88 +4 / 90+ +4(클램프)
    expect(growthCoeff("S", 40)).toBe(2);
    expect(growthCoeff("S", 60)).toBe(3);
    expect(growthCoeff("S", 80)).toBe(4);
    expect(growthCoeff("S", 95)).toBe(4);
    // A: 70+ 빈칸 → +3 클램프
    expect(growthCoeff("A", 40)).toBe(2);
    expect(growthCoeff("A", 60)).toBe(3);
    expect(growthCoeff("A", 80)).toBe(3);
    // B: 0~48 +1 / 50~68 +2 / 70~88 +3
    expect(growthCoeff("B", 40)).toBe(1);
    expect(growthCoeff("B", 60)).toBe(2);
    expect(growthCoeff("B", 80)).toBe(3);
    // C: 70+ 빈칸 → +2 클램프
    expect(growthCoeff("C", 40)).toBe(1);
    expect(growthCoeff("C", 80)).toBe(2);
    // D: 전 구간 +1 (원작 미정의 엣지)
    expect(growthCoeff("D", 40)).toBe(1);
    expect(growthCoeff("D", 95)).toBe(1);
  });

  it("Lv0 = floor(base/2) 초기값, 성장 없음", () => {
    expect(corpsStat(98, "S", 0)).toBe(49);
    expect(corpsStat(91, "B", 0)).toBe(45);
  });

  it("증분형 누적 — 레벨마다 그 시점 구간으로 재조회", () => {
    // base 98 → 49. S등급. 49(구간0)+2=51 → 51(구간1)+3=54 → 54+3=57 ...
    expect(corpsStat(98, "S", 1)).toBe(51);
    expect(corpsStat(98, "S", 2)).toBe(54);
    expect(corpsStat(98, "S", 3)).toBe(57);
  });

  it("결정론 — base·grade·level만의 함수, 같은 입력 같은 출력", () => {
    expect(corpsStat(80, "A", 7)).toBe(corpsStat(80, "A", 7));
    expect(corpsStat(50, "B", 12)).toBe(corpsStat(50, "B", 12));
  });

  it("단조증가 — 레벨↑ → 스탯 비감소(매 등급)", () => {
    for (const g of ["S", "A", "B", "C", "D"] as const) {
      for (const base of [40, 60, 90, 100]) {
        let prev = corpsStat(base, g, 0);
        for (let lv = 1; lv <= 50; lv++) {
          const cur = corpsStat(base, g, lv);
          expect(cur).toBeGreaterThanOrEqual(prev);
          prev = cur;
        }
      }
    }
  });

  it("등급 우열 — 동일 base·level에서 S ≥ A ≥ B ≥ C ≥ D", () => {
    const base = 60, lv = 20;
    const s = corpsStat(base, "S", lv), a = corpsStat(base, "A", lv);
    const b = corpsStat(base, "B", lv), c = corpsStat(base, "C", lv), d = corpsStat(base, "D", lv);
    expect(s).toBeGreaterThanOrEqual(a);
    expect(a).toBeGreaterThanOrEqual(b);
    expect(b).toBeGreaterThanOrEqual(c);
    expect(c).toBeGreaterThanOrEqual(d);
  });

  it("attackPower가 corpsStat(무력, grades.atk, level)과 일치", () => {
    const guanyu = createBattle(testCtx, 1).units.find((u) => u.id === "관우")!;
    expect(attackPower(guanyu)).toBe(corpsStat(guanyu.war, guanyu.grades.atk, guanyu.level));
  });
});

describe("결산 평가 (evaluateStage)", () => {
  it("S: 빠른 클리어 + 무퇴각 + 보물 풀획득", () => {
    const r = evaluateStage({ turnsUsed: 4, turnLimit: 10, playerRetreats: 0, treasuresObtained: 2, totalTreasures: 2 });
    expect(r.grade).toBe("S");
  });

  it("A: ratio<=0.6 && retreats<=1 (보물 미충족이라 S 아님)", () => {
    const r = evaluateStage({ turnsUsed: 6, turnLimit: 10, playerRetreats: 1, treasuresObtained: 0, totalTreasures: 1 });
    expect(r.grade).toBe("A");
  });

  it("B: ratio<=0.9", () => {
    const r = evaluateStage({ turnsUsed: 9, turnLimit: 10, playerRetreats: 0, treasuresObtained: 0, totalTreasures: 0 });
    expect(r.grade).toBe("B");
  });

  it("C: 초과 turn 또는 많은 퇴각", () => {
    const r = evaluateStage({ turnsUsed: 10, turnLimit: 10, playerRetreats: 3, treasuresObtained: 0, totalTreasures: 0 });
    expect(r.grade).toBe("C");
  });

  it("score는 0~100으로 clamp된다", () => {
    const lo = evaluateStage({ turnsUsed: 100, turnLimit: 10, playerRetreats: 9, treasuresObtained: 0, totalTreasures: 0 });
    expect(lo.score).toBe(0);
    const hi = evaluateStage({ turnsUsed: 0, turnLimit: 10, playerRetreats: 0, treasuresObtained: 30, totalTreasures: 30 });
    expect(hi.score).toBe(100);
  });
});
