import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import { computeDamage } from "../src/combat";
import type { BattleContext, BattleState, UnitState } from "../src/types";
import { testCtx } from "./fixtures";

const fresh = () => createBattle(testCtx, 42);
const get = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;

/** 테스트용: 유닛을 강제로 특정 위치/상태로 덮어쓴 사본 */
function patchUnit(s: BattleState, id: string, patch: Partial<UnitState>): BattleState {
  return { ...s, units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) };
}

describe("명중/회피 롤 (시드 고정 §2-1)", () => {
  it("같은 시드 → 같은 명중 결과·rngState (재현)", () => {
    const s = patchUnit(fresh(), "이숙", { x: 1, y: 3 }); // 관우(1,4) 인접
    const r1 = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    const r2 = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(r1.events).toEqual(r2.events);
    expect(r1.state.rngState).toBe(r2.state.rngState);
  });

  it("공격은 rngState를 전진시킨다", () => {
    const s = patchUnit(fresh(), "이숙", { x: 1, y: 3 });
    const { state } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(state.rngState).not.toBe(s.rngState);
  });

  it("순발 우위면 1타 항상 명중(hit=true)", () => {
    let st = patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 1 });
    st = patchUnit(st, "관우", { agility: 100 });
    const { events } = applyAction(testCtx, st, { type: "attack", unitId: "관우", targetId: "이숙" });
    const dd = events.find((e) => e.type === "damageDealt" && !e.counter);
    expect(dd && dd.type === "damageDealt" && dd.hit).toBe(true);
  });

  it("미스면 damageDealt.hit=false·피해0, 방어자 병력 불변·공격자 SP 0", () => {
    // 순발 열세 → 하한 80% 명중(20% 미스). 시드 스윕으로 미스 1건 확보.
    // doubleStrike 비활성(관우 baseMove 낮춤) + 이숙 인접 반격 없음(사거리 2) → 1타만 → 미스 시 참여 SP 0.
    let missed = false;
    for (let seed = 0; seed < 60 && !missed; seed++) {
      let st = patchUnit(createBattle(testCtx, seed), "이숙", { x: 1, y: 3, agility: 100 });
      st = patchUnit(st, "관우", { agility: 1, baseMove: 2 });
      const before = get(st, "이숙").troops;
      const { events, state } = applyAction(testCtx, st, { type: "attack", unitId: "관우", targetId: "이숙" });
      const dd = events.find((e) => e.type === "damageDealt");
      if (dd && dd.type === "damageDealt" && dd.hit === false) {
        missed = true;
        expect(dd.damage).toBe(0);
        expect(get(state, "이숙").troops).toBe(before);
        expect(get(state, "관우").sp ?? 0).toBe(0);
      }
    }
    expect(missed).toBe(true);
  });
});

