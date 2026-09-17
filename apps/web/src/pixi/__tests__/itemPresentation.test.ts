import { describe, expect, it } from "vitest";
import { gameData } from "@tk/data";
import { itemFxCategory } from "../itemPresentation";

describe("item effect families", () => {
  it.each([
    ["쌀", "heal"], ["폭탄", "fire"], ["낙석서", "earth"],
    ["소용돌이서", "water"], ["초열서", "fire"],
  ])("%s uses %s", (id, family) => {
    expect(gameData.items[id]).toBeDefined();
    expect(itemFxCategory(gameData.items[id])).toBe(family);
  });
  it("unknown tools retain a neutral effect", () => {
    expect(itemFxCategory(undefined)).toBe("special");
  });
});
