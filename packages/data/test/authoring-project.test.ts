import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  authoringId, importLegacyChapter, exportLegacyBattle, loadAuthoringProject,
  parseAuthoringProject, serializeAuthoringProject, validateAuthoringProject,
  createLegacyPlaytestSnapshot, type ProjectObject,
} from "../src/authoring-project";

function read(path: string): ProjectObject {
  return JSON.parse(readFileSync(new URL(`../json/${path}`, import.meta.url), "utf8"));
}
const filenames = readdirSync(new URL("../json/stages/", import.meta.url)).filter((name) => name.endsWith(".json")).sort();
const stages = filenames.map((name) => read(`stages/${name}`));
const mapNames = [...new Set(stages.map((stage) => String(stage.mapId)))];
const maps = mapNames.map((name) => read(`maps/${name}.json`));
const options = { draftId: "test", revision: 1, seed: 42, savedAt: "2026-09-14T00:00:00Z" };
function fixture() {
  const stage = read("stages/05-sishuiguan.json");
  return importLegacyChapter({ id: "test", name: "테스트", stages: [stage], maps: [read(`maps/${stage.mapId}.json`)] });
}
const errors = (draft: unknown) => validateAuthoringProject(draft).map((issue) => issue.code);

describe("legacy chapter migration", () => {
  it("covers the existing campaign and validates its references", () => {
    expect(stages.length).toBe(27);
    const project = importLegacyChapter({ id: "campaign", name: "삼국지", stages, maps });
    expect(validateAuthoringProject(project)).toEqual([]);
    expect(project.battles).toHaveLength(27);
  });
  for (const [i, name] of filenames.entries()) {
    it(`${name}: preserves every field and key order through save/reopen/export`, () => {
      const stage = stages[i]!;
      const before = JSON.stringify(stage);
      const map = maps.find((m) => m.id === stage.mapId)!;
      const project = importLegacyChapter({ id: "one", name: "One", stages: [stage], maps: [map] });
      const reopened = parseAuthoringProject(serializeAuthoringProject(project));
      const restored = exportLegacyBattle(reopened, authoringId("battle", String(stage.id)));
      expect(JSON.stringify(restored)).toBe(before);
      expect(JSON.stringify(stage)).toBe(before);
      expect(project.maps[0]!.data).toEqual(map);
    });
  }
  it("preserves unknown fields, explicit null, empty slots and scenario field order", () => {
    const stage = {
      id: "odd:/%", scenario: { future: { empty: null }, outro: [], intro: null, outroDefeat: { alien: false } },
      custom: [null, { value: 0 }], units: [],
    };
    const project = importLegacyChapter({ id: "p", name: "P", stages: [stage], maps: [] });
    const restored = exportLegacyBattle(project, project.battles[0]!.id);
    expect(JSON.stringify(restored)).toBe(JSON.stringify(stage));
    expect(errors(project)).toContain("resource-data");
    expect(parseAuthoringProject(serializeAuthoringProject(project))).toEqual(project);
  });
  it("keeps absent and non-object scenario values unchanged", () => {
    for (const stage of [{ id: "x" }, { id: "x", scenario: null }, { id: "x", scenario: [] }]) {
      const project = importLegacyChapter({ id: "p", name: "P", stages: [stage], maps: [] });
      expect(exportLegacyBattle(project, project.battles[0]!.id)).toEqual(stage);
    }
  });
  it("changes only the selected scene slot and leaves battle dialogue/events in place", () => {
    const project = fixture();
    const battle = project.battles[0]!;
    const before = exportLegacyBattle(project, battle.id);
    const scene = project.scenes.find((s) => s.id === battle.sceneSlots.intro)!;
    scene.data = { bg: "changed", lines: [{ text: "새 장면" }] };
    const after = exportLegacyBattle(project, battle.id);
    expect(after).toEqual({ ...before, scenario: { ...(before.scenario as ProjectObject), intro: scene.data } });
    expect(battle.data).not.toHaveProperty("scenario.intro");
    expect(battle.data.dialogue).toEqual(before.dialogue);
    expect(battle.data.events).toEqual(before.events);
  });
  it("uses explicit order and routes defeat to its own outro then end", () => {
    const first = read("stages/05-sishuiguan.json");
    (first.scenario as ProjectObject).outroDefeat = { bg: "defeat", lines: [{ text: "후퇴" }] };
    const second = read("stages/01-zhuojun.json");
    const project = importLegacyChapter({ id: "p", name: "P", stages: [first, second], maps });
    const chapter = project.chapters[0]!;
    const battle = chapter.stages.find((n) => n.kind === "battle")!;
    const defeat = chapter.stages.find((n) => n.id === battle.next.defeat)!;
    expect(chapter.entryStageId).toBe(authoringId("node", project.battles[0]!.sceneSlots.intro!));
    expect(defeat.resourceId).toBe(project.battles[0]!.sceneSlots.outroDefeat);
    expect(chapter.stages.find((n) => n.id === defeat.next.completed)?.kind).toBe("end");
    const outro = chapter.stages.find((n) => n.id === battle.next.victory)!;
    expect(outro.next.completed).toBe(authoringId("node", project.battles[1]!.sceneSlots.intro!));
  });
  it("rejects duplicate source IDs, while allowing multiple battles to share a map", () => {
    expect(() => importLegacyChapter({ id: "p", name: "P", stages: [stages[0], stages[0]], maps })).toThrow("Duplicate stage");
    expect(() => importLegacyChapter({ id: "p", name: "P", stages: [], maps: [maps[0], maps[0]] })).toThrow("Duplicate map");
    const second = { ...stages[0]!, id: "other" };
    const project = importLegacyChapter({ id: "p", name: "P", stages: [stages[0], second], maps });
    expect(validateAuthoringProject(project)).toEqual([]);
  });
});

