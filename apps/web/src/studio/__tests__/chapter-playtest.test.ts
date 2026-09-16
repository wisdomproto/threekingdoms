import { describe, expect, it } from "vitest";
import { gameData } from "@tk/data";
import { importLegacyChapter } from "@tk/data/authoring-project";
import { createChapterTest, nextChapterNode, parseChapterTest } from "../chapter-playtest";
const catalogs = { commanders: gameData.commanders, items: gameData.items, rosters: gameData.rosters };
function fixture() {
  const stage = gameData.stages["05-sishuiguan"]!;
  const project = importLegacyChapter({ id: "project", name: "test", stages: [stage], maps: [gameData.maps[stage.mapId]!] });
  return { project, chapter: project.chapters[0]! };
}
describe("chapter flow playtest", () => {
  it("runs scene completion and separate victory/defeat branches using immutable data", () => {
    const { project, chapter } = fixture(), original = structuredClone(project);
    const test = createChapterTest(project, chapter.id, catalogs, "run", "storage");
    const battle = test.nodes.find(n => n.kind === "battle")!;
    expect(nextChapterNode(test, test.entry, "completed")).toBe(battle.id);
    expect(nextChapterNode(test, battle.id, "victory")).toBe(battle.next.victory);
    expect(nextChapterNode(test, battle.id, "defeat")).toBe(battle.next.defeat);
    expect(() => nextChapterNode(test, battle.id, "completed")).toThrow();
    expect(project).toEqual(original);
    test.nodes[0]!.name = "Changed snapshot";
    expect(project).toEqual(original);
  });
  it("rejects broken branches and invalid runtime data before starting", () => {
    const { project, chapter } = fixture();
    const battle = chapter.stages.find(n => n.kind === "battle")!;
    delete battle.next.defeat;
    expect(() => createChapterTest(project, chapter.id, catalogs, "run", "storage")).toThrow("defeat");
    battle.next.defeat = chapter.stages.find(n => n.kind === "end")!.id;
    project.battles[0]!.data.turnLimit = null;
    expect(() => createChapterTest(project, chapter.id, catalogs, "run", "storage")).toThrow("검증 실패");
  });
  it("rejects duplicate step IDs and unknown completion events", () => {
    const { project, chapter } = fixture();
    const test = createChapterTest(project, chapter.id, catalogs, "run", "storage");
    expect(() => nextChapterNode(test, "missing", "victory")).toThrow();
    test.nodes.push(test.nodes[0]!);
    expect(() => parseChapterTest(test)).toThrow("중복");
  });
});
