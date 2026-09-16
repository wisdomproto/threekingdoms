import { describe, expect, it } from "vitest";
import { gameData, StageSchema } from "@tk/data";
import { createBattle, spawnUnit } from "@tk/engine";
import { importLegacyChapter } from "@tk/data/authoring-project";
import { createChapterTest } from "../chapter-playtest";
import { applyChapterProgress, collectBattleCarry, finishChapterBattle, initialChapterProgress } from "../chapter-progress";
import { parsePlaytestSnapshot } from "../../lab/playtest";
import { applySortieToStage } from "../../meta/sortie";
import { loadStage, serializeStage } from "../../../../../tools/editor/stage-io.js";
const catalogs = { commanders: gameData.commanders, items: gameData.items, rosters: gameData.rosters };
function fixture() {
  const stage = gameData.stages["05-sishuiguan"]!;
  const project = importLegacyChapter({ id: "p", name: "p", stages: [stage], maps: [gameData.maps[stage.mapId]!] });
  const test = createChapterTest(project, project.chapters[0]!.id, catalogs, "run", "storage");
  const parsed = parsePlaytestSnapshot(test.nodes.find(n => n.kind === "battle")!.snapshot);
  if (!parsed.ok) throw new Error(parsed.message);
  return { test, payload: parsed.payload };
}
describe("chapter progression", () => {
  it("carries growth, equipment and shared supplies through the actual next battle, preserving authored positions and enemies", () => {
    const { test, payload } = fixture(), original = structuredClone(payload), progress = initialChapterProgress(test);
    const state = createBattle({ data: gameData, stage: payload.stage, map: payload.map }, 1);
    const unit = state.units.find(u => u.side === "player")!;
    unit.level = 12; unit.exp = 87; unit.items = ["사모"];
    state.sharedItems.friendly = ["콩"];
    const next = finishChapterBattle(progress, payload, "victory", collectBattleCarry(state));
    const prepared = applyChapterProgress(payload, next);
    const battle = createBattle({ data: gameData, stage: prepared.stage, map: prepared.map }, 1, { sharedItems: prepared.sharedItems });
    expect(battle.units.find(u => u.id === unit.id)).toMatchObject({ level: 12, exp: 87, items: ["사모"] });
    expect(battle.sharedItems.friendly).toContain("콩");
    expect(prepared.stage.units.filter(u => u.side !== "player")).toEqual(payload.stage.units.filter(u => u.side !== "player"));
    expect(payload).toEqual(original);
    expect(progress.units).toEqual({});
    expect(finishChapterBattle(next, payload, "defeat", null)).toBe(next);
  });
  it("joins by the project chapter number and resets progress for a fresh run", () => {
    const { test } = fixture();
    const first = initialChapterProgress(test);
    expect(first.joined.every(id => gameData.rosters[id]!.joinChapter <= 1)).toBe(true);
    expect(first.joined).not.toContain("제갈량");
    const later = initialChapterProgress({ ...test, chapterNumber: 4 });
    expect(later.joined).toContain("제갈량");
    expect(initialChapterProgress(test).units).toEqual({});
  });
  it("preserves starting experience through both editor round-trip and normal sortie", () => {
    const { payload } = fixture(), unit = payload.stage.units.find(u => u.side === "player")!;
    unit.exp = 37;
    const serialized = serializeStage(loadStage(payload.stage));
    const parsed = StageSchema.parse(serialized);
    expect(parsed.units.find(u => u.commanderId === unit.commanderId)!.exp).toBe(37);
    const members = [{ commanderId: unit.commanderId, classId: unit.classId, level: unit.level, exp: 42, items: unit.items }];
    const staged = applySortieToStage(payload.stage, members).find(u => u.side === "player")!;
    expect(spawnUnit(gameData, staged).exp).toBe(42);
    expect(StageSchema.safeParse({ ...payload.stage, units: [{ ...unit, exp: -1 }] }).success).toBe(false);
  });
  it("rejects invalid completion data rather than corrupting the next battle", () => {
    const { test, payload } = fixture();
    const progress = initialChapterProgress(test);
    expect(() => finishChapterBattle(progress, payload, "victory", { units: [{ commanderId: "missing" }], sharedItems: [] })).toThrow();
    expect(() => finishChapterBattle(progress, payload, "victory", { units: [], sharedItems: ["사모"] })).toThrow();
  });
});
