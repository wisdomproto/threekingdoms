import { describe, expect, it } from "vitest";
import { gameData } from "@tk/data";
import { importLegacyChapter } from "@tk/data/authoring-project";
import { legacyEditorDocument } from "../legacy-project";
import { createChapterTest } from "../chapter-playtest";
import { parsePlaytestSnapshot } from "../../lab/playtest";
import { resolveSceneMap } from "../../lab/scene-maps";

function fixture() {
  const stage = structuredClone(gameData.stages["05-sishuiguan"]!);
  const sceneMap = { id: "custom-story-map", name: "Custom", width: 8, height: 6, tiles: Array(6).fill("........"), tileLegend: { ".": "plain" }, futureField: { keep: true } };
  stage.scenario = { intro: [{ map: sceneMap.id, units: [{ id: "hero", sprite: "liubei-foot", cell: [2, 2] }], lines: [{ text: "Project map story" }] }] };
  const project = importLegacyChapter({ id: "p", name: "p", stages: [stage], maps: [gameData.maps[stage.mapId]!, sceneMap] });
  return { project, sceneMap };
}
describe("project maps in story scenes", () => {
  it("carries a custom map through standalone scene, battle and chapter snapshots without altering the project", () => {
    const { project, sceneMap } = fixture(), original = structuredClone(project);
    for (const target of [{ kind: "scene" as const, id: project.scenes[0]!.id }, { kind: "battle" as const, id: project.battles[0]!.id }]) {
      const doc = legacyEditorDocument(project, target);
      expect(doc.sceneMaps[sceneMap.id]).toEqual(sceneMap);
      const parsed = parsePlaytestSnapshot({ ...doc, kind: "tk-playtest-snapshot", version: 1 });
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(resolveSceneMap(sceneMap.id, parsed.payload.sceneMaps)?.tiles).toEqual(sceneMap.tiles);
    }
    const chapter = createChapterTest(project, project.chapters[0]!.id, { commanders: gameData.commanders, rosters: gameData.rosters, items: gameData.items }, "run", "storage");
    expect(chapter.nodes.find(n => n.kind === "scene")!.snapshot!.sceneMaps).toHaveProperty(sceneMap.id);
    expect(project).toEqual(original);
  });
  it("uses project overrides and falls back only for maps absent from the snapshot", () => {
    const base = Object.values(gameData.maps)[0]!;
    const override = { ...base, name: "Edited" };
    expect(resolveSceneMap(base.id, { [base.id]: override })).toBe(override);
    expect(resolveSceneMap(base.id, {})).toBe(base);
    expect(resolveSceneMap("missing", {})).toBeUndefined();
  });
  it("rejects missing and mismatched scene maps instead of silently skipping a story", () => {
    const { project, sceneMap } = fixture();
    const doc = legacyEditorDocument(project, { kind: "scene", id: project.scenes[0]!.id });
    const snapshot = { ...doc, kind: "tk-playtest-snapshot", version: 1 };
    const missing = parsePlaytestSnapshot({ ...snapshot, sceneMaps: {} });
    expect(missing).toMatchObject({ ok: false, message: expect.stringContaining(sceneMap.id) });
    expect(parsePlaytestSnapshot({ ...snapshot, sceneMaps: { [sceneMap.id]: { ...sceneMap, id: "wrong" } } }).ok).toBe(false);
  });
});
