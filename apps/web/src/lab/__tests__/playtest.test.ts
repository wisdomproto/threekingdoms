import { describe, it, expect } from "vitest";
import { gameData } from "@tk/data";
import { exitTarget } from "../lab";
import { parsePlaytestSnapshot, PLAYTEST_KIND, PLAYTEST_VERSION } from "../playtest";

describe("exitTarget — 실험실/플레이테스트 종료 목적지 (spec §6)", () => {
  it("returnUrl 없음 → /lab (현행 실험실 동작)", () => {
    expect(exitTarget(null, true)).toEqual({ kind: "navigate", to: "/lab" });
    expect(exitTarget({}, false)).toEqual({ kind: "navigate", to: "/lab" });
  });
  it("returnUrl 있음 + opener 있음 → close (에디터가 연 탭)", () => {
    expect(exitTarget({ returnUrl: "http://localhost:8082/tools/stage-editor.html" }, true)).toEqual({ kind: "close" });
  });
  it("returnUrl 있음 + opener 없음 → returnUrl 로 이동 (탭을 직접 열었거나 복사한 경우)", () => {
    expect(exitTarget({ returnUrl: "http://x/editor" }, false)).toEqual({ kind: "navigate", to: "http://x/editor" });
  });
});

describe("parsePlaytestSnapshot — 드래프트 파일 → LabPayload (spec §4·§7)", () => {
  const snap = () => ({
    kind: PLAYTEST_KIND, version: PLAYTEST_VERSION,
    draftId: "05-sishuiguan-1", revision: 1,
    stage: structuredClone(gameData.stages["05-sishuiguan"]!),
    map: structuredClone(gameData.maps["sishuiguan"]!),
    seed: 1, returnUrl: "http://localhost:8082/tools/stage-editor.html", savedAt: "2026-09-12T00:00:00Z",
  });
  it("유효 스냅샷 → ok + LabPayload (sharedItems [], seed, returnUrl 전달)", () => {
    const r = parsePlaytestSnapshot(snap());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.stage.id).toBe("05-sishuiguan");
    expect(r.payload.map.id).toBe("sishuiguan");
    expect(r.payload.sharedItems).toEqual([]);
    expect(r.payload.seed).toBe(1);
    expect(r.payload.returnUrl).toBe("http://localhost:8082/tools/stage-editor.html");
  });
  it("kind 불일치 → ok:false 안내", () => {
    const r = parsePlaytestSnapshot({ ...snap(), kind: "something-else" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("형식");
  });
  it("zod 실패(turnLimit 삭제) → ok:false 메시지에 경로 포함", () => {
    const s = snap();
    delete (s.stage as Record<string, unknown>).turnLimit;
    const r = parsePlaytestSnapshot(s);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("turnLimit");
  });
  it("returnUrl 없으면 payload 에 키가 없다 (실험실과 동일하게 /lab 복귀)", () => {
    const { returnUrl: _omit, ...rest } = snap();
    const r = parsePlaytestSnapshot(rest);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect("returnUrl" in r.payload).toBe(false);
  });
  it("객체가 아니면 ok:false", () => {
    expect(parsePlaytestSnapshot(null).ok).toBe(false);
    expect(parsePlaytestSnapshot("x").ok).toBe(false);
  });
  it("맵 검증 실패(tiles 손상) → ok:false, 메시지에 '맵 검증 실패'", () => {
    const s = snap();
    (s.map as { tiles: string[] }).tiles.pop();
    const r = parsePlaytestSnapshot(s);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("맵 검증 실패");
  });
  it("mapId 불일치(스테이지가 다른 맵을 가리킴) → ok:false, 메시지에 'mapId'", () => {
    const s = snap();
    (s.stage as { mapId: string }).mapId = "zhuojun";
    const r = parsePlaytestSnapshot(s);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("mapId");
  });
});
