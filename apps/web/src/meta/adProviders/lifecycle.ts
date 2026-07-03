/**
 * 포털 라이프사이클 신호 라우터(§13) — 포털 심사가 요구하는 게임 상태 신호를
 * 활성 어댑터로 전달한다. stub(자체 도메인/개발)에선 전부 no-op.
 *
 * 호출부(순수 표현 — 게임 로직 무관):
 *  - loadingFinished: 타이틀 첫 마운트(게임 상호작용 가능 시점). 1회만 전달.
 *  - gameplayStart/Stop: 전투 진입/이탈(BattleScreen). 중복 호출은 여기서 dedupe.
 * 신호 실패는 게임에 영향 없음(어댑터가 전부 삼킴).
 */

export interface PortalLifecycle {
  /** SDK 프리로드 킥(레이아웃 마운트 시 1회 — 첫 광고 지연 감소). */
  boot(): void;
  /** 게임 로딩 완료(포털 로딩 지표). */
  loadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** 기쁜 순간(전투 승리 등) — 포털 참여 지표/광고 타이밍 힌트. CrazyGames/Poki 지원, GD no-op. */
  happytime(): void;
}

let active: PortalLifecycle | null = null;
/** adService 쪽이 등록하는 "서비스 생성 보장" 훅 — 신호가 서비스 생성보다 먼저 와도 안전. */
let ensureService: (() => void) | null = null;

let loadingReported = false;
let playing = false;

/** 팩토리(index.ts)가 포털 어댑터 생성 시 등록. stub이면 호출 안 됨(null 유지). */
export function __setActivePortalLifecycle(l: PortalLifecycle | null): void {
  active = l;
}

/** adService가 등록 — adLifecycle.* 첫 호출 시 getAdService()를 보장(모듈 순환 회피용 콜백). */
export function __registerAdServiceEnsurer(fn: () => void): void {
  ensureService = fn;
}

export const adLifecycle = {
  boot(): void {
    ensureService?.();
    active?.boot();
  },
  loadingFinished(): void {
    ensureService?.();
    if (loadingReported) return; // 포털엔 1회만(라우트 재방문 무시)
    loadingReported = true;
    active?.loadingFinished();
  },
  gameplayStart(): void {
    ensureService?.();
    if (playing) return;
    playing = true;
    active?.gameplayStart();
  },
  gameplayStop(): void {
    if (!playing) return; // start 없이 stop 금지(포털 짝 요건)
    playing = false;
    active?.gameplayStop();
  },
  happytime(): void {
    ensureService?.();
    active?.happytime(); // 기쁜 순간 펄스 — dedupe 없음(승리마다 1회)
  },
};
