import { describe, expect, it } from "vitest";
import { gameData, normalizeSceneSlot, StageSchema } from "../src";
import { loadStage, serializeStage } from "../../../tools/editor/stage-io.js";

const sequel = Object.values(gameData.stages).filter(s => Number.parseInt(s.id) > 27);
describe("post-Red-Cliffs campaign", () => {
  it("keeps siege gates open and every starting unit connected to the courtyard", () => {
    for (const id of ["nanjun","changsha","luocheng","chengdu","fancheng","tianshui","chencang","jianye"]) {
      const map=gameData.maps[id]!;
      const left=["nanjun","fancheng","jianye"].includes(id)?10:9;
      for(let y=8;y<12;y++) expect(map.tiles[y]![left],id).toBe("P");
      for(let x=17;x<21;x++) expect(map.tiles[17]![x],id).toBe("P");
      const reached=new Set<string>(), queue: Array<[number,number]>=[[18,10]];
      while(queue.length) {
        const [x,y]=queue.shift()!; const key=`${x},${y}`;
        if(reached.has(key)||x<0||y<0||x>=map.width||y>=map.height)continue;
        if(["#","~","m"].includes(map.tiles[y]![x]!))continue;
        reached.add(key); queue.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
      }
      for(const stage of sequel.filter(s=>s.mapId===id)) for(const unit of stage.units)
        expect(reached.has(`${unit.x},${unit.y}`),`${id}:${unit.commanderId}`).toBe(true);
    }
  });
  it("reaches reunification with an uninterrupted sequence and authored stories", () => {
    expect(sequel.map(s => Number.parseInt(s.id)).sort((a,b)=>a-b)).toEqual(Array.from({length:28},(_,i)=>i+28));
    for (const stage of sequel) {
      for (const slot of ["intro", "outro"] as const) {
        const lines = normalizeSceneSlot(stage.scenario![slot]!).flatMap(p => "lines" in p ? p.lines.map(line => line.text ?? "") : []);
        expect(lines.length, stage.id+slot).toBeGreaterThanOrEqual(8);
      }
      expect(stage.allowedCommanderIds).toEqual(stage.units.filter(u => u.side === "player").map(u => u.commanderId));
      expect(new Set(stage.allowedCommanderIds).size).toBe(stage.allowedCommanderIds!.length);
      for (const id of stage.allowedCommanderIds!) expect(gameData.rosters[id], `${stage.id}:${id}`).toBeDefined();
      expect(StageSchema.parse(serializeStage(loadStage(stage))).allowedCommanderIds).toEqual(stage.allowedCommanderIds);
    }
    expect(JSON.stringify(gameData.stages["55-jianye"]!.scenario!.outro)).toContain("삼국지 본선 끝");
  });
  it("keeps deceased and separated characters out of later battle parties", () => {
    const last: Record<string,number> = { 방통:31, 관우:41, 관평:41, 주창:41, 장비:39, 유비:42, 조운:47, 제갈량:49, 위연:49, 왕평:51, 장억:51, 마충:51 };
    for (const stage of sequel) for (const [name,end] of Object.entries(last)) {
      if (Number.parseInt(stage.id)>end) expect(stage.allowedCommanderIds, stage.id+name).not.toContain(name);
    }
    expect(gameData.stages["55-jianye"]!.allowedCommanderIds).toContain("왕준");
    expect(gameData.stages["55-jianye"]!.allowedCommanderIds).not.toContain("주지");
  });
  it("places defeat narratives after tactical withdrawal, and makes Yiling fire hurt the player", () => {
    for (const id of ["41-maicheng","42-yiling","47-jieting","54-mianzhu"]) {
      expect(gameData.stages[id]!.objectives!.some(o=>o.kind==="surviveTurns"),id).toBe(true);
    }
    const damage=gameData.stages["42-yiling"]!.scriptEvents!.flatMap(e=>e.actions).find(a=>a.kind==="damage");
    expect(damage).toMatchObject({kind:"damage",target:{side:"player"},percent:true});
  });
});
