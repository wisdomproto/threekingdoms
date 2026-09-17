/** Local, revision-checked installation. Never publishes to a remote service. */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createProjectStore } from "../../apps/web/src/studio/project-store";
import { createGameStore } from "../../apps/web/src/studio/game-store";
import { importCampaign } from "../../apps/web/src/studio/import-campaign";
import { extendCampaign } from "../../apps/web/src/studio/extend-campaign";
import { compileGame } from "../../apps/web/src/studio/game-compiler";

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("Pass the local Samgukji Studio project UUID.");
  const root = resolve(import.meta.dirname, "../..");
  const store = createProjectStore(join(root, ".studio/projects"));
  const record = await store.read(id);
  const fresh = await importCampaign(join(root, "packages/data/json"), String(record.project.id), String(record.project.name));
  const project = extendCampaign(record.project, fresh);
  const snapshot = compileGame({ ...record, revision: record.revision + 1, project }, project.catalogs);
  const backup = join(root, ".studio/backups");
  await mkdir(backup, { recursive: true });
  await writeFile(join(backup, `${id}.before-sequel.${record.revision}.json`), JSON.stringify(record, null, 2), { flag: "wx" });
  const saved = await store.save(id, project, record.revision);
  // Explicit --activate updates the local published game; historical snapshots remain intact.
  if (process.argv.includes("--activate")) await createGameStore(join(root, ".studio/game")).activate(snapshot);
  console.log(JSON.stringify({ projectId: id, revision: saved.revision, chapters: snapshot.chapters.length, battles: Object.keys(snapshot.stages).length, activated: process.argv.includes("--activate") }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
