/**
 * 일기토 미디어 해석(순수) — 드롭인 사다리 경로 키와 banter 추출.
 * 실데이터 계약도 함께 가드: 27스테이지 전 duel 이벤트가 banter를 갖는지(컷인 대사 공급 보장).
 */
import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { duelPairKey, duelImagePath, duelVideoPath, duelBanter } from "../duel/duelMedia";

describe("duelPairKey / 경로", () => {
  it("공격자_방어자 고정 방향 키 (스테이지 간 재사용)", () => {
    expect(duelPairKey("관우", "화웅")).toBe("관우_화웅");
    expect(duelImagePath("관우", "화웅")).toBe("/assets/duels/관우_화웅.webp");
    expect(duelVideoPath("관우", "화웅")).toBe("/assets/duels/관우_화웅.webm");
  });
});

describe("duelBanter", () => {
  it("해당 duelId의 duelOccurred 대사만 뽑는다", () => {
    const st = stages["05-sishuiguan"]!;
    const lines = duelBanter(st.dialogue, "duel_guanyu_huaxiong");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.speaker === "화웅")).toBe(true);
    expect(duelBanter(st.dialogue, "duel_없는것")).toEqual([]);
    expect(duelBanter(undefined, "duel_guanyu_huaxiong")).toEqual([]);
  });

  it("전 스테이지의 모든 duel 이벤트가 banter 대사를 가진다(컷인 대사 공급 계약)", () => {
    for (const st of Object.values(stages)) {
      for (const ev of st.events) {
        if (ev.type !== "duel") continue;
        const lines = duelBanter(st.dialogue, ev.id);
        expect(lines.length, `${st.id}/${ev.id} banter 누락`).toBeGreaterThan(0);
        // 참전자 id가 commanders에 실재(컷인 초상·이름 해석 가능)
        expect(gameData.commanders[ev.trigger.attackerId], `${st.id}/${ev.id} attacker`).toBeTruthy();
        expect(gameData.commanders[ev.trigger.defenderId], `${st.id}/${ev.id} defender`).toBeTruthy();
      }
    }
  });
});
