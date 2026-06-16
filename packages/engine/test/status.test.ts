import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import { hasStatus, applyStatus, tickStatuses } from "../src/status";
import { testCtx } from "./fixtures";

describe("status 헬퍼 (Phase D)", () => {
  it("applyStatus: 신규 추가 / 같은 kind면 turns=max", () => {
    const a = applyStatus(undefined, "poison", 3);
    expect(a).toEqual([{ kind: "poison", turns: 3 }]);
    const b = applyStatus(a, "poison", 2); // 더 짧음 → max 유지
    expect(b).toEqual([{ kind: "poison", turns: 3 }]);
    const c = applyStatus(a, "seal", 1);
    expect(c).toEqual([{ kind: "poison", turns: 3 }, { kind: "seal", turns: 1 }]);
  });

  it("hasStatus", () => {
    const s = createBattle(testCtx, 1);
    const u = { ...s.units[0]!, statuses: [{ kind: "immobilize" as const, turns: 2 }] };
    expect(hasStatus(u, "immobilize")).toBe(true);
    expect(hasStatus(u, "poison")).toBe(false);
  });

  it("tickStatuses: 중독 피해 + turns 감소 + 만료, 이벤트 서술", () => {
    const s0 = createBattle(testCtx, 1);
    const target = s0.units.find((u) => u.side === "player")!;
    const s = { ...s0, units: s0.units.map((u) => u.id === target.id
      ? { ...u, troops: 100, statuses: [{ kind: "poison" as const, turns: 2 }, { kind: "seal" as const, turns: 1 }] } : u) };
    const { state, events } = tickStatuses(testCtx, s, "player");
    const after = state.units.find((u) => u.id === target.id)!;
    expect(after.troops).toBe(100 - testCtx.data.combat.status.poisonDamage); // 중독 1틱
    expect(after.statuses).toEqual([{ kind: "poison", turns: 1 }]); // poison 2→1, seal 1→만료
    expect(events.some((e) => e.type === "statusTick" && e.kind === "poison")).toBe(true);
    expect(events.some((e) => e.type === "statusExpired" && e.kind === "seal")).toBe(true);
  });
});
