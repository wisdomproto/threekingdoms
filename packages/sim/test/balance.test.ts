import { describe, it, expect } from "vitest";
import {
  damageTable,
  hitsToKillTable,
  skirmishSweep,
  runSkirmish,
} from "../src/balance";
import { skirmishContext, unit, REF_CLASSES } from "../src/fixtures";

describe("balance fixtures (일기토 없는 순수 교전)", () => {
  it("합성 스테이지는 events가 비어 있다 — computeDamage가 실제로 돈다", () => {
    const ctx = skirmishContext([
      unit("ace", REF_CLASSES.cavalry, 5, 120, "player", 1, 1),
      unit("mook", REF_CLASSES.infantry, 1, 120, "enemy", 3, 1),
    ]);
    expect(ctx.stage.events).toEqual([]);
  });

  it("교전이 실제로 데미지를 발생시키고 종료된다(일기토 즉승 아님)", () => {
    const ctx = skirmishContext([
      unit("ace", REF_CLASSES.cavalry, 6, 120, "player", 1, 1),
      unit("mook", REF_CLASSES.infantry, 1, 120, "enemy", 3, 1),
    ]);
    const r = runSkirmish(ctx, 0);
    expect(["victory", "defeat", "timeout"]).toContain(r.result);
    // 적이 격파되려면 데미지 누적 교전이 일어났어야 한다
    if (r.result === "victory") expect(r.enemyRetreats).toBeGreaterThan(0);
  });
});

describe("balance reports", () => {
  it("(a) 타격당 데미지 — 상성 유리가 불리보다 크다 (동일 공/방)", () => {
    const { rows } = damageTable();
    // 쫄병기병 → 쫄병보병(유리) vs 쫄병기병 → 쫄병궁병(불리), Lv1
    const adv = rows.find((r) => r.attacker.includes("쫄병기병") && r.matchup === "유리");
    const dis = rows.find((r) => r.attacker.includes("쫄병기병") && r.matchup === "불리");
    expect(adv).toBeDefined();
    expect(dis).toBeDefined();
    expect(adv!.byLevel[1]!).toBeGreaterThan(dis!.byLevel[1]!);
  });

  it("(a) 데미지는 레벨이 오를수록 단조 증가 (+Lv 상수항)", () => {
    const { rows } = damageTable();
    for (const r of rows) {
      expect(r.byLevel[5]!).toBeGreaterThanOrEqual(r.byLevel[1]!);
      expect(r.byLevel[10]!).toBeGreaterThanOrEqual(r.byLevel[5]!);
    }
  });

  it("(b) 격파 타수는 양의 정수다", () => {
    const { rows } = hitsToKillTable();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.hits).toBeGreaterThan(0);
      expect(Number.isFinite(r.hits)).toBe(true);
    }
  });

  it("(c) 스커미시 sweep — 결정론(엔진 무분산): 같은 시나리오 min=max 턴", () => {
    const { stats } = skirmishSweep(4);
    expect(stats.length).toBe(5);
    for (const s of stats) {
      // 엔진 공식은 분산이 없어 시드 스윕 전체가 동일 결과 → 턴 폭이 0
      expect(s.minTurns).toBe(s.maxTurns);
      expect(s.winRate).toBeGreaterThanOrEqual(0);
      expect(s.winRate).toBeLessThanOrEqual(100);
    }
  });

  it("(c) 레벨 우위가 승률을 높인다 (아군+2 ≥ 동레벨)", () => {
    const { stats } = skirmishSweep(2);
    const even = stats.find((s) => s.label.includes("동레벨"))!;
    const plus2 = stats.find((s) => s.label.includes("아군 +2"))!;
    expect(plus2.winRate).toBeGreaterThanOrEqual(even.winRate);
  });
});