describe("전투 특성 (Phase C)", () => {
  // 관우(공격자, 순발 우위로 항상 명중)가 이숙을 친다. 이숙=사거리1·고병력(반격 가능·다단 생존).
  const base = () => {
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 1, rangeMin: 1, rangeMax: 1, troops: 9999, maxTroops: 9999 });
    s = patchUnit(s, "관우", { agility: 100, baseMove: 2 }); // baseMove2 = 레거시 doubleStrike 비활성
    return s;
  };
  const atk = (s: BattleState) => applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });

  it("무반격: 공격자 noCounter면 반격 damageDealt 없음(대조: 평소 1회)", () => {
    const ctr = atk(patchUnit(base(), "관우", { agility: 100, baseMove: 2, noCounter: true }))
      .events.filter((e) => e.type === "damageDealt" && e.counter === true);
    expect(ctr.length).toBe(0);
    const ctr2 = atk(base()).events.filter((e) => e.type === "damageDealt" && e.counter === true);
    expect(ctr2.length).toBe(1);
  });

  it("관통 multiHit=3: 개시 비반격 damageDealt 3개(레거시 2타 미적용)", () => {
    const non = atk(patchUnit(base(), "관우", { agility: 100, baseMove: 2, multiHit: 3 }))
      .events.filter((e) => e.type === "damageDealt" && e.counter === false);
    expect(non.length).toBe(3);
  });

  it("재반격 counterStrikes=2: 반격 damageDealt 2개", () => {
    const s = patchUnit(base(), "이숙", { x: 1, y: 3, agility: 1, rangeMin: 1, rangeMax: 1, troops: 9999, maxTroops: 9999, counterStrikes: 2 });
    const ctr = atk(s).events.filter((e) => e.type === "damageDealt" && e.counter === true);
    expect(ctr.length).toBe(2);
  });

  it("고정 피해 flatDamagePerLevel: 방어/상성 무관 = 값×(lv+1)", () => {
    const ev = atk(patchUnit(base(), "관우", { agility: 100, baseMove: 2, flatDamagePerLevel: 10, level: 1 }))
      .events.find((e) => e.type === "damageDealt" && e.counter === false);
    expect(ev && ev.type === "damageDealt" && ev.damage).toBe(20);
  });

  it("필중 alwaysHit: 순발 열세여도 항상 명중", () => {
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 100, troops: 9999, maxTroops: 9999 });
    s = patchUnit(s, "관우", { agility: 1, baseMove: 2, alwaysHit: true });
    const ev = atk(s).events.find((e) => e.type === "damageDealt" && e.counter === false);
    expect(ev && ev.type === "damageDealt" && ev.hit).toBe(true);
  });
});

describe("상태이상 (Phase D)", () => {
  const base = () => {
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 1, rangeMin: 1, rangeMax: 1, troops: 9999, maxTroops: 9999 });
    s = patchUnit(s, "관우", { agility: 100, baseMove: 2 });
    return s;
  };

  it("부여: chance=100이면 적중 시 statusApplied + 방어자 statuses", () => {
    const s = patchUnit(base(), "관우", { agility: 100, baseMove: 2, inflictStatuses: [{ kind: "poison", chance: 100, turns: 3 }] });
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(events.some((e) => e.type === "statusApplied" && e.kind === "poison")).toBe(true);
    expect(get(state, "이숙").statuses).toEqual([{ kind: "poison", turns: 3 }]);
  });

  it("부여 chance=0: 상태 없음", () => {
    const s = patchUnit(base(), "관우", { agility: 100, baseMove: 2, inflictStatuses: [{ kind: "poison", chance: 0, turns: 3 }] });
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(events.some((e) => e.type === "statusApplied")).toBe(false);
    expect(get(state, "이숙").statuses ?? []).toEqual([]);
  });

  it("중독 틱: enemy 페이즈 진입 시 중독 피해 이벤트", () => {
    let s = patchUnit(base(), "이숙", { x: 1, y: 3, troops: 9999, maxTroops: 9999, statuses: [{ kind: "poison", turns: 2 }] });
    // 유비만 미행동(마지막 player 행동), 나머지 player는 acted, ally는 retreated로 스킵 → 다음=enemy.
    s = { ...s, units: s.units.map((u) =>
      u.side === "ally" ? { ...u, retreated: true }
        : (u.side === "player" && u.id !== "유비") ? { ...u, acted: true } : u) };
    const { events } = applyAction(testCtx, s, { type: "wait", unitId: "유비" });
    expect(events.some((e) => e.type === "statusTick" && e.unitId === "이숙" && e.kind === "poison")).toBe(true);
  });

  it("부동: immobilize면 move throw, attack은 가능", () => {
    const s = patchUnit(base(), "관우", { statuses: [{ kind: "immobilize", turns: 2 }] });
    const dest = { x: get(s, "관우").x, y: get(s, "관우").y - 1 };
    expect(() => applyAction(testCtx, s, { type: "move", unitId: "관우", to: dest })).toThrow("부동");
    const s2 = patchUnit(s, "관우", { agility: 100, statuses: [{ kind: "immobilize", turns: 2 }] });
    expect(() => applyAction(testCtx, s2, { type: "attack", unitId: "관우", targetId: "이숙" })).not.toThrow();
  });

  it("금책: seal이면 strategy throw", () => {
    const caster = fresh().units.find((u) => u.side === "player" && u.mp > 0);
    if (!caster) return;
    const sid = testCtx.data.unitClasses[caster.classId]?.strategies[0];
    if (!sid) return;
    const s = patchUnit(fresh(), caster.id, { statuses: [{ kind: "seal", turns: 2 }] });
    expect(() => applyAction(testCtx, s, { type: "strategy", unitId: caster.id, strategyId: sid, target: { x: caster.x, y: caster.y } })).toThrow("금책");
  });
});

