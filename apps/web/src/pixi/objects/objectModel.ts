// apps/web/src/pixi/objects/objectModel.ts
/** 지형 id → 오브젝트 종류. wall/gate는 특수 렌더, 그 외는 deco(텍스처 유무로 그릴지 결정). pixi-free. */
export type ObjectKind = "wall" | "gate" | "deco";
export function objectKind(terrainId: string): ObjectKind {
  if (terrainId === "wall") return "wall";
  if (terrainId === "gate") return "gate";
  return "deco";
}

/** deco 지형 → 새 K-5/K-6 오브젝트 키(/assets/objects/). 있으면 옛 DECO_FILES보다 우선 사용.
 *  미보유 시(아트 미생성) 옛 데코로 폴백. 미매핑 지형(gate/bridge 등)은 옛 데코 그대로.
 *  매핑·키는 데이터 — 시각이 안 맞으면 여기만 바꾸면 됨. */
export const DECO_OBJECT_MAP: Record<string, string> = {
  mountain: "rock_cluster", // 산지 = 바위 무리
  cliff: "rock_cliff",      // 절벽 = 바위 노두
  forest: "tree_leafy",     // 숲 = 활엽수(종전 데코 없던 바닥에 나무 액센트)
  // 거점 3종(지형 회복 §10 — "여기 서면 회복"이 읽혀야 한다). K-9 아트 미보유 시 옛 데코
  // (hut/camp/storehouse) 폴백. 종전 수레/진영문 대용은 "벌판에 성문이 떠 있는" 오독을
  // 낳아 교정(2026-07-04 전장 오브젝트 검토).
  village: "village_hut",   // 마을/취락 = 민가
  depot: "depot_store",     // 보물창고 = 창고
  barracks: "camp_tent",    // 병영 = 군막
};

/** deco 지형의 우선 오브젝트 키(없으면 undefined → 옛 데코 폴백). */
export function decoObjectKey(terrainId: string): string | undefined {
  return DECO_OBJECT_MAP[terrainId];
}

// ── 지형 자동 데코의 유기적 변형(하이브리드 플랜 Chunk 3 #4) ─────────────────
// 같은 스프라이트가 정격자에 도장처럼 반복돼 "어색"하던 문제(2026-07-03 피드백)를
// (gx,gy) 해시 시드의 **결정론** 변형(좌우 반전·크기·칸 내 오프셋·산지 바위 2종 혼합)으로 푼다.
// 순수 시각 — 지형/통행 판정 불변. 렌더마다 동일(리플레이/스크린샷 안정).
// 정밀 배치(stage.decorations)는 손으로 놓은 그대로 — 변형을 적용하지 않는다.

export interface DecoVariant {
  /** 그릴 오브젝트 키(변형 키 미보유 시 호출측이 기본 키로 폴백) */
  key: string;
  flip: boolean;
  /** 기본 스케일 배수 (0.88~1.14) */
  scale: number;
  /** 칸 내 오프셋(타일 비율, 자연물만 ±0.12 — 구조물은 0) */
  dx: number;
  dy: number;
  /** 웜 멀티플라이 틴트(0xRRGGBB) — 미지정 시 원색.
   *  바위류의 차가운 회색조 + 스프라이트에 박힌 흰 바닥 카펫(아트와 픽셀 연결이라 수술 불가,
   *  2026-07-03)을 렌더에서 완화: 흰색×틴트=땅색 근사라 카펫이 배경에 흡수된다. */
  tint?: number;
}

/** 지형별 웜 틴트 — 황토 painted 전장과 온도 정합(값은 데이터 1곳, 재생성 아트가 오면 제거 검토). */
const DECO_TINT: Record<string, number> = {
  mountain: 0xd9c9a8, // 바위: 강한 웜(흰 카펫 흡수 + 한색 보정)
  cliff: 0xd9c9a8,
  forest: 0xefe6d0, // 나무: 약한 웜(잿빛 잎 온도만 살짝)
};

/** 산지 혼합 바위(1/3 확률로 큰 바위) — OBJECT_FILES에 함께 등록돼 있어야 한다. */
const MOUNTAIN_MIX_KEY = "rock_boulder";
/** 오프셋까지 흔드는 자연물 지형(구조물·수레는 제자리 유지) */
const NATURE_TERRAIN = new Set(["mountain", "forest", "cliff"]);

/** (terrain,gx,gy) → 32bit 정수 해시(결정론). 시각 전용 — 게임 RNG와 무관. */
function cellHash(terrainId: string, gx: number, gy: number): number {
  let h = 0x811c9dc5;
  const s = `${terrainId}:${gx}:${gy}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 0..1 균등 파생(비트 시프트별 독립 사용) */
function unit(h: number, shift: number): number {
  return ((h >>> shift) & 0x3ff) / 0x3ff;
}

export function decoVariant(terrainId: string, gx: number, gy: number): DecoVariant | undefined {
  const base = DECO_OBJECT_MAP[terrainId];
  if (!base) return undefined;
  const h = cellHash(terrainId, gx, gy);
  const nature = NATURE_TERRAIN.has(terrainId);
  const key = terrainId === "mountain" && h % 3 === 0 ? MOUNTAIN_MIX_KEY : base;
  return {
    key,
    flip: (h & 1) === 1,
    scale: 0.88 + unit(h, 2) * 0.26,
    // 구조물은 정확히 0 — 음수 방향 곱의 -0 잔재도 남기지 않는다(직렬화/비교 안전)
    dx: nature ? (unit(h, 12) * 2 - 1) * 0.12 : 0,
    dy: nature ? (unit(h, 22) * 2 - 1) * 0.12 : 0,
    tint: DECO_TINT[terrainId],
  };
}
