/**
 * 효과음 레지스트리 완전성(env=node — AudioContext 미생성, 순수 import만).
 * SFX 상수의 모든 키가 SYNTHS에 합성함수로 존재해야 한다(playSfx가 폴백할 절차적 소리 보장).
 * 또한 SYNTHS에만 있고 SFX로 노출 안 된 합성이 없는지(데드코드 방지) 확인한다.
 */
import { describe, it, expect } from "vitest";
import { SFX } from "../sfx";
import { SYNTHS } from "../synth";

describe("SFX ↔ SYNTHS 레지스트리", () => {
  it("모든 SFX 키가 SYNTHS에 합성함수로 존재한다", () => {
    for (const key of Object.values(SFX)) {
      expect(typeof SYNTHS[key], `SYNTHS["${key}"]`).toBe("function");
    }
  });

  it("SYNTHS의 모든 합성은 SFX로 노출된다(데드코드 없음)", () => {
    const exposed = new Set<string>(Object.values(SFX));
    for (const key of Object.keys(SYNTHS)) {
      expect(exposed.has(key), `SFX에 누락된 합성: ${key}`).toBe(true);
    }
  });
});