describe("흡혈 (Phase E)", () => {
  it("lifestealPercent: 입힌 피해 비례 자가 회복 + troopsHealed", () => {
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 1, rangeMin: 1, rangeMax: 1, troops: 9999, maxTroops: 9999 });
    s = patchUnit(s, "관우", { agility: 100, baseMove: 2, troops: 100, maxTroops: 9999, lifestealPercent: 50, noCounter: true });
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    const dmg = events.filter((e) => e.type === "damageDealt" && e.counter === false && e.hit)[0];
    const heal = events.find((e) => e.type === "troopsHealed" && e.unitId === "관우");
    expect(heal).toBeTruthy();
    if (heal && heal.type === "troopsHealed" && dmg && dmg.type === "damageDealt") {
      expect(heal.amount).toBe(Math.floor(dmg.damage * 0.5));
      expect(get(state, "관우").troops).toBe(100 + heal.amount);
    }
  });

  it("흡혈 회복은 maxTroops 상한", () => {
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 1, rangeMin: 1, rangeMax: 1, troops: 9999, maxTroops: 9999 });
    s = patchUnit(s, "관우", { agility: 100, baseMove: 2, troops: 95, maxTroops: 100, lifestealPercent: 100, noCounter: true });
    const { state } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(get(state, "관우").troops).toBe(100); // 상한 클램프
  });
});

describe("필살 게이지(SP) 누적 (§9)", () => {
  it("공격 시 공격자 +onAttack, 피격자 생존 시 +onHitTaken (결정론)", () => {
    const sp = testCtx.data.combat.sp;
    // 이숙(궁병)을 관우(1,4) 인접 (1,3)에 두고 관우가 공격 — 일기토 없음, 이숙 사거리(2)라 인접 반격 없음
    const s0 = patchUnit(fresh(), "이숙", { x: 1, y: 3 });
    expect(get(s0, "관우").sp).toBe(0);
    const { state } = applyAction(testCtx, s0, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(get(state, "이숙").retreated).toBe(false); // 생존
    expect(get(state, "관우").sp).toBe(sp.onAttack);   // 공격자 누적
    expect(get(state, "이숙").sp).toBe(sp.onHitTaken);  // 피격자 누적
  });

  it("SP는 maxSp로 클램프된다", () => {
    const sp = testCtx.data.combat.sp;
    const s0 = patchUnit(patchUnit(fresh(), "이숙", { x: 1, y: 3 }), "관우", { sp: sp.max - 5 });
    const { state } = applyAction(testCtx, s0, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(get(state, "관우").sp).toBe(sp.max); // max-5 + onAttack(25) → max 클램프
  });
});

describe("applyAction: ultimate (필살)", () => {
  it("SP 가득 시 필살 — 일반보다 큰 피해 + SP 소진 + ultimate 이벤트", () => {
    const sp = testCtx.data.combat.sp;
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3 }); // 관우 인접
    s = patchUnit(s, "관우", { sp: sp.max });
    const normal = computeDamage(testCtx, get(s, "관우"), get(s, "이숙"));
    const { state, events } = applyAction(testCtx, s, { type: "ultimate", unitId: "관우", targetId: "이숙" });
    const ult = events.find((e) => e.type === "ultimate");
    expect(ult && ult.type === "ultimate").toBe(true);
    if (ult && ult.type === "ultimate") {
      expect(ult.damage).toBeGreaterThan(normal); // 필살 > 일반
      expect(ult.name).toBe("청룡언월"); // 관우 네임드 시그니처(§8 고유 스킬)
    }
    expect(get(state, "관우").sp).toBe(0); // SP 소진
    expect(get(state, "관우").acted).toBe(true);
  });
  it("SP 미충전이면 필살 불가(throw)", () => {
    const s = patchUnit(fresh(), "이숙", { x: 1, y: 3 }); // 관우 sp=0
    expect(() => applyAction(testCtx, s, { type: "ultimate", unitId: "관우", targetId: "이숙" })).toThrow();
  });
});

