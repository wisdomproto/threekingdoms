/**
 * 캠페인 시퀀싱(W1) 테스트 — 순수. 스테이지 순서·다음 스테이지·챕터 매핑.
 */
import { describe, it, expect } from "vitest";
import { stageNumber, chapterOf, orderedStageIds, nextStageId } from "../campaign";

describe("stageNumber", () => {
  it("id 'NN-slug'에서 번호 추출", () => {
    expect(stageNumber("05-sishuiguan")).toBe(5);
    expect(stageNumber("27-huarongdao")).toBe(27);
    expect(stageNumber("garbage")).toBe(999); // 파싱 실패 폴백
  });
});

describe("chapterOf", () => {
  it("§5 챕터 구간 매핑", () => {
    expect(chapterOf(1)).toBe(1); // 1장 1-4
    expect(chapterOf(4)).toBe(1);
    expect(chapterOf(5)).toBe(2); // 2장 5-9
    expect(chapterOf(9)).toBe(2);
    expect(chapterOf(15)).toBe(3); // 3장 10-15
    expect(chapterOf(22)).toBe(4); // 4장 16-22
    expect(chapterOf(27)).toBe(5); // 5장 23-27
  });
});

describe("orderedStageIds", () => {
  it("번호 오름차순 27개", () => {
    const ids = orderedStageIds();
    expect(ids.length).toBe(27);
    expect(ids[0]).toBe("01-zhuojun");
    expect(ids[ids.length - 1]).toBe("27-huarongdao");
    // 단조 증가
    for (let i = 1; i < ids.length; i++) {
      expect(stageNumber(ids[i]!)).toBeGreaterThan(stageNumber(ids[i - 1]!));
    }
  });
});

describe("nextStageId", () => {
  it("다음 스테이지 id, 마지막이면 null", () => {
    expect(nextStageId("01-zhuojun")).toBe("02-yingchuan");
    expect(nextStageId("26-chibi")).toBe("27-huarongdao");
    expect(nextStageId("27-huarongdao")).toBeNull();
    expect(nextStageId("없는스테이지")).toBeNull();
  });
});
