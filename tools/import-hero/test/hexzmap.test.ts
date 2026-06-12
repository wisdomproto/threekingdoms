import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseHexzmap, toBattleMap } from "../src/hexzmap";
import { BattleMapSchema } from "@tk/data";

const HERO = process.env.HERO_DIR ?? "C:\\HERO";
const have = existsSync(`${HERO}\\HEXZMAP.R3`);

describe.skipIf(!have)("HEXZMAP 파싱 (C:\\HERO 필요)", () => {
  const maps = have ? parseHexzmap(readFileSync(`${HERO}\\HEXZMAP.R3`)) : null!;

  it("58개 맵 + 이름, 0번 = 사수관 56×32", () => {
    expect(maps).toHaveLength(58);
    expect(maps[0]!).toMatchObject({ name: "사수관", width: 56, height: 32 });
    expect(maps[1]!.name).toBe("호로관");
  });

  it("사수관 BattleMap 변환: 스키마 통과 + 미매핑 타일 0건", () => {
    const { map, unmapped } = toBattleMap(maps[0]!, "sishuiguan");
    expect(() => BattleMapSchema.parse(map)).not.toThrow();
    expect(unmapped).toEqual([]);
    const all = map.tiles.join("");
    expect(all).toContain("G"); // 관문 존재
    expect(all).toContain("#"); // 성벽 존재
  });
});
