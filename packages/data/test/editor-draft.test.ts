import { describe, it, expect, vi } from "vitest";
import { saveState, createDraftSaver } from "../../../tools/editor/draft-store.js";

/** 주입용 가짜 시계 + 타이머 (setTimeout/clearTimeout/now 전부 여기서). */
function fakeTimers(start = 0) {
  let t = start; let seq = 0;
  const q = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => t,
    setTimeout: (fn: () => void, ms: number) => { const id = ++seq; q.set(id, { at: t + ms, fn }); return id; },
    clearTimeout: (id: number) => { q.delete(id); },
    async tick(ms: number) {
      const end = t + ms;
      for (;;) {
        const due = [...q.entries()].filter(([, e]) => e.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        t = due[1].at; q.delete(due[0]); due[1].fn();
        await flush();
      }
      t = end; await flush();
    },
  };
}
const flush = () => new Promise<void>((r) => setImmediate(r));

describe("saveState — 저장 상태 칩 텍스트/클래스", () => {
  it.each([
    [{ dirty: false, draftAt: "14:32" }, "Draft 저장됨 ✓ 14:32", "ok"],
    [{ dirty: true }, "수정됨", "warn"],
    [{ saving: true }, "저장 중…", "warn"],
    [{ lastError: "net" }, "오프라인 — 로컬에 보관됨", "bad"],
    [{ conflict: true }, "다른 탭에서 수정됨 — 새로고침", "bad"],
    [{ dirty: false, draftAt: null, publishedAt: "14:40" }, "Published ✓ 14:40", "ok"],
  ] as const)("%j → %s / %s", (s, text, cls) => {
    expect(saveState(s)).toEqual({ text, cls });
  });
  it("conflict 가 lastError·saving·dirty 보다 우선", () => {
    expect(saveState({ dirty: true, saving: true, lastError: "x", conflict: true }).cls).toBe("bad");
    expect(saveState({ dirty: true, saving: true, lastError: "x" }).text).toContain("오프라인");
    expect(saveState({ dirty: true, saving: true }).text).toBe("저장 중…");
  });
});

function setup(postImpl?: (body: any) => Promise<any>) {
  const T = fakeTimers(1000);
  const post = vi.fn(postImpl ?? (async () => ({ ok: true, revision: 2, savedAt: "2026-09-12T05:32:00+00:00" })));
  const onSaved = vi.fn(); const onState = vi.fn();
  const saver = createDraftSaver({ post, debounceMs: 1500, retryMs: 30000, now: T.now, setTimeout: T.setTimeout, clearTimeout: T.clearTimeout, onSaved, onState });
  return { T, post, onSaved, onState, saver };
}

describe("createDraftSaver — 디바운스·재시도·409 정지 상태기계", () => {
  it("touch 두 번(500ms 간격) → 마지막 touch 기준 1500ms 후 post 1회", async () => {
    const { T, post, saver } = setup();
    saver.touch(); await T.tick(500); saver.touch();
    expect(saver.state().dirty).toBe(true);
    await T.tick(1400); expect(post).not.toHaveBeenCalled();
    await T.tick(100); expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toEqual({ baseRevision: null });
  });
  it("성공 {ok,revision:2} → revision·draftAt 갱신, dirty=false, onSaved 호출", async () => {
    const { T, onSaved, onState, saver } = setup();
    saver.touch(); await T.tick(1500);
    const s = saver.state();
    expect(s.revision).toBe(2); expect(s.dirty).toBe(false); expect(s.saving).toBe(false);
    expect(s.draftAt).toMatch(/^\d\d:\d\d$/); expect(s.lastError).toBe(null);
    expect(onSaved).toHaveBeenCalledTimes(1); expect(onState).toHaveBeenCalled();
  });
  it("두 번째 저장은 baseRevision 에 직전 revision 을 넣는다", async () => {
    const { T, post, saver } = setup();
    saver.touch(); await T.tick(1500); saver.touch(); await T.tick(1500);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[0]).toEqual({ baseRevision: 2 });
  });
  it("post reject → lastError, retryMs 뒤 재시도 1회 → 성공 시 정상", async () => {
    let fail = true;
    const { T, post, saver } = setup(async (): Promise<any> => { if (fail) throw new Error("net"); return { ok: true, revision: 1 }; });
    saver.touch(); await T.tick(1500);
    expect(post).toHaveBeenCalledTimes(1);
    expect(saver.state().lastError).toBe("net"); expect(saver.state().saving).toBe(false);
    await T.tick(29999); expect(post).toHaveBeenCalledTimes(1);
    fail = false;
    await T.tick(1); expect(post).toHaveBeenCalledTimes(2);
    expect(saver.state().lastError).toBe(null); expect(saver.state().revision).toBe(1);
  });
  it("409 {ok:false,conflict:true} → conflict, 이후 touch 무시(정지), reset 으로 해제", async () => {
    const { T, post, saver } = setup(async (): Promise<any> => ({ ok: false, conflict: true, revision: 7 }));
    saver.touch(); await T.tick(1500);
    expect(saver.state().conflict).toBe(true); expect(saver.state().saving).toBe(false);
    saver.touch(); await T.tick(5000); saver.flush(); await T.tick(60000);
    expect(post).toHaveBeenCalledTimes(1);
    saver.reset({ revision: 7 });
    expect(saver.state()).toMatchObject({ conflict: false, dirty: false, saving: false, lastError: null, revision: 7 });
    saver.touch(); await T.tick(1500);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[0]).toEqual({ baseRevision: 7 });
  });
  it("저장 중 touch → 완료 후 한 번 더 post", async () => {
    let resolve!: (v: any) => void;
    const { T, post, saver } = setup(() => new Promise((r) => { resolve = r; }));
    saver.touch(); await T.tick(1500);
    expect(post).toHaveBeenCalledTimes(1); expect(saver.state().saving).toBe(true);
    saver.touch(); await T.tick(3000);
    expect(post).toHaveBeenCalledTimes(1);
    expect(saver.state().dirty).toBe(true);
    resolve({ ok: true, revision: 1 }); await flush(); await flush();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[0]).toEqual({ baseRevision: 1 });
    resolve({ ok: true, revision: 2 }); await flush(); await flush();
    expect(saver.state()).toMatchObject({ dirty: false, saving: false, revision: 2 });
  });
  it("flush() = 디바운스 없이 즉시 post", async () => {
    const { T, post, saver } = setup();
    saver.touch(); saver.flush(); await flush();
    expect(post).toHaveBeenCalledTimes(1);
    await T.tick(5000); expect(post).toHaveBeenCalledTimes(1);
  });
  it("깨끗한 상태의 flush 는 아무것도 안 한다", async () => {
    const { post, saver } = setup();
    saver.flush(); await flush();
    expect(post).not.toHaveBeenCalled();
  });
});
