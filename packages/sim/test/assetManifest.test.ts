/**
 * 에셋 매니페스트 수집(W1) 테스트 — 순수. 스테이지 scenario/units에서 필요한 초상·씬·맵을 수집.
 */
import { describe, it, expect } from "vitest";
import { gameData } from "@tk/data";
import { collectRequiredAssets } from "../src/assets/manifest";

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

  it("맵 배경: 스테이지별 mapId 수집(중복 제거)", () => {
    expect(req.maps.some((m) => m.stageId === "05-sishuiguan" && m.mapId === "sishuiguan")).toBe(true);
    const mapIds = req.maps.map((m) => m.stageId);
    expect(new Set(mapIds).size).toBe(mapIds.length);
  });
});
