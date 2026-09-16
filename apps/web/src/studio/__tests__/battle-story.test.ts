import { describe, expect, it } from "vitest";
import { importLegacyChapter, exportLegacyBattle } from "@tk/data/authoring-project";
import { addBattleStory } from "../battle-story";

describe("battle story attachment", () => {
  it("connects before and after stories while preserving battle fields and other branches", () => {
    const project = importLegacyChapter({ id: "test", name: "Test", maps: [], stages: [{ id: "one", name: "One", custom: { keep: true } }, { id: "two", name: "Two" }] });
    const chapter = project.chapters[0]!;
    const battle = project.battles[0]!;
    const node = chapter.stages[0]!;
    const victory = node.next.victory, defeat = node.next.defeat;
    let counter = 0;
    const nextId = () => `node-${++counter}`;
    addBattleStory(project, battle.id, "intro", "intro", nextId);
    addBattleStory(project, battle.id, "outro", "outro", nextId);
    addBattleStory(project, battle.id, "outroDefeat", "defeat", nextId);
    expect(chapter.entryStageId).toBe("node-1");
    expect(chapter.stages.find(n => n.id === "node-1")?.next.completed).toBe(node.id);
    expect(chapter.stages.find(n => n.id === node.next.victory)?.next.completed).toBe(victory);
    expect(chapter.stages.find(n => n.id === node.next.defeat)?.next.completed).toBe(defeat);
    const exported = exportLegacyBattle(project, battle.id);
    expect(exported.custom).toEqual({ keep: true });
    expect(Object.keys(exported.scenario as object)).toEqual(["intro", "outro", "outroDefeat"]);
    expect(() => addBattleStory(project, battle.id, "intro", "duplicate", nextId)).toThrow();
    expect(project.scenes).toHaveLength(3);
  });
});