describe("draft persistence and graph validation", () => {
  it("saves malformed or future drafts without deleting data or injecting defaults", () => {
    const draft = { kind: "tk-authoring-project", version: 999, future: { nodes: [null, false, {}] } };
    expect(parseAuthoringProject(serializeAuthoringProject(draft))).toEqual(draft);
    expect(errors(draft)).toContain("structure");
    expect(() => createLegacyPlaytestSnapshot(draft, "unknown", options)).toThrow();
  });
  it("isolates the input, reopened drafts, and exported battle payloads", () => {
    const project = fixture();
    const copy = loadAuthoringProject(project);
    (copy.battles as ProjectObject[])[0]!.data = {};
    const restored = exportLegacyBattle(project, project.battles[0]!.id);
    (restored.units as ProjectObject[])[0]!.level = 99;
    expect(exportLegacyBattle(project, project.battles[0]!.id)).not.toEqual(restored);
    expect(project.battles[0]!.data).not.toEqual({});
  });
  it("does not silently discard non-JSON values", () => {
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    for (const input of [{ value: undefined }, { value: NaN }, { value: BigInt(1) }, { value: new Date() }, { value: () => 1 }, cycle, { value: new Array(2) }]) {
      expect(() => serializeAuthoringProject(input)).toThrow();
    }
    expect(() => parseAuthoringProject("[]")).toThrow();
    expect(() => parseAuthoringProject("{" )).toThrow();
  });
  it("preserves JSON prototype-like keys without polluting prototypes", () => {
    const source = '{"__proto__":{"polluted":true},"constructor":null}';
    expect(JSON.stringify(parseAuthoringProject(source))).toBe(source);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("preserves unknown prototype-like keys inside exported battle data", () => {
    const stage = JSON.parse('{"id":"x","__proto__":{"future":1},"scenario":{"intro":[],"constructor":null}}');
    const project = importLegacyChapter({ id: "p", name: "P", stages: [stage], maps: [] });
    expect(JSON.stringify(exportLegacyBattle(project, project.battles[0]!.id))).toBe(JSON.stringify(stage));
  });
  it("allows story-only and consecutive battle chapters", () => {
    const story = fixture();
    const chapter = story.chapters[0]!;
    const scene = chapter.stages.find((n) => n.kind === "scene")!;
    const end = chapter.stages.find((n) => n.kind === "end")!;
    scene.next = { completed: end.id };
    chapter.stages = [scene, end]; chapter.entryStageId = scene.id;
    expect(validateAuthoringProject(story)).toEqual([]);
    const project = importLegacyChapter({ id: "p", name: "P", stages: stages.slice(0, 2).map(({ scenario, ...stage }) => stage), maps });
    const battles = project.chapters[0]!.stages.filter((n) => n.kind === "battle");
    expect(battles[0]!.next.victory).toBe(battles[1]!.id);
    expect(validateAuthoringProject(project)).toEqual([]);
  });
  it("reports paths for wrong resource types, missing defeat and cross-chapter successors", () => {
    const project = fixture();
    const node = project.chapters[0]!.stages.find((n) => n.kind === "battle")!;
    node.resourceId = project.scenes[0]!.id;
    delete node.next.defeat;
    node.next.victory = "other-chapter-node";
    const issues = validateAuthoringProject(project);
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(["resource-reference", "missing-result", "next-reference"]));
    expect(issues.find((i) => i.code === "missing-result")!.fieldPath).toMatch(/next.defeat$/);
    expect(parseAuthoringProject(serializeAuthoringProject(project))).toEqual(project);
  });
  it("rejects duplicates, invalid entry and end, unsupported kinds/results and missing maps", () => {
    const project = fixture();
    project.scenes.push(project.scenes[0]!);
    const chapter = project.chapters[0]!;
    chapter.stages.push(chapter.stages[0]!);
    chapter.entryStageId = null;
    const end = chapter.stages.find((n) => n.kind === "end")!;
    end.next = { completed: "missing" };
    const scene = chapter.stages.find((n) => n.kind === "scene")!;
    scene.kind = "webtoon"; scene.next.dynamic = end.id;
    project.maps = [];
    expect(errors(project)).toEqual(expect.arrayContaining(["duplicate-id", "duplicate-node", "entry-reference", "end-node", "unsupported-kind", "unsupported-result", "map-reference", "scene-reference"]));
  });
  it("does not export a dangling scene as an empty scene", () => {
    const project = fixture();
    project.battles[0]!.sceneSlots.intro = "missing";
    expect(() => exportLegacyBattle(project, project.battles[0]!.id)).toThrow("Scene reference");
  });
});

describe("legacy playtest projection", () => {
  it("creates a detached payload with the original map and seed", () => {
    const project = fixture();
    const snapshot = createLegacyPlaytestSnapshot(project, project.battles[0]!.id, options);
    expect(snapshot).toMatchObject({ ...options, kind: "tk-playtest-snapshot", version: 1 });
    expect(snapshot.stage).toEqual(read("stages/05-sishuiguan.json"));
    expect(snapshot.map).toEqual(project.maps[0]!.data);
    snapshot.map.id = "changed";
    expect(project.maps[0]!.data.id).not.toBe("changed");
  });
  it("rejects invalid battle data and missing or ambiguous maps", () => {
    const project = fixture();
    project.battles[0]!.data.turnLimit = 0;
    expect(() => createLegacyPlaytestSnapshot(project, project.battles[0]!.id, options)).toThrow();
    project.battles[0]!.data.turnLimit = 10;
    project.maps.push(project.maps[0]!);
    expect(() => createLegacyPlaytestSnapshot(project, project.battles[0]!.id, options)).toThrow("exactly once");
    project.maps = [];
    expect(() => createLegacyPlaytestSnapshot(project, project.battles[0]!.id, options)).toThrow("exactly once");
  });
  it("does not require unrelated unfinished chapter edits to test one battle", () => {
    const project = fixture();
    project.chapters[0]!.entryStageId = "unfinished";
    expect(errors(project)).toContain("entry-reference");
    expect(createLegacyPlaytestSnapshot(project, project.battles[0]!.id, options).stage.id).toBe("05-sishuiguan");
  });
  it("blocks conflicting scene copies instead of silently choosing one", () => {
    const project = fixture();
    (project.battles[0]!.data.scenario as ProjectObject).intro = [];
    expect(errors(project)).toContain("duplicate-scene-data");
    expect(() => createLegacyPlaytestSnapshot(project, project.battles[0]!.id, options)).toThrow("duplicated");
  });
  it("rejects invalid snapshot metadata", () => {
    const project = fixture();
    for (const override of [{ seed: NaN }, { seed: 1.5 }, { revision: -1 }, { draftId: "" }, { savedAt: "invalid" }]) {
      expect(() => createLegacyPlaytestSnapshot(project, project.battles[0]!.id, { ...options, ...override })).toThrow();
    }
  });
});
