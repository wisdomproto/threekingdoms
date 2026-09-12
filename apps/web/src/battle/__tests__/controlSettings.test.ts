/** 조작 설정(입문 공격 확인) — 순수 정규화 + node(비브라우저) 영속 가드. */
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTROLS, loadControls, normalizeControls, saveControls } from "../controlSettings";

describe("controlSettings", () => {
  it("normalizeControls: 미지정/손상은 기본(attackConfirm=true), 명시 false는 false", () => {
    expect(normalizeControls(undefined)).toEqual({ attackConfirm: true });
    expect(normalizeControls(null)).toEqual(DEFAULT_CONTROLS);
    expect(normalizeControls({ attackConfirm: false })).toEqual({ attackConfirm: false });
    expect(normalizeControls({ attackConfirm: "x" as unknown as boolean })).toEqual({ attackConfirm: true });
  });

  it("node(window 없음): loadControls는 기본값, saveControls는 no-op", () => {
    expect(loadControls()).toEqual(DEFAULT_CONTROLS);
    expect(() => saveControls({ attackConfirm: false })).not.toThrow();
    expect(loadControls()).toEqual(DEFAULT_CONTROLS);
  });
});
