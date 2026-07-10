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
  it("같은 줄 같은 id의 exit+enter 혼합 = 정렬 계약(exit 먼저→enter 나중 = 최종 visible)", () => {
    const s2: MapScene = {
      ...scene,
      lines: [{ exit: [{ id: "a", to: [0, 4] }], enter: [{ id: "a", from: [4, 0], to: [4, 1] }] }],
    };
    expect(sceneUnitStates(s2, 0, walkable).get("a")).toMatchObject({ cell: [4, 1], hidden: false });
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
  it("최단성 잠금 — 벽(2,2) 우회 경로는 정확히 7칸", () => {
    expect(findScenePath(walkable, [0, 2], [4, 2]).length).toBe(7);
  });
  it("무계 predicate + 도달 불가 = 탐색 상한에서 무붕괴 종료(무한 루프 없음)", () => {
    // y=1 벽으로 위아래가 분리된 '무한' 평면 — 상한 없으면 BFS가 영원히 확장
    const halves = (c: readonly [number, number]) => c[1] !== 1;
    expect(findScenePath(halves, [0, 0], [0, 2])).toEqual([[0, 0]]);
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
  it("전부 막힘 = 원좌표 그대로 반환(무붕괴)", () => {
    expect(nearestWalkable(() => false, [3, 3])).toEqual([3, 3]);
  });
});
