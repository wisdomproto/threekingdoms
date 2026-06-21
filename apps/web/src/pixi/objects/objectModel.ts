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
  village: "supply_cart",   // 마을/취락 = 보급 수레(전용 건물 오브젝트 생기면 교체)
  depot: "supply_cart",     // 보급소 = 보급 수레
  barracks: "camp_gate",    // 병영 = 진영문
};

/** deco 지형의 우선 오브젝트 키(없으면 undefined → 옛 데코 폴백). */
export function decoObjectKey(terrainId: string): string | undefined {
  return DECO_OBJECT_MAP[terrainId];
}
