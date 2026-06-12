import iconv from "iconv-lite";
import { ls11Extract } from "./ls11.js";
import type { BattleMap } from "@tk/data";

export interface RawMap {
  index: number;
  name: string;
  width: number;
  height: number;
  tiles: Uint8Array;
}

export function parseHexzmap(buf: Buffer): RawMap[] {
  const chunks = ls11Extract(buf);
  if (chunks.length !== 59) throw new Error(`expected 59 chunks, got ${chunks.length}`);
  // CP949 텍스트 블록: \r\n 또는 \n 구분 (DOS 원본은 \r\n이나 환경에 따라 변환될 수 있음)
  const names = iconv
    .decode(Buffer.from(chunks[58]!), "cp949")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return chunks.slice(0, 58).map((c, i) => {
    const width = c[0]!, height = c[1]!;
    const expected = 2 + width * height + (width * height) / 4;
    if (c.length !== expected) throw new Error(`map ${i}: size ${c.length} != ${expected}`);
    return {
      index: i,
      name: names[i] ?? `map${i}`,
      width,
      height,
      tiles: c.subarray(2, 2 + width * height),
    };
  });
}

/**
 * 타일 인덱스 → 지형 id (사수관 검증분).
 *
 * 판별 방법: 히스토그램 + 전체 맵 덤프 + ASCII 시각화로 위치 대조.
 * 사수관(56×32)은 우측에서 좌측으로 진격하는 관문 돌파 맵.
 *
 * --- 분류 기준 ---
 * 큰 덩어리(0xAC: 321개) → 좌측 전체를 점유하는 산악 덩어리.
 * 0x00(540개) → 가운데-우측 개방 지대 = 평지.
 * 0x36-0x3B, 0x40-0x4F → 우측 구역에서 교차하는 길/통로 타일 = plain(道上).
 * 0xC5/C6/C7 + 0xBD-0xC4 + 0xCA/CB + 0xDA → 성벽 구조물.
 * 0xE3/E4/EA/C9 → 성문(0xE3/EA가 col4-5 row13에, 0xE4가 row15에 등장).
 * 0xD4 → 성벽 우측 열(세로 stripe, col8 row8-27) = wall.
 * 0x60-0x93 → 산기슭·초목 = forest.
 * 0x0E-0x23 + 0xA1/A2/A5/A6/A9 → 산 경계부 경사지 = mountain.
 * 0x01-0x04 → 2×2 건물 클러스터(row16-17, col22-23) = village(촌락).
 * 0x05 → 단독 특수 지점 = depot(보물창고 후보).
 * 0x2D-0x35 → 3×4 사각형 구조물(rows20-22) = barracks(병영).
 * 0xAA/AB/AD/AE/AF/B0/EF/F0-F6 → 산악 경계 전환 타일 = mountain.
 * 나머지 저출현 값 → plain 폴백(사수관 내 전부 식별 완료).
 */
