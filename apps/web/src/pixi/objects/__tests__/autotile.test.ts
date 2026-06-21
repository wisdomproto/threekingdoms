// apps/web/src/pixi/objects/__tests__/autotile.test.ts
import { describe, it, expect } from "vitest";
import { wallTile, type WallTile } from "../autotile";

const N = 1, E = 2, S = 4, W = 8;

describe("wallTile", () => {
  const cases: Array<[number, WallTile]> = [
    [0,        { seg: "single",   rot: 0 }],
    [N,        { seg: "end",      rot: 270 }],
    [E,        { seg: "end",      rot: 0 }],
    [S,        { seg: "end",      rot: 90 }],
    [W,        { seg: "end",      rot: 180 }],
    [E | W,    { seg: "straight", rot: 0 }],
    [N | S,    { seg: "straight", rot: 90 }],
    [S | E,    { seg: "corner",   rot: 0 }],
    [S | W,    { seg: "corner",   rot: 90 }],
    [N | W,    { seg: "corner",   rot: 180 }],
    [N | E,    { seg: "corner",   rot: 270 }],
    [E | S | W,        { seg: "tee",   rot: 0 }],
    [N | S | W,        { seg: "tee",   rot: 90 }],
    [N | E | W,        { seg: "tee",   rot: 180 }],
    [N | E | S,        { seg: "tee",   rot: 270 }],
    [N | E | S | W,    { seg: "cross", rot: 0 }],
  ];
  it.each(cases)("mask %i → segment", (mask, expected) => {
    expect(wallTile(mask)).toEqual(expected);
  });
  it("masks the low 4 bits only", () => {
    expect(wallTile(0b10000 | E)).toEqual({ seg: "end", rot: 0 });
  });
});
