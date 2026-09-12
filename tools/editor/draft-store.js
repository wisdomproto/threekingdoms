// tools/editor/draft-store.js — Draft 자동 저장 상태기계 (DOM/fetch/timers 전부 주입, 순수).
// spec 2026-09-12-project-store-draft-design §4·§5. 본문(stageId/stage/map)은 post 의 호출측 클로저가 붙인다 —
// saver 는 { baseRevision } 만 넘긴다.

/** 저장 상태 → 칩 {text, cls}. 우선순위: conflict > lastError > saving > dirty > draftAt > publishedAt. */
export function saveState({ dirty = false, saving = false, lastError = null, conflict = false, draftAt = null, publishedAt = null } = {}) {
  if (conflict) return { text: "다른 탭에서 수정됨 — 새로고침", cls: "bad" };
  if (lastError) return { text: "오프라인 — 로컬에 보관됨", cls: "bad" };
  if (saving) return { text: "저장 중…", cls: "warn" };
  if (dirty) return { text: "수정됨", cls: "warn" };
  if (draftAt) return { text: `Draft 저장됨 ✓ ${draftAt}`, cls: "ok" };
  if (publishedAt) return { text: `Published ✓ ${publishedAt}`, cls: "ok" };
  return { text: "Published", cls: "ok" };
}

const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export function createDraftSaver({
  post, debounceMs = 1500, retryMs = 30000, now = () => Date.now(),
  setTimeout: setT = globalThis.setTimeout, clearTimeout: clearT = globalThis.clearTimeout,
  onSaved = () => {}, onState = () => {},
}) {
  const s = { dirty: false, saving: false, lastError: null, conflict: false, revision: null, draftAt: null };
  let timer = null;       // 디바운스 또는 재시도 타이머 (동시에 하나만)
  let again = false;      // 저장 중 touch → 완료 후 한 번 더
  const emit = () => onState({ ...s });
  const arm = (ms) => { if (timer !== null) clearT(timer); timer = setT(() => { timer = null; save(); }, ms); };

  async function save() {
    if (s.conflict || s.saving) return;
    s.saving = true; s.dirty = false; again = false; emit();
    let res;
    try { res = await post({ baseRevision: s.revision }); }
    catch (e) { res = { ok: false, error: (e && e.message) || String(e) }; }
    s.saving = false;
    if (res && res.ok) {
      s.revision = res.revision; s.lastError = null; s.draftAt = hhmm(now());
      emit(); onSaved(res);
      if (again) save();          // 저장 중 들어온 편집 — 즉시 한 번 더
      return;
    }
    if (res && res.conflict) { s.conflict = true; s.dirty = true; emit(); return; } // 정지 — reset() 까지 touch 무시
    // ponytail: 400 등 서버 거부도 "오프라인"으로 묶어 재시도 — 구분 필요해지면 res.error 로 분기
    s.lastError = (res && res.error) || "error"; s.dirty = true; emit();
    arm(retryMs);
  }

  return {
    /** 편집 발생. 디바운스 후 저장; 저장 중이면 완료 후 한 번 더. conflict 중엔 무시. */
    touch() {
      if (s.conflict) return;
      s.dirty = true; emit();
      if (s.saving) { again = true; return; }
      arm(debounceMs);
    },
    /** 즉시 저장 (Ctrl+S / 「저장」). 저장할 게 없으면 no-op. */
    flush() {
      if (s.conflict) return;
      if (s.saving) { again = true; return; }
      if (timer !== null) { clearT(timer); timer = null; }
      if (s.dirty || s.lastError) save();
    },
    /** 새 문서 로드 / conflict 해제. revision = 서버 Draft meta 의 revision(없으면 null). */
    reset({ revision = null, draftAt = null } = {}) {
      if (timer !== null) { clearT(timer); timer = null; }
      again = false;
      Object.assign(s, { dirty: false, saving: false, lastError: null, conflict: false, revision, draftAt });
      emit();
    },
    state: () => ({ ...s }),
  };
}
