import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extendCampaign } from "../extend-campaign";
import { importCampaign } from "../import-campaign";
import { compileGame } from "../game-compiler";
import { loadAuthoringProject, type ProjectObject } from "@tk/data/authoring-project";

describe("non-destructive campaign extension", () => {
  it("preserves user edits and bindings, appends all chapters once, and compiles to the ending", async () => {
    const complete = await importCampaign(resolve("../../packages/data/json"),"original","삼국지");
    const original = loadAuthoringProject(complete);
    original.chapters = (original.chapters as ProjectObject[]).slice(0,5);
    original.battles = (original.battles as ProjectObject[]).filter(b=>Number.parseInt(String((b.data as ProjectObject).id))<=27);
    const battle = (original.battles as ProjectObject[])[0]!;
    (battle.data as ProjectObject).name="User-edited title";
    original.editorNotes={keep:"custom metadata"};
    const before=JSON.stringify(original);
    const extended=extendCampaign(original,complete);
    expect(JSON.stringify(original)).toBe(before);
    expect(extended.editorNotes).toEqual(original.editorNotes);
    expect(extended.assetBindings).toEqual(original.assetBindings);
    expect((extended.battles as ProjectObject[])[0]).toEqual(battle);
    expect(extended.chapters).toHaveLength(12);
    expect(extended.battles).toHaveLength(55);
    expect(extendCampaign(extended,complete)).toEqual(extended);
    const snapshot=compileGame({id:"791e33c0-eb83-4b40-8b91-f58843ad3a64",revision:1,updatedAt:"2026-09-16T00:00:00Z",project:extended},extended.catalogs);
    expect(snapshot.chapters.at(-1)!.stageIds.at(-1)).toBe("55-jianye");
  });
  it("does not extend an unrelated MOD", async () => {
    const complete = await importCampaign(resolve("../../packages/data/json"),"original","삼국지");
    expect(()=>extendCampaign({...complete,battles:[]},complete)).toThrow("삼국지");
  });
});
