import { AuthoringProjectSchema, loadAuthoringProject, type ProjectObject } from "@tk/data/authoring-project";
import { normalizeSceneSlot, SceneSlotSchema } from "@tk/data";

/** Append missing official chapters without replacing the user's battles, scenes or bindings. */
export function extendCampaign(existing: unknown, complete: unknown): ProjectObject {
  const original = AuthoringProjectSchema.parse(existing);
  const source = AuthoringProjectSchema.parse(complete);
  const result = loadAuthoringProject(existing);
  const existingBattles = new Set(original.battles.map(b => String(b.data.id)));
  // This migration only applies to the complete original Samgukji campaign, never a MOD.
  if (!existingBattles.has("01-zhuojun") || !existingBattles.has("27-huarongdao")) {
    throw new Error("전체 삼국지 캠페인 프로젝트에서만 확장할 수 있습니다.");
  }
  const newChapters = source.chapters.filter(ch => ch.stages.some(node => {
    const battle = source.battles.find(b => b.id === node.resourceId);
    return battle && Number.parseInt(String(battle.data.id), 10) > 27 && !existingBattles.has(String(battle.data.id));
  }));
  if (!newChapters.length) return result;
  // Reject partial chapter collisions; silently duplicating nodes would corrupt game sequencing.
  for (const ch of newChapters) for (const node of ch.stages) {
    const battle = source.battles.find(b => b.id === node.resourceId);
    if (battle && existingBattles.has(String(battle.data.id))) throw new Error(`${ch.name}: 일부 전투가 이미 존재합니다. 연결을 확인해 주세요.`);
  }
  result.chapters = [...(result.chapters as ProjectObject[]), ...newChapters.map(ch => loadAuthoringProject(ch))];
  const resourceIds = new Set(newChapters.flatMap(ch => ch.stages.map(node => node.resourceId)));
  const battles = source.battles.filter(b => resourceIds.has(b.id));
  const sceneIds = new Set(battles.flatMap(b => Object.values(b.sceneSlots)));
  const scenes = source.scenes.filter(s => resourceIds.has(s.id) || sceneIds.has(s.id));
  const mapIds = new Set(battles.map(b => String(b.data.mapId)));
  for (const scene of scenes) for (const part of normalizeSceneSlot(SceneSlotSchema.parse(scene.data))) {
    if ("map" in part) mapIds.add(part.map);
  }
  const additions = { battles, scenes, maps: source.maps.filter(m => mapIds.has(String(m.data.id))) };
  for (const key of ["maps", "battles", "scenes"] as const) {
    const current = result[key] as ProjectObject[];
    const ids = new Set(current.map(value => value.id));
    result[key] = [...current, ...additions[key].filter(value => !ids.has(value.id)).map(value => loadAuthoringProject(value))];
  }
  const catalogs = (result.catalogs ?? {}) as ProjectObject;
  for (const key of ["commanders", "rosters", "items"] as const) {
    const incoming = ((source.catalogs as ProjectObject)?.[key] ?? {}) as ProjectObject;
    catalogs[key] = { ...incoming, ...((catalogs[key] ?? {}) as ProjectObject) };
  }
  result.catalogs = catalogs;
  return result;
}
