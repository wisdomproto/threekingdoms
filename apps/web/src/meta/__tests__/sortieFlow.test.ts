/**
 * 막간 → 전투 진입 통합 흐름 단위테스트(env=node — window 없음).
 *
 * 검증 대상은 두 축:
 *  1) sortie.ts applySortieToStage(순수) — player 슬롯 override / 좌표 유지 / no-op 회귀.
 *  2) metaStore 공개 API로 본 "구매 → 클리어 → 해금 → 편성" 플로우가 한 상태로 이어지는지.
 *     (writeSortie/readSortie/clearSortie는 sessionStorage라 node에서 no-op이므로 여기선
 *      순수 변환과 영속 상태 전이만 본다.)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { gameData, stages } from "@tk/data";
import { applySortieToStage, type SortieMember } from "../sortie";
import {
  reset,
  getMeta,
  addGold,
  spendGold,
  addItem,
  markCleared,
  getRoster,
  setEquipped,
} from "../metaStore";

const STAGE = stages["05-sishuiguan"]!;

function playerUnits(units: typeof STAGE.units) {
  return units.filter((u) => u.side === "player");
}

describe("applySortieToStage (순수 — player 슬롯 override)", () => {
  it("members 빈 배열이면 stage.units를 그대로(동일 참조) 반환 — 기존 전투 회귀 없음", () => {
    expect(applySortieToStage(STAGE, [])).toBe(STAGE.units);
  });

  it("player 슬롯을 앞에서부터 members로 매핑하되 좌표(x,y)는 슬롯 원본 유지", () => {
    const slots = playerUnits(STAGE.units);
    const members: SortieMember[] = [
      { commanderId: "관우", classId: "lightCavalry", level: 7, exp: 3, items: ["청룡언월도"] },
    ];
    const out = applySortieToStage(STAGE, members);
    const outPlayers = playerUnits(out);

    // 첫 player 슬롯이 편성 1번으로 교체됨.
    expect(outPlayers[0]!.commanderId).toBe("관우");
    expect(outPlayers[0]!.classId).toBe("lightCavalry");
    expect(outPlayers[0]!.level).toBe(7);
    expect(outPlayers[0]!.items).toEqual(["청룡언월도"]);
    // 좌표는 stage 슬롯 그대로(배치 UI 없음).
    expect(outPlayers[0]!.x).toBe(slots[0]!.x);
    expect(outPlayers[0]!.y).toBe(slots[0]!.y);
    // 편성이 모자란 나머지 슬롯은 원본 유지.
    expect(outPlayers[1]!.commanderId).toBe(slots[1]!.commanderId);
    // enemy는 손대지 않음.
    const enemiesBefore = STAGE.units.filter((u) => u.side === "enemy").length;
    const enemiesAfter = out.filter((u) => u.side === "enemy").length;
    expect(enemiesAfter).toBe(enemiesBefore);
  });

  it("members가 player 슬롯보다 많으면 잉여는 버린다(슬롯이 상한)", () => {
    const slotCount = playerUnits(STAGE.units).length;
    const members: SortieMember[] = Array.from({ length: slotCount + 3 }, (_, i) => ({
      commanderId: `dummy${i}`,
      classId: "footman",
      level: 1,
      exp: 0,
      items: [],
    }));
    const out = applySortieToStage(STAGE, members);
    expect(playerUnits(out).length).toBe(slotCount); // 슬롯 수 불변
  });

  it("troops 미지정이면 슬롯 기본값 유지, 지정하면 주입", () => {
    const slots = playerUnits(STAGE.units);
    const withTroops = applySortieToStage(STAGE, [
      { commanderId: "유비", classId: "footman", level: 1, exp: 0, items: [], troops: 999 },
    ]);
    expect(playerUnits(withTroops)[0]!.troops).toBe(999);

    const noTroops = applySortieToStage(STAGE, [
      { commanderId: "유비", classId: "footman", level: 1, exp: 0, items: [] },
    ]);
    expect(playerUnits(noTroops)[0]!.troops).toBe(slots[0]!.troops);
  });
});

describe("막간 플로우 — 구매 → 클리어 → 해금 → 편성 (metaStore 공개 API)", () => {
  beforeEach(() => reset());

  it("상점 구매: spendGold 성공 시 자금 차감 + addItem으로 인벤토리 적재", () => {
    addGold(500);
    const shopItem = gameData.shops.ch1!.items[0]!; // ch1 첫 진열품
    expect(spendGold(shopItem.price)).toBe(true);
    addItem(shopItem.itemId);
    expect(getMeta().gold).toBe(500 - shopItem.price);
    expect(getMeta().inventory).toContain(shopItem.itemId);
  });

  it("구매 실패(잔액 부족)면 상태 불변 — 인벤토리/자금 그대로", () => {
    addGold(10);
    const pricey = gameData.shops.ch1!.items.find((i) => i.price > 10)!;
    expect(spendGold(pricey.price)).toBe(false);
    expect(getMeta().gold).toBe(10);
    expect(getMeta().inventory).toEqual([]);
  });

  it("클리어 기록이 다음 장 장수를 해금한다(getRoster 게이팅 일관)", () => {
    // 신규: 1장 장수만(유비 등), 3장 합류 조운은 잠김.
    const before = getRoster();
    expect(before.some((r) => r.commanderId === "유비")).toBe(true);
    expect(before.some((r) => r.commanderId === "조운")).toBe(false);

    // 스테이지 2개 클리어 → 해금 챕터 = 1 + 2 = 3 → 조운 해금.
    markCleared("a");
    markCleared("b");
    const after = getRoster();
    expect(after.some((r) => r.commanderId === "조운")).toBe(true);
  });

  it("markCleared는 중복 클리어를 한 번만 센다(해금 단계가 부풀지 않음)", () => {
    markCleared("05-sishuiguan");
    markCleared("05-sishuiguan");
    expect(getMeta().clearedStages).toEqual(["05-sishuiguan"]);
  });

  it("편성 장비 영속(setEquipped)이 getRoster 결과에 반영되어 출진 후보로 노출", () => {
    setEquipped("유비", ["쌍고검"]);
    const roster = getRoster();
    const yubi = roster.find((r) => r.commanderId === "유비")!;
    expect(yubi.equipped).toEqual(["쌍고검"]);
  });
});
