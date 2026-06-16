/**
 * attackPreview 단위 테스트 (Tier 1-1).
 * 핵심 계약: buildAttackPreview의 피해/반격/퇴각 예측이 **엔진 applyAction 실제 결과와 일치**한다.
 *   → 예측 패널이 거짓말하지 않음을 엔진 진실로 교차검증(결정론이므로 정확히 같아야 함).
 *
 * 매치업은 사수관 ctx에서 **일기토 트리거가 없는** 조합을 쓴다(관우↔화웅은 듀얼이라 제외):
 *  - 장비(경기병, player, 사거리1) vs 조잠(보병, enemy, 사거리1) → 일반 교전·반격
 *  - 이숙(궁병, enemy) → 간접공격(사거리 밖) 반격 없음
 */
import { describe, expect, it } from "vitest";
import { applyAction, createBattle, distance, hitChance, agilityPower } from "@tk/engine";
import type { BattleEvent, BattleState } from "@tk/engine";
import { buildAttackPreview } from "../attackPreview";
import { findUnit, sishuiCtx, withUnit } from "./fixtures";

const ctx = sishuiCtx;
const SEED = 42;

function damageEvents(
  events: BattleEvent[],
): Array<{ counter: boolean; damage: number; defenderId: string }> {
  return events.filter(
    (e): e is Extract<BattleEvent, { type: "damageDealt" }> => e.type === "damageDealt",
  );
}

/** 장비 옆 칸에 조잠을 두고 둘 다 충분 병력으로 — 일반 교전(듀얼 없음) 결정론 상태 */
function meleeState(zhangfeiTroops = 9999, caoTroops = 9999): BattleState {
  const s0 = createBattle(ctx, SEED);
  const zf = findUnit(s0, "장비");
  let s = withUnit(s0, "장비", { x: zf.x, y: zf.y, troops: zhangfeiTroops, maxTroops: 99999 });
  s = withUnit(s, "조잠", { x: zf.x - 1, y: zf.y, troops: caoTroops, maxTroops: 99999 });
  expect(findUnit(s, "장비").rangeMin).toBe(1);
  expect(findUnit(s, "조잠").rangeMax).toBeGreaterThanOrEqual(1);
  return s;
}

