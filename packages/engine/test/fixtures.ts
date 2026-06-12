import { gameData, type BattleMap, type Stage } from "@tk/data";
import type { BattleContext } from "../src/types";

/** 8×6 합성 맵: 평지 위주 + 산/성벽/관문 1열 (실제 terrains.json 지형 사용) */
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

/** 합성 스테이지: 실제 장수/병종 데이터 사용 (관우·유비 vs 화웅·이숙) */
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
  events: [{
    id: "duel_관우_화웅", type: "duel",
    trigger: { kind: "attack", attackerId: "관우", defenderId: "화웅" },
    outcome: { winnerId: "관우", loserRetreats: true }, once: true,
  }],
};

export const testCtx: BattleContext = { data: gameData, stage: testStage, map: testMap };
