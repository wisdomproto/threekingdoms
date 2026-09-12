import { describe, it, expect } from "vitest";
import { exitTarget } from "../lab";

describe("exitTarget — 실험실/플레이테스트 종료 목적지 (spec §6)", () => {
  it("returnUrl 없음 → /lab (현행 실험실 동작)", () => {
    expect(exitTarget(null, true)).toEqual({ kind: "navigate", to: "/lab" });
    expect(exitTarget({}, false)).toEqual({ kind: "navigate", to: "/lab" });
  });
  it("returnUrl 있음 + opener 있음 → close (에디터가 연 탭)", () => {
    expect(exitTarget({ returnUrl: "http://localhost:8082/tools/stage-editor.html" }, true)).toEqual({ kind: "close" });
  });
  it("returnUrl 있음 + opener 없음 → returnUrl 로 이동 (탭을 직접 열었거나 복사한 경우)", () => {
    expect(exitTarget({ returnUrl: "http://x/editor" }, false)).toEqual({ kind: "navigate", to: "http://x/editor" });
  });
});
