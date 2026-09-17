import { describe, expect, it } from "vitest";
import { renderDensity } from "../renderDensity";

describe("canvas density inside the shared game frame", () => {
  it("renders at native desktop pixels, not an enlarged 800px bitmap", () => {
    expect(renderDensity(800, 450, 1920, 1)).toBe(2.4);
    expect(800 * renderDensity(800, 450, 3840, 1)).toBe(3840);
  });
  it("combines mobile CSS scaling with the display pixel ratio", () => {
    expect(renderDensity(800, 450, 640, 3)).toBeCloseTo(2.4);
    expect(renderDensity(800, 450, 800, 2)).toBe(2);
  });
  it("bounds backing allocations without dropping normal 4K detail", () => {
    const density = renderDensity(800, 450, 10000, 3);
    expect(800 * 450 * density ** 2).toBeLessThanOrEqual(16_777_217);
    expect(renderDensity(0, 0, 0, 1)).toBe(1);
  });
});
