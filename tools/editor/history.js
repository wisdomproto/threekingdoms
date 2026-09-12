// tools/editor/history.js — 에디터 스냅샷 히스토리 (DOM 무관). spec 2026-09-12-editor-history-autosave-design §4
// 스택 원소 = 전체 상태의 직렬화 문자열. 복원은 호출측(loadStage/loadMap)이 한다.
export function createHistory({ limit = 100, coalesceMs = 400, now = () => Date.now() } = {}) {
  let stack = [];
  let index = -1;
  let saved = null;
  let lastPushAt = -Infinity;   // 병합 창 기준 시각. undo/redo/reset 이 닫는다(-Infinity).
  let lastWasPush = false;      // 마지막 호출이 새 항목/교체를 만든 push 였는가
  let lastCoalesce = false;     // 그 push 가 coalesce:true 였는가 (체크박스 직후 타이핑이 체크박스 항목을 덮지 않게)
  let didReset = false;         // 첫 reset 전엔 dirty 판정 안 함(init 렌더 push 무시)
  const current = () => (index >= 0 ? stack[index] : null);
  return {
    /** 새 상태. 직전과 같으면 false. coalesce 면 병합 창(coalesceMs) 안에서 top 교체(baseline 은 절대 안 덮음). */
    push(snapshot, { coalesce = false } = {}) {
      if (snapshot === current()) return false;
      const t = now();
      const burst = coalesce && lastWasPush && lastCoalesce && t - lastPushAt <= coalesceMs && index >= 1;
      stack.length = index + 1; // redo 비움
      if (burst) stack[index] = snapshot;
      else { stack.push(snapshot); index = stack.length - 1; }
      if (stack.length > limit) { const drop = stack.length - limit; stack.splice(0, drop); index -= drop; }
      lastPushAt = t; lastWasPush = true; lastCoalesce = coalesce;
      return true;
    },
    undo() { if (index <= 0) return null; index -= 1; lastWasPush = false; lastPushAt = -Infinity; return stack[index]; },
    redo() { if (index >= stack.length - 1) return null; index += 1; lastWasPush = false; lastPushAt = -Infinity; return stack[index]; },
    canUndo: () => index > 0,
    canRedo: () => index < stack.length - 1,
    current,
    /** 로드 직후: 스택 = [snapshot], saved = snapshot */
    reset(snapshot) { stack = [snapshot]; index = 0; saved = snapshot; lastWasPush = false; lastPushAt = -Infinity; didReset = true; },
    markSaved() { saved = current(); },
    isDirty: () => didReset && current() !== saved,
  };
}
