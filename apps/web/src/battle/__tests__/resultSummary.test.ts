/**
 * 결산 요약/자금 영속 순수 로직 테스트 (설계 §10·§12).
 * ResultSequence 연출은 React라 제외 — 산출 로직(node)만 검증.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Item, StageReward } from "@tk/data";
import type { PendingReward } from "@tk/engine";
import type { BattleVM, UnitVM } from "../viewmodel";
import { buildResultSummary, countPlayerRetreats, deriveFanfare } from "../hud/resultSummary";
import { addMetaGold, readMetaGold } from "../hud/metaGold";

function unit(partial: Partial<UnitVM>): UnitVM {
  return {
    id: "u",
    name: "u",
    className: "c",
    side: "player",
    level: 1,
    exp: 0,
    x: 0,
    y: 0,
    troops: 10,
    maxTroops: 10,
    mp: 0,
    maxMp: 0,
    sp: 0,
    maxSp: 255,
    moved: false,
    acted: false,
    retreated: false,
    atk: 1,
    def: 1,
    spirit: 1,
    warStat: 1,
    leadershipStat: 1,
    intelligenceStat: 1,
    move: 1,
    rangeMin: 1,
    rangeMax: 1,
    terrainName: "평지",
    terrainGuard: 0,
    ...partial,
  };
}

function vmWith(
  turn: number,
  turnLimit: number,
  units: UnitVM[],
  pendingRewards: PendingReward[] = [],
): BattleVM {
  return {
    turn: { turn, turnLimit, phase: "player" },
    status: "victory",
    units,
    pendingRewards,
    levelUps: [],
  };
}

const ITEMS: Record<string, Item> = {
  무술교본: { id: "무술교본", name: "무술교본", category: "book", power: 0, bonusPercent: 5 },
  검술지침서: { id: "검술지침서", name: "검술지침서", category: "book", power: 0, bonusPercent: 5 },
};

describe("countPlayerRetreats", () => {
  it("아군 퇴각만 센다", () => {
    const vm = vmWith(5, 20, [
      unit({ id: "a", side: "player", retreated: true }),
      unit({ id: "b", side: "player", retreated: false }),
      unit({ id: "c", side: "enemy", retreated: true }), // 적은 제외
    ]);
    expect(countPlayerRetreats(vm)).toBe(1);
  });
});

describe("buildResultSummary", () => {
  it("S등급: 빠른 클리어 + 퇴각0 + 보물 전획득", () => {
    const reward: StageReward = { gold: 300, exp: 50, treasures: ["무술교본"] };
    const vm = vmWith(4, 20, [unit({ side: "player", retreated: false })]); // ratio 0.2
    const s = buildResultSummary(vm, reward, ITEMS);
    expect(s.grade).toBe("S");
    expect(s.stars).toBe(4);
    expect(s.gold).toBe(300);
    expect(s.exp).toBe(50);
    expect(s.treasures).toEqual([{ id: "무술교본", name: "무술교본" }]);
    expect(s.score).toBeGreaterThan(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });

  it("퇴각이 있으면 S가 깨진다(A 이하)", () => {
    const reward: StageReward = { gold: 100, exp: 0, treasures: [] };
    const vm = vmWith(4, 20, [unit({ side: "player", retreated: true })]);
    const s = buildResultSummary(vm, reward, ITEMS);
    expect(s.grade).not.toBe("S");
    expect(s.playerRetreats).toBe(1);
  });

  it("reward 미지정 스테이지는 gold/exp 0, 보물 0개", () => {
    const vm = vmWith(10, 20, [unit({ side: "player" })]);
    const s = buildResultSummary(vm, undefined, ITEMS);
    expect(s.gold).toBe(0);
    expect(s.exp).toBe(0);
    expect(s.treasures).toEqual([]);
  });

  it("items에 없는 보물 id는 id를 이름으로 사용", () => {
    const reward: StageReward = { gold: 0, exp: 0, treasures: ["미등록보물"] };
    const vm = vmWith(10, 20, [unit({ side: "player" })]);
    const s = buildResultSummary(vm, reward, ITEMS);
    expect(s.treasures).toEqual([{ id: "미등록보물", name: "미등록보물" }]);
  });

  it("별 개수는 등급과 일치(S4 A3 B2 C1)", () => {
    const reward: StageReward = { gold: 0, exp: 0, treasures: [] };
    // C: 거의 제한 가득
    const c = buildResultSummary(vmWith(19, 20, [unit({ side: "player" })]), reward, ITEMS);
    expect(c.grade).toBe("C");
    expect(c.stars).toBe(1);
  });

  it("전략조건 노획분(pendingRewards)이 보물·자금에 병합된다", () => {
    const reward: StageReward = { gold: 600, exp: 0, treasures: [] };
    const pending: PendingReward[] = [
      { conditionId: "duel_zhangfei_lijue_reward", treasures: ["검술지침서"], gold: 200 },
    ];
    const vm = vmWith(4, 20, [unit({ side: "player" })], pending);
    const s = buildResultSummary(vm, reward, ITEMS);
    expect(s.treasures).toEqual([{ id: "검술지침서", name: "검술지침서" }]);
    expect(s.gold).toBe(800); // 600 + 200
  });

  it("같은 보물 id가 stage.reward와 pendingRewards 양쪽에 있어도 카드 1장(중복제거)", () => {
    // 데이터가 잘못 양쪽에 같은 id를 넣어도 결산엔 phantom 중복이 보이지 않아야 한다.
    const reward: StageReward = { gold: 600, exp: 0, treasures: ["검술지침서"] };
    const pending: PendingReward[] = [
      { conditionId: "dup", treasures: ["검술지침서"], gold: 0 },
    ];
    const vm = vmWith(4, 20, [unit({ side: "player" })], pending);
    const s = buildResultSummary(vm, reward, ITEMS);
    expect(s.treasures).toEqual([{ id: "검술지침서", name: "검술지침서" }]);
  });

  it("fanfare가 요약에 포함되고 S는 잭팟", () => {
    const reward: StageReward = { gold: 300, exp: 50, treasures: ["무술교본"] };
    const s = buildResultSummary(vmWith(4, 20, [unit({ side: "player" })]), reward, ITEMS);
    expect(s.grade).toBe("S");
    expect(s.fanfare.jackpot).toBe(true);
    expect(s.fanfare.level).toBe(3);
    expect(s.fanfare.coinPops).toBeGreaterThan(0);
  });
});

describe("deriveFanfare (연출 강도 파생 — 순수, 내용물 불변)", () => {
  it("S만 잭팟, 등급 내림차순으로 level 차등", () => {
    expect(deriveFanfare("S", 100).jackpot).toBe(true);
    expect(deriveFanfare("A", 100).jackpot).toBe(false);
    expect(deriveFanfare("S", 100).level).toBe(3);
    expect(deriveFanfare("A", 100).level).toBe(2);
    expect(deriveFanfare("B", 100).level).toBe(1);
    expect(deriveFanfare("C", 100).level).toBe(0);
  });

  it("자금 0이면 코인 팝 0(표현 억제)", () => {
    expect(deriveFanfare("S", 0).coinPops).toBe(0);
    expect(deriveFanfare("C", 0).coinPops).toBe(0);
  });

  it("코인 팝은 6~14로 클램프", () => {
    for (const grade of ["S", "A", "B", "C"] as const) {
      for (const gold of [1, 50, 300, 5000, 99999]) {
        const f = deriveFanfare(grade, gold);
        expect(f.coinPops).toBeGreaterThanOrEqual(6);
        expect(f.coinPops).toBeLessThanOrEqual(14);
      }
    }
  });

  it("자금이 많을수록 코인 팝이 많거나 같다(단조 증가)", () => {
    const lo = deriveFanfare("A", 50).coinPops;
    const hi = deriveFanfare("A", 50000).coinPops;
    expect(hi).toBeGreaterThanOrEqual(lo);
  });

  it("음수/소수 자금은 안전 처리(코인 0 또는 정상 범위)", () => {
    expect(deriveFanfare("S", -100).coinPops).toBe(0);
    expect(deriveFanfare("S", 12.9).coinPops).toBeGreaterThanOrEqual(6);
  });
});

describe("addMetaGold / readMetaGold (node: 비브라우저 가드)", () => {
  beforeEach(() => {
    // node 환경엔 window 없음 — 영속 없이 입력 합만 반환되는 가드 동작 검증
  });

  it("비브라우저에서 readMetaGold는 0", () => {
    expect(readMetaGold()).toBe(0);
  });

  it("비브라우저에서 addMetaGold는 입력 합을 반환(영속 없음)", () => {
    expect(addMetaGold(300)).toBe(300);
    // 영속이 없으므로 read는 여전히 0
    expect(readMetaGold()).toBe(0);
  });

  it("음수/소수 gold는 floor·clamp", () => {
    expect(addMetaGold(-50)).toBe(0);
    expect(addMetaGold(12.9)).toBe(12);
  });
});
