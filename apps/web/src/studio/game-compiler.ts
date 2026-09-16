import { AuthoringProjectSchema, exportLegacyBattle, type AuthoringProject, type ChapterStage } from "@tk/data/authoring-project";
import { BattleMapSchema, normalizeSceneSlot, StageSchema, type ScenePart } from "@tk/data";
import { parseRuntimeCatalogs } from "../lab/catalog-data";
import { parsePlaytestSnapshot } from "../lab/playtest";
import { GameSnapshotSchema, type GameSnapshot } from "../game/snapshot";
import type { StoredProject } from "./project-store";

/** Compile the supported normal-game flow without changing the authoring document. */
export function compileGame(record: StoredProject, catalogs: unknown): GameSnapshot {
  const project = AuthoringProjectSchema.parse(record.project) as AuthoringProject;
  const maps = Object.fromEntries(project.maps.map(m => { const map = BattleMapSchema.parse(m.data); return [map.id, map]; }));
  if (Object.keys(maps).length !== project.maps.length) throw new Error("맵 ID가 중복됩니다.");
  const stages: GameSnapshot["stages"] = {};
  const chapters: GameSnapshot["chapters"] = [];
  const scenes = new Map(project.scenes.map(s => [s.id, s.data]));
  const story = (node: ChapterStage): ScenePart[] => {
    if (node.kind !== "scene" || !node.resourceId || !scenes.has(node.resourceId)) throw new Error(`${node.name}: 이야기 연결을 확인해 주세요.`);
    return normalizeSceneSlot(StageSchema.parse({ id:"story", name:"story", mapId:"story", turnLimit:1, units:[], events:[], victory:{kind:"defeatAll"}, scenario:{intro:scenes.get(node.resourceId)} }).scenario?.intro ?? []);
  };
  for (const [index, chapter] of project.chapters.entries()) {
    const nodes = new Map(chapter.stages.map(n => [n.id, n]));
    if (nodes.size !== chapter.stages.length) throw new Error(`${chapter.name}: 단계 ID가 중복됩니다.`);
    const visited = new Set<string>(), ids: string[] = [];
    let current: string | undefined = chapter.entryStageId ?? undefined;
    let previous: string | undefined;
    let pending: { id: string; parts: ScenePart[] }[] = [];
    while (current) {
      if (visited.has(current)) throw new Error(`${chapter.name}: 반복 연결은 실제 게임에 동기화할 수 없습니다.`);
      visited.add(current);
      const node = nodes.get(current);
      if (!node) throw new Error(`${chapter.name}: 다음 단계를 찾을 수 없습니다.`);
      if (node.kind === "end") break;
      if (node.kind === "scene") { pending.push({id:node.resourceId!,parts:story(node)}); current = node.next.completed; }
      else if (node.kind === "battle") {
        if (!node.resourceId) throw new Error(`${node.name}: 전투를 연결해 주세요.`);
        const stage = StageSchema.parse(exportLegacyBattle(project, node.resourceId));
        if (stages[stage.id]) throw new Error(`${stage.name}: 같은 전투를 두 번 실행하는 연결은 지원하지 않습니다.`);
        const resource = project.battles.find(b => b.id === node.resourceId)!;
        const introAt = pending.findIndex(scene => scene.id === resource.sceneSlots.intro);
        const split = previous && introAt >= 0 ? introAt : 0;
        if (previous) stages[previous]!.scenario!.outro = pending.slice(0, split).flatMap(s => s.parts);
        stage.scenario = { ...stage.scenario, intro: pending.slice(split).flatMap(s => s.parts), outro: [], outroDefeat: [] };
        pending = [];
        // Normal game defeats return to formation; only an optional story then end is representable.
        let failure = node.next.defeat;
        const failures = new Set<string>();
        while (failure) {
          if (failures.has(failure)) throw new Error(`${node.name}: 패배 연결이 반복됩니다.`);
          failures.add(failure);
          const next = nodes.get(failure);
          if (!next) throw new Error(`${node.name}: 패배 연결이 없습니다.`);
          if (next.kind === "end") break;
          if (next.kind !== "scene") throw new Error(`${node.name}: 실제 게임의 패배 흐름은 이야기 후 재도전만 지원합니다.`);
          (stage.scenario.outroDefeat as ScenePart[]).push(...story(next)); failure = next.next.completed;
        }
        if (!failure) throw new Error(`${node.name}: 패배 후 종료를 연결해 주세요.`);
        stages[stage.id] = stage; ids.push(stage.id); previous = stage.id; current = node.next.victory;
      } else throw new Error(`${node.name}: 웹툰은 이야기의 만화 파트로 연결해 주세요.`);
      if (!current) throw new Error(`${node.name}: 다음 단계를 연결해 주세요.`);
    }
    if (!current || !previous) throw new Error(`${chapter.name}: 시작부터 종료까지 전투를 연결해 주세요.`);
    stages[previous]!.scenario!.outro = pending.flatMap(s => s.parts);
    chapters.push({ chapter: index + 1, title: chapter.name, stageIds: ids });
  }
  const parsedCatalogs = parseRuntimeCatalogs(catalogs);
  for (const stage of Object.values(stages)) {
    const checked = parsePlaytestSnapshot({ kind:"tk-playtest-snapshot", version:1, stage, map:maps[stage.mapId], sceneMaps:maps, catalogs:parsedCatalogs, seed:1 });
    if (!checked.ok) throw new Error(`${stage.name}: ${checked.message}`);
  }
  return GameSnapshotSchema.parse({ version:1, projectId:record.id, revision:record.revision, name:project.name, chapters, stages, maps, ...parsedCatalogs });
}
