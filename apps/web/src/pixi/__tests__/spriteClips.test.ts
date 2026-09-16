import { describe, expect, it } from "vitest";
import { ATTACK_CLIP_MS, ATTACK_CONTACT_MS, spriteFrameAt, isSpriteClip } from "../spriteClips";

describe("battle sprite clip timing", () => {
  it("shows the contact drawing exactly when impact is scheduled", () => {
    expect(spriteFrameAt("attack", ATTACK_CONTACT_MS - 1)).toBe(2);
    expect(spriteFrameAt("attack", ATTACK_CONTACT_MS)).toBe(3);
    expect(spriteFrameAt("attack", ATTACK_CLIP_MS)).toBe(5);
    expect(spriteFrameAt("attack", ATTACK_CLIP_MS * 2)).toBe(5);
  });
  it("loops gait continuously across tiles and clamps invalid time", () => {
    expect(spriteFrameAt("move", 359, true)).toBe(3);
    expect(spriteFrameAt("move", 360, true)).toBe(0);
    expect(spriteFrameAt("move", 450, true)).toBe(1);
    expect(spriteFrameAt("move", -10, true)).toBe(0);
    expect(spriteFrameAt("move", NaN)).toBe(0);
  });
  it("leaves custom scene poses outside the battle clip catalog", () => {
    expect(isSpriteClip("attack")).toBe(true);
    expect(isSpriteClip("kneel")).toBe(false);
    expect(isSpriteClip("toString")).toBe(false);
  });
});
