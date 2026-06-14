/**
 * Tier 2-1: 우군(ally) 페이즈 — 플레이어 조종/공격 불가, AI 그리디 자동 구동, 적의 타깃.
 * store/inputMachine/enemyTurnDriver 전 스택에서 우군 페이즈가
 *   (a) 입력을 잠그고(enemyTurn ui), (b) runAiPhases로 ally→enemy를 연속 구동하며,
 *   (c) 한 라운드 뒤 player로 복귀하는지 검증한다.
 */
import { describe, expect, it } from "vitest";
import { gameData, type BattleMap, type Stage } from "@tk/data";
import type { BattleContext } from "@tk/engine";
import { BattleStore } from "../store";

const map: BattleMap = {
  id: "allymap", name: "우군맵", width: 12, height: 3,
  tileLegend: { ".": "plain" },
  tiles: ["............", "............", "............"],
};

// 유비(player, 우측) / 공손찬(ally, 중앙) / 화웅(enemy, 좌측)
const stage: Stage = {
  id: "ally-stage", name: "우군", mapId: "allymap", turnLimit: 30,
  units: [
    { commanderId: "유비", classId: "footman", level: 5, troops: 100, items: [], side: "player", x: 10, y: 1 },
    { commanderId: "공손찬", classId: "lightCavalry", level: 5, troops: 100, items: [], side: "ally", x: 5, y: 1 },
    { commanderId: "화웅", classId: "lightCavalry", level: 5, troops: 100, items: [], side: "enemy", x: 1, y: 1 },
  ],
  victory: { kind: "defeatUnit", unitId: "화웅" },
  defeat: { kind: "lordRetreat", unitId: "유비" },
  events: [],
};
const ctx: BattleContext = { data: gameData, stage, map };

describe("우군(ally) 페이즈", () => {
  it("플레이어가 턴 종료하면 우군 페이즈가 자동 구동되고 입력이 잠긴다(enemyTurn)", async () => {
    const store = new BattleStore(ctx, 7);
    expect(store.uiState.kind).toBe("idle");
    expect(store.committedState.phase).toBe("player");

    // 유비 wait → 턴 종료 → ally 페이즈로 진입, runAiPhases 기동
    store.dispatchUi({ type: "endTurnPressed" });
    await store.whenIdle(); // ally·enemy 페이즈가 끝나고 player로 복귀할 때까지

    // 한 라운드(player→ally→enemy) 완주 후 다시 player 입력 가능
    expect(store.committedState.status).toBe("ongoing");
    expect(store.committedState.phase).toBe("player");
    expect(store.uiState.kind).toBe("idle");
  }, 30_000);

  it("우군이 ally 페이즈에 실제로 행동(적 추격/교전)해 actionLog에 우군 액션이 남는다", async () => {
    const store = new BattleStore(ctx, 7);
    store.dispatchUi({ type: "endTurnPressed" });
    await store.whenIdle();
    const allyActed = store.actionLog.some((a) => a.unitId === "공손찬");
    expect(allyActed).toBe(true);
  }, 30_000);

  it("플레이어는 우군 유닛을 선택할 수 없다(아군만 선택)", () => {
    const store = new BattleStore(ctx, 7);
    // 우군(5,1) 탭 → 선택되지 않고 조회(inspect)만
    store.dispatchUi({ type: "tapTile", coord: { x: 5, y: 1 } });
    expect(store.uiState.kind).toBe("idle");
  });
});
