/**
 * 스위트 2 (설계 §7) — EventPlayer를 FakePresenter로 검증.
 *  - 이벤트 1개 → Presenter 메서드 1개 매핑, 받은 순서 그대로 (재정렬/병합/스킵 금지)
 *  - 직렬 소비: 앞 연출의 Promise가 완료되기 전 다음 연출 미시작
 *  - 드레인 시퀀스: sync → dev 단언 → onDrained → enqueue 대기자 resolve
 *  - dev 계약: battleEnded 최후 재생, 종료 후 enqueue 금지, presented ≡ committed 단언
 */
import { describe, expect, it } from "vitest";
import { applyAction, createBattle, spawnUnit } from "@tk/engine";
import type { BattleContext, BattleEvent, BattleState } from "@tk/engine";
import { gameData, type Stage } from "@tk/data";
import { EventPlayer, type PresentedSnapshot } from "../eventPlayer";
import { FakePresenter, TrackingPresenter } from "./fakePresenter";
import { sishuiCtx, testMap } from "./fixtures";

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

describe("회복 책략 투영 (회귀: 드레인 정합 — 회복이 이벤트로 서술되지 않아 presented<committed)", () => {
  // 실전 사수관에서 목격한 단언("드레인 정합 단언 실패 — 유닛 X troops 불일치: presented<committed")의
  // 근본 재현. 책사가 부상당한 아군을 회복하면 troops가 늘지만, 회복 경로(actions.ts strategy heal)가
  // strategyCast만 emit하고 회복량을 서술하는 이벤트가 없으면 투영이 옛 값에 머물러 드레인에서 드리프트.
  const healStage: Stage = {
    id: "heal-drain-test", name: "회복드레인", mapId: "testmap", turnLimit: 30,
    units: [
      { commanderId: "간옹", classId: "strategist", level: 10, troops: 80,  items: [], side: "player", x: 2, y: 4 },
      { commanderId: "유비", classId: "lord",        level: 10, troops: 200, items: [], side: "player", x: 3, y: 4 },
      { commanderId: "화웅", classId: "footman",     level: 3,  troops: 120, items: [], side: "enemy",  x: 6, y: 0 },
    ],
    victory: { kind: "defeatAll" },
    defeat: { kind: "lordRetreat", unitId: "유비" },
    events: [],
  };
  const healCtx: BattleContext = { data: gameData, stage: healStage, map: testMap };

  it("회복 책략 후 드레인 정합 단언을 통과한다 (회복이 이벤트로 서술됨)", async () => {
    // 유비를 부상 상태로(troops=10, maxTroops=200) — 회복 여지 충분
    const base = createBattle(healCtx, 1);
    const wounded: BattleState = {
      ...base,
      units: base.units.map((u) => (u.id === "유비" ? { ...u, troops: 10 } : u)),
    };
    // 간옹이 헌책(회복·단일·사거리3)을 부상당한 유비(3,4)에 시전 → 유비 회복
    const r = applyAction(healCtx, wounded, {
      type: "strategy", unitId: "간옹", strategyId: "헌책", target: { x: 3, y: 4 },
    });
    // 전제: 엔진 진실에서 유비가 실제로 회복됐다 (회복 경로가 탔다)
    const liubeiCommitted = r.state.units.find((u) => u.id === "유비")!;
    expect(liubeiCommitted.troops).toBeGreaterThan(10);

    // 투영을 행동 전 상태(wounded)로 프라임 → 이벤트만으로 재구성 (BattleRenderer 부팅과 동일)
    const tp = new TrackingPresenter();
    tp.prime(wounded);
    const violations: string[] = [];
    const player = new EventPlayer({
      presenter: tp, getCommitted: () => r.state, dev: true,
      onDrained: () => {}, onDevViolation: (m) => violations.push(m),
    });
    await player.enqueue(r.events);

    // 수정 전: 회복 이벤트 부재 → 유비 투영이 10에 머무름 → "유닛 유비 troops 불일치" 위반.
    expect(violations).toEqual([]);
    expect(tp.snapshot!()!.units.find((u) => u.id === "유비")!.troops).toBe(liubeiCommitted.troops);
  });
});

