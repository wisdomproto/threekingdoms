import { describe, expect, it } from "vitest";
import { GAME_WIDTH, GAME_HEIGHT, gameViewportScale } from "../gameViewportMath";

describe("gameplay viewport", () => {
  it.each([[667, 375], [844, 390], [390, 844], [1024, 768], [1920, 1080], [2560, 1080]])(
    "contains the same 16:9 canvas in %s × %s without cropping",
    (width, height) => {
      const scale = gameViewportScale(width, height);
      expect(GAME_WIDTH * scale).toBeLessThanOrEqual(width + 0.001);
      expect(GAME_HEIGHT * scale).toBeLessThanOrEqual(height + 0.001);
      expect((GAME_WIDTH * scale) / (GAME_HEIGHT * scale)).toBeCloseTo(16 / 9);
      expect(Math.min(width - GAME_WIDTH * scale, height - GAME_HEIGHT * scale)).toBeCloseTo(0);
    },
  );
  it("waits for a measurable viewport", () => {
    expect(gameViewportScale(0, 450)).toBe(0);
    expect(gameViewportScale(800, -1)).toBe(0);
    expect(gameViewportScale(Infinity, 450)).toBe(0);
  });
});
