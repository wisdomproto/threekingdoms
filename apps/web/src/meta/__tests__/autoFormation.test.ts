import { describe, expect, it } from "vitest";
import { gameData } from "@tk/data";
import { autoFormation } from "../autoFormation";
import type { RosterUnit } from "../metaStore";
const stage = gameData.stages["05-sishuiguan"]!;
const unit = (id: string): RosterUnit => ({ commanderId: id, classId: "footman", role: "melee", joinChapter: 1, level: 7, exp: 42, equipped: ["사모"] });
describe("automatic formation", () => {
  it("prioritizes available authored allies and fills the remaining slots without duplicates", () => {
    const allies = stage.units.filter(u => u.side === "player");
    const roster = [unit("reserve"), unit(allies[1]!.commanderId), unit(allies[0]!.commanderId)];
    const result = autoFormation(roster, stage);
    expect(result.map(u => u.commanderId)).toEqual([allies[0]!.commanderId, allies[1]!.commanderId, "reserve"]);
    expect(result[0]).toMatchObject({ level: 7, exp: 42, items: ["사모"] });
    result[0]!.items.push("test");
    expect(roster[2]!.equipped).toEqual(["사모"]);
  });
  it("respects stage capacity and an empty available roster", () => {
    const roster = Array.from({ length: 20 }, (_, i) => unit(`unit-${i}`));
    expect(autoFormation(roster, stage)).toHaveLength(stage.units.filter(u => u.side === "player").length);
    expect(autoFormation([], stage)).toEqual([]);
  });
});
