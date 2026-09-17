import { afterEach, expect, it } from "vitest";
import { gameData as base } from "@tk/data";
import { gameData, installGame } from "../../game/data";
import { SERENDIPITY_RARE } from "../serendipity";
import { treasureGrade } from "../treasureGrade";
import { itemEffectText } from "../itemEffectText";
afterEach(() => installGame(null));
it("keeps four items in each draw grade with weighted odds", () => {
  const totals: Record<string, {count:number;weight:number}> = {};
  for (const entry of SERENDIPITY_RARE) {
    const item = base.items[entry.itemId]!;
    expect(item).toBeDefined();
    const grade = treasureGrade(item.effects).grade;
    const sum = totals[grade] ??= {count:0,weight:0}; sum.count++; sum.weight+=entry.weight;
  }
  expect(totals).toEqual({common:{count:4,weight:160},fine:{count:4,weight:140},rare:{count:4,weight:80},legendary:{count:4,weight:20}});
});
it("adds missing shared draw items to old snapshots without replacing project edits", () => {
  const item = {...base.items["qiyuan-charm"]!,name:"Custom charm"};
  installGame({version:1,projectId:"791e33c0-eb83-4b40-8b91-f58843ad3a64",revision:1,name:"Legacy",chapters:[{chapter:1,title:"Chapter",stageIds:["01-zhuojun"]}],stages:base.stages,maps:base.maps,commanders:base.commanders,rosters:base.rosters,items:{[item.id]:item}});
  expect(gameData.items["qiyuan-charm"]?.name).toBe("Custom charm");
  for (const entry of SERENDIPITY_RARE) expect(gameData.items[entry.itemId]).toBeDefined();
  expect(gameData.items["not-in-project"]).toBeUndefined();
});
it("describes combat traits rather than reporting no effects", () => {
  const text = itemEffectText({noCounter:true,lifestealPercent:50,multiHit:2,rangeBonus:1,inflictStatus:{kind:"seal",chance:30,turns:2}});
  expect(text).toContain("반격 차단"); expect(text).toContain("50% 회복"); expect(text).toContain("2회 타격"); expect(text).toContain("사거리 +1"); expect(text).toContain("책략 봉인 2턴");
});
