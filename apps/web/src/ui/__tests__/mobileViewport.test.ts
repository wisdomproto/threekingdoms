import { expect, it } from "vitest";
import { gameViewportLayout } from "../gameViewportMath";

it("fills short mobile landscape viewports without shrinking controls", () => {
  for (const [width, height] of [[812, 230], [915, 412], [667, 300], [1180, 820]] as const) {
    const view = gameViewportLayout(width, height, true);
    expect(view.width * view.scale).toBeCloseTo(width);
    expect(view.height * view.scale).toBeCloseTo(height);
    expect(view.scale).toBeGreaterThanOrEqual(1);
  }
});
it("retains the desktop 16:9 frame", () => {
  const view = gameViewportLayout(1440, 900, false);
  expect(view.width / view.height).toBeCloseTo(16 / 9);
});