describe("buildAttackPreview", () => {
  it("좌표에 적이 없거나 아군이면 null", () => {
    const s = createBattle(ctx, SEED);
    const ally = findUnit(s, "유비");
    expect(buildAttackPreview(ctx, s, "장비", { x: ally.x, y: ally.y })).toBeNull(); // 아군
    expect(buildAttackPreview(ctx, s, "장비", { x: -1, y: -1 })).toBeNull(); // 빈 칸
  });

  it("근접 교전: 피해·반격이 엔진 applyAction 결과와 정확히 일치", () => {
    const s = meleeState();
    const zf = findUnit(s, "장비");
    const cao = findUnit(s, "조잠");

    const preview = buildAttackPreview(ctx, s, "장비", { x: cao.x, y: cao.y });
    expect(preview).not.toBeNull();
    expect(preview!.willRetreat).toBe(false); // 병력 충분

    const res = applyAction(ctx, s, { type: "attack", unitId: "장비", targetId: "조잠" });
    const dmgs = damageEvents(res.events);
    // 장비(경기병6)→조잠(보병4)은 이동력 차 2 → 연속공격(2타). preview.damage는 2타 합산.
    const hits = dmgs.filter((d) => !d.counter && d.defenderId === "조잠");
    const ctr = dmgs.find((d) => d.counter);

    expect(preview!.damage).toBe(hits.reduce((s2, h) => s2 + h.damage, 0));
    // 거리1 ≤ 조잠 사거리 → 반격 성립, 수치 일치
    expect(distance({ x: zf.x, y: zf.y }, { x: cao.x, y: cao.y })).toBe(1);
    expect(preview!.counter).toBeDefined();
    expect(preview!.counter!.damage).toBe(ctr!.damage);
  });

  it("hitPercent가 엔진 hitChance와 일치 (공격·반격, §2-1 시드확률)", () => {
    const s = meleeState();
    const zf = findUnit(s, "장비");
    const cao = findUnit(s, "조잠");
    const pv = buildAttackPreview(ctx, s, "장비", { x: cao.x, y: cao.y })!;
    const acc = ctx.data.combat.accuracy;
    expect(pv.hitPercent).toBe(hitChance(agilityPower(zf), agilityPower(cao), acc));
    expect(pv.counter?.hitPercent).toBe(hitChance(agilityPower(cao), agilityPower(zf), acc));
  });

  it("격파: 방어자 병력이 피해 미만이면 willRetreat=true, 반격 없음", () => {
    const probeState = meleeState();
    const probe = buildAttackPreview(ctx, probeState, "장비", {
      x: findUnit(probeState, "조잠").x,
      y: findUnit(probeState, "조잠").y,
    })!;
    const s = meleeState(9999, Math.max(1, probe.damage - 1)); // 조잠 병력 < 피해 → 한 방 격파

    const cao = findUnit(s, "조잠");
    const preview = buildAttackPreview(ctx, s, "장비", { x: cao.x, y: cao.y })!;
    expect(preview.willRetreat).toBe(true);
    expect(preview.counter).toBeUndefined(); // 퇴각하면 반격 없음

    const res = applyAction(ctx, s, { type: "attack", unitId: "장비", targetId: "조잠" });
    expect(res.events.some((e) => e.type === "unitRetreated" && e.unitId === "조잠")).toBe(true);
    expect(damageEvents(res.events).some((d) => d.counter)).toBe(false);
  });

  it("간접공격: 궁병이 사거리 밖에서 때리면 반격 없음", () => {
    const s0 = createBattle(ctx, SEED);
    const isu = findUnit(s0, "이숙"); // 궁병
    const target = findUnit(s0, "장비"); // 사거리1 방어자
    const dx = Math.max(2, isu.rangeMin); // 장비 사거리(1) 밖 + 이숙 사거리 안
    let s = withUnit(s0, "이숙", { x: target.x - dx, y: target.y });
    s = withUnit(s, "장비", { x: target.x, y: target.y, troops: 9999, maxTroops: 99999 });

    const d = distance(
      { x: findUnit(s, "이숙").x, y: findUnit(s, "이숙").y },
      { x: target.x, y: target.y },
    );
    expect(d).toBeGreaterThan(findUnit(s, "장비").rangeMax); // 방어자 사거리 밖 → 반격 불가
    expect(d).toBeGreaterThanOrEqual(isu.rangeMin); // 이숙 사거리 안
    expect(d).toBeLessThanOrEqual(isu.rangeMax);

    const preview = buildAttackPreview(ctx, s, "이숙", { x: target.x, y: target.y })!;
    expect(preview.willRetreat).toBe(false);
    expect(preview.counter).toBeUndefined();

    // 엔진 교차검증은 적 페이즈에서 (이숙=enemy). buildAttackPreview는 페이즈 무관(순수 예측).
    const enemyPhase: BattleState = { ...s, phase: "enemy" };
    const res = applyAction(ctx, enemyPhase, { type: "attack", unitId: "이숙", targetId: "장비" });
    expect(damageEvents(res.events).some((dd) => dd.counter)).toBe(false);
  });

  it("협공: 대상 반대편 아군이 있으면 flank 발동 + 피해가 엔진과 일치", () => {
    const s0 = meleeState(); // 장비(zf), 조잠(zf.x-1) — 협공 없음
    const cao = findUnit(s0, "조잠");
    // 조잠 서쪽(장비 반대편)에 아군 유비 배치 → 장비(동)+유비(서) 협공 2기
    const s = withUnit(s0, "유비", { x: cao.x - 1, y: cao.y });

    const noFlank = buildAttackPreview(ctx, s0, "장비", { x: cao.x, y: cao.y })!;
    expect(noFlank.flank).toBeUndefined(); // 공격자만 인접 = 미발동

    const withFlank = buildAttackPreview(ctx, s, "장비", { x: cao.x, y: cao.y })!;
    expect(withFlank.flank).toBeDefined();
    expect(withFlank.flank!.surround).toBe(2);
    expect(withFlank.flank!.bonusPercent).toBe(20);
    expect(withFlank.damage).toBeGreaterThan(noFlank.damage); // 확정 추가피해

    // 엔진 교차검증: applyAction 피해가 예측과 정확히 일치 + flank 이벤트 emit
    const res = applyAction(ctx, s, { type: "attack", unitId: "장비", targetId: "조잠" });
    const hits = damageEvents(res.events).filter((d) => !d.counter && d.defenderId === "조잠");
    expect(withFlank.damage).toBe(hits.reduce((a, h) => a + h.damage, 0)); // 연속공격이면 2타 합산
    expect(res.events.some((e) => e.type === "flank" && e.defenderId === "조잠")).toBe(true);
  });

  it("기병 돌격: 이동 후 공격이면 charge 발동(+20%), 제자리면 미발동", () => {
    const s0 = createBattle(ctx, SEED);
    const zf = findUnit(s0, "장비"); // lightCavalry = 기병

    // 이동 후 공격: preview(조잠 인접 칸)로 이동 예정 → 돌격
    const cao = { x: zf.x - 2, y: zf.y };
    let s = withUnit(s0, "조잠", { x: cao.x, y: cao.y, troops: 9999, maxTroops: 99999 });
    s = withUnit(s, "장비", { x: zf.x, y: zf.y, troops: 9999, maxTroops: 99999, moved: false });
    const movedPrev = buildAttackPreview(ctx, s, "장비", cao, { x: zf.x - 1, y: zf.y })!;
    expect(movedPrev.charge).toBeDefined();
    expect(movedPrev.charge!.bonusPercent).toBe(20);

    // 제자리 공격(현위치에서 인접 적, from 미지정): 돌격 없음
    let s2 = withUnit(s0, "조잠", { x: zf.x - 1, y: zf.y, troops: 9999, maxTroops: 99999 });
    s2 = withUnit(s2, "장비", { x: zf.x, y: zf.y, troops: 9999, maxTroops: 99999, moved: false });
    const stillPrev = buildAttackPreview(ctx, s2, "장비", { x: zf.x - 1, y: zf.y })!;
    expect(stillPrev.charge).toBeUndefined();
  });

  it("연속공격: 빠른 병종(장비 경기병)이 느린 적(조잠 보병)에게 2타 — 총피해 엔진과 일치", () => {
    const s = meleeState(); // 장비(경기병 move6) zf, 조잠(보병 move4) zf.x-1, 둘 다 9999
    const cao = findUnit(s, "조잠");
    const preview = buildAttackPreview(ctx, s, "장비", { x: cao.x, y: cao.y })!;
    expect(preview.doubleStrike).toBeDefined(); // 이동력 차 2 → 발동

    const res = applyAction(ctx, s, { type: "attack", unitId: "장비", targetId: "조잠" });
    const hits = damageEvents(res.events).filter((d) => !d.counter && d.defenderId === "조잠");
    expect(hits.length).toBe(2); // 2회 타격
    expect(hits[0]!.damage + hits[1]!.damage).toBe(preview.damage); // 합 = 예측 총피해
    expect(res.events.some((e) => e.type === "doubleStrike")).toBe(true);
  });

  it("이동 후 공격: from(preview) 기준으로 평가 — move→attack 엔진 결과와 일치", () => {
    const s0 = createBattle(ctx, SEED);
    const zf = findUnit(s0, "장비");
    const cao = { x: zf.x - 2, y: zf.y }; // 현위치(거리2)는 공격 불가, preview(거리1)에서 가능
    let s = withUnit(s0, "조잠", { x: cao.x, y: cao.y, troops: 9999, maxTroops: 99999 });
    s = withUnit(s, "장비", { x: zf.x, y: zf.y, troops: 9999, maxTroops: 99999 });
    const preview = { x: zf.x - 1, y: zf.y };

    const fromPreview = buildAttackPreview(ctx, s, "장비", cao, preview)!;

    const moved = applyAction(ctx, s, { type: "move", unitId: "장비", to: preview });
    const attacked = applyAction(ctx, moved.state, {
      type: "attack",
      unitId: "장비",
      targetId: "조잠",
    });
    const hits = damageEvents(attacked.events).filter((dd) => !dd.counter && dd.defenderId === "조잠");
    expect(fromPreview.damage).toBe(hits.reduce((a, h) => a + h.damage, 0)); // 연속공격이면 2타 합산
  });
});
