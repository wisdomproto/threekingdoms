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
  selectRoster,
  getMeta,
  addGold,
  spendGold,
  addItem,
  removeItem,
  markCleared,
  getRoster,
  reset,
} from "../metaStore";

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
    expect(m).toEqual({ gold: 0, inventory: [], clearedStages: [], rosterProgress: {} });
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
