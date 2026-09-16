import { resolveActiveAsset } from "../asset-bindings";
import { afterEach, describe, expect, it } from "vitest";
import { gameData } from "@tk/data";
import { importLegacyChapter } from "@tk/data/authoring-project";
import { compileGame } from "../game-compiler";
import { installGame, gameData as runtimeData } from "../../game/data";
import { nextStageId, orderedStageIds } from "../../meta/campaign";
import type { StoredProject } from "../project-store";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createGameStore } from "../game-store";
import { snapshotKey } from "../../game/snapshot";

function record(): StoredProject {
  const project = importLegacyChapter({id:"campaign",name:"연결 캠페인", stages:[gameData.stages["01-zhuojun"],gameData.stages["02-yingchuan"]],maps:Object.values(gameData.maps)});
  return {id:"791e33c0-eb83-4b40-8b91-f58843ad3a64",revision:5,updatedAt:"2026-09-14",project:JSON.parse(JSON.stringify(project))};
}
afterEach(() => installGame(null));
describe("normal game compilation", () => {
  it('preserves per-project asset bindings through compile and resets on project switch', () => {
    const draft=record();draft.project.assetBindings={'/assets/maps/01-zhuojun.webp':'/assets/library/custom/map.webp'};
    const snapshot=compileGame(draft,gameData);installGame(snapshot);
    expect(resolveActiveAsset('/assets/maps/01-zhuojun.webp')).toBe('/assets/library/custom/map.webp');
    installGame(compileGame(record(),gameData));
    expect(resolveActiveAsset('/assets/maps/01-zhuojun.webp')).toBe('/assets/maps/01-zhuojun.webp');
  });
  it("installs edited combat and catalog data without modifying drafts or base game", () => {
    const draft=record();
    const before=JSON.stringify(draft);
    const catalogs={...gameData,commanders:{...gameData.commanders,"유비":{...gameData.commanders["유비"],war:81}}};
    const result=compileGame(draft,catalogs);
    installGame(result);
    expect(runtimeData.commanders["유비"]!.war).toBe(81);
    expect(orderedStageIds()).toEqual(["01-zhuojun","02-yingchuan"]);
    expect(nextStageId("02-yingchuan")).toBeNull();
    expect(JSON.stringify(draft)).toBe(before);
    expect(gameData.commanders["유비"]!.war).not.toBe(81);
    expect(result.stages["01-zhuojun"]!.scenario!.intro).toBeDefined();
    expect(result.stages["02-yingchuan"]!.scenario!.intro).toEqual(
      Array.isArray(gameData.stages["02-yingchuan"]!.scenario!.intro) ? gameData.stages["02-yingchuan"]!.scenario!.intro : [gameData.stages["02-yingchuan"]!.scenario!.intro]);
  });
  it("rejects looping chapter links before activation", () => {
    const draft=record();
    const chapters=draft.project.chapters as any[];
    const battle=chapters[0].stages.find((n:any)=>n.kind==='battle');
    battle.next.victory=battle.id;
    expect(()=>compileGame(draft,gameData)).toThrow(/반복/);
  });
  it("uses chapter links as the actual game order", () => {
    const draft=record();
    const chapters=draft.project.chapters as any[];
    const second=chapters[0].stages.find((n:any)=>n.kind==='battle'&&n.resourceId.includes('02-yingchuan'));
    chapters[0].entryStageId=second.id;
    const result=compileGame(draft,gameData);
    expect(result.chapters[0]!.stageIds).toEqual(["02-yingchuan"]);
  });
  it("preserves the old revision for resume while activating new content", async () => {
    const directory=await mkdtemp(join(tmpdir(),"tk-game-test-"));
    try {
      const games=createGameStore(directory), draft=record();
      const old=compileGame(draft,gameData); await games.activate(old);
      draft.revision++;
      const next=compileGame(draft,{...gameData,commanders:{...gameData.commanders,"유비":{...gameData.commanders["유비"],war:82}}});
      await games.activate(next);
      expect((await games.read())!.revision).toBe(6);
      expect((await games.read(snapshotKey(old)))!.commanders["유비"]!.war).toBe(gameData.commanders["유비"]!.war);
      await expect(games.activate({...next,stages:{invalid:{}}} as any)).rejects.toThrow();
      expect((await games.read())!.revision).toBe(6);
    } finally {
      const target=resolve(directory);
      if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith("tk-game-test-"))throw new Error("Unexpected cleanup path");
      await rm(target,{recursive:true,force:true});
    }
  });
});
