import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseBakdata } from "../src/bakdata";

const HERO = process.env.HERO_DIR ?? "C:\\HERO";
const have = existsSync(`${HERO}\\BAKDATA.R3`);

describe.skipIf(!have)("BAKDATA 파싱 (C:\\HERO 필요)", () => {
  const parsed = have ? parseBakdata(readFileSync(`${HERO}\\BAKDATA.R3`)) : null!;

  it("레퍼런스 발췌 표와 일치 — 관우/여포/제갈량/화웅", () => {
    const c = parsed.commanders;
    expect(c["관우"]).toMatchObject({ leadership: 100, war: 98, intelligence: 80 });
    expect(c["여포"]).toMatchObject({ war: 100, intelligence: 21 });
    expect(c["제갈량"]).toMatchObject({ intelligence: 100 });
    expect(c["화웅"]).toMatchObject({ leadership: 88, war: 90, intelligence: 29 });
  });

  it("아이템 63종 — 청룡언월도 +12%, 패자검 +24% (레퍼런스 §4)", () => {
    expect(Object.keys(parsed.items)).toHaveLength(63);
    expect(parsed.items["청룡언월도"]).toMatchObject({ category: "weapon", bonusPercent: 12 });
    expect(parsed.items["패자검"]).toMatchObject({ category: "weapon", bonusPercent: 24 });
    expect(parsed.items["적토마"]).toMatchObject({ category: "horse" });
  });

  it("초기 편성 — 관우 경기병 Lv1 병력 1120 청룡언월도, 여포 적토마+방천화극", () => {
    const f = parsed.initialForces;
    expect(f["관우"]).toMatchObject({ classId: "lightCavalry", level: 1, troops: 1120, items: ["청룡언월도"] });
    expect(f["여포"]!.items).toEqual(expect.arrayContaining(["적토마", "방천화극"]));
  });

  it("장수 능력치 전수 1~100 범위", () => {
    for (const c of Object.values(parsed.commanders)) {
      for (const v of [c.leadership, c.war, c.intelligence]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});
