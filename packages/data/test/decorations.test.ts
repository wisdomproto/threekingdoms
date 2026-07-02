import { describe, it, expect } from "vitest";
import { gameData } from "../src/index";

/**
 * 정밀 데코(stage.decorations, §3-1 Chunk 3) 배치 계약.
 *
 * 데코는 순수 시각(통행/전투 불변)이라 데이터가 지켜야 할 시각 정직성 규칙을 여기서 강제한다:
 *  1) 맵 경계 안.
 *  2) 평탄·통행 지형(plain/grass/waste)에만 — forest/mountain은 지형 자동 데코(ObjectLayer)가
 *     이미 그리고, wall/river 등 불통행 칸 위 소품은 painted 배경·오토타일과 충돌한다.
 *  3) 유닛 초기 배치 칸(초기 units + 증원 units)과 겹치지 않는다 — 등장 순간 소품과 겹쳐 보임.
 *  4) 같은 스테이지 안에서 같은 칸 중복 배치 금지.
 * (kind 화이트리스트는 DecorationSchema z.enum이 로드 시점에 강제 — 여기선 재검사 불필요.)
 */
describe("스테이지 정밀 데코 배치 계약 (§3-1)", () => {
  const DECO_TERRAIN = new Set(["plain", "grass", "waste"]);

  const staged = Object.values(gameData.stages).filter(
    (s) => (s.decorations?.length ?? 0) > 0,
  );

  it("데코 있는 스테이지가 존재한다 (1~2장 정밀 배치 — P1)", () => {
    expect(staged.length).toBeGreaterThan(0);
  });

  it.each(staged.map((s) => [s.id, s] as const))(
    "%s: 경계·지형·유닛충돌·중복 없음",
    (_id, stage) => {
      const map = gameData.maps[stage.mapId]!;
      expect(map).toBeDefined();
      const seen = new Set<string>();
      // 초기 유닛 + 증원 유닛의 등장 칸
      const unitCells = new Set<string>();
      for (const u of stage.units) unitCells.add(`${u.x},${u.y}`);
      for (const r of stage.reinforcements ?? [])
        for (const u of r.units) unitCells.add(`${u.x},${u.y}`);

      for (const d of stage.decorations!) {
        const [x, y] = d.cell;
        const key = `${x},${y}`;
        // 1) 경계
        expect(x, `${key} x`).toBeLessThan(map.width);
        expect(y, `${key} y`).toBeLessThan(map.height);
        // 2) 지형 — 행 문자열에서 char → tileLegend로 해석
        const ch = map.tiles[y]!.charAt(x);
        const terrainId = map.tileLegend[ch];
        expect(
          terrainId && DECO_TERRAIN.has(terrainId),
          `${key} terrain=${terrainId ?? ch} (allowed: plain/grass/waste)`,
        ).toBe(true);
        // 3) 유닛 초기 칸과 불충돌
        expect(unitCells.has(key), `${key} unit spawn collision`).toBe(false);
        // 4) 중복 금지
        expect(seen.has(key), `${key} duplicate`).toBe(false);
        seen.add(key);
      }
    },
  );
});
