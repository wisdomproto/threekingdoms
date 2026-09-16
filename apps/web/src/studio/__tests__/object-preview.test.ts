import { expect, it } from "vitest";
import { objectPreview } from "../object-preview";
it("previews connected walls, river crossings and authored props without editing input", () => {
  const input = {tiles:["##..", ".brf"],legend:{"#":"wall",b:"bridge",r:"river",f:"forest"},decorations:[{kind:"campfire",cell:[2,0],flip:true,scale:1.4,custom:"preserved"}]};
  const before = JSON.stringify(input);
  const objects = objectPreview(input);
  expect(objects.find(o => o.x === 0 && o.y === 0)?.urls[0]).toContain("wall_end.webp");
  expect(objects.find(o => o.x === 1 && o.y === 1)?.urls[0]).toContain("bridge_v.webp");
  expect(objects.find(o => o.x === 3 && o.y === 1)?.urls[0]).toContain("tree_leafy.webp");
  expect(objects.at(-1)).toMatchObject({x:2,y:0,flip:true});
  expect(objects.at(-1)?.scale).toBeCloseTo(1.4 * 0.48);
  expect(JSON.stringify(input)).toBe(before);
  expect(objectPreview(input)).toEqual(objects);
});
