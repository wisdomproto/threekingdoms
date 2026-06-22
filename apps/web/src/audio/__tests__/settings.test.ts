/**
 * 오디오 설정 순수 로직 테스트(env=node — window 없음).
 * clamp/normalize는 순수, load는 비브라우저에서 기본값 폴백을 확인한다.
 */
import { describe, it, expect } from "vitest";
import {
  clampVolume,
  normalizeSettings,
  loadAudioSettings,
  DEFAULT_SETTINGS,
} from "../settings";

describe("clampVolume", () => {
  it("0..1로 클램프한다", () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(2)).toBe(1);
  });
  it("비유한 입력(NaN/±Infinity)은 무효로 보고 0", () => {
    expect(clampVolume(NaN)).toBe(0);
    expect(clampVolume(Infinity)).toBe(0);
    expect(clampVolume(-Infinity)).toBe(0);
  });
});

describe("normalizeSettings", () => {
  it("누락 필드는 기본값으로 채운다", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
  it("음량은 클램프, muted는 boolean 강제", () => {
    const s = normalizeSettings({ master: 5, bgm: -2, sfx: 0.3, muted: true });
    expect(s.master).toBe(1);
    expect(s.bgm).toBe(0);
    expect(s.sfx).toBe(0.3);
    expect(s.muted).toBe(true);
  });
  it("muted 비-true 값은 false", () => {
    expect(normalizeSettings({ muted: undefined }).muted).toBe(false);
    // @ts-expect-error 손상 입력 방어 확인
    expect(normalizeSettings({ muted: "yes" }).muted).toBe(false);
  });
});

describe("loadAudioSettings (node)", () => {
  it("비브라우저(window 없음)에서 기본값을 반환한다", () => {
    expect(loadAudioSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
