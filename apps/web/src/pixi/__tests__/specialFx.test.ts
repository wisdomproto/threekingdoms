import { describe, expect, it } from "vitest";
import { specialFxCandidates } from "../specialFx";

describe("special hit presentation fallback", () => {
  it("provides universal critical and ultimate effects for all units", () => {
    expect(specialFxCandidates("critical")).toEqual(["critical"]);
    expect(specialFxCandidates("ultimate")).toEqual(["ultimate"]);
    expect(specialFxCandidates("critical", "crescent")).toEqual(["critical"]);
  });
  it("retains the universal ultimate if the named hero art is unavailable", () => {
    expect(specialFxCandidates("ultimate", "dual")).toEqual(["ultimate-dual", "ultimate"]);
    expect(specialFxCandidates("ultimate", "spear")).toEqual(["ultimate-spear", "ultimate"]);
  });
});
