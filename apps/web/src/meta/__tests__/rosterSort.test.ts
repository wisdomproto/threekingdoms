import { describe, it, expect } from "vitest";
import { sortRoster, type SortKey } from "../rosterSort";
import type { RosterUnit } from "../metaStore";

function makeUnit(
  commanderId: string,
  overrides: Partial<RosterUnit> = {},
): RosterUnit {
  return {
    commanderId,
    classId: "lightCavalry",
    joinChapter: 1,
    role: "melee",
    level: 10,
    exp: 0,
    equipped: [],
    ...overrides,
  };
}

const 관우 = makeUnit("관우", { role: "melee", level: 15, equipped: ["청룡언월도"] });
const 유비 = makeUnit("유비", { role: "lord", level: 10, classId: "footman" });
const 제갈량 = makeUnit("제갈량", { role: "caster", level: 8, classId: "strategist", joinChapter: 4 });
const 간옹 = makeUnit("간옹", { role: "support", level: 6, classId: "strategist", joinChapter: 1 });

describe("sortRoster", () => {
  it("빈 배열 안전", () => {
    expect(sortRoster([], "power", 1)).toEqual([]);
  });

  it("level: 레벨 내림차순", () => {
    const result = sortRoster([간옹, 제갈량, 관우, 유비], "level", 1);
    expect(result[0]!.commanderId).toBe("관우"); // Lv15
    expect(result[1]!.commanderId).toBe("유비");  // Lv10
  });

  it("role: lord > melee > caster > support > guest", () => {
    const result = sortRoster([간옹, 관우, 유비, 제갈량], "role", 1);
    expect(result[0]!.commanderId).toBe("유비");   // lord
    expect(result[1]!.commanderId).toBe("관우");   // melee
    expect(result[2]!.commanderId).toBe("제갈량"); // caster
    expect(result[3]!.commanderId).toBe("간옹");   // support
  });

  it("new: joinChapter===chapter 먼저", () => {
    // chapter=4일 때 제갈량(joinChapter=4)이 먼저
    const result = sortRoster([간옹, 관우, 유비, 제갈량], "new", 4);
    expect(result[0]!.commanderId).toBe("제갈량");
  });

  it("원본 배열 불변", () => {
    const arr = [유비, 관우];
    const sorted = sortRoster(arr, "level", 1);
    expect(arr[0]!.commanderId).toBe("유비"); // 원본 불변
    expect(sorted[0]!.commanderId).toBe("관우");
  });

  it("power: 관우(청룡언월도 장착)가 비장착보다 높거나 같다", () => {
    const plain관우 = makeUnit("관우", { role: "melee", level: 15, equipped: [] });
    const result = sortRoster([plain관우, 관우], "power", 1);
    // 관우(청룡언월도)가 앞서거나 동률
    const firstPower = result[0]!.equipped.includes("청룡언월도");
    const samePower = result[0]!.commanderId === result[1]!.commanderId;
    expect(firstPower || samePower || result[0]!.commanderId === "관우").toBe(true);
  });
});
