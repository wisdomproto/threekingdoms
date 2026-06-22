/**
 * 오디오 설정 (기기 로컬 — 세이브와 분리).
 *
 * 음량/뮤트는 *기기 환경설정*이지 게임 진행이 아니므로 metaStore(`tk.meta.v1`,
 * 내보내기/불러오기 대상)와 별도 키 `tk.audio.v1`에 둔다. 세이브를 다른 기기로 옮겨도
 * 그 기기의 음량이 따라오지 않게 하기 위함.
 *
 * 순수 헬퍼(clamp/normalize)와 영속(localStorage)을 분리 — 순수부는 node 단위테스트 대상.
 */

/** 음량(0..1) 3버스 + 전체 뮤트. effectiveSfx = master*sfx, effectiveBgm = master*bgm (muted면 0). */
export interface AudioSettings {
  /** 마스터 음량 0..1 (모든 버스 공통 배수). */
  master: number;
  /** BGM 버스 음량 0..1. */
  bgm: number;
  /** 효과음 버스 음량 0..1. */
  sfx: number;
  /** 전체 뮤트(음량값은 보존, 마스터 게인만 0). */
  muted: boolean;
}

/** 기본값 — BGM은 분위기라 낮게, SFX는 또렷하게. */
export const DEFAULT_SETTINGS: AudioSettings = {
  master: 0.7,
  bgm: 0.45,
  sfx: 0.85,
  muted: false,
};

const STORAGE_KEY = "tk.audio.v1";

/** 0..1로 클램프. NaN/비유한은 기본값으로 폴백하지 않고 0 처리(호출부 normalize가 채움). */
export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** 부분 객체(구버전/손상 포함)를 완전한 AudioSettings로 정규화. */
export function normalizeSettings(partial: Partial<AudioSettings> | null | undefined): AudioSettings {
  const p = partial ?? {};
  return {
    master: typeof p.master === "number" ? clampVolume(p.master) : DEFAULT_SETTINGS.master,
    bgm: typeof p.bgm === "number" ? clampVolume(p.bgm) : DEFAULT_SETTINGS.bgm,
    sfx: typeof p.sfx === "number" ? clampVolume(p.sfx) : DEFAULT_SETTINGS.sfx,
    muted: p.muted === true,
  };
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** 저장된 설정 로드(없거나 비브라우저/손상 시 기본값). */
export function loadAudioSettings(): AudioSettings {
  if (!hasStorage()) return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw) as Partial<AudioSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 설정 저장(비브라우저/쿼터초과는 무시). */
export function saveAudioSettings(s: AudioSettings): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // 무시 — 인메모리 상태로 세션 유지.
  }
}
