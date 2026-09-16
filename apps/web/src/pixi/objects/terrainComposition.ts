import { decoVariant, type DecoVariant } from "./objectModel";

export type TerrainComposition = DecoVariant & { x: number; y: number; width: number; height: number; maxHeight?: number; courtyard?: boolean };

/** Visual-only patches. Never rewrite collision tiles or authored decorations. */
export function terrainComposition(width: number, height: number, at: (x: number, y: number) => string | undefined): Map<string, TerrainComposition> {
  const result = new Map<string, TerrainComposition>();
  const used = new Set<string>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const id = at(x, y);
    if (!id || !["forest", "mountain", "village"].includes(id) || used.has(`${x},${y}`)) continue;
    // A patch may only consume cells of the same terrain, including narrow edges.
    const free = (px: number, py: number) => px < width && py < height && at(px, py) === id && !used.has(`${px},${py}`);
    const w = free(x + 1, y) ? 2 : 1;
    const h = free(x, y + 1) && (w === 1 || free(x + 1, y + 1)) ? 2 : 1;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) used.add(`${x + dx},${y + dy}`);
    const v = decoVariant(id, x, y)!;
    const natural = id !== "village";
    const same = (px: number, py: number) => px >= 0 && py >= 0 && px < width && py < height && at(px, py) === id;
    const left = Array.from({length:h}, (_,i) => !same(x-1,y+i)).some(Boolean);
    const right = Array.from({length:h}, (_,i) => !same(x+w,y+i)).some(Boolean);
    const top = Array.from({length:w}, (_,i) => !same(x+i,y-1)).some(Boolean);
    const bottom = Array.from({length:w}, (_,i) => !same(x+i,y+h)).some(Boolean);
    const exposed = Number(left)+Number(right)+Number(top)+Number(bottom);
    const edgeScale = natural ? 1.1 - exposed * 0.055 : 1;
    result.set(`${x},${y}`, {
      ...v, x, y, width: w, height: h,
      // Broad silhouettes overlap gently; exposed edge cells stay small.
      scale: w * (natural ? 0.9 + (v.scale - 0.88) * 0.9 : 0.88) * edgeScale,
      dx: (w - 1) / 2 + (natural ? v.dx * 1.8 + (Number(left)-Number(right))*0.08 : 0),
      dy: natural ? (h - 1) / 2 + v.dy * 1.8 + (Number(top)-Number(bottom))*0.06 : -0.22,
      // Houses sit along the north edge; tile centers remain an open courtyard.
      ...(!natural ? { maxHeight: 0.72, courtyard: true } : {}),
      tint: undefined,
    });
  }
  return result;
}