describe("회복약(supplyItem) 투영 (회귀: 드레인 정합 — itemUsed가 투영되지 않아 presented<committed)", () => {
  // 위 "회복 책략 투영"의 형제 버그. supplyItem(회복약)은 troopsHealed/damageDealt 없이
  // itemUsed{amount}만 emit한다(actions.ts useItem). TrackingPresenter에 itemUsed 케이스가
  // 없으면 회복이 투영에 반영되지 않아 유닛 troops가 옛 값에 머물러 드레인 정합 단언이
  // presented<committed로 터진다. 실전은 정상(BattleRenderer.itemUsed가 supplyItem 시
  // setTroops(target.troops)) — 미러만 불완전했다.
  const itemStage: Stage = {
    id: "item-heal-drain-test", name: "회복약드레인", mapId: "testmap", turnLimit: 30,
    units: [
      { commanderId: "간옹", classId: "strategist", level: 5, troops: 80,  items: ["쌀", "폭탄"], side: "player", x: 2, y: 4 },
      { commanderId: "유봉", classId: "footman",     level: 5, troops: 100, items: [], side: "player", x: 3, y: 4 },
      { commanderId: "화웅", classId: "footman",     level: 3, troops: 120, items: [], side: "enemy",  x: 6, y: 0 },
    ],
    victory: { kind: "defeatAll" },
    defeat: { kind: "lordRetreat", unitId: "간옹" },
    events: [],
  };
  const itemCtx: BattleContext = { data: gameData, stage: itemStage, map: testMap };

  it("회복약 사용 후 드레인 정합 단언을 통과한다 (itemUsed가 이벤트로 투영됨)", async () => {
    // 유봉을 부상 상태로(troops=50, maxTroops=100) — 회복 여지 충분
    const base = createBattle(itemCtx, 1);
    const wounded: BattleState = {
      ...base,
      units: base.units.map((u) => (u.id === "유봉" ? { ...u, troops: 50 } : u)),
    };
    // 간옹이 회복약(쌀·power40)을 부상당한 유봉(3,4)에 사용 → 유봉 50→90
    const r = applyAction(itemCtx, wounded, {
      type: "useItem", unitId: "간옹", itemId: "쌀", target: { x: 3, y: 4 },
    });
    // 전제: 엔진 진실에서 유봉이 실제로 회복됐다 (supplyItem 경로가 탔다)
    const yufengCommitted = r.state.units.find((u) => u.id === "유봉")!;
    expect(yufengCommitted.troops).toBeGreaterThan(50);

    // 투영을 행동 전 상태(wounded)로 프라임 → 이벤트만으로 재구성 (BattleRenderer 부팅과 동일)
    const tp = new TrackingPresenter();
    tp.prime(wounded);
    const violations: string[] = [];
    const player = new EventPlayer({
      presenter: tp, getCommitted: () => r.state, dev: true,
      onDrained: () => {}, onDevViolation: (m) => violations.push(m),
    });
    await player.enqueue(r.events);

    // 수정 전: itemUsed 케이스 부재 → 유봉 투영이 50에 머무름 → "유닛 유봉 troops 불일치" 위반.
    expect(violations).toEqual([]);
    expect(tp.snapshot!()!.units.find((u) => u.id === "유봉")!.troops).toBe(yufengCommitted.troops);
  });

  it("공격아이템(attackItem) 사용은 troops를 이중 적용하지 않는다 (선행 damageDealt에 위임)", async () => {
    // 가드: 간옹이 폭탄(attackItem·power50)을 적 화웅(6,0)에 사용. 엔진은 damageDealt + itemUsed{amount:50}을
    // emit한다. itemUsed가 supplyItem처럼 amount를 또 더하면 presented>committed(화웅 과다)로 위반 —
    // 미러는 attackItem을 선행 damageDealt에 위임(no-op)해야 정합. BattleRenderer.itemUsed 분기와 동형.
    const s0 = createBattle(itemCtx, 1);
    const r = applyAction(itemCtx, s0, {
      type: "useItem", unitId: "간옹", itemId: "폭탄", target: { x: 6, y: 0 },
    });
    const huaxiongCommitted = r.state.units.find((u) => u.id === "화웅")!;
    expect(huaxiongCommitted.troops).toBe(120 - 50); // 폭탄 power 50 고정

    const tp = new TrackingPresenter();
    tp.prime(s0);
    const violations: string[] = [];
    const player = new EventPlayer({
      presenter: tp, getCommitted: () => r.state, dev: true,
      onDrained: () => {}, onDevViolation: (m) => violations.push(m),
    });
    await player.enqueue(r.events);

    expect(violations).toEqual([]);
    expect(tp.snapshot!()!.units.find((u) => u.id === "화웅")!.troops).toBe(huaxiongCommitted.troops);
  });
});
