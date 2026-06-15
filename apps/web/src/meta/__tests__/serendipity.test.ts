/**
 * 기연(奇緣) 순수 로직 테스트(env=node) — §12 기연 시스템.
 * 무작위는 주입된 rng(() => number)로 결정화 → 결정적 검증(전투 밖 메타라 결정론 ethos 유지).
 */
import { describe, it, expect } from "vitest";
import {
  PULL_COST,
  PITY_CAP,
  RARE_CHANCE,
  SERENDIPITY_COMMON,
  SERENDIPITY_RARE,
  FLAVOR_LINES,
  weightedPick,
  rollSerendipity,
  pickFlavor,
  clearReward,
  isSerendipityTreasure,
} from "../serendipity";

/** 큐에 넣은 값을 순서대로 반환하는 스크립트 rng(소진 후 0). 무작위원 주입용(목 아님). */
function scriptRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++]! : 0);
}

describe("weightedPick", () => {
  const entries = [
    { weight: 1, value: "a" },
    { weight: 3, value: "b" }, // 누적 [0,1) a, [1,4) b
  ];
  it("roll=0이면 첫 엔트리", () => {
    expect(weightedPick(entries, 0)).toBe("a");
  });
  it("roll이 첫 경계 직후면 둘째 엔트리", () => {
    // 총 weight 4, roll*4 = 1.0 → b 구간 시작
    expect(weightedPick(entries, 0.25)).toBe("b");
  });
  it("roll이 1에 근접해도 마지막 엔트리(상한 클램프)", () => {
    expect(weightedPick(entries, 0.999)).toBe("b");
  });
});

describe("rollSerendipity", () => {
  it("천장 도달(pity+1>=CAP) 시 rng와 무관하게 보물 확정·pity 리셋", () => {
    const out = rollSerendipity(PITY_CAP - 1, scriptRng([0.99, 0.99])); // rng 높아 자연 rare 아님
    expect(out.wasRare).toBe(true);
    expect(out.reward.kind).toBe("item");
    expect(out.nextPity).toBe(0);
  });

  it("rng이 RARE_CHANCE 미만이면 보물(rare)·pity 리셋", () => {
    const out = rollSerendipity(0, scriptRng([RARE_CHANCE - 0.001, 0]));
    expect(out.wasRare).toBe(true);
    expect(out.reward.kind).toBe("item");
    expect(SERENDIPITY_RARE.some((r) => r.itemId === (out.reward as { itemId: string }).itemId)).toBe(true);
    expect(out.nextPity).toBe(0);
  });

  it("rng이 RARE_CHANCE 이상이면 common·pity 증가", () => {
    const out = rollSerendipity(2, scriptRng([RARE_CHANCE + 0.001, 0]));
    expect(out.wasRare).toBe(false);
    expect(out.nextPity).toBe(3);
    // common 풀의 보상 형태(gold|item)
    expect(["gold", "item"]).toContain(out.reward.kind);
  });
});

describe("pickFlavor", () => {
  it("rng으로 FLAVOR_LINES 중 하나를 결정적으로 고른다", () => {
    expect(pickFlavor(0)).toBe(FLAVOR_LINES[0]);
    expect(FLAVOR_LINES).toContain(pickFlavor(0.5));
  });
});

describe("clearReward", () => {
  it("첫 클리어는 등급 기반(S5/A4/B3/C2)", () => {
    expect(clearReward("S", true)).toBe(5);
    expect(clearReward("A", true)).toBe(4);
    expect(clearReward("B", true)).toBe(3);
    expect(clearReward("C", true)).toBe(2);
  });
  it("재도전은 등급 무관 1(파밍 방지 §11)", () => {
    expect(clearReward("S", false)).toBe(1);
    expect(clearReward("C", false)).toBe(1);
  });
});

describe("isSerendipityTreasure (도감 분리)", () => {
  it("기연 전용 보물 id는 true, 스테이지 보물은 false", () => {
    expect(isSerendipityTreasure("qiyuan-charm")).toBe(true);
    expect(isSerendipityTreasure("qiyuan-token")).toBe(true);
    expect(isSerendipityTreasure("둔갑천서")).toBe(false);
    expect(isSerendipityTreasure("청룡언월도")).toBe(false);
  });
});

describe("상수 정합", () => {
  it("PULL_COST·PITY_CAP은 양수, 풀은 비어있지 않음", () => {
    expect(PULL_COST).toBeGreaterThan(0);
    expect(PITY_CAP).toBeGreaterThan(0);
    expect(SERENDIPITY_COMMON.length).toBeGreaterThan(0);
    expect(SERENDIPITY_RARE.length).toBeGreaterThan(0);
    expect(FLAVOR_LINES.length).toBeGreaterThan(0);
  });
});
