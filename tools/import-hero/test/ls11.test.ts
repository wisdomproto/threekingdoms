import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { ls11Extract } from "../src/ls11";

const HERO = process.env.HERO_DIR ?? "C:\\HERO";
const have = existsSync(`${HERO}\\HEXZMAP.R3`);

describe.skipIf(!have)("LS11 해제 (C:\\HERO 필요 — 없으면 skip)", () => {
  it("HEXZMAP.R3 → 59청크, 각 원본 크기와 일치", () => {
    const chunks = ls11Extract(readFileSync(`${HERO}\\HEXZMAP.R3`));
    expect(chunks).toHaveLength(59); // 맵 58 + 지명 테이블 1 (레퍼런스 §8-2)
  });

  it("맵 청크 58개가 W×H×1.25+2 크기식을 만족 (레퍼런스 검증식)", () => {
    const chunks = ls11Extract(readFileSync(`${HERO}\\HEXZMAP.R3`));
    for (let i = 0; i < 58; i++) {
      const c = chunks[i]!;
      const w = c[0]!, h = c[1]!;
      expect(c.length).toBe(w * h * 1.25 + 2);
    }
  });
});
