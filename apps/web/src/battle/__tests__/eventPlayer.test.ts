/**
 * 스위트 2 (설계 §7) — EventPlayer를 FakePresenter로 검증.
 *  - 이벤트 1개 → Presenter 메서드 1개 매핑, 받은 순서 그대로 (재정렬/병합/스킵 금지)
 *  - 직렬 소비: 앞 연출의 Promise가 완료되기 전 다음 연출 미시작
 *  - 드레인 시퀀스: sync → dev 단언 → onDrained → enqueue 대기자 resolve
 *  - dev 계약: battleEnded 최후 재생, 종료 후 enqueue 금지, presented ≡ committed 단언
 */
import { describe, expect, it } from "vitest";
import { createBattle, spawnUnit } from "@tk/engine";
import type { BattleEvent, BattleState } from "@tk/engine";
import { EventPlayer, type PresentedSnapshot } from "../eventPlayer";
import { FakePresenter, TrackingPresenter } from "./fakePresenter";
import { sishuiCtx } from "./fixtures";

const state0 = createBattle(sishuiCtx, 42);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

const moved: BattleEvent = {
  type: "unitMoved", unitId: "관우", from: { x: 50, y: 15 }, to: { x: 49, y: 15 },
};
const damaged: BattleEvent = {
  type: "damageDealt", attackerId: "관우", defenderId: "화웅", damage: 100, counter: false, hit: true,
};
const retreated: BattleEvent = { type: "unitRetreated", unitId: "화웅" };
const dueled: BattleEvent = {
  type: "duelTriggered", eventId: "duel_guanyu_huaxiong",
  attackerId: "관우", defenderId: "화웅", winnerId: "관우",
};
const phased: BattleEvent = { type: "phaseChanged", phase: "enemy", turn: 1 };
const ended: BattleEvent = { type: "battleEnded", result: "victory" };

interface Setup {
  presenter: FakePresenter;
  player: EventPlayer;
  drains: number[];
  violations: string[];
}

function setup(opts: { dev?: boolean; committed?: BattleState } = {}): Setup {
  const presenter = new FakePresenter();
  const drains: number[] = [];
  const violations: string[] = [];
  const player = new EventPlayer({
    presenter,
    getCommitted: () => opts.committed ?? state0,
    onDrained: () => drains.push(presenter.log.length),
    ...(opts.dev !== undefined ? { dev: opts.dev } : {}),
    onDevViolation: (m) => violations.push(m),
  });
  return { presenter, player, drains, violations };
}

describe("이벤트 → Presenter 매핑", () => {
  it("6종 전부 해당 메서드로, 받은 순서 그대로 전달된다", async () => {
    const { presenter, player } = setup();
    await player.enqueue([moved, damaged, retreated, dueled, phased, ended]);
    expect(presenter.events).toEqual([moved, damaged, retreated, dueled, phased, ended]);
    expect(presenter.log).toEqual([
      "unitMoved", "damageDealt", "unitRetreated", "duelTriggered", "phaseChanged", "battleEnded",
      "sync", // 드레인 시 마지막에 sync
    ]);
  });
});

describe("직렬 소비", () => {
  it("앞 연출이 완료될 때까지 다음 연출을 시작하지 않는다", async () => {
    const { presenter, player, drains } = setup();
    presenter.auto = false;
    const done = player.enqueue([moved, damaged]);
    await tick();
    expect(presenter.log).toEqual(["unitMoved"]); // 두 번째는 아직
    expect(player.playing).toBe(true);

    presenter.release();
    await tick();
    expect(presenter.log).toEqual(["unitMoved", "damageDealt"]);
    expect(drains).toEqual([]); // 아직 드레인 아님

    presenter.release();
    await done;
    expect(player.playing).toBe(false);
    expect(drains).toHaveLength(1);
  });

  it("재생 중 추가 enqueue는 큐 뒤에 이어붙고, 드레인은 전체 소진 후 1회", async () => {
    const { presenter, player, drains } = setup();
    presenter.auto = false;
    const d1 = player.enqueue([moved]);
    await tick();
    const d2 = player.enqueue([damaged]); // 펌프 동작 중 투입
    presenter.release();
    await tick();
    expect(presenter.log).toEqual(["unitMoved", "damageDealt"]);
    presenter.release();
    await Promise.all([d1, d2]);
    expect(drains).toHaveLength(1);
    expect(presenter.log).toEqual(["unitMoved", "damageDealt", "sync"]);
  });

  it("빈 배치 enqueue도 드레인을 1회 발생시킨다 — 이벤트 0개 커밋(wait)의 교착 방지", async () => {
    const { presenter, player, drains } = setup();
    await player.enqueue([]);
    expect(drains).toHaveLength(1);
    expect(presenter.synced).toHaveLength(1);
  });
});

describe("드레인 시퀀스", () => {
  it("sync(committed) → onDrained 순서, sync는 항상 연출 뒤", async () => {
    const committed: BattleState = { ...state0, turn: 7 };
    const { presenter, player, drains } = setup({ committed });
    await player.enqueue([moved]);
    expect(presenter.log).toEqual(["unitMoved", "sync"]);
    expect(presenter.synced).toEqual([committed]);
    // onDrained 시점에 이미 sync까지 끝나 있었다 (로그 길이 2 = unitMoved+sync)
    expect(drains).toEqual([2]);
  });
});

