import { gameData, type BattleMap, type Stage } from "@tk/data";
import type { BattleContext } from "@tk/engine";

/**
 * 경로 검증용 8×6 합성 맵 — 엔진 테스트 픽스처와 동일 구조 (실제 terrains.json 지형 사용).
 * 비용(기병 기준): plain 1 / forest 2 / mountain 3 / gate 1 / wall 99(불가)
 */
export const testMap: BattleMap = {
  id: "testmap", name: "테스트맵", width: 8, height: 6,
  tileLegend: { ".": "plain", "m": "mountain", "#": "wall", "G": "gate", "f": "forest" },
  tiles: [
    "########",
    "#..G...#",
    ".....f..",
    "..m.....",
    "........",
    "........",
  ],
};

export const testStage: Stage = {
  id: "test-stage", name: "테스트", mapId: "testmap", turnLimit: 30,
  units: [
    { commanderId: "유비", classId: "footman",      level: 1, troops: 1120, items: [],            side: "player", x: 2, y: 5 },
    { commanderId: "관우", classId: "lightCavalry", level: 1, troops: 1120, items: ["청룡언월도"], side: "player", x: 1, y: 4 },
    { commanderId: "화웅", classId: "lightCavalry", level: 3, troops: 1760, items: [],            side: "enemy",  x: 5, y: 1 },
    { commanderId: "이숙", classId: "archer",       level: 3, troops: 1760, items: [],            side: "enemy",  x: 6, y: 2 },
  ],
  victory: { kind: "defeatUnit", unitId: "화웅" },
  defeat: { kind: "lordRetreat", unitId: "유비" },
  events: [],
};

export const testCtx: BattleContext = { data: gameData, stage: testStage, map: testMap };
