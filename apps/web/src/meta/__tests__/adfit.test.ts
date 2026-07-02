/**
 * 애드핏 배너 게이트(§13) — 광고단위 미발급/adFree면 절대 그리지 않는다.
 * 렌더는 DOM(애드핏 스크립트) 의존이라 순수 게이트 함수만 검증.
 */
import { describe, it, expect } from "vitest";
import { adfitVisible } from "../AdFitBanner";

describe("adfitVisible", () => {
  it("광고단위 코드가 없으면 안 그림(발급 전 배포 무해)", () => {
    expect(adfitVisible(undefined, false)).toBe(false);
    expect(adfitVisible("", false)).toBe(false);
    expect(adfitVisible("   ", false)).toBe(false);
  });

  it("adFree(광고제거 구매)면 코드가 있어도 안 그림 — §13 불가침", () => {
    expect(adfitVisible("DAN-abc123", true)).toBe(false);
  });

  it("코드 있고 adFree 아니면 그림", () => {
    expect(adfitVisible("DAN-abc123", false)).toBe(true);
  });
});
