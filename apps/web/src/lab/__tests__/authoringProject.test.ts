import { describe, expect, it } from "vitest";
import { gameData } from "@tk/data";
import { importLegacyChapter, createLegacyPlaytestSnapshot } from "@tk/data/authoring-project";
import { parsePlaytestSnapshot } from "../playtest";

describe("authoring project → existing playtest boundary", () => {
  it("accepts the bridge snapshot without changing the current runtime contract", () => {
    const stage = gameData.stages["05-sishuiguan"]!;
    const map = gameData.maps[stage.mapId]!;
    const project = importLegacyChapter({ id: "test", name: "Test", stages: [stage], maps: [map] });
    const snapshot = createLegacyPlaytestSnapshot(project, project.battles[0]!.id, {
      draftId: "test", revision: 7, seed: 123, savedAt: "2026-09-14T00:00:00Z", returnUrl: "http://localhost:8081/",
    });
    const result = parsePlaytestSnapshot(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.payload.stage).toEqual(stage);
    expect(result.payload.map).toEqual(map);
    expect(result.payload.seed).toBe(123);
    expect(result.payload.returnUrl).toBe(snapshot.returnUrl);
  });
});
