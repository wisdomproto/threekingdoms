import { describe, expect, it } from "vitest";
import { loadSpriteQueue } from "../spriteLoading";

describe("sprite loading order", () => {
  it("finishes all characters' standing poses before animation and bounds requests", async () => {
    const jobs = ["front_attack_0", "front_idle", "back_idle", "front_idle", "front_move_0"].map((pose, id) => ({ pose, id }));
    const completed: number[] = [];
    const completedAtAnimationStart: number[][] = [];
    let active = 0, peak = 0;
    await loadSpriteQueue(jobs, async job => {
      active++; peak = Math.max(peak, active);
      if (job.pose.includes("_0")) completedAtAnimationStart.push([...completed]);
      await Promise.resolve();
      completed.push(job.id); active--;
    }, 2);
    expect(peak).toBe(2);
    expect(completed).toHaveLength(jobs.length);
    expect(completedAtAnimationStart).toHaveLength(2);
    for (const standing of completedAtAnimationStart) {
      expect(standing).toEqual(expect.arrayContaining([1, 2, 3]));
    }
  });
  it("continues loading after a missing standing pose or animation frame", async () => {
    const loaded: string[] = [];
    await loadSpriteQueue([{pose:"front_idle"},{pose:"front_attack_0"},{pose:"front_attack_1"}], async job => {
      loaded.push(job.pose);
      if(job.pose !== "front_attack_1") throw new Error("404");
    }, 1);
    expect(loaded).toEqual(["front_idle","front_attack_0","front_attack_1"]);
  });
});
