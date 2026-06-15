import { gameData, type BattleMap, type Stage, type Commander } from "@tk/data";
import type { BattleContext } from "../src/types";

/**
 * 공식 검증 픽스처는 영걸전 레퍼런스(§6) 수치에 고정한다.
 * 런타임 commanders.json 은 조조전 스탯으로 이식됐으므로(맵=영걸전/시스템=조조전, CLAUDE.md §2-9),
 * 공식 테스트가 shipping 데이터에 흔들리지 않도록 테스트 4인의 스탯을 합성 주입해 디커플한다.
 */
const refCommanders: Record<string, Commander> = {
  유비: { id: "유비", name: "유비", war: 75, leadership: 91, intelligence: 64, faceId: 0 },
  관우: { id: "관우", name: "관우", war: 98, leadership: 100, intelligence: 80, faceId: 1, ultimate: { name: "청룡언월", percent: 180 } },
  화웅: { id: "화웅", name: "화웅", war: 90, leadership: 88, intelligence: 29, faceId: 138 },
  이숙: { id: "이숙", name: "이숙", war: 54, leadership: 50, intelligence: 68, faceId: 139 },
};
const refData = { ...gameData, commanders: { ...gameData.commanders, ...refCommanders } };

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

export const testCtx: BattleContext = { data: refData, stage: testStage, map: testMap };
