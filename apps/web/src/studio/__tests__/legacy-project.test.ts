import { describe, expect, it } from "vitest";
import { gameData } from "@tk/data";
import { importLegacyChapter, type AuthoringProject } from "@tk/data/authoring-project";
import { applyLegacyEditorEdit, legacyEditorDocument } from "../legacy-project";

function fixture() {
  const stage = gameData.stages["05-sishuiguan"]!;
  return importLegacyChapter({ id: "p", name: "test", stages: [stage], maps: [{ ...gameData.maps[stage.mapId]!, futureMapSetting: { active: true } }] });
}
describe("legacy editor project integration", () => {
  it("updates only a selected scene and preserves chapter links and future fields", () => {
    const project = fixture(), baseline = structuredClone(project);
    const target = { kind: "scene" as const, id: project.scenes[0]!.id };
    const doc = legacyEditorDocument(project, target);
    const scene = { lines: [{ text: "edited" }], future: { nested: true } };
    const result = applyLegacyEditorEdit(project, target, { ...doc.stage, scenario: { intro: scene } }, doc.map, () => "new") as unknown as AuthoringProject;
    expect(result.scenes[0]!.data).toEqual(scene);
    expect(result.chapters).toEqual(project.chapters);
    expect(result.battles).toEqual(project.battles);
    expect(result.maps).toEqual(project.maps);
    expect(project).toEqual(baseline);
  });
  it("keeps unknown map fields and scene IDs when the legacy canvas saves", () => {
    const project = fixture(), target = { kind: "battle" as const, id: project.battles[0]!.id };
    Object.assign(project.battles[0]!.sourceLayout!, { futureLayoutSetting: 17 });
    const doc = legacyEditorDocument(project, target);
    const map: Record<string, unknown> = { ...doc.map }; delete map.futureMapSetting;
    const result = applyLegacyEditorEdit(project, target, { ...doc.stage, turnLimit: 17 }, map, () => "new") as unknown as AuthoringProject;
    expect(result.battles[0]!.data.turnLimit).toBe(17);
    expect(result.battles[0]!.sceneSlots).toEqual(project.battles[0]!.sceneSlots);
    expect(result.maps[0]!.data.futureMapSetting).toEqual({ active: true });
    expect(result.battles[0]!.sourceLayout).toMatchObject({ futureLayoutSetting: 17 });
    expect(result.chapters).toEqual(project.chapters);
    expect(() => applyLegacyEditorEdit(project, target, { ...doc.stage, id: "renamed" }, map, () => "new")).toThrow("ID");
  });
  it("can edit an independent scene with no battles and preserve incomplete drafts", () => {
    const project = fixture(); project.battles = []; project.maps = [];
    const target = { kind: "scene" as const, id: project.scenes[0]!.id };
    const doc = legacyEditorDocument(project, target);
    const result = applyLegacyEditorEdit(project, target, { ...doc.stage, scenario: { intro: { kind: "future", unfinished: null } } }, doc.map, () => "new") as unknown as AuthoringProject;
    expect(result.scenes[0]!.data).toEqual({ kind: "future", unfinished: null });
  });
});
