/**
 * 자금 최소 영속 (설계 phase-1 계약 §2) — 결산에서 획득 gold를 localStorage에 누적.
 * 막간 화면 전체는 이번 범위 아님 — 결산만. SSR/비브라우저 가드 포함(node 테스트 안전).
 */
const KEY = "tk.meta.gold";

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** 누적 자금 읽기. 비브라우저/파싱 실패 시 0. */
export function readMetaGold(): number {
  if (!hasStorage()) return 0;
  try {
    const raw = window.localStorage.getItem(KEY);
    const n = raw == null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** gold를 누적 저장하고 새 합계를 반환. 비브라우저면 현재 입력 합만 반환(영속 없음). */
export function addMetaGold(gold: number): number {
  const next = readMetaGold() + Math.max(0, Math.floor(gold));
  if (hasStorage()) {
    try {
      window.localStorage.setItem(KEY, String(next));
    } catch {
      // 저장 실패(쿼터/프라이빗 모드)는 무시 — 결산 연출은 계속
    }
  }
  return next;
}
