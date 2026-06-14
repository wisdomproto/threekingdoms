import { describe, it, expect } from "vitest";
import { gameData, type BattleMap, type Stage } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import { getAttackableTargets } from "../src/combat";
import { getMovableTiles } from "../src/movement";
import { camp, areFoes } from "../src/types";
import type { BattleContext, BattleState } from "../src/types";

/**
 * Tier 2-1: 진영 3종(player/ally/enemy) 피아식별 테스트.
 *  - camp(side): player·ally = friendly, enemy = hostile.
 *  - 우군(ally)은 AI 그리디로 자동 구동, 플레이어 조종/공격 불가, 적의 타깃.
 *  - 페이즈 순서 player→ally→enemy, 우군 없는 스테이지는 ally 스킵.
 */

const get = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;

// 평지 10×3 맵 — 좌측 적, 우측 아군, 중앙 우군
const map: BattleMap = {
  id: "campmap", name: "캠프맵", width: 10, height: 3,
  tileLegend: { ".": "plain" },
  tiles: ["..........", "..........", ".........."],
};

/** 우군 1기 포함 스테이지: 유비(player) / 공손찬(ally) / 화웅(enemy) */
function makeStage(allyIncluded: boolean): Stage {
  const units: Stage["units"] = [
    { commanderId: "유비", classId: "footman", level: 5, troops: 100, items: [], side: "player", x: 8, y: 1 },
    { commanderId: "화웅", classId: "lightCavalry", level: 5, troops: 100, items: [], side: "enemy", x: 1, y: 1 },
  ];
  if (allyIncluded) {
    units.splice(1, 0, {
      commanderId: "공손찬", classId: "lightCavalry", level: 5, troops: 100, items: [], side: "ally", x: 4, y: 1,
    });
  }
  return {
    id: "camp-stage", name: "캠프", mapId: "campmap", turnLimit: 30,
    units,
    victory: { kind: "defeatUnit", unitId: "화웅" },
    defeat: { kind: "lordRetreat", unitId: "유비" },
    events: [],
  };
}

const ctxWithAlly: BattleContext = { data: gameData, stage: makeStage(true), map };
const ctxNoAlly: BattleContext = { data: gameData, stage: makeStage(false), map };

describe("camp 헬퍼", () => {
  it("player·ally = friendly, enemy = hostile", () => {
    expect(camp("player")).toBe("friendly");
    expect(camp("ally")).toBe("friendly");
    expect(camp("enemy")).toBe("hostile");
  });
  it("areFoes: 다른 camp만 적대", () => {
    expect(areFoes("player", "enemy")).toBe(true);
    expect(areFoes("ally", "enemy")).toBe(true);
    expect(areFoes("player", "ally")).toBe(false); // 우군은 아군과 같은 편
    expect(areFoes("enemy", "enemy")).toBe(false);
  });
});

describe("타깃 필터: 우군은 공격 불가, 적은 양쪽 타깃", () => {
  it("플레이어는 우군(ally)을 공격 대상으로 보지 않는다", () => {
    // 유비(8,1) 옆에 우군을 인접시켜도 사거리 내 타깃에서 제외
    let s = createBattle(ctxWithAlly, 1);
    s = { ...s, units: s.units.map((u) => (u.id === "공손찬" ? { ...u, x: 7, y: 1 } : u)) };
    const targets = getAttackableTargets(ctxWithAlly, s, "유비");
    expect(targets).not.toContain("공손찬");
  });

  it("플레이어가 우군을 attack하려 하면 invalid target", () => {
    let s = createBattle(ctxWithAlly, 1);
    s = { ...s, units: s.units.map((u) => (u.id === "공손찬" ? { ...u, x: 7, y: 1 } : u)) };
    expect(() => applyAction(ctxWithAlly, s, { type: "attack", unitId: "유비", targetId: "공손찬" })).toThrow();
  });

  it("적은 player와 ally 둘 다 사거리 내면 타깃 후보", () => {
    let s = createBattle(ctxWithAlly, 1);
    // 화웅(1,1) 주위에 player·ally 인접 배치
    s = {
      ...s,
      phase: "enemy",
      units: s.units.map((u) =>
        u.id === "유비" ? { ...u, x: 2, y: 1 } : u.id === "공손찬" ? { ...u, x: 1, y: 0 } : u,
      ),
    };
    const targets = getAttackableTargets(ctxWithAlly, s, "화웅");
    expect(targets).toEqual(expect.arrayContaining(["유비", "공손찬"]));
  });

  it("우군은 적(화웅)을 타깃하고 아군(유비)은 타깃하지 않는다", () => {
    let s = createBattle(ctxWithAlly, 1);
    s = {
      ...s,
      units: s.units.map((u) =>
        u.id === "공손찬" ? { ...u, x: 2, y: 1 } : u.id === "유비" ? { ...u, x: 3, y: 1 } : u,
      ),
    };
    const targets = getAttackableTargets(ctxWithAlly, s, "공손찬");
    expect(targets).toContain("화웅");
    expect(targets).not.toContain("유비");
  });
});

