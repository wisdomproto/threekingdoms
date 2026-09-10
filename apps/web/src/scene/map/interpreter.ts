/** 막간 v4 순수 인터프리터 — 씬 스크립트의 유닛 상태·경로 계산(렌더 없음, 스펙 §러너 구조).
 * walkable은 주입(predicate) — 맵 데이터 접근 없음(순수성·테스트 용이). SceneStage가 소비. */
import type { MapScene } from "@tk/data";

export type Cell = readonly [number, number];
export type SceneUnitState = { cell: Cell; facing: "left" | "right" | "up" | "down"; pose: string; hidden: boolean };
export type Walkable = (c: Cell) => boolean;

export function nearestWalkable(walkable: Walkable, to: Cell): Cell {
  if (walkable(to)) return to;
  // 저작 실수 무붕괴: 맨해튼 링 확장, 결정론적 순회(반경→dx→dy 부호 순).
  // 반경 6 상한 = 씬 맵은 ~15×10이라 충분(전부 막히면 원좌표 폴백).
  for (let r = 1; r <= 6; r++) {
    for (let dx = -r; dx <= r; dx++) {
      const rest = r - Math.abs(dx);
      for (const dy of rest === 0 ? [0] : [-rest, rest]) {
        const c: Cell = [to[0] + dx, to[1] + dy];
        if (walkable(c)) return c;
      }
    }
  }
  return to; // 전부 막힘 — 원좌표 반환(렌더는 순간이동 폴백)
}

export function findScenePath(walkable: Walkable, from: Cell, to: Cell): Cell[] {
  const goal = nearestWalkable(walkable, to);
  const key = (c: Cell) => `${c[0]},${c[1]}`;
  const prev = new Map<string, Cell | null>([[key(from), null]]);
  const q: Cell[] = [from];
  while (q.length) {
    // 저작 실수 무붕괴: 무계(unbounded) walkable에서 도달 불가면 BFS가 영원히 확장 — 탐색 상한에서 포기
    if (prev.size > 4096) return [from];
    const cur = q.shift()!;
    if (cur[0] === goal[0] && cur[1] === goal[1]) {
      const path: Cell[] = [];
      for (let c: Cell | null = cur; c; c = prev.get(key(c)) ?? null) path.unshift(c);
      return path;
    }
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n: Cell = [cur[0] + d[0], cur[1] + d[1]];
      if (!prev.has(key(n)) && walkable(n)) { prev.set(key(n), cur); q.push(n); }
    }
  }
  return [from]; // 도달 불가 — 출발지 유지(무붕괴)
}

/** Four-way facing; explicit face actions override the direction derived from movement. */
function faceByDelta(s: SceneUnitState, dx: number, dy: number): void {
  if (dx !== 0) s.facing = dx > 0 ? "right" : "left";
  else if (dy !== 0) s.facing = dy > 0 ? "down" : "up";
}

/**
 * idx까지 액션 누적한 유닛 상태. 줄 내 정렬 = exit→move→enter→face→pose(스펙 계약). id 미매칭 = no-op.
 * facing: move(현재 칸→목적지)·enter(from→to)의 **net x-델타**로 파생 — 라이브 걸음(moveAlong이
 * x걸음마다 facing을 덮음)과 스킵 상태가 수렴한다(F-1). face는 enter **뒤** = 같은 줄 face가
 * 걸음 파생 facing을 교정하는 최종 발언권.
 */
export function sceneUnitStates(
  scene: MapScene, lineIdx: number, walkable: Walkable,
): ReadonlyMap<string, Readonly<SceneUnitState>> {
  const st = new Map<string, SceneUnitState>();
  for (const u of scene.units) {
    st.set(u.id, { cell: u.cell, facing: u.facing ?? "left", pose: "idle", hidden: u.hidden ?? false });
  }
  const upto = Math.min(lineIdx, scene.lines.length - 1);
  for (let i = 0; i <= upto; i++) {
    const l = scene.lines[i];
    if (!l) continue;
    // exit는 nearestWalkable 미적용이 의도 — 화면 밖/벽 너머로의 퇴장 목적지 허용(숨겨진 뒤라 통행성 무의미)
    l.exit?.forEach(({ id, to }) => { const s = st.get(id); if (s) { s.cell = to; s.hidden = true; } });
    l.move?.forEach(({ id, to }) => {
      const s = st.get(id);
      if (!s) return;
      const goal = nearestWalkable(walkable, to);
      faceByDelta(s, goal[0] - s.cell[0], goal[1] - s.cell[1]);
      s.cell = goal;
    });
    l.enter?.forEach(({ id, from, to }) => {
      const s = st.get(id);
      if (!s) return;
      const goal = nearestWalkable(walkable, to);
      faceByDelta(s, goal[0] - from[0], goal[1] - from[1]);
      s.cell = goal;
      s.hidden = false;
    });
    l.face?.forEach(({ id, dir }) => { const s = st.get(id); if (s) s.facing = dir; });
    l.pose?.forEach(({ id, pose }) => { const s = st.get(id); if (s) s.pose = pose; });
  }
  return st;
}