describe("콤보(연속 격파) (§7/§12)", () => {
  it("아군 연속 격파 → combo 증가 + 보너스 자금 적립(결정론)", () => {
    const gp = testCtx.data.combat.combo.goldPerStack;
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3, troops: 1 }); // 관우 인접, 한 방 격파
    s = patchUnit(s, "화웅", { x: 2, y: 4, troops: 1 });           // 유비 인접, 한 방 격파
    expect(s.combo).toBe(0);
    s = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" }).state;
    expect(s.combo).toBe(1); // 1격파
    const r = applyAction(testCtx, s, { type: "attack", unitId: "유비", targetId: "화웅" }); // 유비=일기토 없음
    expect(r.state.combo).toBe(2); // 연속 격파
    expect(r.events.some((e) => e.type === "combo" && e.count === 2)).toBe(true);
    const comboGold = r.state.pendingRewards
      .filter((p) => p.conditionId === "combo")
      .reduce((a, p) => a + p.gold, 0);
    expect(comboGold).toBe(gp * 1 + gp * 2); // 1콤보 + 2콤보 = 15 + 30
  });
});

describe("applyAction: move", () => {
  it("이동하면 위치가 바뀌고 unitMoved 이벤트, moved=true", () => {
    const s0 = fresh();
    const g0 = get(s0, "관우");
    // 관우 (1,4) → (2,4) — 인접 평지, 이동력 6 내
    const { state, events } = applyAction(testCtx, s0, { type: "move", unitId: "관우", to: { x: 2, y: 4 } });
    expect(get(state, "관우")).toMatchObject({ x: 2, y: 4, moved: true, acted: false });
    expect(events).toContainEqual({ type: "unitMoved", unitId: "관우", from: { x: g0.x, y: g0.y }, to: { x: 2, y: 4 } });
    expect(s0).toEqual(fresh()); // 원본 불변
  });

  it("이동 불가 타일(성벽)이면 에러", () => {
    // 성벽 타일 — (0,0)='#' testMap
    expect(() => applyAction(testCtx, fresh(), { type: "move", unitId: "관우", to: { x: 0, y: 0 } })).toThrow();
  });

  it("이미 행동한 유닛은 이동 불가", () => {
    const s = patchUnit(fresh(), "관우", { acted: true });
    expect(() => applyAction(testCtx, s, { type: "move", unitId: "관우", to: { x: 2, y: 4 } })).toThrow();
  });

  it("같은 턴에 이동 후 공격이 가능하고 이동한 위치 기준으로 사거리 판정한다", () => {
    // 관우 (1,4) → (6,3): 이동력 6으로 도달 가능 (비용: 각 평지 1씩 5칸 + 1 = 6)
    // 이숙 (6,2) 와 거리 1 → 공격 가능 (rangeMin=1, rangeMax=1 for 관우)
    let s = fresh();
    s = applyAction(testCtx, s, { type: "move", unitId: "관우", to: { x: 6, y: 3 } }).state;
    const { state } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(get(state, "관우").acted).toBe(true);
    expect(get(state, "이숙").troops).toBeLessThan(get(fresh(), "이숙").troops);
  });
});

