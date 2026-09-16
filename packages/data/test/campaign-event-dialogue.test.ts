import { describe, it, expect } from "vitest";
import { stages } from "../src/index";
import { loadStage, serializeStage } from "../../../tools/editor/stage-io.js";

describe("campaign event dialogue timing", () => {
  for (const stage of Object.values(stages)) {
    it(`${stage.id}: every hazard and reinforcement has a matching event cue`, () => {
      for (const script of stage.scriptEvents ?? []) {
        expect(stage.dialogue?.filter(d => d.trigger.kind === "scriptFired" && d.trigger.scriptId === script.id)).toHaveLength(1);
      }
      for (const reinforcement of stage.reinforcements ?? []) {
        expect(stage.dialogue?.some(d => d.trigger.kind === "reinforcementArrived" && d.trigger.reinforcementId === reinforcement.id)).toBe(true);
      }
      const saved = serializeStage(loadStage(JSON.parse(JSON.stringify(stage))));
      expect(saved.dialogue).toEqual(stage.dialogue);
    });
  }
  it("Bowangpo explains fire at ignition rather than the commander's retreat", () => {
    const stage = stages["18-bowangpo"]!;
    expect(stage.dialogue?.find(d => d.trigger.kind === "scriptFired")?.lines.some(l => l.speaker === "제갈량")).toBe(true);
    expect(stage.dialogue?.filter(d => d.trigger.kind === "unitRetreated").flatMap(d => d.lines).some(l => l.speaker === "제갈량")).toBe(false);
  });
});
