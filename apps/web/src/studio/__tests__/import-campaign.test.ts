import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { describe, it, expect } from "vitest";
import { exportLegacyBattle, validateAuthoringProject } from "@tk/data/authoring-project";
import { importCampaign } from "../import-campaign";
import { createChapterTest } from "../chapter-playtest";

const directory = resolve(process.cwd(), "../../packages/data/json");
const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));

describe("full campaign migration", () => {
  it("preserves every raw battle, story map and catalog in all twelve chapters", async () => {
    const project = await importCampaign(directory, "campaign", "Full campaign");
    expect(project.battles).toHaveLength(55);
    expect(project.chapters.map(ch => ch.stages.filter(n => n.kind === "battle").length)).toEqual([4, 5, 6, 7, 5, 3, 4, 5, 3, 3, 5, 5]);
    const files = (await readdir(join(directory, "stages"))).filter(file => file.endsWith(".json"));
    for (const file of files) {
      const original = await read(join(directory, "stages", file));
      const battle = project.battles.find(b => b.data.id === original.id)!;
      expect(exportLegacyBattle(project, battle.id)).toEqual(original);
    }
    const mapFiles = (await readdir(join(directory, "maps"))).filter(file => file.endsWith(".json"));
    expect(project.maps).toHaveLength(mapFiles.length);
    for (const file of mapFiles) {
      const original = await read(join(directory, "maps", file));
      expect(project.maps.find(m => m.data.id === original.id)?.data).toEqual(original);
    }
    for (const key of ["commanders", "rosters", "items"]) {
      expect((project.catalogs as Record<string, unknown>)[key]).toEqual(await read(join(directory, `${key}.json`)));
    }
    expect(validateAuthoringProject(project).filter(issue => issue.severity === "error")).toEqual([]);
  });

  it("builds executable snapshots for all chapter nodes with local victory and defeat links", async () => {
    const project = await importCampaign(directory, "campaign", "Full campaign");
    for (const [index, chapter] of project.chapters.entries()) {
      const snapshot = createChapterTest(project, chapter.id, project.catalogs, "test", "storage");
      expect(snapshot.chapterNumber).toBe(index + 1);
      expect(snapshot.nodes).toHaveLength(chapter.stages.length);
    }
  });
});
