import { expect, it } from "vitest";
import { terrainComposition } from "../terrainComposition";

it("covers irregular terrain exactly once without filling paths or crossing map edges", () => {
  const rows = ["ff.ff", "ff..f", "fmmmf", ".mm.v", "...vv"];
  const kinds: Record<string, string> = { f: "forest", m: "mountain", v: "village" };
  const at = (x: number, y: number) => kinds[rows[y]?.[x] ?? ""];
  const patches = terrainComposition(5, 5, at);
  const covered = new Set<string>();
  for (const p of patches.values()) {
    for (let y = p.y; y < p.y + p.height; y++) for (let x = p.x; x < p.x + p.width; x++) {
      expect(at(x, y)).toBe(at(p.x, p.y));
      expect(covered.has(`${x},${y}`)).toBe(false);
      covered.add(`${x},${y}`);
    }
  }
  expect(covered.size).toBe(rows.join("").replaceAll(".", "").length);
  expect(patches.size).toBeLessThan(covered.size);
  expect(terrainComposition(5, 5, at)).toEqual(patches);
});

it("keeps isolated terrain visible and enlarges a connected village", () => {
  const single = terrainComposition(1, 1, () => "forest").get("0,0")!;
  expect(single.width).toBe(1);
  const village = terrainComposition(2, 2, () => "village");
  expect(village.size).toBe(1);
  expect(village.get("0,0")).toMatchObject({ width: 2, height: 2, dx: 0.5, dy: -0.22, scale: 1.76, maxHeight: 0.72, courtyard: true });
});


it("leaves unit foot positions clear of roofs for isolated and grouped villages", () => {
  for (const width of [1, 2]) for (const height of [1, 2]) {
    const p = terrainComposition(width, height, () => "village").get("0,0")!;
    const bottom = 1 + p.dy;
    const top = bottom - p.maxHeight!;
    // Rendered foot anchors sit at cell bottoms, including the neighboring row to the north.
    for (let row = -1; row < height; row++) {
      const feet = row + 1;
      expect(feet < top || feet > bottom).toBe(true);
    }
  }
});
