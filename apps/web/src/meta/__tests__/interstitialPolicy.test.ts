/**
 * 전환 전면광고 절제형 빈도 정책 단위테스트(env=node — 순수 함수).
 *  - 보스 우선 노출 / N마다 1번 / 첫 출진 무광고 가드레일을 고정한다.
 */
import { describe, it, expect } from "vitest";
import {
  shouldShowInterstitial,
  isBossStage,
  stageNumberOf,
  INTERSTITIAL_EVERY_N,
  BOSS_STAGE_NUMBERS,
} from "../interstitialPolicy";

describe("stageNumberOf", () => {
  it("'05-sishuiguan' → 5", () => {
    expect(stageNumberOf("05-sishuiguan")).toBe(5);
  });
  it("대시 없는 id도 숫자 머리를 파싱", () => {
    expect(stageNumberOf("27")).toBe(27);
  });
  it("파싱 불가면 NaN(판정에서 자연 제외)", () => {
    expect(Number.isNaN(stageNumberOf("sishuiguan"))).toBe(true);
  });
});

describe("isBossStage", () => {
  it("§5 보스 번호는 true", () => {
    for (const n of BOSS_STAGE_NUMBERS) {
      expect(isBossStage(`${String(n).padStart(2, "0")}-x`)).toBe(true);
    }
  });
  it("일반 스테이지는 false", () => {
    expect(isBossStage("05-sishuiguan")).toBe(false);
    expect(isBossStage("01-zhuojun")).toBe(false);
  });
});

describe("shouldShowInterstitial (절제형 빈도)", () => {
  it("보스 스테이지는 진행과 무관하게 무조건 노출", () => {
    expect(shouldShowInterstitial(0, "04-zhangjiao")).toBe(true);
    expect(shouldShowInterstitial(1, "27-huarongdao")).toBe(true);
  });

  it("첫 출진(cleared=0, 비보스)은 인터럽트 없음", () => {
    expect(shouldShowInterstitial(0, "01-zhuojun")).toBe(false);
  });

  it("비보스는 클리어 수가 N의 배수일 때만 노출(2~3마다 1번)", () => {
    // INTERSTITIAL_EVERY_N=3 기준: cleared 3,6,9에서만 true(비보스 스테이지).
    expect(INTERSTITIAL_EVERY_N).toBe(3);
    const nonBoss = "05-sishuiguan";
    expect(shouldShowInterstitial(1, nonBoss)).toBe(false);
    expect(shouldShowInterstitial(2, nonBoss)).toBe(false);
    expect(shouldShowInterstitial(3, nonBoss)).toBe(true);
    expect(shouldShowInterstitial(4, nonBoss)).toBe(false);
    expect(shouldShowInterstitial(6, nonBoss)).toBe(true);
  });

  it("절제: 연속 비보스 출진에서 광고는 드물게만(빈도 캡)", () => {
    const seq = Array.from({ length: 9 }, (_, i) =>
      shouldShowInterstitial(i + 1, "07-luoyang"),
    );
    // cleared 1..9 중 true는 3,6,9 → 3회뿐(매번 아님).
    expect(seq.filter(Boolean).length).toBe(3);
  });
});
