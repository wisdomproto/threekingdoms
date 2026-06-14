/**
 * 자동전투 (feel-spec §A 보조 컨트롤) — setAutoBattle 토글이 아군 페이즈를 그리디 드라이버로
 * 구동하는지 검증. 정책은 @tk/sim chooseAction(진영 무관)이라, 자동 완주 결과는 순수 그리디
 * 루프(applyAction 직접)와 한 치도 다르지 않아야 한다 (store/입력기계가 결과를 왜곡하지 않음).
 */
import { describe, expect, it } from "vitest";
import { applyAction, createBattle, distance, type BattleContext } from "@tk/engine";
import { chooseAction } from "@tk/sim";
import { BattleStore } from "../store";
import { sishuiCtx, xiapi1Ctx } from "./fixtures";

const ctx = sishuiCtx;
const SEED = 42;

/** 순수 엔진 그리디 완주 — 자동전투 결과의 기대 베이스라인 (임의 ctx) */
function pureGreedyEnd(c: BattleContext, seed: number) {
  let state = createBattle(c, seed);
  let guard = 0;
  while (state.status === "ongoing" && guard++ < 10_000) {
    const act = chooseAction(c, state);
    if (!act) break;
    state = applyAction(c, state, act).state;
  }
  return state;
}

describe("자동전투 토글", () => {
  it("ON이면 양 페이즈가 자동 진행되어 전투가 끝까지 완주한다", async () => {
    const store = new BattleStore(ctx, SEED);
    expect(store.autoBattle).toBe(false);

    store.setAutoBattle(true); // idle → autoTurn → 그리디 드라이버 기동
    expect(store.autoBattle).toBe(true);
    await store.whenIdle(); // battleOver까지 대기 (auto 중엔 idle로 안 머문다)

    expect(store.uiState.kind).toBe("battleOver");
    expect(store.committedState.status).not.toBe("ongoing");
    // 자동 완주 ≡ 순수 그리디 — 아군 측도 동일 정책으로 구동됨을 고정
    expect(store.committedState).toEqual(pureGreedyEnd(ctx, SEED));
  }, 30_000);

  it("진행 중 OFF로 끄면 드라이버가 멈추고 아군 입력(idle)으로 복귀한다", async () => {
    const store = new BattleStore(ctx, SEED);
    store.setAutoBattle(true); // 첫 아군 액션 1개 커밋 후 play await에서 suspend
    store.setAutoBattle(false); // 즉시 OFF — shouldStop으로 다음 루프에서 중단

    await store.whenIdle();
    expect(store.autoBattle).toBe(false);
    expect(store.uiState.kind).toBe("idle"); // 자동 OFF → 수동 제어 복귀
    expect(store.committedState.status).toBe("ongoing"); // 전투는 아직 진행 중
  }, 30_000);

  it("이미 같은 값으로 토글하면 무시된다 (중복 드라이버 기동 없음)", () => {
    const store = new BattleStore(ctx, SEED);
    store.setAutoBattle(false); // 이미 false — no-op
    expect(store.autoBattle).toBe(false);
    expect(store.uiState.kind).toBe("idle");
    expect(store.actionLog.length).toBe(0);
  });
});

/**
 * 비섬멸(탈출형) 목표 자동전투 — task C 핵심 검증.
 * 인게임 player 자동전투(startAutoPhase→runGreedyPhase side="player")가 @tk/sim chooseAction을
 * 공유하므로, policy.ts의 *목표 인식*(탈출 라우팅)이 web 자동전투에도 그대로 적용된다.
 * 하비1차(12-xiapi1): 유비 시작 (31,15), 탈출 목표 (0,15)는 *좌측*, 적은 *우측*(x=36~40).
 *  - 순수 그리디(목표 무시)면 유비가 적을 향해 우측(x 증가)으로 돌진한다.
 *  - 목표 인식이면 유비가 목표 칸을 향해 좌측(x 감소)으로 라우팅된다.
 * 이 판별로 "web 자동전투가 목표를 향하는가"를 직접 고정한다.
 */
describe("자동전투 — 비섬멸 목표(탈출) 인식", () => {
  const ec = xiapi1Ctx;
  const GOAL = { x: 0, y: 15 }; // 유비 reachTile 목표
  const START = { x: 31, y: 15 };

  const liubei = (s: { units: readonly { id: string; x: number; y: number }[] }) =>
    s.units.find((u) => u.id === "유비")!;

  it("player 자동전투가 유비를 적(우측)이 아닌 탈출 목표(좌측)로 라우팅한다", async () => {
    const store = new BattleStore(ec, SEED);
    expect(liubei(store.committedState)).toMatchObject(START);

    store.setAutoBattle(true);
    await store.whenIdle(); // 완주(목표 도달=승리 또는 turnLimit) 또는 battleOver까지

    const end = liubei(store.committedState);
    // 목표 인식 적용 증거: 유비가 시작점보다 목표(좌측)에 *더 가까워졌다*.
    expect(distance(end, GOAL)).toBeLessThan(distance(START, GOAL));
    // 그리디 자살 방지 증거: 적 쪽(우측, x 증가)으로 가지 않았다.
    expect(end.x).toBeLessThan(START.x);
  }, 30_000);

  it("탈출 자동전투 결과 ≡ 순수 그리디 (store/입력기계가 목표 인식 정책을 왜곡하지 않음)", async () => {
    const store = new BattleStore(ec, SEED);
    store.setAutoBattle(true);
    await store.whenIdle();

    expect(store.committedState.status).not.toBe("ongoing");
    expect(store.committedState).toEqual(pureGreedyEnd(ec, SEED));
  }, 30_000);
});
