import { describe, it, expect } from "vitest";
import { sortieSummary } from "../sortieSummary";
import type { RosterUnit } from "../metaStore";
import type { SortieMember } from "../sortie";

function makeUnit(commanderId: string, role: RosterUnit["role"] = "melee"): RosterUnit {
  return {
    commanderId, classId: "lightCavalry", joinChapter: 1, role,
    level: 10, exp: 0, equipped: [],
  };
}

function makeMember(commanderId: string, classId = "lightCavalry"): SortieMember {
  return { commanderId, classId, level: 10, exp: 0, items: [] };
}

const 유비 = makeUnit("유비", "lord");
const 관우 = makeUnit("관우", "melee");
const 장비 = makeUnit("장비", "melee");
const roster = [유비, 관우, 장비];

describe("sortieSummary", () => {
  it("0명 선택 = emptyDefault, 경고 없음", () => {
    const s = sortieSummary([], roster, 3);
    expect(s.emptyDefault).toBe(true);
    expect(s.warnings).toHaveLength(0);
    expect(s.totalPower).toBe(0);
    expect(s.count).toBe(0);
  });

  it("빈 슬롯 경고", () => {
    const s = sortieSummary([makeMember("관우")], roster, 3);
    expect(s.warnings).toContain("빈 슬롯 2개");
  });

  it("군주 있는 roster에서 lord 미선택 시 경고", () => {
    const s = sortieSummary([makeMember("관우")], roster, 3);
    expect(s.warnings).toContain("군주 미편성");
  });

  it("군주 선택 시 군주 미편성 경고 없음", () => {
    const s = sortieSummary(
      [makeMember("유비"), makeMember("관우"), makeMember("장비")],
      roster, 3,
    );
    expect(s.warnings.every((w) => !w.includes("군주"))).toBe(true);
  });

  it("roster에 lord 없으면 군주 경고 없음", () => {
    const noLord = [관우, 장비];
    const s = sortieSummary([makeMember("관우")], noLord, 2);
    expect(s.warnings.every((w) => !w.includes("군주"))).toBe(true);
  });

  it("totalPower = 선택 멤버 power 합산 > 0", () => {
    const s = sortieSummary([makeMember("관우")], roster, 3);
    expect(s.totalPower).toBeGreaterThan(0);
  });

  it("경고 없는 정상 케이스 — maxSlots=1, 유비(lord) 선택", () => {
    const s = sortieSummary([makeMember("유비")], [유비], 1);
    expect(s.warnings).toHaveLength(0);
    expect(s.emptyDefault).toBe(false);
  });
});
