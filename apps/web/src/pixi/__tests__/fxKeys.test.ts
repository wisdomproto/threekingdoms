import { describe, it, expect } from "vitest";
import { FX, pickFlashKey } from "../fxKeys";

describe("fxKeys", () => {
  it("FX 키 상수는 파일명과 1:1", () => {
    expect(FX.slash).toBe("slash");
    expect(FX.flash).toBe("flash");
    expect(FX.sparkle).toBe("sparkle");
    expect(FX.coin).toBe("coin");
  });
  it("pickFlashKey: big이면 대형 금빛(sparkle), 아니면 일반 섬광(flash)", () => {
    expect(pickFlashKey(true)).toBe("sparkle");  // 회심/필살
    expect(pickFlashKey(false)).toBe("flash");   // 평타/협공
  });
});
