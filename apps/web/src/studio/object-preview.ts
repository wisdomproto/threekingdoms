import { decoObjectKey, decoVariant } from "../pixi/objects/objectModel";
import { wallTile } from "../pixi/objects/autotile";
import { assetUrl } from "../assetUrl";
import { StoreError } from "./project-store";
import { terrainComposition } from "../pixi/objects/terrainComposition";
import { propScale } from "../pixi/objects/propPresentation";

type Placement = { x: number; y: number; urls: string[]; tile?: boolean; rotation?: number; scale?: number; flip?: boolean; dx?: number; dy?: number; tint?: number; gate?: boolean; maxHeight?: number; courtyard?: boolean; width?: number; height?: number };
export function objectPreview(input: Record<string, unknown>): Placement[] {
  const rows = input.tiles;
  if (!Array.isArray(rows) || rows.length > 120 || !rows.every(row => typeof row === "string" && row.length <= 120)) throw new StoreError(400, "맵 크기를 확인해 주세요.");
  const legend = input.legend as Record<string, string> | undefined;
  const at = (x: number, y: number) => legend?.[rows[y]?.[x] ?? ""];
  const composition = terrainComposition(Math.max(0, ...rows.map(row => row.length)), rows.length, at);
  const url = (key: string) => assetUrl(`/assets/objects/${encodeURIComponent(key)}.webp`);
  const result: Placement[] = [];
  const fallback: Record<string, string> = { mountain: "mountain", gate: "gate", village: "hut", barracks: "camp", depot: "storehouse" };
  rows.forEach((row: string, y: number) => [...row].forEach((_, x) => {
    const terrain = at(x, y); if (!terrain) return;
    if (terrain === "wall") {
      const mask = (at(x,y-1)==="wall"?1:0)|(at(x+1,y)==="wall"?2:0)|(at(x,y+1)==="wall"?4:0)|(at(x-1,y)==="wall"?8:0);
      const wall = wallTile(mask); result.push({x,y,urls:[url(`wall_${wall.seg}`)],tile:true,rotation:wall.rot}); return;
    }
    if (terrain === "bridge") { result.push({x,y,urls:[url(at(x-1,y)==="river" || at(x+1,y)==="river" ? "bridge_v" : "bridge_h")],tile:true}); return; }
    const grouped = ["forest", "mountain", "village"].includes(terrain);
    const patch = composition.get(`${x},${y}`);
    if (grouped && !patch) return;
    const variant = patch ?? decoVariant(terrain,x,y), base = terrain === "gate" ? "gate_closed" : decoObjectKey(terrain);
    const urls = [...new Set([variant?.key,base].filter((key): key is string => !!key))].map(url);
    if (fallback[terrain]) urls.push(assetUrl(`/assets/tiles/${fallback[terrain]}.webp`));
    if (urls.length) result.push({x,y,urls,...variant,gate:terrain==="gate"});
  }));
  if (Array.isArray(input.decorations)) for (const d of input.decorations.slice(0,10000)) {
    if (!d || !Array.isArray(d.cell) || !d.cell.every(Number.isFinite) || typeof d.kind !== "string") continue;
    result.push({x:d.cell[0],y:d.cell[1],urls:[url(d.kind)],flip:d.flip === true,scale:propScale(d.kind, Number.isFinite(d.scale) ? d.scale : 1)});
  }
  return result;
}
