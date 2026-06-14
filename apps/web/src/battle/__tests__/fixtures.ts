import { gameData, type BattleMap, type Stage } from "@tk/data";
import type { BattleContext, BattleState, UnitState } from "@tk/engine";

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

/**
 * 실제 사수관 ctx (설계 §7 스위트 1·3·4의 픽스처) — gameData + 05-sishuiguan.
 * 아군 3기(유비·관우·장비, x=50)와 적 4기(화웅·이숙·호진·조잠, x=1~2)가 56×32 맵 양끝에 배치.
 */
const sishuiStage = gameData.stages["05-sishuiguan"];
const sishuiMap = gameData.maps["sishuiguan"];
if (!sishuiStage || !sishuiMap) throw new Error("사수관 데이터 누락 — @tk/data 로더 확인");
export const sishuiCtx: BattleContext = { data: gameData, stage: sishuiStage, map: sishuiMap };

/**
 * 하비1차 ctx (12-xiapi1) — 비섬멸 *탈출* 목표 픽스처. 유비(31,15)가 reachTile 목표 (0,15)로
 * 좌측 탈출, 적은 우측(x=36~40)에 배치. 순수 그리디 "최단거리 적 돌진"이면 유비가 *우측(적)*으로
 * 가지만, policy.ts의 목표 인식(escapeGoalFor)이면 유비가 *좌측(목표)*으로 라우팅된다.
 * 자동전투(player 페이즈)가 같은 chooseAction을 공유하는지 검증하는 판별 픽스처.
 */
const xiapiStage = gameData.stages["12-xiapi1"];
const xiapiMap = gameData.maps["xiapi1"];
if (!xiapiStage || !xiapiMap) throw new Error("하비1차 데이터 누락 — @tk/data 로더 확인");
export const xiapi1Ctx: BattleContext = { data: gameData, stage: xiapiStage, map: xiapiMap };

export function findUnit(state: BattleState, id: string): UnitState {
  const u = state.units.find((x) => x.id === id);
  if (!u) throw new Error(`픽스처에 없는 유닛: ${id}`);
  return u;
}

/** 유닛 패치 사본 — 시나리오 구성용 (reduceInput은 순수 함수라 임의 상태 주입 가능) */
export function withUnit(state: BattleState, id: string, patch: Partial<UnitState>): BattleState {
  findUnit(state, id); // 존재 검증
  return { ...state, units: state.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) };
}
