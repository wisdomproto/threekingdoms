/** Revision-checked local update, scoped to the authored sequel resources. */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadAuthoringProject, type ProjectObject } from "@tk/data/authoring-project";
import { createProjectStore } from "../../apps/web/src/studio/project-store";
import { createGameStore } from "../../apps/web/src/studio/game-store";
import { importCampaign } from "../../apps/web/src/studio/import-campaign";
import { compileGame } from "../../apps/web/src/studio/game-compiler";

async function main() {
  const [id, revisionArg] = process.argv.slice(2);
  if (!id || !revisionArg) throw new Error("Pass project UUID and the reviewed base revision.");
  const root=resolve(import.meta.dirname,"../..");
  const store=createProjectStore(join(root,".studio/projects"));
  const record=await store.read(id);
  if(record.revision!==Number(revisionArg)) throw new Error("Project changed since review; inspect edits before retrying.");
  const project=loadAuthoringProject(record.project);
  const fresh=await importCampaign(join(root,"packages/data/json"),String(project.id),String(project.name));
  const battles=project.battles as ProjectObject[];
  if(!battles.some(b=>(b.data as ProjectObject).id==="01-zhuojun") || !battles.some(b=>(b.data as ProjectObject).id==="55-jianye")) throw new Error("Expected the complete Samgukji campaign.");
  const protectedBefore=JSON.stringify(battles.filter(b=>Number.parseInt(String((b.data as ProjectObject).id))<=27));
  const sceneIds=new Set<string>(), mapIds=new Set<string>();
  for(const battle of battles) {
    const data=battle.data as ProjectObject;
    if(Number.parseInt(String(data.id))<=27)continue;
    const incoming=fresh.battles.find(b=>b.data.id===data.id)!;
    if(!incoming)throw new Error(`Missing source ${data.id}`);
    for(const slot of ["intro","outro"] as const) {
      const target=(battle.sceneSlots as ProjectObject)[slot];
      const source=fresh.scenes.find(s=>s.id===incoming.sceneSlots[slot]);
      const scene=(project.scenes as ProjectObject[]).find(s=>s.id===target);
      if(!scene || !source)throw new Error(`Missing story resource ${data.id}:${slot}`);
      scene.data=loadAuthoringProject({value:source.data}).value!;
      sceneIds.add(String(target));
    }
    mapIds.add(String(data.mapId));
    const placements=incoming.data.units as Array<{commanderId:string;x:number;y:number;level:number;side:string}>;
    for(const unit of data.units as ProjectObject[]) {
      const updated=placements.find(u=>u.commanderId===unit.commanderId);
      if(updated){unit.x=updated.x;unit.y=updated.y;}
      // Only migrate the reviewed stock Changsha levels; keep custom edits.
      if(data.id==="29-changsha" && updated?.side==="enemy" && unit.level===updated.level-1)unit.level=updated.level;
    }
  }
  const maps=project.maps as ProjectObject[];
  for(const incoming of fresh.maps) {
    if(!mapIds.has(String(incoming.data.id)) && !String(incoming.data.id).startsWith("scene-sequel-"))continue;
    const current=maps.find(m=>(m.data as ProjectObject).id===incoming.data.id);
    if(current)current.data={...(current.data as ProjectObject),...loadAuthoringProject(incoming.data)};
    else maps.push(loadAuthoringProject(incoming));
  }
  if(protectedBefore!==JSON.stringify(battles.filter(b=>Number.parseInt(String((b.data as ProjectObject).id))<=27)))throw new Error("Protected battles changed.");
  const next={...record,revision:record.revision+1,project};
  const snapshot=compileGame(next,project.catalogs);
  await mkdir(join(root,".studio/backups"),{recursive:true});
  await writeFile(join(root,`.studio/backups/${id}.before-sequel-art.${record.revision}.json`),JSON.stringify(record,null,2),{flag:"wx"});
  await store.save(id,project,record.revision);
  await createGameStore(join(root,".studio/game")).activate(snapshot);
  console.log(JSON.stringify({revision:next.revision,stories:sceneIds.size,maps:mapIds.size,battles:Object.keys(snapshot.stages).length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
