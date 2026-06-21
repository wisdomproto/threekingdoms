// apps/web/src/pixi/objects/objectModel.ts
/** 지형 id → 오브젝트 종류. wall/gate는 특수 렌더, 그 외는 deco(텍스처 유무로 그릴지 결정). pixi-free. */
export type ObjectKind = "wall" | "gate" | "deco";
export function objectKind(terrainId: string): ObjectKind {
  if (terrainId === "wall") return "wall";
  if (terrainId === "gate") return "gate";
  return "deco";
}
