import { describe, expect, it } from "vitest";
import { gameData } from "@tk/data";
import { spawnUnit } from "@tk/engine";
import { parseRuntimeCatalogs, runtimeGameData } from "../catalog-data";
import { parsePlaytestSnapshot } from "../playtest";
import { cloneItemCatalog, serializeItemCatalog } from "../../../../../tools/editor/catalog-io.js";

const catalogs = () => structuredClone({ commanders: gameData.commanders, items: gameData.items, rosters: gameData.rosters });
describe("project catalogs", () => {
  it("preserves equipment effects and future fields during item editing", () => {
    const original = { horse: { id: "horse", name: "Horse", effects: { move: 2, future: null }, future: { enabled: false } } };
    const edited = cloneItemCatalog(original);
    edited.horse.name = "Edited";
    expect(JSON.parse(serializeItemCatalog(edited, ["horse"]))).toEqual({ horse: { ...original.horse, name: "Edited" } });
    expect(original.horse.name).toBe("Horse");
    delete edited.horse.effects;
    expect(JSON.parse(serializeItemCatalog(edited, ["horse"])).horse).not.toHaveProperty("effects");
    expect(() => cloneItemCatalog({ broken: null })).toThrow();
  });
  it("uses project stats and equipment effects in the actual engine without changing defaults", () => {
    const value = catalogs(), stage = gameData.stages["05-sishuiguan"]!, unit = stage.units[0]!;
    value.commanders[unit.commanderId]!.war = 17;
    value.items.testHorse = { id: "testHorse", name: "Project horse", category: "horse", power: 0, bonusPercent: 0, effects: { move: 3 } };
    const data = runtimeGameData(parseRuntimeCatalogs(value));
    const base = spawnUnit(gameData, { ...unit, items: [] });
    const result = spawnUnit(data, { ...unit, items: ["testHorse"] });
    expect(result.war).toBe(17);
    expect(result.move).toBe(base.move + 3);
    expect(gameData.items.testHorse).toBeUndefined();
    expect(gameData.commanders[unit.commanderId]!.war).not.toBe(17);
  });
  it("rejects invalid catalogs and missing deployed references before playtest", () => {
    const stage = gameData.stages["05-sishuiguan"]!;
    const snapshot = { kind: "tk-playtest-snapshot", version: 1, stage, map: gameData.maps[stage.mapId], catalogs: catalogs() };
    expect(parsePlaytestSnapshot(snapshot).ok).toBe(true);
    delete snapshot.catalogs.commanders[stage.units[0]!.commanderId];
    expect(parsePlaytestSnapshot(snapshot).ok).toBe(false);
    expect(() => parseRuntimeCatalogs({ ...catalogs(), items: [] })).toThrow();
    const mismatch = catalogs(); mismatch.commanders[stage.units[0]!.commanderId]!.id = "other";
    expect(() => parseRuntimeCatalogs(mismatch)).toThrow("ID");
  });
});
