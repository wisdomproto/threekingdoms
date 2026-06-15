/**
 * 메타 스토어 단위테스트(env=node — window 없음). 순수 reducer + 비브라우저 영속 가드 검증.
 * 영속(localStorage)은 node에 없으므로 공개 API는 메모리 캐시로 폴백한다 — 그 경로도 확인.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { RosterEntry } from "@tk/data";
import {
  initialMeta,
  reduceAddGold,
  reduceSpendGold,
  reduceAddItem,
  reduceRemoveItem,
  reduceMarkCleared,
  reduceSetEquipped,
  reduceSetAdFree,
  reduceRecordAdGold,
  canWatchAdForGold,
  adGoldCountToday,
  AD_GOLD_DAILY_CAP,
  selectRoster,
  getMeta,
  addGold,
  spendGold,
  addItem,
  removeItem,
  markCleared,
  getRoster,
  reset,
  isAdFree,
  setAdFree,
  canWatchGoldAd,
  recordAdGold,
  reduceAddSerendipity,
  reduceApplyPull,
  addSerendipity,
  getSerendipity,
  getSerendipityPity,
  pullSerendipity,
} from "../metaStore";
import { PULL_COST } from "../serendipity";

describe("순수 reducer", () => {
  it("addGold는 floor·clamp 누적, 0/음수는 불변 참조", () => {
    const s = initialMeta();
    expect(reduceAddGold(s, 12.9).gold).toBe(12);
    expect(reduceAddGold(s, -50)).toBe(s); // 변화 없으면 동일 참조
    expect(reduceAddGold(s, 0)).toBe(s);
  });

  it("spendGold는 부족하면 null, 충분하면 차감", () => {
    const s = { ...initialMeta(), gold: 100 };
    expect(reduceSpendGold(s, 150)).toBeNull();
    expect(reduceSpendGold(s, 60)!.gold).toBe(40);
    expect(reduceSpendGold(s, 100)!.gold).toBe(0); // 정확히 일치 허용
  });

  it("inventory add/remove는 중복 보유 허용, remove는 첫 일치 1개만", () => {
    let s = initialMeta();
    s = reduceAddItem(s, "상약");
    s = reduceAddItem(s, "상약");
    expect(s.inventory).toEqual(["상약", "상약"]);
    s = reduceRemoveItem(s, "상약");
    expect(s.inventory).toEqual(["상약"]);
    expect(reduceRemoveItem(s, "없는아이템")).toBe(s); // 없으면 동일 참조
  });

  it("markCleared는 중복 무시", () => {
    let s = initialMeta();
    s = reduceMarkCleared(s, "05-sishuiguan");
    expect(s.clearedStages).toEqual(["05-sishuiguan"]);
    expect(reduceMarkCleared(s, "05-sishuiguan")).toBe(s);
  });

  it("setEquipped는 기존 진행 보존하며 equipped만 교체", () => {
    let s = initialMeta();
    s = reduceSetEquipped(s, "관우", ["청룡언월도"]);
    expect(s.rosterProgress["관우"]).toEqual({ level: 1, exp: 0, equipped: ["청룡언월도"] });
    s = reduceSetEquipped(s, "관우", ["사모"]);
    expect(s.rosterProgress["관우"]!.equipped).toEqual(["사모"]);
  });
});

describe("기연 reducer (§12 — 포인트·천장·뽑기)", () => {
  it("addSerendipity는 floor·clamp 누적, 0/음수는 불변 참조", () => {
    const s = initialMeta();
    expect(reduceAddSerendipity(s, 4.9).serendipity).toBe(4);
    expect(reduceAddSerendipity(s, -3)).toBe(s);
    expect(reduceAddSerendipity(s, 0)).toBe(s);
  });

  it("applyPull은 포인트 부족 시 null", () => {
    const s = { ...initialMeta(), serendipity: PULL_COST - 1 };
    expect(reduceApplyPull(s, { reward: { kind: "gold", amount: 30 }, nextPity: 1, wasRare: false })).toBeNull();
  });

  it("applyPull(common gold)은 비용 차감 + pity 갱신 + 자금 적립", () => {
    const s = { ...initialMeta(), serendipity: 10, serendipityPity: 2 };
    const next = reduceApplyPull(s, { reward: { kind: "gold", amount: 80 }, nextPity: 3, wasRare: false })!;
    expect(next.serendipity).toBe(10 - PULL_COST);
    expect(next.serendipityPity).toBe(3);
    expect(next.gold).toBe(80);
  });

  it("applyPull(rare item)은 인벤토리 적립 + pity 리셋", () => {
    const s = { ...initialMeta(), serendipity: 5, serendipityPity: 9 };
    const next = reduceApplyPull(s, { reward: { kind: "item", itemId: "qiyuan-charm" }, nextPity: 0, wasRare: true })!;
    expect(next.serendipity).toBe(5 - PULL_COST);
    expect(next.serendipityPity).toBe(0);
    expect(next.inventory).toEqual(["qiyuan-charm"]);
  });
});

describe("광고 reducer (§13 — adFree + 일일 캡)", () => {
  it("setAdFree는 동일값이면 불변 참조, 다르면 토글", () => {
    const s = initialMeta();
    expect(s.adFree).toBe(false);
    expect(reduceSetAdFree(s, false)).toBe(s); // 변화 없음
    const on = reduceSetAdFree(s, true);
    expect(on.adFree).toBe(true);
    expect(reduceSetAdFree(on, true)).toBe(on);
  });

  it("adGoldCountToday는 날짜 일치할 때만 카운트, 불일치/미설정은 0", () => {
    const s = { ...initialMeta(), adGoldCap: { date: "2026-06-14", count: 3 } };
    expect(adGoldCountToday(s, "2026-06-14")).toBe(3);
    expect(adGoldCountToday(s, "2026-06-15")).toBe(0); // 날짜 롤오버
    expect(adGoldCountToday(initialMeta(), "2026-06-14")).toBe(0); // 미설정
  });

  it("recordAdGold는 같은 날 증가, 날짜 바뀌면 1로 리셋", () => {
    let s = initialMeta();
    s = reduceRecordAdGold(s, "2026-06-14");
    expect(s.adGoldCap).toEqual({ date: "2026-06-14", count: 1 });
    s = reduceRecordAdGold(s, "2026-06-14");
    expect(s.adGoldCap!.count).toBe(2);
    // 다음 날 — 카운터 롤오버
    s = reduceRecordAdGold(s, "2026-06-15");
    expect(s.adGoldCap).toEqual({ date: "2026-06-15", count: 1 });
  });

  it("canWatchAdForGold는 캡 미만이면 true, 도달하면 false", () => {
    const dk = "2026-06-14";
    let s = initialMeta();
    expect(canWatchAdForGold(s, dk)).toBe(true);
    for (let i = 0; i < AD_GOLD_DAILY_CAP; i++) s = reduceRecordAdGold(s, dk);
    expect(adGoldCountToday(s, dk)).toBe(AD_GOLD_DAILY_CAP);
    expect(canWatchAdForGold(s, dk)).toBe(false); // 도달 → 마감
    // 날짜가 바뀌면 다시 시청 가능(진행 인질 아님)
    expect(canWatchAdForGold(s, "2026-06-15")).toBe(true);
  });
});

describe("광고 공개 API (node 메모리 캐시)", () => {
  beforeEach(() => reset());

  it("setAdFree/isAdFree 왕복", () => {
    expect(isAdFree()).toBe(false);
    setAdFree(true);
    expect(isAdFree()).toBe(true);
    setAdFree(false);
    expect(isAdFree()).toBe(false);
  });

  it("recordAdGold가 캡 카운트를 영속(메모리)하고 canWatchGoldAd가 마감 판정", () => {
    const dk = "2026-06-14";
    expect(canWatchGoldAd(dk)).toBe(true);
    for (let i = 0; i < AD_GOLD_DAILY_CAP; i++) recordAdGold(dk);
    expect(canWatchGoldAd(dk)).toBe(false);
    expect(canWatchGoldAd("2026-06-15")).toBe(true); // 롤오버
  });

  it("reset은 adFree를 초기값(false)으로 되돌린다", () => {
    setAdFree(true);
    reset();
    expect(isAdFree()).toBe(false);
  });
});

describe("selectRoster 해금 게이팅", () => {
  const rosters: Record<string, RosterEntry> = {
    유비: { commanderId: "유비", classId: "footman", joinChapter: 1, role: "lord" },
    조운: { commanderId: "조운", classId: "lightCavalry", joinChapter: 3, role: "melee" },
  };

  it("클리어 없으면 1장 장수만, 클리어 누적 시 다음 장 해금", () => {
    const fresh = selectRoster(initialMeta(), rosters);
    expect(fresh.map((r) => r.commanderId)).toEqual(["유비"]);

    const cleared2 = selectRoster(
      { ...initialMeta(), clearedStages: ["a", "b"] },
      rosters,
    );
    // 해금 챕터 = 1 + 2 = 3 → 조운(joinChapter 3) 포함
    expect(cleared2.map((r) => r.commanderId).sort()).toEqual(["유비", "조운"]);
  });

  it("진행 없는 장수는 기본값(level 1/exp 0/equipped [])으로 채움", () => {
    const [yubi] = selectRoster(initialMeta(), rosters);
    expect(yubi).toMatchObject({ level: 1, exp: 0, equipped: [] });
  });
});

describe("공개 API (node 비브라우저 — 메모리 캐시 폴백)", () => {
  beforeEach(() => reset());

  it("getMeta 초기값은 빈 상태", () => {
    const m = getMeta();
    expect(m).toEqual({
      gold: 0,
      inventory: [],
      clearedStages: [],
      rosterProgress: {},
      adFree: false,
      serendipity: 0,
      serendipityPity: 0,
    });
  });

  it("addSerendipity→pullSerendipity 흐름이 메모리 캐시로 일관", () => {
    expect(addSerendipity(PULL_COST * 2)).toBe(PULL_COST * 2);
    expect(getSerendipity()).toBe(PULL_COST * 2);
    // rng 주입: 첫 rng 높게(common) → gold/item 1회. 포인트 차감 확인.
    const out = pullSerendipity(() => 0.99);
    expect(out).not.toBeNull();
    expect(getSerendipity()).toBe(PULL_COST);
    expect(getSerendipityPity()).toBe(1);
  });

  it("pullSerendipity는 포인트 부족 시 null(상태 불변)", () => {
    addSerendipity(PULL_COST - 1);
    expect(pullSerendipity(() => 0.5)).toBeNull();
    expect(getSerendipity()).toBe(PULL_COST - 1);
  });

  it("addGold→spendGold 흐름이 메모리 캐시로 일관", () => {
    expect(addGold(300)).toBe(300);
    expect(getMeta().gold).toBe(300);
    expect(spendGold(500)).toBe(false); // 부족
    expect(spendGold(120)).toBe(true);
    expect(getMeta().gold).toBe(180);
  });

  it("addItem/removeItem/markCleared가 영속(메모리)에 반영", () => {
    addItem("상약");
    markCleared("05-sishuiguan");
    expect(getMeta().inventory).toEqual(["상약"]);
    expect(getMeta().clearedStages).toEqual(["05-sishuiguan"]);
    removeItem("상약");
    expect(getMeta().inventory).toEqual([]);
  });

  it("getRoster는 기본 gameData.rosters로 1장 장수를 포함", () => {
    const roster = getRoster();
    expect(roster.some((r) => r.commanderId === "유비")).toBe(true);
    // 클리어 없으면 3장 합류 조운은 제외
    expect(roster.some((r) => r.commanderId === "조운")).toBe(false);
  });
});
