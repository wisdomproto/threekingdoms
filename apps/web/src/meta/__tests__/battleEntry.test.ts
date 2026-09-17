import { expect, it } from "vitest";
import { resolveBattleEntry, applySortieToStage } from "../sortie";
import { stages } from "@tk/data";

it("honors direct battle links and discards another battle's formation", () => {
  const old = { stageId: "05-sishuiguan", members: [] };
  expect(resolveBattleEntry("55-jianye", old)).toEqual({ stageId: "55-jianye", sortie: null });
  expect(resolveBattleEntry(null, old)).toEqual({ stageId: old.stageId, sortie: old });
  expect(resolveBattleEntry("05-sishuiguan", old).sortie).toBe(old);
  expect(resolveBattleEntry(null, null).stageId).toBe("05-sishuiguan");
});

it("filters stale departed characters before filling late-campaign slots", () => {
  const member = (commanderId: string) => ({ commanderId, classId: "footman", level:55, exp:0, items:[] });
  const result = applySortieToStage(stages["55-jianye"]!, [member("유비"),member("왕준")]);
  expect(result.filter(u=>u.side==="player").map(u=>u.commanderId)).toEqual(["왕준"]);
});
