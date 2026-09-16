import { z } from "zod";
import { BattleMapSchema, SceneSlotSchema, StageSchema } from "./schemas";

export type ProjectJson = null | boolean | number | string | ProjectJson[] | ProjectObject;
export interface ProjectObject { [key: string]: ProjectJson; }
export const AUTHORING_PROJECT_KIND = "tk-authoring-project";
export const AUTHORING_PROJECT_VERSION = 1;
const slots = ["intro", "outro", "outroDefeat"] as const;
const slotNames = { intro: "전투 전 이야기", outro: "승리 후 이야기", outroDefeat: "패배 후 이야기" };
type Slot = typeof slots[number];
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value: unknown): value is ProjectObject => value !== null && typeof value === "object" && !Array.isArray(value);

/** Reject lossy inputs (undefined, NaN, cycles, class instances) instead of silently dropping them. */
function cloneJson(value: unknown, ancestors = new Set<object>()): ProjectJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || value === null) throw new Error("Project contains a non-JSON value");
  if (ancestors.has(value)) throw new Error("Project contains a cycle");
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error("Project contains a non-JSON object");
  }
  if (Object.getOwnPropertySymbols(value).length) throw new Error("Project contains symbol keys");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Array.from({ length: value.length }, (_, i) => cloneJson(value[i], ancestors));
    }
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, cloneJson(v, ancestors)]));
  } finally { ancestors.delete(value); }
}

/** Draft persistence deliberately does not enforce executable project schemas. */
export function loadAuthoringProject(input: unknown): ProjectObject {
  const value = cloneJson(input);
  if (!object(value)) throw new Error("Project draft must be a JSON object");
  return value;
}
export function parseAuthoringProject(text: string): ProjectObject {
  return loadAuthoringProject(JSON.parse(text));
}
export function serializeAuthoringProject(draft: unknown): string {
  return JSON.stringify(loadAuthoringProject(draft), null, 2);
}

const id = z.string().min(1);
const payload = z.record(z.unknown());
const ResourceSchema = z.object({ id, data: payload }).passthrough();
const SceneResourceSchema = z.object({ id, data: z.unknown().refine((v) => v !== undefined, "Scene data is required") }).passthrough();
const BattleResourceSchema = ResourceSchema.extend({
  sceneSlots: z.object({ intro: id.optional(), outro: id.optional(), outroDefeat: id.optional() }).passthrough(),
  sourceLayout: z.object({ stageKeys: z.array(z.string()), scenarioKeys: z.array(z.string()).optional() }).passthrough(),
}).passthrough();
export const ChapterStageSchema = z.object({
  id, name: z.string(), kind: z.enum(["scene", "battle", "webtoon", "end"]),
  resourceId: id.nullable(), next: z.record(id),
}).passthrough();
const ChapterSchema = z.object({ id, name: z.string(), entryStageId: id.nullable(), stages: z.array(ChapterStageSchema) }).passthrough();
export const AuthoringProjectSchema = z.object({
  kind: z.literal(AUTHORING_PROJECT_KIND), version: z.literal(AUTHORING_PROJECT_VERSION),
  id, name: z.string(), maps: z.array(ResourceSchema), battles: z.array(BattleResourceSchema),
  scenes: z.array(SceneResourceSchema), chapters: z.array(ChapterSchema),
}).passthrough();
export type AuthoringProject = z.infer<typeof AuthoringProjectSchema>;
export type ChapterStage = z.infer<typeof ChapterStageSchema>;

function supportedProject(draft: unknown): AuthoringProject {
  const copy = loadAuthoringProject(draft);
  // Validate without using Zod's output as the saved model: unknown JSON keys belong to the author.
  AuthoringProjectSchema.parse(copy);
  return copy as unknown as AuthoringProject;
}

export interface ProjectIssue {
  code: string; severity: "error" | "warning"; fieldPath: string; message: string;
}

/** Prefixes make roles disjoint; encoding preserves arbitrary source IDs without collisions. */
export const authoringId = (kind: string, sourceId: string): string => `${kind}:${encodeURIComponent(sourceId)}`;

function sourceId(data: ProjectObject, label: string): string {
  if (typeof data.id !== "string" || !data.id) throw new Error(`${label} requires a nonempty id`);
  return data.id;
}
function uniqueSources(values: readonly unknown[], label: string): ProjectObject[] {
  const seen = new Set<string>();
  return values.map((value) => {
    const data = loadAuthoringProject(value);
    const key = sourceId(data, label);
    if (seen.has(key)) throw new Error(`Duplicate ${label} id: ${key}`);
    seen.add(key);
    return data;
  });
}

