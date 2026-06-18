/**
 * 대사 디렉터(director.ts) 트리거 판정 테스트 — 순수 함수, node 환경.
 * engine·store 미수정 확인의 핵심: 디렉터는 BattleState read-only 슬라이스만으로
 * 트리거를 판정한다(여기서 그 판정 로직을 직접 검증).
 */
import { describe, it, expect } from "vitest";
import type { BattleState } from "@tk/engine";
import type { StageDialogue } from "@tk/data";
import {
  toDialogueSnapshot,
  triggerFired,
  firedDialogues,
  type DialogueSnapshot,
} from "../dialogue/director";

/** 최소 BattleState 픽스처 (디렉터가 읽는 필드만 채움) */
function makeState(p: {
  turn?: number;
  status?: BattleState["status"];
  duelHistory?: string[];
  retreated?: string[];
}): BattleState {
  const retreated = new Set(p.retreated ?? []);
  return {
    turn: p.turn ?? 1,
    phase: "player",
    status: p.status ?? "ongoing",
    units: ["관우", "화웅", "유비"].map((id) => ({ id, retreated: retreated.has(id) })) as unknown as BattleState["units"],
    rngState: 0,
    firedEvents: [],
    duelHistory: p.duelHistory ?? [],
    metStrategyConditions: [],
    spawnedReinforcements: [],
    pendingRewards: [],
    levelUps: [],
  };
}

const snap = (p: Parameters<typeof makeState>[0]): DialogueSnapshot =>
  toDialogueSnapshot(makeState(p));

describe("대사 디렉터 트리거 판정", () => {
  it("battleStart: 최초 구독(prev=null)에서만 발동", () => {
    const s = snap({});
    expect(triggerFired({ kind: "battleStart" }, null, s)).toBe(true);
    expect(triggerFired({ kind: "battleStart" }, s, s)).toBe(false);
  });

  it("turn(n): n 도달 엣지에서 1회 — 이전엔 미발동", () => {
    const t = { kind: "turn", n: 3 } as const;
    expect(triggerFired(t, snap({ turn: 1 }), snap({ turn: 2 }))).toBe(false);
    expect(triggerFired(t, snap({ turn: 2 }), snap({ turn: 3 }))).toBe(true);
    // 이미 지난 턴에선 재발동 안 함(엣지)
    expect(triggerFired(t, snap({ turn: 3 }), snap({ turn: 4 }))).toBe(false);
    // 첫 구독(prev=null)에 이미 n 이상이면 발동
    expect(triggerFired(t, null, snap({ turn: 3 }))).toBe(true);
  });

  it("duelOccurred: duelHistory에 처음 나타날 때만", () => {
    const t = { kind: "duelOccurred", duelId: "duel_guanyu_huaxiong" } as const;
    expect(triggerFired(t, snap({ duelHistory: [] }), snap({ duelHistory: [] }))).toBe(false);
    expect(
      triggerFired(t, snap({ duelHistory: [] }), snap({ duelHistory: ["duel_guanyu_huaxiong"] })),
    ).toBe(true);
    // 이미 있던 경우 재발동 안 함
    expect(
      triggerFired(
        t,
        snap({ duelHistory: ["duel_guanyu_huaxiong"] }),
        snap({ duelHistory: ["duel_guanyu_huaxiong"] }),
      ),
    ).toBe(false);
  });

  it("unitRetreated: retreated false→true 엣지", () => {
    const t = { kind: "unitRetreated", unitId: "화웅" } as const;
    expect(triggerFired(t, snap({}), snap({}))).toBe(false);
    expect(triggerFired(t, snap({}), snap({ retreated: ["화웅"] }))).toBe(true);
    expect(triggerFired(t, snap({ retreated: ["화웅"] }), snap({ retreated: ["화웅"] }))).toBe(false);
  });

  it("battleEnd: ongoing→ended 엣지, result 게이트", () => {
    const any = { kind: "battleEnd" } as const;
    const win = { kind: "battleEnd", result: "victory" } as const;
    const lose = { kind: "battleEnd", result: "defeat" } as const;
    const ongoing = snap({ status: "ongoing" });
    const victory = snap({ status: "victory" });
    const defeat = snap({ status: "defeat" });
    // result 무관: 승/패 모두 발동
    expect(triggerFired(any, ongoing, victory)).toBe(true);
    expect(triggerFired(any, ongoing, defeat)).toBe(true);
    expect(triggerFired(any, ongoing, ongoing)).toBe(false);
    // result 게이트
    expect(triggerFired(win, ongoing, victory)).toBe(true);
    expect(triggerFired(win, ongoing, defeat)).toBe(false);
    expect(triggerFired(lose, ongoing, defeat)).toBe(true);
    // 이미 종료된 상태(엣지 아님)에선 재발동 안 함
    expect(triggerFired(any, victory, victory)).toBe(false);
  });

  it("firedDialogues: 정의 순서 보존 + playedIds 중복 차단", () => {
    const dialogue: StageDialogue[] = [
      { id: "intro", trigger: { kind: "battleStart" }, lines: [{ speaker: "유비", text: "a" }] },
      { id: "t3", trigger: { kind: "turn", n: 3 }, lines: [{ speaker: "관우", text: "b" }] },
    ];
    // 최초 구독 — battleStart만(턴1이라 turn3 미충족)
    const first = firedDialogues(dialogue, null, snap({ turn: 1 }), new Set());
    expect(first.map((d) => d.id)).toEqual(["intro"]);
    // intro 재생됨 표시 후 다시 평가 — intro 제외, turn3 도달 시 t3
    const played = new Set(["intro"]);
    const again = firedDialogues(dialogue, snap({ turn: 2 }), snap({ turn: 3 }), played);
    expect(again.map((d) => d.id)).toEqual(["t3"]);
  });
});

describe("사수관 파일럿 대사 데이터", () => {
  it("05-sishuiguan: battleStart/duelOccurred/battleEnd 대사 정의 존재", async () => {
    const { gameData } = await import("@tk/data");
    const stage = gameData.stages["05-sishuiguan"];
    expect(stage?.dialogue).toBeDefined();
    const triggers = (stage?.dialogue ?? []).map((d) => d.trigger.kind);
    expect(triggers).toContain("battleStart");
    expect(triggers).toContain("duelOccurred");
    expect(triggers).toContain("battleEnd");
    // duelOccurred는 실제 이벤트 duelId와 정합해야 한다(디렉터가 duelHistory로 매칭)
    const duelLine = (stage?.dialogue ?? []).find((d) => d.trigger.kind === "duelOccurred");
    expect(duelLine?.trigger.kind === "duelOccurred" && duelLine.trigger.duelId).toBe(
      "duel_guanyu_huaxiong",
    );
    expect(stage?.events.some((e) => e.id === "duel_guanyu_huaxiong")).toBe(true);
  });
});