describe("applyAction: attack", () => {
  it("공격하면 피해·반격이 일어나고 acted=true", () => {
    // 관우를 화웅(5,1) 인접인 (4,1)에 배치 — 일기토가 없는 조합(유비→화웅)으로 테스트하기 위해
    // 관우→화웅은 일기토 이벤트가 있으므로, 유비→이숙 공격으로 테스트
    // 유비(footman, 아군) → 이숙(archer, 적) 인접 공격
    const s = patchUnit(fresh(), "유비", { x: 6, y: 3 }); // 이숙(6,2) 인접, 거리 1
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "유비", targetId: "이숙" });
    const dmgEvts = events.filter((e) => e.type === "damageDealt");
    expect(dmgEvts.length).toBeGreaterThanOrEqual(1);
    expect(dmgEvts[0]).toMatchObject({ attackerId: "유비", defenderId: "이숙", counter: false });
    expect(get(state, "이숙").troops).toBeLessThan(get(s, "이숙").troops);
    expect(get(state, "유비").acted).toBe(true);
    // 이숙(궁병, rangeMin=2)은 거리 1에서 반격 불가 — 유비 병력 불변
    expect(dmgEvts.filter((e) => e.type === "damageDealt" && (e as { counter: boolean }).counter)).toHaveLength(0);
  });

  it("근접 보병이 살아 있으면 반격한다 — 반격 damage는 computeDamage 결정론값과 일치", () => {
    // 관우를 이숙(6,2)과 거리 1인 (6,3)에 배치 — 이숙은 궁병(rangeMin=2)이라 반격 안 함
    // 대신 화웅(lightCavalry, rangeMin=1) vs 유비(footman, rangeMin=1): 유비가 반격
    const s = patchUnit(fresh(), "유비", { x: 4, y: 1 }); // 화웅(5,1)과 거리 1
    // 적 페이즈로 강제 전환해 화웅이 공격
    const s2 = { ...s, phase: "enemy" as const };
    const { state, events } = applyAction(testCtx, s2, { type: "attack", unitId: "화웅", targetId: "유비" });
    const dmgEvts = events.filter((e) => e.type === "damageDealt");
    expect(dmgEvts.length).toBeGreaterThanOrEqual(1);
    // 유비 생존시 반격 발동
    if (!get(state, "유비").retreated) {
      const counterEvt = dmgEvts.find((e) => (e as { counter: boolean }).counter);
      expect(counterEvt).toBeDefined();
      // 반격 damage가 computeDamage(counterRatio=0.5) 결정론 값과 일치
      const ctrDmg = computeDamage(testCtx, get(s2, "유비"), get(s2, "화웅"), testCtx.data.combat.counterRatio);
      expect((counterEvt as { damage: number }).damage).toBe(ctrDmg);
    }
  });

  it("궁병 공격(rangeMin=2)에는 근접 유닛이 반격하지 못한다", () => {
    // 이숙(궁병, rangeMin=2) → 관우(거리 2): 이숙이 적 페이즈에 공격
    // 관우(rangeMin=1)는 거리 2에 있으므로 반격 가능 — 거리 판단을 위해 위치 조정
    // 이숙이 관우와 거리 1이 되도록 이숙을 (1,3)에 배치 → rangeMin=2라 관우를 공격 불가
    // 대신 이숙(6,2)이 관우(1,4)에게 공격하려면 거리=5, 사거리 2 초과
    // 이숙(6,2) → 관우를 (6,4)에 배치: 거리=2, 공격 가능. 관우(rangeMin=1)는 거리 2라 반격 불가
    const s = patchUnit(
      { ...fresh(), phase: "enemy" as const },
      "관우", { x: 6, y: 4 }
    ); // 이숙(6,2)과 거리 2
    const { events } = applyAction(testCtx, s, { type: "attack", unitId: "이숙", targetId: "관우" });
    const counterEvts = events.filter((e) => e.type === "damageDealt" && (e as { counter: boolean }).counter);
    expect(counterEvts).toHaveLength(0);
  });

  it("병력 0이 되면 퇴각(unitRetreated), 사망 없음", () => {
    // 유비를 화웅 인접에 배치하고 병력 1로 설정
    const s = patchUnit(
      patchUnit(
        { ...fresh(), phase: "enemy" as const },
        "유비", { x: 4, y: 1, troops: 1 }
      ),
      "화웅", { x: 5, y: 1 }
    );
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "화웅", targetId: "유비" });
    expect(get(state, "유비")).toMatchObject({ retreated: true, troops: 0 });
    expect(events).toContainEqual({ type: "unitRetreated", unitId: "유비" });
  });

  it("사거리 밖 공격은 에러", () => {
    // 관우(1,4) → 화웅(5,1): 거리 8, 사거리 1
    expect(() => applyAction(testCtx, fresh(), { type: "attack", unitId: "관우", targetId: "화웅" })).toThrow();
  });
});