export const TILE_TERRAIN: Record<number, string> = {
  // ── 평지 ─────────────────────────────────────────────
  0x00: "plain",   // 개방 지대 (최다 출현 540개)

  // ── 길 / 통로 (평지 취급, 우측 반부 교차 패턴) ───────
  // 0x36-0x3F (도로 타일 전 범위, 행 방향/교차 등 아트 변형)
  0x36: "plain", 0x37: "plain", 0x38: "plain",
  0x39: "plain", 0x3a: "plain", 0x3b: "plain",
  0x3c: "plain", 0x3d: "plain", 0x3e: "plain", 0x3f: "plain",
  // 0x40-0x4F (도로 이음 타일들)
  0x40: "plain", 0x41: "plain", 0x42: "plain", 0x43: "plain",
  0x44: "plain", 0x45: "plain", 0x46: "plain", 0x47: "plain",
  0x48: "plain", 0x49: "plain", 0x4a: "plain", 0x4b: "plain",
  0x4c: "plain", 0x4d: "plain", 0x4e: "plain", 0x4f: "plain",
  // 소규모 연결 타일 (06-0D 범위)
  0x06: "plain", 0x07: "plain", 0x08: "plain", 0x09: "plain",
  0x0a: "plain", 0x0b: "plain", 0x0c: "plain", 0x0d: "plain",

  // ── 산지 (대덩어리) ───────────────────────────────────
  0xac: "mountain",  // 좌측 산악 본체 (321개, 가장 큰 블록)

  // 산악 경계 전환 타일군
  0xaa: "mountain", 0xab: "mountain", 0xad: "mountain",
  0xae: "mountain", 0xaf: "mountain", 0xb0: "mountain",
  // 추가 산악 경계 (우측 상단 경사지)
  0xef: "mountain", 0xf0: "mountain",
  0xf1: "mountain", 0xf2: "mountain", 0xf3: "mountain",
  0xf4: "mountain", 0xf5: "mountain", 0xf6: "mountain",
  // 우측 산지 경사 타일 (0x0E-0x23 범위 — 산 경계부)
  0x0e: "mountain", 0x0f: "mountain", 0x10: "mountain",
  0x11: "mountain", 0x12: "mountain", 0x13: "mountain",
  0x14: "mountain", 0x15: "mountain", 0x16: "mountain",
  0x17: "mountain", 0x18: "mountain", 0x19: "mountain",
  0x1a: "mountain", 0x1b: "mountain", 0x1c: "mountain",
  0x1d: "mountain", 0x1e: "mountain", 0x1f: "mountain",
  0x20: "mountain", 0x21: "mountain", 0x22: "mountain",
  0x23: "mountain",
  // 독립 산지 조각
  0xa1: "mountain", 0xa2: "mountain",
  0xa5: "mountain", 0xa6: "mountain", 0xa9: "mountain",

  // ── 삼림 (산기슭·초목 0x60-0x93 범위) ───────────────
  0x60: "forest", 0x62: "forest", 0x63: "forest", 0x64: "forest",
  0x65: "forest", 0x66: "forest", 0x67: "forest", 0x68: "forest",
  0x69: "forest", 0x6a: "forest", 0x6b: "forest", 0x6c: "forest",
  0x6d: "forest", 0x6e: "forest", 0x6f: "forest", 0x70: "forest",
  0x71: "forest", 0x72: "forest", 0x73: "forest", 0x74: "forest",
  0x75: "forest", 0x76: "forest", 0x77: "forest", 0x78: "forest",
  0x79: "forest", 0x7a: "forest", 0x7b: "forest", 0x7c: "forest",
  0x7d: "forest", 0x7e: "forest", 0x7f: "forest", 0x80: "forest",
  0x81: "forest", 0x82: "forest", 0x83: "forest", 0x84: "forest",
  0x85: "forest", 0x86: "forest", 0x87: "forest", 0x88: "forest",
  0x89: "forest", 0x8a: "forest", 0x8b: "forest", 0x8c: "forest",
  0x8d: "forest", 0x8e: "forest", 0x8f: "forest", 0x90: "forest",
  0x91: "forest", 0x92: "forest", 0x93: "forest", 0x98: "forest",

  // ── 성벽 (wall, moveCost 99) ─────────────────────────
  // 성벽 몸체
  0xc5: "wall", 0xc6: "wall", 0xc7: "wall", 0xc8: "wall",
  // 성벽 모서리 (상단 캡)
  0xbd: "wall", 0xbe: "wall", 0xbf: "wall", 0xc0: "wall",
  // 성벽 하단 모서리
  0xc1: "wall", 0xc2: "wall", 0xc3: "wall", 0xc4: "wall",
  // 성벽 우측 세로 열 (col8, rows 8-27)
  0xd4: "wall",
  // 성벽 보조 연결 타일
  0xca: "wall", 0xcb: "wall",
  // 성벽 측면 (col5, row22 등)
  0xda: "wall",
  // 단일 출현 성벽 이상값 처리
  0xfd: "wall", 0xfe: "wall",

  // ── 성문 (gate) ───────────────────────────────────────
  0xe3: "gate",  // 성문 좌측 (row13 col4, row15 col6-7)
  0xe4: "gate",  // 성문 우측
  0xea: "gate",  // 성문 중앙 (row13 col6)
  0xc9: "gate",  // 성문 상단 장식 (row13 col5)

  // ── 촌락 (village, 2×2 건물 col22-23 row16-17) ───────
  0x01: "village", 0x02: "village",
  0x03: "village", 0x04: "village",

  // ── 보물창고 (depot, 단독 특수 지점) ─────────────────
  0x05: "depot",

  // ── 병영 (barracks, 3×4 사각 구조물 rows20-22) ───────
  0x2d: "barracks", 0x2e: "barracks", 0x2f: "barracks",
  0x30: "barracks", 0x31: "barracks", 0x32: "barracks",
  0x33: "barracks", 0x34: "barracks", 0x35: "barracks",

  // ── 기타 저출현 보조 타일 ─────────────────────────────
  // 성문 구역 보조 장식
  0xe0: "gate", 0xe1: "gate", 0xe2: "gate",
};

/** 지형 id → 맵 JSON 1글자 코드 (terrains.json 14종과 1:1) */
export const TERRAIN_CHAR: Record<string, string> = {
  plain: ".",
  grass: "g",
  bridge: "b",
  waste: "w",
  village: "v",
  barracks: "B",
  depot: "d",
  forest: "f",
  mountain: "m",
  fort: "F",
  gate: "G",
  river: "r",
  wall: "#",
  cliff: "c",
};

export function toBattleMap(
  raw: RawMap,
  id: string,
): { map: BattleMap; unmapped: number[] } {
  const unmapped = new Set<number>();
  const rows: string[] = [];
  for (let y = 0; y < raw.height; y++) {
    let row = "";
    for (let x = 0; x < raw.width; x++) {
      const t = raw.tiles[y * raw.width + x]!;
      const terrain = TILE_TERRAIN[t] ?? (unmapped.add(t), "plain");
      row += TERRAIN_CHAR[terrain]!;
    }
    rows.push(row);
  }
  const tileLegend = Object.fromEntries(
    Object.entries(TERRAIN_CHAR).map(([k, v]) => [v, k]),
  );
  return {
    map: {
      id,
      name: raw.name,
      width: raw.width,
      height: raw.height,
      tileLegend,
      tiles: rows,
    },
    unmapped: [...unmapped].sort((a, b) => a - b),
  };
}
