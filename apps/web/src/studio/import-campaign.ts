import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { importLegacyChapter, loadAuthoringProject } from "@tk/data/authoring-project";
import { CHAPTERS, chapterOf, stageNumber } from "../meta/campaign";

/** Read authoring JSON directly: runtime schema parsing would discard unknown fields. */
export async function importCampaign(directory: string, id: string, name: string) {
  const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
  const readFolder = async (folder: string) => Promise.all(
    (await readdir(join(directory, folder))).filter(file => file.endsWith(".json")).sort()
      .map(file => read(join(directory, folder, file))),
  );
  const [stages, maps, catalogs] = await Promise.all([
    readFolder("stages"), readFolder("maps"),
    Promise.all(["commanders", "rosters", "items"].map(async key => [key, await read(join(directory, `${key}.json`))])),
  ]);
  // Import once to enforce global uniqueness and preserve all maps, including story-only maps.
  const project = importLegacyChapter({ id, name, stages, maps });
  for (const stage of stages) {
    if (!chapterOf(stageNumber(stage.id))) throw new Error(`No campaign chapter for stage: ${stage.id}`);
  }
  project.chapters = CHAPTERS.map(chapter => {
    const selected = stages.filter(stage => chapterOf(stageNumber(stage.id)) === chapter.chapter)
      .sort((a, b) => stageNumber(a.id) - stageNumber(b.id));
    if (!selected.length) throw new Error(`Empty campaign chapter: ${chapter.chapter}`);
    return importLegacyChapter({ id: `${id}.chapter-${chapter.chapter}`, name: chapter.title, stages: selected, maps: [] }).chapters[0]!;
  });
  project.catalogs = loadAuthoringProject(Object.fromEntries(catalogs));
  return project;
}
