import { describe, it, expect } from "vitest";
import { createHistory } from "../../../tools/editor/history.js";

function clock(start = 1000) { let t = start; return { now: () => t, tick: (ms: number) => { t += ms; } }; }

describe("editor history — 스냅샷 스택 (spec §4)", () => {
  it("같은 스냅샷 push 는 무시(false), 다른 스냅샷은 true", () => {
    const h = createHistory({ now: clock().now });
    h.reset("A");
    expect(h.push("A")).toBe(false);
    expect(h.push("B")).toBe(true);
    expect(h.current()).toBe("B");
  });
  it("undo/redo 왕복, 새 push 가 redo 를 비운다", () => {
    const c = clock(); const h = createHistory({ now: c.now });
    h.reset("A"); c.tick(1000); h.push("B"); c.tick(1000); h.push("C");
    expect(h.undo()).toBe("B"); expect(h.undo()).toBe("A"); expect(h.undo()).toBe(null);
    expect(h.redo()).toBe("B"); expect(h.canRedo()).toBe(true);
    c.tick(1000); h.push("D");
    expect(h.canRedo()).toBe(false); expect(h.current()).toBe("D");
    expect(h.undo()).toBe("B");
  });
  it("coalesce:true 로 400ms 안 연속 push 는 한 항목 — undo 한 번에 버스트 전으로", () => {
    const c = clock(); const h = createHistory({ now: c.now, coalesceMs: 400 });
    h.reset("A"); c.tick(1000);
    h.push("B1", { coalesce: true }); c.tick(100); h.push("B12", { coalesce: true }); c.tick(100); h.push("B123", { coalesce: true });
    expect(h.current()).toBe("B123");
    expect(h.undo()).toBe("A");
    expect(h.redo()).toBe("B123");
  });
  it("coalesce:false 는 400ms 안이어도 별 항목", () => {
    const c = clock(); const h = createHistory({ now: c.now });
    h.reset("A"); c.tick(1000); h.push("B"); c.tick(100); h.push("C");
    expect(h.undo()).toBe("B");
  });
  it("버스트 밖(500ms 뒤) push 는 별 항목", () => {
    const c = clock(); const h = createHistory({ now: c.now, coalesceMs: 400 });
    h.reset("A"); c.tick(1000); h.push("B", { coalesce: true }); c.tick(500); h.push("C", { coalesce: true });
    expect(h.undo()).toBe("B");
  });
  it("undo 뒤 300ms 안 push 는 병합하지 않는다 (돌아간 상태 보존)", () => {
    const c = clock(); const h = createHistory({ now: c.now, coalesceMs: 400 });
    h.reset("A"); c.tick(1000); h.push("B", { coalesce: true });
    c.tick(100); expect(h.undo()).toBe("A");
    c.tick(100); h.push("C", { coalesce: true });
    expect(h.undo()).toBe("A");
    expect(h.redo()).toBe("C");
  });
  it("coalesce:false 항목 직후 400ms 안의 coalesce:true push 는 그 항목을 덮지 않는다", () => {
    const c = clock(); const h = createHistory({ now: c.now, coalesceMs: 400 });
    h.reset("A"); c.tick(1000); h.push("CHK"); c.tick(100); h.push("T1", { coalesce: true });
    expect(h.undo()).toBe("CHK"); expect(h.undo()).toBe("A");
  });
  it("같은 스냅샷 push(false) 는 redo 스택을 지우지 않는다", () => {
    const c = clock(); const h = createHistory({ now: c.now });
    h.reset("A"); c.tick(1000); h.push("B"); h.undo();
    expect(h.push("A")).toBe(false); expect(h.canRedo()).toBe(true);
  });
  it("버스트 첫 항목은 reset 직후 baseline 을 덮지 않는다", () => {
    const c = clock(); const h = createHistory({ now: c.now });
    h.reset("A"); c.tick(10); h.push("B", { coalesce: true });
    expect(h.undo()).toBe("A");
  });
  it("limit 초과 시 가장 오래된 항목 제거", () => {
    const c = clock(); const h = createHistory({ now: c.now, limit: 3 });
    h.reset("A"); for (const s of ["B", "C", "D"]) { c.tick(1000); h.push(s); }
    expect(h.undo()).toBe("C"); expect(h.undo()).toBe("B"); expect(h.undo()).toBe(null);
  });
  it("reset / markSaved / isDirty — 첫 reset 전엔 dirty 아님", () => {
    const c = clock(); const h = createHistory({ now: c.now });
    expect(h.isDirty()).toBe(false);
    h.push("X"); expect(h.isDirty()).toBe(false);
    h.reset("A"); expect(h.isDirty()).toBe(false);
    c.tick(1000); h.push("B"); expect(h.isDirty()).toBe(true);
    h.markSaved(); expect(h.isDirty()).toBe(false);
    h.undo(); expect(h.isDirty()).toBe(true);
    h.redo(); expect(h.isDirty()).toBe(false);
  });
});
