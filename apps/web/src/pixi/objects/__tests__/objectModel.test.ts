// apps/web/src/pixi/objects/__tests__/objectModel.test.ts
import { describe, it, expect } from "vitest";
import { objectKind } from "../objectModel";

describe("objectKind", () => {
  it("wall → wall (autotiled)", () => expect(objectKind("wall")).toBe("wall"));
  it("gate → gate (stateful)", () => expect(objectKind("gate")).toBe("gate"));
  it.each(["mountain", "village", "barracks", "depot", "bridge", "plain", "grass"])(
    "%s → deco (texture layer decides)", (t) => expect(objectKind(t)).toBe("deco"),
  );
});
