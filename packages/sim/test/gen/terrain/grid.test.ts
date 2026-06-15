/**
 * 지형 격자 프리미티브(§11-C) 테스트 — 순수, 시드 PRNG 결정론.
 */
import { describe, it, expect } from "vitest";
import {
  createGrid, fillRect, vWall, scatter, carvePath, mulberry32, toBattleMap,
} from "../../../src/gen/terrain/grid";

describe("createGrid", () => {
  it("치수·채움 정확", () => {
    const g = createGrid(4, 3, ".");
    expect(g.width).toBe(4);
    expect(g.height).toBe(3);
    expect(g.cells.length).toBe(3);
    expect(g.cells.every((r) => r.length === 4 && r.every((c) => c === "."))).toBe(true);
  });
});

describe("fillRect", () => {
  it("지정 사각 영역만 채움(경계 포함, 클램프)", () => {
    const g = createGrid(5, 5, ".");
    fillRect(g, 1, 1, 3, 2, "#");
    expect(g.cells[1]!.slice(1, 4).join("")).toBe("###");
    expect(g.cells[2]!.slice(1, 4).join("")).toBe("###");
    expect(g.cells[0]!.join("")).toBe("....."); // 밖은 불변
    expect(g.cells[3]!.join("")).toBe(".....");
  });
});

describe("vWall", () => {
  it("세로 벽 + 게이트 갭", () => {
    const g = createGrid(5, 6, ".");
    vWall(g, 2, "#", 2, 3, "G"); // col2 전부 # 단 y 2~3은 G
    expect(g.cells.map((r) => r[2]).join("")).toBe("##GG##");
  });
});

describe("scatter (시드 결정론)", () => {
  it("density 0이면 변화 없음, density 1이면 전부", () => {
    const g0 = createGrid(4, 4, ".");
    scatter(g0, "f", 0, mulberry32(1));
    expect(g0.cells.flat().every((c) => c === ".")).toBe(true);
    const g1 = createGrid(4, 4, ".");
    scatter(g1, "f", 1, mulberry32(1));
    expect(g1.cells.flat().every((c) => c === "f")).toBe(true);
  });

  it("같은 시드면 동일 산포", () => {
    const a = createGrid(8, 8, ".");
    const b = createGrid(8, 8, ".");
    scatter(a, "f", 0.4, mulberry32(7));
    scatter(b, "f", 0.4, mulberry32(7));
    expect(a.cells).toEqual(b.cells);
  });

  it("mask가 false인 칸은 건너뜀", () => {
    const g = createGrid(4, 4, ".");
    scatter(g, "f", 1, mulberry32(1), (x) => x !== 0); // x=0 열 보호
    expect(g.cells.every((r) => r[0] === ".")).toBe(true);
    expect(g.cells.every((r) => r.slice(1).every((c) => c === "f"))).toBe(true);
  });
});

describe("carvePath", () => {
  it("웨이포인트를 잇는 통로를 ch로 깎음", () => {
    const g = createGrid(7, 7, "#");
    carvePath(g, [{ x: 1, y: 1 }, { x: 1, y: 4 }, { x: 5, y: 4 }], 1, ".");
    // 세로 구간 x=1 y1..4
    expect([1, 2, 3, 4].every((y) => g.cells[y]![1] === ".")).toBe(true);
    // 가로 구간 y=4 x1..5
    expect([1, 2, 3, 4, 5].every((x) => g.cells[4]![x] === ".")).toBe(true);
  });
});

describe("mulberry32", () => {
  it("같은 시드 같은 수열, 다른 시드 다른 수열", () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    const seqC = [c(), c(), c()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe("toBattleMap", () => {
  it("행=height·열=width 문자열, 범례·id 보존", () => {
    const g = createGrid(3, 2, ".");
    setTileAt(g, 0, 0, "#");
    const map = toBattleMap(g, { ".": "plain", "#": "wall" }, "m1", "맵1");
    expect(map.width).toBe(3);
    expect(map.height).toBe(2);
    expect(map.tiles.length).toBe(2);
    expect(map.tiles.every((r) => r.length === 3)).toBe(true);
    expect(map.tiles[0]).toBe("#..");
    expect(map.id).toBe("m1");
  });
});

// setTile 직접 검증용(별도 import 대신 cells 조작 헬퍼)
function setTileAt(g: { cells: string[][] }, x: number, y: number, ch: string): void {
  g.cells[y]![x] = ch;
}
