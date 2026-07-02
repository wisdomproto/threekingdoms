/**
 * 포털 광고 어댑터 공용 배관(§13) — SDK 스크립트 로더 + 타임아웃 가드 + 주입 의존성 타입.
 *
 * 가드레일: 광고는 어떤 경우에도 진행을 막으면 안 된다(§13 무손실). 그래서
 *  - SDK 로드/광고 재생 전부 타임아웃으로 감싸고,
 *  - 어댑터는 실패를 "보상 없음(false)/조용한 통과(void)"로만 번역한다(throw 금지).
 * 어댑터는 DOM 무의존(loadSdk 주입) — node 테스트 가능. 실제 스크립트 로더는 여기(브라우저 전용).
 */

/** 어댑터 주입 의존성 — 테스트는 가짜 loadSdk/뮤트로 구동. */
export interface PortalDeps<TSdk> {
  /** 광고제거(IAP) 판정 — true면 SDK 로드조차 하지 않는다(§13). */
  adFree(): boolean;
  /** SDK 로드+초기화(1회 결과를 어댑터가 캐시). 실패는 reject. */
  loadSdk(): Promise<TSdk>;
  /** 광고 재생 시작/종료 시 게임 오디오 음소거 훅(포털 심사 요건). */
  muteBegin(): void;
  muteEnd(): void;
  /** SDK 로드 대기 상한(ms). 기본 12초 — 애드블록/네트워크 행 방지. */
  sdkTimeoutMs?: number;
  /** 광고 재생 대기 상한(ms). 기본 120초 — 리워드 영상 길이 여유 + 행 방지. */
  adTimeoutMs?: number;
}

export const DEFAULT_SDK_TIMEOUT_MS = 12_000;
export const DEFAULT_AD_TIMEOUT_MS = 120_000;

/** p가 ms 안에 안 끝나면 reject — 광고 배관의 모든 await에 씌운다. */
export function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${tag} timeout ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

// ── 실제 스크립트 로더(브라우저 전용) ─────────────────────────────────────────
const scriptPromises = new Map<string, Promise<void>>();

/** 같은 src는 1회만 삽입(중복 호출 안전). SSR/노드에서는 즉시 reject. */
export function loadScriptOnce(src: string): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("no DOM (SSR/node)"));
  }
  const cached = scriptPromises.get(src);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromises.delete(src); // 실패는 캐시하지 않는다(재시도 허용)
      reject(new Error(`script load failed: ${src}`));
    };
    document.head.appendChild(el);
  });
  scriptPromises.set(src, p);
  return p;
}