/** Explicit input order defines one chapter. No filename-based grouping and no mutation of gameData. */
export function importLegacyChapter(input: {
  id: string; name: string; stages: readonly unknown[]; maps: readonly unknown[];
}): AuthoringProject {
  if (!input.id) throw new Error("Project requires a nonempty id");
  const stages = uniqueSources(input.stages, "stage");
  const maps = uniqueSources(input.maps, "map");
  const project: AuthoringProject = {
    kind: AUTHORING_PROJECT_KIND, version: AUTHORING_PROJECT_VERSION, id: input.id, name: input.name,
    maps: maps.map((data) => ({ id: authoringId("map", sourceId(data, "map")), data })),
    battles: [], scenes: [], chapters: [],
  };
  for (const data of stages) {
    const sid = sourceId(data, "stage");
    const sceneSlots: Record<string, string> = {};
    const stageKeys = Object.keys(data);
    const scenarioKeys = object(data.scenario) ? Object.keys(data.scenario) : undefined;
    if (object(data.scenario)) {
      for (const slot of slots) {
        if (!own(data.scenario, slot)) continue;
        const sceneId = authoringId(`scene.${slot}`, sid);
        project.scenes.push({ id: sceneId, data: data.scenario[slot]! });
        sceneSlots[slot] = sceneId;
        delete data.scenario[slot];
      }
    }
    project.battles.push({
      id: authoringId("battle", sid), data, sceneSlots,
      sourceLayout: { stageKeys, ...(scenarioKeys ? { scenarioKeys } : {}) },
    });
  }
  const endId = authoringId("end", input.id);
  const nodes: ChapterStage[] = [];
  const entryFor = (battle: AuthoringProject["battles"][number]) => battle.sceneSlots.intro
    ? authoringId("node", battle.sceneSlots.intro) : authoringId("node", battle.id);
  project.battles.forEach((battle, index) => {
    const nextBattle = project.battles[index + 1];
    const next = nextBattle ? entryFor(nextBattle) : endId;
    const battleNodeId = authoringId("node", battle.id);
    const sceneNode = (slot: Slot, target: string) => {
      const resourceId = battle.sceneSlots[slot];
      if (!resourceId) return target;
      const nodeId = authoringId("node", resourceId);
      nodes.push({ id: nodeId, name: `${String(battle.data.name ?? battle.id)} · ${slotNames[slot]}`, kind: "scene", resourceId, next: { completed: target } });
      return nodeId;
    };
    sceneNode("intro", battleNodeId);
    const battleNode: ChapterStage = { id: battleNodeId, name: String(battle.data.name ?? battle.id), kind: "battle", resourceId: battle.id, next: {} };
    nodes.push(battleNode);
    const victory = sceneNode("outro", next);
    const defeat = sceneNode("outroDefeat", endId);
    battleNode.next = { victory, defeat };
  });
  nodes.push({ id: endId, name: "종료", kind: "end", resourceId: null, next: {} });
  const first = project.battles[0];
  project.chapters.push({ id: authoringId("chapter", input.id), name: input.name, entryStageId: first ? entryFor(first) : endId, stages: nodes });
  return project;
}

function inOriginalOrder(data: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const entries = new Map<string, unknown>();
  for (const key of keys) if (own(data, key)) entries.set(key, data[key]);
  for (const [key, value] of Object.entries(data)) if (!entries.has(key)) entries.set(key, value);
  return Object.fromEntries(entries);
}

function restoreBattle(project: AuthoringProject, battle: AuthoringProject["battles"][number]): ProjectObject {
  const data = loadAuthoringProject(battle.data);
  if (object(data.scenario) && slots.some((slot) => own(data.scenario as ProjectObject, slot))) {
    throw new Error("Scene slot data must be stored in scenes, not duplicated inside the battle");
  }
  const refs = Object.entries(battle.sceneSlots);
  if (refs.length) {
    if (!object(data.scenario)) throw new Error(`Battle ${battle.id} has scene references but no scenario object`);
    for (const [slot, sceneId] of refs) {
      if (!slots.includes(slot as Slot)) throw new Error(`Unsupported scene slot: ${slot}`);
      const matches = project.scenes.filter((scene) => scene.id === sceneId);
      if (matches.length !== 1) throw new Error(`Scene reference must resolve exactly once: ${String(sceneId)}`);
      data.scenario[slot] = cloneJson(matches[0]!.data);
    }
  }
  if (object(data.scenario) && battle.sourceLayout.scenarioKeys) {
    data.scenario = loadAuthoringProject(inOriginalOrder(data.scenario, battle.sourceLayout.scenarioKeys));
  }
  return loadAuthoringProject(inOriginalOrder(data, battle.sourceLayout.stageKeys));
}

/** Structural validation only: an unfinished battle can still be exported without losing fields. */
export function exportLegacyBattle(draft: unknown, battleId: string): ProjectObject {
  const project = supportedProject(draft);
  const matches = project.battles.filter((battle) => battle.id === battleId);
  if (matches.length !== 1) throw new Error(`Battle reference must resolve exactly once: ${battleId}`);
  return restoreBattle(project, matches[0]!);
}

