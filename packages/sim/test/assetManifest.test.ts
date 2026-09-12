/**
 * 에셋 매니페스트 수집(W1) 테스트 — 순수. 스테이지 scenario/units에서 필요한 초상·씬·맵을 수집.
 */
import { describe, it, expect } from "vitest";
import { gameData } from "@tk/data";
import { collectRequiredAssets } from "../src/assets/manifest";
import type { Stage } from "@tk/data";

describe("collectRequiredAssets", () => {
  const req = collectRequiredAssets(gameData.stages, gameData.commanders);

  it("초상: 05 시나리오 화자(유비/관우/장비) + 전투 유닛 commanderId 포함", () => {
    const ids = new Set(req.portraits.map((p) => p.id));
    expect(ids.has("유비")).toBe(true);
    expect(ids.has("관우")).toBe(true);
    expect(ids.has("장비")).toBe(true);
    expect(ids.has("화웅")).toBe(true); // 05 적장
  });

  it("초상은 중복 없이 최초 등장 스테이지 기록", () => {
    const ids = req.portraits.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // 유일
    const yubi = req.portraits.find((p) => p.id === "유비")!;
    expect(yubi.firstStage).toBeTruthy();
  });

  it("씬 배경: 05 intro/outro bg 수집", () => {
    const bgs = new Set(req.scenes.map((s) => s.bgId));
    expect(bgs.has("05-sishuiguan-intro")).toBe(true);
    expect(bgs.has("05-sishuiguan-outro")).toBe(true);
    const intro = req.scenes.find((s) => s.bgId === "05-sishuiguan-intro")!;
    expect(intro.type).toBe("intro");
    expect(intro.stageId).toBe("05-sishuiguan");
  });

  it("맵 배경: 스테이지별 mapId 수집(중복 제거 — 키는 맵 id, 씬 파트가 스테이지당 여러 맵 추가 가능)", () => {
    expect(req.maps.some((m) => m.stageId === "05-sishuiguan" && m.mapId === "sishuiguan")).toBe(true);
    const mapIds = req.maps.map((m) => m.mapId);
    expect(new Set(mapIds).size).toBe(mapIds.length);
  });

  it("씬 맵(막간 v4): 01 MapScene 파트의 씬 맵 3장 수집", () => {
    for (const id of ["scene-01-street", "scene-01-tavern", "scene-01-orchard"]) {
      expect(req.maps.some((m) => m.stageId === "01-zhuojun" && m.mapId === id), id).toBe(true);
    }
  });

  it("출시 데이터엔 만화 파트가 없다(comics 빈 배열 — 스펙 §5 콘텐츠 불침범)", () => {
    expect(req.comics).toEqual([]);
  });

  it("만화 파트(story editor v2): 페이지 image 수집(중복 제거) + 칸 화자 초상", () => {
    const base = gameData.stages["05-sishuiguan"]!;
    type R4 = [number, number, number, number];
    const comic = { kind: "comic" as const, pages: [
      { image: "05-sishuiguan-intro-p1", panels: [
        { rect: [0, 0, 1, 1] as R4 },
        { rect: [0, 0, 0.5, 0.5] as R4, lines: [{ speaker: "손건", portraitId: "손건", text: "화웅이 관을 지킵니다" }] },
      ] },
      { image: "05-sishuiguan-intro-p1", panels: [{ rect: [0, 0, 1, 1] as R4 }] }, // 같은 지면 재사용
    ] };
    const st: Stage = { ...base, scenario: { intro: [comic, { bg: "05-sishuiguan-intro", lines: [{ text: "x" }] }] } };
    const r = collectRequiredAssets({ [st.id]: st }, gameData.commanders);
    expect(r.comics).toEqual([{ image: "05-sishuiguan-intro-p1", stageId: "05-sishuiguan", type: "intro", firstLine: "화웅이 관을 지킵니다" }]);
    expect(r.portraits.some((p) => p.id === "손건")).toBe(true);
    expect(r.scenes.some((s) => s.bgId === "05-sishuiguan-intro")).toBe(true); // 뒤따르는 VN 파트는 그대로
  });
});