describe("applyAction: 일기토", () => {
  it("관우→화웅 공격 시 일기토 발동: 화웅 퇴각, 일반 데미지 교환 없음", () => {
    // 관우를 화웅(5,1) 인접인 (4,1)에 배치
    const s = patchUnit(fresh(), "관우", { x: 4, y: 1 });
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "화웅" });
    expect(events).toContainEqual({
      type: "duelTriggered", eventId: "duel_관우_화웅",
      attackerId: "관우", defenderId: "화웅", winnerId: "관우",
    });
    expect(events.filter((e) => e.type === "damageDealt")).toHaveLength(0);
    expect(get(state, "화웅").retreated).toBe(true);
    expect(state.firedEvents).toContain("duel_관우_화웅");
  });

  it("화웅 퇴각으로 승리 조건(defeatUnit) 충족 → battleEnded(victory)", () => {
    const s = patchUnit(fresh(), "관우", { x: 4, y: 1 });
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "화웅" });
    expect(state.status).toBe("victory");
    expect(events).toContainEqual({ type: "battleEnded", result: "victory" });
  });

  it("일기토에서 공격자가 패자: 공격자 퇴각, 방어자 생존", () => {
    const loseCtx: BattleContext = {
      ...testCtx,
      stage: {
        ...testCtx.stage,
        events: [{
          id: "duel_관우_화웅", type: "duel" as const,
          trigger: { kind: "attack" as const, attackerId: "관우", defenderId: "화웅" },
          outcome: { winnerId: "화웅", loserRetreats: true },
          once: true,
        }],
      },
    };
    const s = patchUnit(fresh(), "관우", { x: 4, y: 1 });
    const { state } = applyAction(loseCtx, s, { type: "attack", unitId: "관우", targetId: "화웅" });
    expect(get(state, "관우").retreated).toBe(true);
    expect(get(state, "화웅").retreated).toBe(false);
    expect(state.status).toBe("ongoing"); // 관우는 군주가 아니므로 패배 아님
  });

  it("loserRetreats=false면 일기토 후 양측 모두 생존", () => {
    const noRetreatCtx: BattleContext = {
      ...testCtx,
      stage: {
        ...testCtx.stage,
        events: [{
          id: "duel_관우_화웅", type: "duel" as const,
          trigger: { kind: "attack" as const, attackerId: "관우", defenderId: "화웅" },
          outcome: { winnerId: "관우", loserRetreats: false },
          once: true,
        }],
      },
    };
    const s = patchUnit(fresh(), "관우", { x: 4, y: 1 });
    const { state, events } = applyAction(noRetreatCtx, s, { type: "attack", unitId: "관우", targetId: "화웅" });
    expect(get(state, "화웅").retreated).toBe(false);
    expect(get(state, "관우").retreated).toBe(false);
    expect(events.filter((e) => e.type === "unitRetreated")).toHaveLength(0);
    expect(state.firedEvents).toContain("duel_관우_화웅");
  });
});

describe("페이즈 전환", () => {
  it("아군 전원이 행동하면 적 페이즈로 넘어간다", () => {
    let s = fresh();
    const players = s.units.filter((u) => u.side === "player").map((u) => u.id);
    let last: ReturnType<typeof applyAction> | undefined;
    for (const id of players) {
      last = applyAction(testCtx, s, { type: "wait", unitId: id });
      s = last.state;
    }
    expect(s.phase).toBe("enemy");
    expect(last!.events).toContainEqual({ type: "phaseChanged", phase: "enemy", turn: 1 });
    for (const u of s.units.filter((u) => u.side === "enemy")) {
      expect(u.acted).toBe(false);
    }
  });

  it("적 전원이 행동하면 턴이 증가하고 아군 페이즈로 돌아온다", () => {
    let s = fresh();
    for (const id of s.units.filter((u) => u.side === "player").map((u) => u.id)) {
      s = applyAction(testCtx, s, { type: "wait", unitId: id }).state;
    }
    for (const id of s.units.filter((u) => u.side === "enemy").map((u) => u.id)) {
      s = applyAction(testCtx, s, { type: "wait", unitId: id }).state;
    }
    expect(s.phase).toBe("player");
    expect(s.turn).toBe(2);
  });

  it("자기 페이즈가 아닌 유닛의 행동은 에러", () => {
    expect(() => applyAction(testCtx, fresh(), { type: "wait", unitId: "화웅" })).toThrow();
  });
});