describe("dev 계약 — battleEnded 최후 재생", () => {
  it("battleEnded가 배치 중간에 있으면 위반", () => {
    const { player, violations } = setup({ dev: true });
    void player.enqueue([ended, phased]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("battleEnded");
  });

  it("battleEnded 이후 추가 enqueue는 위반", async () => {
    const { player, violations } = setup({ dev: true });
    await player.enqueue([damaged, ended]);
    expect(violations).toEqual([]);
    void player.enqueue([phased]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("battleEnded 이후");
  });

  it("onDevViolation 미지정이면 throw가 기본", () => {
    const presenter = new FakePresenter();
    const player = new EventPlayer({
      presenter, getCommitted: () => state0, onDrained: () => {}, dev: true,
    });
    expect(() => player.enqueue([ended, phased])).toThrow(/battleEnded/);
  });

  it("dev=false면 검사하지 않는다", async () => {
    const { player, violations } = setup({ dev: false });
    await player.enqueue([ended, phased]);
    await player.enqueue([damaged]);
    expect(violations).toEqual([]);
  });
});

describe("dev 계약 — 드레인 정합 단언 (presented ≡ committed)", () => {
  function snapOf(state: BattleState): PresentedSnapshot {
    return {
      phase: state.phase,
      units: state.units.map((u) => ({
        id: u.id, x: u.x, y: u.y, troops: u.troops, retreated: u.retreated,
      })),
    };
  }

  it("투영 상태가 일치하면 단언 통과", async () => {
    const { presenter, player, violations } = setup({ dev: true });
    presenter.snapshot = () => snapOf(state0);
    await player.enqueue([moved]);
    expect(violations).toEqual([]);
  });

  it("troops 드리프트는 sync로 덮이기 전에 단언이 잡는다", async () => {
    const { presenter, player, violations } = setup({ dev: true });
    presenter.snapshot = () => {
      const s = snapOf(state0);
      s.units[0]!.troops += 1; // 화면이 엔진보다 1 많다고 가정
      return s;
    };
    await player.enqueue([moved]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("troops 불일치");
    // 단, sync 자체는 호출됐다 — 화면은 진실로 복구됨
    expect(presenter.synced).toHaveLength(1);
  });

  it("좌표/phase 드리프트도 잡는다", async () => {
    const { presenter, player, violations } = setup({ dev: true });
    presenter.snapshot = () => ({ ...snapOf(state0), phase: "enemy" });
    await player.enqueue([moved]);
    expect(violations.some((v) => v.includes("phase 불일치"))).toBe(true);
  });

  it("snapshot 미구현(null)이면 단언 생략", async () => {
    const { presenter, player, violations } = setup({ dev: true });
    presenter.snapshot = () => null;
    await player.enqueue([moved]);
    expect(violations).toEqual([]);
  });
});

describe("증원 도착 — 중도 스폰 유닛 투영 (회귀: 03 광종 보병대 '투영 누락')", () => {
  it("reinforcementArrived가 투영에 유닛을 추가해 드레인 단언을 통과한다", async () => {
    // 증원 유닛(초기 배치에 없음)을 committed에 추가하고, 그 이벤트를 재생한다.
    const reinf = spawnUnit(sishuiCtx.data, {
      commanderId: "보병대", classId: "footman", level: 3, troops: 90, items: [], side: "enemy", x: 5, y: 5,
    });
    const committed: BattleState = { ...state0, units: [...state0.units, reinf] };
    const tp = new TrackingPresenter();
    tp.prime(state0); // 렌더러 부팅 = 초기 유닛만 (보병대 없음)
    const violations: string[] = [];
    const player = new EventPlayer({
      presenter: tp, getCommitted: () => committed, dev: true,
      onDrained: () => {}, onDevViolation: (m) => violations.push(m),
    });

    const event: BattleEvent = {
      type: "reinforcementArrived", reinforcementId: "r1", side: "enemy",
      units: [{ id: "보병대", classId: "footman", x: 5, y: 5, troops: 90, maxTroops: 90 }],
    };
    await player.enqueue([event]);

    // 수정 전: dispatch 케이스 없음 → 투영에 보병대 없음 → "유닛 보병대 투영 누락" 위반.
    expect(violations).toEqual([]);
    expect(tp.snapshot!()!.units.some((u) => u.id === "보병대")).toBe(true);
  });
});

describe("상태이상 statusTick 투영 (Phase D)", () => {
  it("statusTick은 TrackingPresenter troops를 차감(이벤트 자기서술)", async () => {
    const tp = new TrackingPresenter();
    tp.prime(state0);
    const u = state0.units.find((x) => x.troops > 30)!;
    await tp.statusTick!({ type: "statusTick", unitId: u.id, kind: "poison", damage: 30 });
    expect(tp.snapshot!()!.units.find((x) => x.id === u.id)!.troops).toBe(u.troops - 30);
  });

  it("troopsHealed는 TrackingPresenter troops를 증가(흡혈 자기서술)", async () => {
    const tp = new TrackingPresenter();
    tp.prime(state0);
    const u = state0.units.find((x) => x.troops > 0)!;
    await tp.troopsHealed!({ type: "troopsHealed", unitId: u.id, amount: 25 });
    expect(tp.snapshot!()!.units.find((x) => x.id === u.id)!.troops).toBe(u.troops + 25);
  });
});
