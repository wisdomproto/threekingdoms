import { expect, it } from "vitest";
import { hasLoadedWeakPose, isLowHealth, lowHealthTint } from "../lowHealth";

it("uses weak poses from the loaded tier fallback without changing character identity", () => {
  const candidates = ["hero/t2", "hero", "generic"];
  expect(hasLoadedWeakPose(candidates, id => id === "hero", id => id === "hero")).toBe(true);
  expect(hasLoadedWeakPose(candidates, () => true, id => id === "hero")).toBe(false);
  expect(hasLoadedWeakPose(candidates, id => id !== "hero/t2", id => id === "generic")).toBe(false);
  expect(hasLoadedWeakPose(candidates, () => false, () => true)).toBe(false);
});

it("enters at 30 percent, clears on healing, and excludes retreat and invalid maxima", () => {
  expect(isLowHealth(30, 100)).toBe(true);
  expect(isLowHealth(31, 100)).toBe(false);
  expect(isLowHealth(0, 100)).toBe(false);
  expect(isLowHealth(1, 0)).toBe(false);
});
it("pulses tint smoothly without hiding the character", () => {
  expect(lowHealthTint(0)).toBe(0xffffff);
  expect(lowHealthTint(800)).toBe(0xffbec3);
  expect(lowHealthTint(1600)).toBe(0xffffff);
});
