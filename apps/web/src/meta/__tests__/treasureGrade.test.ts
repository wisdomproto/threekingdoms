import { expect, it } from "vitest";
import { treasureGrade } from "../treasureGrade";
it("appraises effects independently of the rare drop pool", () => {
  expect(treasureGrade({defensePercent:5}).label).toBe("고급");
  expect(treasureGrade({spiritPercent:5}).label).toBe("고급");
  expect(treasureGrade({move:1}).label).toBe("희귀");
  expect(treasureGrade({doubleStrike:true}).label).toBe("전설");
  expect(treasureGrade().label).toBe("일반");
});
