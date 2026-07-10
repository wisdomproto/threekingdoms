import { describe, it, expect } from "vitest";
import { sceneUnitStates, findScenePath, nearestWalkable } from "../interpreter";
import type { MapScene } from "@tk/data";

// 5×5 전부 통행, (2,2)만 벽인 격자 스텁
const walkable = (c: readonly [number, number]) =>
  c[0] >= 0 && c[0] < 5 && c[1] >= 0 && c[1] < 5 && !(c[0] === 2 && c[1] === 2);

const scene: MapScene = {
  map: "m", units: [
    { id: "a", sprite: "s", cell: [0, 0] },
    { id: "b", sprite: "s", cell: [4, 4], hidden: true },
  ],
  lines: [
    { text: "0" },
    { move: [{ id: "a", to: [3, 0] }], face: [{ id: "a", dir: "right" }], text: "1" },
    { enter: [{ id: "b", from: [4, 0], to: [4, 1] }], text: "2" },
    { pose: [{ id: "a", pose: "kneel" }], text: "3" },
    { exit: [{ id: "b", to: [4, 0] }], text: "4" },
    { move: [{ id: "x", to: [1, 1] }], text: "5 (미매칭 no-op)" },
  ],
};

describe("sceneUnitStates", () => {
  it("초기: hidden 반영, 기본 facing left·pose idle", () => {
    const s = sceneUnitStates(scene, 0, walkable);
    expect(s.get("a")).toEqual({ cell: [0, 0], facing: "left", pose: "idle", hidden: false });
    expect(s.get("b")!.hidden).toBe(true);
  });
  it("move·face 누적", () => {
    const s = sceneUnitStates(scene, 1, walkable);
    expect(s.get("a")).toMatchObject({ cell: [3, 0], facing: "right" });
  });
  it("enter는 hidden 해제 + 목적지", () => {
    expect(sceneUnitStates(scene, 2, walkable).get("b")).toMatchObject({ cell: [4, 1], hidden: false });
  });
  it("pose 전환·exit 재숨김", () => {
    expect(sceneUnitStates(scene, 3, walkable).get("a")!.pose).toBe("kneel");
    expect(sceneUnitStates(scene, 4, walkable).get("b")!.hidden).toBe(true);
  });
  it("id 미매칭 = no-op(크래시 없음)", () => {
    expect(() => sceneUnitStates(scene, 5, walkable)).not.toThrow();
  });
  it("idx가 범위를 넘어도 마지막 줄 상태로 클램프", () => {
    expect(sceneUnitStates(scene, 99, walkable).get("a")!.pose).toBe("kneel");
  });
  it("통행 불가 목적지는 인접 통행 칸으로 보정", () => {
    const s2: MapScene = { ...scene, lines: [{ move: [{ id: "a", to: [2, 2] }] }] };
    const cell = sceneUnitStates(s2, 0, walkable).get("a")!.cell;
    expect(walkable(cell)).toBe(true);
    expect(Math.abs(cell[0] - 2) + Math.abs(cell[1] - 2)).toBe(1);
  });
});

describe("findScenePath", () => {
  it("벽(2,2)을 우회하는 BFS 최단 경로(연속 인접 셀)", () => {
    const p = findScenePath(walkable, [0, 2], [4, 2]);
    expect(p[0]).toEqual([0, 2]);
    expect(p[p.length - 1]).toEqual([4, 2]);
    expect(p.some(c => c[0] === 2 && c[1] === 2)).toBe(false);
    for (let i = 1; i < p.length; i++) {
      expect(Math.abs(p[i]![0] - p[i - 1]![0]) + Math.abs(p[i]![1] - p[i - 1]![1])).toBe(1);
    }
  });
  it("도달 불가면 출발지만 반환(무붕괴)", () => {
    const boxed = (c: readonly [number, number]) => c[0] === 0 && c[1] === 0;
    expect(findScenePath(boxed, [0, 0], [3, 3])).toEqual([[0, 0]]);
  });
  it("목적지가 벽이면 보정된 인접 칸까지의 경로", () => {
    const p = findScenePath(walkable, [0, 2], [2, 2]);
    const last = p[p.length - 1]!;
    expect(walkable(last)).toBe(true);
    expect(Math.abs(last[0] - 2) + Math.abs(last[1] - 2)).toBe(1);
  });
});

describe("nearestWalkable", () => {
  it("통행 가능하면 그대로", () => {
    expect(nearestWalkable(walkable, [1, 1])).toEqual([1, 1]);
  });
  it("벽이면 결정론적으로 같은 인접 칸", () => {
    const a = nearestWalkable(walkable, [2, 2]);
    const b = nearestWalkable(walkable, [2, 2]);
    expect(a).toEqual(b);
    expect(walkable(a)).toBe(true);
  });
});