describe("턴 제한", () => {
  /** turnLimit=2 컨텍스트 — 2라운드는 온전히 플레이 가능, 3턴 진입 순간 defeat */
  const limitCtx: BattleContext = { ...testCtx, stage: { ...testCtx.stage, turnLimit: 2 } };

  /** 한 라운드(아군 전원 wait → 적 전원 wait)를 진행하고 마지막 액션 결과를 반환 */
  function playRound(ctx: BattleContext, s: BattleState): ReturnType<typeof applyAction> {
    let last: ReturnType<typeof applyAction> | undefined;
    for (const side of ["player", "enemy"] as const) {
      for (const u of s.units.filter((u) => u.side === side && !u.retreated)) {
        last = applyAction(ctx, s, { type: "wait", unitId: u.id });
        s = last.state;
        if (s.status !== "ongoing") return last;
      }
    }
    return last!;
  }

  it("turnLimit 라운드까지는 ongoing — 마지막 라운드도 온전히 플레이 가능", () => {
    // 1라운드 종료 → turn=2 (= turnLimit), 아직 ongoing
    const r1 = playRound(limitCtx, createBattle(limitCtx, 42));
    expect(r1.state.turn).toBe(2);
    expect(r1.state.status).toBe("ongoing");
    // 2라운드(= turnLimit번째 라운드) 중의 아군 행동도 정상 진행
    const mid = applyAction(limitCtx, r1.state, { type: "wait", unitId: "유비" });
    expect(mid.state.status).toBe("ongoing");
  });

  it("turnLimit 초과(턴 증가) 순간 defeat + battleEnded가 마지막 이벤트", () => {
    const r1 = playRound(limitCtx, createBattle(limitCtx, 42));
    const r2 = playRound(limitCtx, r1.state); // 2라운드 종료 → turn=3 > turnLimit=2
    expect(r2.state.turn).toBe(3);
    expect(r2.state.status).toBe("defeat");
    expect(r2.events).toContainEqual({ type: "phaseChanged", phase: "player", turn: 3 });
    expect(r2.events).toContainEqual({ type: "battleEnded", result: "defeat" });
    // battleEnded는 항상 큐의 마지막 (렌더러 연출 계약)
    expect(r2.events[r2.events.length - 1]).toEqual({ type: "battleEnded", result: "defeat" });
    // 종료 후 추가 행동은 거부
    expect(() => applyAction(limitCtx, r2.state, { type: "wait", unitId: "유비" })).toThrow();
  });

  it("기본 turnLimit(30) 내에서는 턴 제한이 발동하지 않는다", () => {
    let s = createBattle(testCtx, 42);
    for (let i = 0; i < 3; i++) {
      const r = playRound(testCtx, s);
      s = r.state;
      if (s.status !== "ongoing") break;
    }
    expect(s.turn).toBe(4);
    expect(s.status).toBe("ongoing");
  });
});

describe("패배 조건", () => {
  it("유비(군주) 퇴각 시 defeat", () => {
    // 유비를 화웅(5,1) 인접 (4,1)에 배치, 병력 1로
    const s = patchUnit(
      patchUnit(
        { ...fresh(), phase: "enemy" as const },
        "유비", { x: 4, y: 1, troops: 1 }
      ),
      "화웅", { x: 5, y: 1 }
    );
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "화웅", targetId: "유비" });
    expect(state.status).toBe("defeat");
    expect(events).toContainEqual({ type: "battleEnded", result: "defeat" });
  });
});