export function validateAuthoringProject(draft: unknown): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  const add = (code: string, fieldPath: string, message: string) => issues.push({ code, severity: "error", fieldPath, message });
  let copy: ProjectObject;
  try { copy = loadAuthoringProject(draft); }
  catch (error) { add("json", "", String(error)); return issues; }
  const parsed = AuthoringProjectSchema.safeParse(copy);
  if (!parsed.success) return parsed.error.issues.map((issue) => ({
    code: "structure", severity: "error", fieldPath: issue.path.join("."), message: issue.message,
  }));
  const project = parsed.data;
  if (!project.chapters.length) add("missing-chapter", "chapters", "Project requires an entry chapter");
  const ids = new Set<string>();
  for (const collection of ["maps", "battles", "scenes", "chapters"] as const) {
    project[collection].forEach((resource, i) => {
      if (ids.has(resource.id)) add("duplicate-id", `${collection}.${i}.id`, `Duplicate resource ID: ${resource.id}`);
      ids.add(resource.id);
    });
  }
  const schemaIssues = (schema: z.ZodTypeAny, value: unknown, path: string) => {
    const result = schema.safeParse(value);
    if (!result.success) for (const issue of result.error.issues) {
      add("resource-data", [path, ...issue.path].join("."), issue.message);
    }
  };
  const mapIds = new Set<string>();
  project.maps.forEach((map, i) => {
    schemaIssues(BattleMapSchema, map.data, `maps.${i}.data`);
    if (typeof map.data.id === "string") {
      if (mapIds.has(map.data.id)) add("duplicate-map-source", `maps.${i}.data.id`, `Duplicate engine map ID: ${map.data.id}`);
      mapIds.add(map.data.id);
    }
  });
  project.scenes.forEach((scene, i) => schemaIssues(SceneSlotSchema, scene.data, `scenes.${i}.data`));
  project.battles.forEach((battle, i) => {
    try { schemaIssues(StageSchema, restoreBattle(project, battle), `battles.${i}.data`); }
    catch (error) { add("scene-reference", `battles.${i}.sceneSlots`, String(error)); }
    if (!mapIds.has(String(battle.data.mapId))) add("map-reference", `battles.${i}.data.mapId`, "Battle map does not exist");
    if (object(battle.data.scenario)) for (const slot of slots) {
      if (own(battle.data.scenario, slot)) add("duplicate-scene-data", `battles.${i}.data.scenario.${slot}`, "Scene slots must be stored in scenes and referenced by sceneSlots");
    }
  });
  project.chapters.forEach((chapter, ci) => {
    const base = `chapters.${ci}`;
    const nodeIds = new Set<string>();
    chapter.stages.forEach((node, ni) => {
      if (nodeIds.has(node.id)) add("duplicate-node", `${base}.stages.${ni}.id`, "Duplicate chapter node ID");
      nodeIds.add(node.id);
    });
    if (chapter.entryStageId === null || !nodeIds.has(chapter.entryStageId)) add("entry-reference", `${base}.entryStageId`, "Chapter entry must reference a node in this chapter");
    chapter.stages.forEach((node, ni) => {
      const path = `${base}.stages.${ni}`;
      if (node.kind === "end") {
        if (node.resourceId !== null || Object.keys(node.next).length) add("end-node", path, "End nodes cannot reference resources or successors");
      } else {
        if (node.kind === "webtoon") add("unsupported-kind", `${path}.kind`, "Standalone webtoon nodes are not supported by the legacy bridge; use a scene slot containing ComicScene");
        else {
          const resources = node.kind === "battle" ? project.battles : project.scenes;
          if (!resources.some((r) => r.id === node.resourceId)) add("resource-reference", `${path}.resourceId`, `Expected a ${node.kind} resource`);
        }
        const results = node.kind === "battle" ? ["victory", "defeat"] : ["completed"];
        for (const result of results) if (!own(node.next, result)) add("missing-result", `${path}.next.${result}`, `Missing ${result} successor`);
        for (const result of Object.keys(node.next)) if (!results.includes(result)) add("unsupported-result", `${path}.next.${result}`, `Unsupported result: ${result}`);
      }
      for (const [result, target] of Object.entries(node.next)) {
        if (!nodeIds.has(target)) add("next-reference", `${path}.next.${result}`, "Successor must reference a node in the same chapter");
      }
    });
  });
  return issues;
}

/** Existing /playtest payload. Chapter execution is deliberately not advertised. */
export function createLegacyPlaytestSnapshot(draft: unknown, battleId: string, options: {
  draftId: string; revision: number; seed: number; savedAt: string; returnUrl?: string;
}) {
  const project = supportedProject(draft);
  const stage = exportLegacyBattle(project, battleId);
  StageSchema.parse(stage);
  const maps = project.maps.filter((map) => map.data.id === stage.mapId);
  if (maps.length !== 1) throw new Error("Battle map must resolve exactly once");
  const map = loadAuthoringProject(maps[0]!.data);
  BattleMapSchema.parse(map);
  if (!options.draftId || !Number.isSafeInteger(options.revision) || options.revision < 0 || !Number.isSafeInteger(options.seed)
    || !Number.isFinite(Date.parse(options.savedAt))) {
    throw new Error("Playtest requires a draft ID, nonnegative revision and integer seed");
  }
  return {
    kind: "tk-playtest-snapshot" as const, version: 1 as const,
    draftId: options.draftId, revision: options.revision, seed: options.seed, savedAt: options.savedAt,
    ...(options.returnUrl === undefined ? {} : { returnUrl: options.returnUrl }), stage, map,
  };
}
