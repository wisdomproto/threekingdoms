/**
 * 조작 설정 (기기 로컬 — 세이브와 분리, audio/settings.ts와 동형).
 * `attackConfirm`=true(입문): 공격 대상 탭 → VS 카드 확인 후 커밋. false(클래식): 즉시 커밋(원작).
 * 키 `tk.controls.v1`. 순수부(normalize)는 node 단위테스트 대상.
 */

export interface ControlSettings {
  /** 입문 공격 확인 — 공격 대상 탭 시 confirmAttack 상태를 거친다 */
  attackConfirm: boolean;
}

export const DEFAULT_CONTROLS: ControlSettings = { attackConfirm: true };

const STORAGE_KEY = "tk.controls.v1";

/** 부분 객체(구버전/손상 포함)를 완전한 ControlSettings로 정규화. */
export function normalizeControls(partial: Partial<ControlSettings> | null | undefined): ControlSettings {
  const p = partial ?? {};
  return {
    attackConfirm: typeof p.attackConfirm === "boolean" ? p.attackConfirm : DEFAULT_CONTROLS.attackConfirm,
  };
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** 저장된 설정 로드(없거나 비브라우저/손상 시 기본값). */
export function loadControls(): ControlSettings {
  if (!hasStorage()) return { ...DEFAULT_CONTROLS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return { ...DEFAULT_CONTROLS };
    return normalizeControls(JSON.parse(raw) as Partial<ControlSettings>);
  } catch {
    return { ...DEFAULT_CONTROLS };
  }
}

/** 설정 저장(비브라우저/쿼터초과는 무시). */
export function saveControls(s: ControlSettings): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // 무시
  }
}