describe("이동: 우군은 통과 가능, 적은 통과 불가", () => {
  it("우군 점유 타일은 통과 가능(정지는 불가)", () => {
    let s = createBattle(ctxWithAlly, 1);
    // 유비(8,1), 우군을 (5,1)에 두고 유비 이동력으로 그 너머까지 도달되는지
    s = { ...s, units: s.units.map((u) => (u.id === "공손찬" ? { ...u, x: 6, y: 1 } : u)) };
    const tiles = getMovableTiles(ctxWithAlly, s, "유비");
    // 우군 칸(6,1)에는 정지 불가
    expect(tiles.some((t) => t.x === 6 && t.y === 1)).toBe(false);
    // 우군 칸 너머(5,1)로는 통과해서 도달 가능 (footman move 충분)
    expect(tiles.some((t) => t.x === 5 && t.y === 1)).toBe(true);
  });
});

describe("페이즈 순서 player→ally→enemy", () => {
  it("우군 포함 시 player 종료 후 ally 페이즈로", () => {
    let s = createBattle(ctxWithAlly, 1);
    expect(s.phase).toBe("player");
    // 유비·... 전원 wait
    for (const u of s.units.filter((u) => u.side === "player")) {
      s = applyAction(ctxWithAlly, s, { type: "wait", unitId: u.id }).state;
    }
    expect(s.phase).toBe("ally");
  });

  it("ally 종료 후 enemy, enemy 종료 후 다시 player(턴 +1)", () => {
    let s = createBattle(ctxWithAlly, 1);
    const wait = (st: BattleState) => {
      let cur = st;
      for (const u of cur.units.filter((x) => x.side === cur.phase && !x.retreated && !x.acted)) {
        cur = applyAction(ctxWithAlly, cur, { type: "wait", unitId: u.id }).state;
      }
      return cur;
    };
    s = wait(s); // player → ally
    expect(s.phase).toBe("ally");
    s = wait(s); // ally → enemy
    expect(s.phase).toBe("enemy");
    expect(s.turn).toBe(1);
    s = wait(s); // enemy → player (round +1)
    expect(s.phase).toBe("player");
    expect(s.turn).toBe(2);
  });

  it("우군 없는 스테이지는 ally 페이즈를 스킵하고 player→enemy", () => {
    let s = createBattle(ctxNoAlly, 1);
    for (const u of s.units.filter((u) => u.side === "player")) {
      s = applyAction(ctxNoAlly, s, { type: "wait", unitId: u.id }).state;
    }
    expect(s.phase).toBe("enemy"); // ally 스킵
  });
});

describe("승패: 우군 전멸은 패배 아님, 적 전멸이 승리(defeatAll)", () => {
  it("우군이 모두 퇴각해도 status는 ongoing", () => {
    const defeatAllStage: Stage = { ...makeStage(true), victory: { kind: "defeatAll" } };
    const ctx: BattleContext = { data: gameData, stage: defeatAllStage, map };
    let s = createBattle(ctx, 1);
    // 우군 강제 퇴각
    s = { ...s, units: s.units.map((u) => (u.id === "공손찬" ? { ...u, troops: 0, retreated: true } : u)) };
    // 적이 살아있으므로 승리 아님 — checkOutcome은 applyAction 내부. wait로 트리거
    s = applyAction(ctx, s, { type: "wait", unitId: "유비" }).state;
    expect(s.status).toBe("ongoing");
  });
});
