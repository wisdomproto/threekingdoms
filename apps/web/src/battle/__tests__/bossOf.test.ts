/**
 * 보스(적 메인 장수) 판정 — defeatUnit 목표 우선, 없으면 최고 레벨 적(동률=배치순).
 * 보스 BGM 교전 트리거의 판정 근거라 실데이터 27스테이지 전수 계약도 가드.
 */
import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { bossUnitId } from "../bossOf";

describe("bossUnitId", () => {
  it("defeatUnit 목표가 있으면 그 대상", () => {
    expect(bossUnitId(stages["05-sishuiguan"]!)).toBe("화웅");
    expect(bossUnitId(stages["06-huluguan"]!)).toBe("여포");
    expect(bossUnitId(stages["27-huarongdao"]!)).toBe("조조");
  });

  it("defeatUnit 없으면 최고 레벨 적 — 01 정원지 / 21 조조", () => {
    expect(bossUnitId(stages["01-zhuojun"]!)).toBe("정원지");
    expect(bossUnitId(stages["21-changbanqiao"]!)).toBe("조조");
  });

  it("27스테이지 전부 보스가 실재 장수로 판정된다(교전 트리거 공급 계약)", () => {
    for (const st of Object.values(stages)) {
      const boss = bossUnitId(st);
      expect(boss, `${st.id} 보스 없음`).toBeTruthy();
      expect(gameData.commanders[boss!], `${st.id} 보스(${boss}) commanders 미등록`).toBeTruthy();
    }
  });
});
