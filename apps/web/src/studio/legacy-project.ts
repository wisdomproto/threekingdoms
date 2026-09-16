import { AuthoringProjectSchema, exportLegacyBattle, importLegacyChapter, loadAuthoringProject, type AuthoringProject, type ProjectObject } from "@tk/data/authoring-project";

export type LegacyTarget = { kind: "battle" | "scene"; id: string };
function projectModel(value: unknown): AuthoringProject {
  const copy = loadAuthoringProject(value); AuthoringProjectSchema.parse(copy);
  return copy as unknown as AuthoringProject;
}
function one<T extends { id: string }>(values: T[], id: string): T {
  const matches = values.filter((v) => v.id === id);
  if (matches.length !== 1) throw new Error("편집할 리소스를 하나로 찾을 수 없습니다.");
  return matches[0]!;
}
/** Only include referenced maps so unrelated unfinished map drafts remain editable. */
export function projectSceneMaps(value: unknown, stage: ProjectObject): Record<string, unknown> {
  const project = projectModel(value), result: Record<string, unknown> = Object.create(null);
  const scenario = stage.scenario;
  if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) return result;
  for (const slot of Object.values(scenario)) {
    for (const part of Array.isArray(slot) ? slot : [slot]) {
      if (!part || typeof part !== "object" || typeof part.map !== "string") continue;
      const matches = project.maps.filter(m => m.data.id === part.map);
      if (matches.length > 1) throw new Error(`스토리 장면의 맵 ID가 중복됩니다: ${part.map}`);
      if (matches[0]) result[part.map] = loadAuthoringProject(matches[0].data);
    }
  }
  return result;
}
export function legacyEditorDocument(value: unknown, target: LegacyTarget) {
  const project = projectModel(value);
  if (target.kind === "scene") {
    const scene = one(project.scenes, target.id);
    return {
      sceneMaps: projectSceneMaps(project, loadAuthoringProject({ scenario: { intro: scene.data } })),
      stage: { id: "studio-scene", name: "스토리 상세 편집", mapId: "studio-scene-map", turnLimit: 1, units: [], events: [], victory: { kind: "defeatAll" }, scenario: { intro: scene.data } },
      map: { id: "studio-scene-map", name: "장면 미리보기", width: 8, height: 6, tileLegend: { ".": "plain" }, tiles: Array(6).fill("........") },
    };
  }
  const battle = one(project.battles, target.id);
  const maps = project.maps.filter((m) => m.data.id === battle.data.mapId);
  if (maps.length !== 1) throw new Error("전투에 연결된 맵을 확인해 주세요.");
  const stage = exportLegacyBattle(project, target.id);
  return { stage, map: loadAuthoringProject(maps[0]!.data), sceneMaps: projectSceneMaps(project, stage) };
}

/** Edits affect this project only. Preserve unknown map fields the legacy canvas does not own. */
export function applyLegacyEditorEdit(value: unknown, target: LegacyTarget, stageInput: unknown, mapInput: unknown, newId: () => string): ProjectObject {
  const project = projectModel(value);
  const stage = loadAuthoringProject(stageInput);
  if (target.kind === "scene") {
    const scene = one(project.scenes, target.id);
    const scenario = stage.scenario;
    scene.data = scenario && typeof scenario === "object" && !Array.isArray(scenario) && Object.prototype.hasOwnProperty.call(scenario, "intro") ? scenario.intro! : [];
    return loadAuthoringProject(project);
  }
  const battle = one(project.battles, target.id);
  const map = loadAuthoringProject(mapInput);
  if (stage.id !== battle.data.id || stage.mapId !== battle.data.mapId || map.id !== battle.data.mapId) throw new Error("프로젝트 편집 중 전투·맵 ID는 변경할 수 없습니다.");
  const mapResources = project.maps.filter((m) => m.data.id === map.id);
  if (mapResources.length !== 1) throw new Error("연결된 맵을 찾을 수 없습니다.");
  const imported = importLegacyChapter({ id: project.id, name: project.name, stages: [stage], maps: [map] });
  const replacement = imported.battles[0]!;
  for (const slot of ["intro", "outro", "outroDefeat"] as const) {
    const previous = battle.sceneSlots[slot];
    const next = imported.scenes.find((s) => s.id === replacement.sceneSlots[slot]);
    if (next) {
      if (previous) one(project.scenes, previous).data = next.data;
      else {
        const id = newId();
        if (project.scenes.some((s) => s.id === id)) throw new Error("새 스토리 ID가 중복됩니다.");
        project.scenes.push({ id, data: next.data }); battle.sceneSlots[slot] = id;
      }
    } else if (previous) {
      one(project.scenes, previous).data = [];
      delete battle.sceneSlots[slot];
    }
  }
  battle.data = replacement.data;
  battle.sourceLayout = { ...battle.sourceLayout, ...replacement.sourceLayout };
  mapResources[0]!.data = { ...mapResources[0]!.data, ...map };
  return loadAuthoringProject(project);
}
