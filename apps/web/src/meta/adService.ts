/**
 * AdService — 광고 공유 배관 (CLAUDE.md §13 "절제형" 광고 모델).
 *
 * 설계 가드레일(§13 불가침선 — 코드로 명시):
 *  - 리워드 보상은 **골드/표현만**. 이 모듈은 보상을 직접 지급하지 않는다 — showRewarded는
 *    "광고를 끝까지 봤는가(boolean)"만 반환하고, *무엇을 줄지는 호출부가 결정*한다.
 *    호출부는 전투력 랜덤/우위를 주면 안 된다(골드→확정 장비만, 밸런스 시뮬 유지).
 *  - **진행 인질 금지**: showRewarded를 거부(false)해도 게임 진행은 무손실이어야 한다.
 *    이 인터페이스는 진행을 막는 어떤 신호도 내보내지 않는다(false = "보상 없음"일 뿐).
 *  - adFree(통구매/광고제거 IAP)면 showRewarded는 즉시 false, showInterstitial은 즉시 resolve.
 *    → adFree 유저에게 광고 UI를 절대 띄우지 않는다.
 *
 * 동작 분리(테스트 가능성):
 *  - 이 모듈은 React/DOM에 의존하지 않는다. UI는 **모듈 레벨 이벤트 큐**로 분리되어,
 *    React <AdHost/>(AdHost.tsx)가 구독해 가짜 광고 모달/전면을 그린다. showRewarded가 반환하는
 *    Promise는 AdHost가 "완주/취소"를 보고할 때(resolveActive) resolve 된다.
 *  - 테스트(env=node, AdHost 없음)는 emit된 요청을 가로채 resolveActive로 직접 완주/취소를
 *    구동한다(아래 __subscribeAdRequests/resolveActive 공개). adFree 분기는 UI 없이 즉시 판정.
 *
 * 다음 단계(적용처 에이전트)는 getAdService()와 컴포넌트(AdHost/RewardedAdButton)만 import.
 */

/** 리워드 4곳(§13) + 전면 1종. 적용처는 이 리터럴만 넘긴다. */
export type AdPlacement =
  | "result_double" // 결산 보상 2배 (§12 카지노 결산 끝)
  | "shop_gold" // 상점 골드 충전 (소액·일일 캡 — §13)
  | "qiyuan_extra" // 기연 뽑기 +1회
  | "merchant_restock" // 떠돌이 상인 재입고
  | "interstitial"; // 전면(로딩) — 막간 카드 번들. showInterstitial 전용 식별자.

export interface AdService {
  /** 광고제거(adFree) 상태. true면 showRewarded는 false, showInterstitial은 즉시 resolve. */
  isAdFree(): boolean;
  /**
   * 리워드 광고 요청. 끝까지 보면 true(→호출부가 보상 지급), 닫으면 false(→무손실).
   * adFree면 UI 없이 즉시 false. p는 표시/분석용 placement(보상은 호출부 책임).
   */
  showRewarded(p: AdPlacement): Promise<boolean>;
  /** 전면(로딩) 광고. 완료/스킵/ adFree 모두 void로 resolve(진행을 막지 않음). */
  showInterstitial(): Promise<void>;
}

// ---------------------------------------------------------------------------
// 모듈 레벨 광고 요청 큐 — UI(AdHost)와 서비스 사이의 단일 채널.
// React/DOM 무의존(테스트도 이 채널을 구독).
// ---------------------------------------------------------------------------

/** AdHost가 렌더할 활성 광고 요청 1건. */
export interface AdRequest {
  /** 모달 종류 — rewarded는 카운트다운+건너뛰기, interstitial은 짧은 전면. */
  kind: "rewarded" | "interstitial";
  placement: AdPlacement;
  /** rewarded: 완주까지 막아둘 카운트다운 초. interstitial: 전면 노출 초. */
  durationSec: number;
}

type AdRequestListener = (req: AdRequest | null) => void;

let activeRequest: AdRequest | null = null;
const requestListeners = new Set<AdRequestListener>();
/** 현재 활성 요청의 resolver — UI(또는 테스트)가 완주/취소를 보고하면 호출. */
let activeResolve: ((completed: boolean) => void) | null = null;

function emitActive(): void {
  for (const l of requestListeners) l(activeRequest);
}

/**
 * 광고 요청 구독(AdHost.tsx 전용 + 테스트). 구독 즉시 현재 활성 요청을 1회 전달한다.
 * 반환 = 해지 함수.
 */
export function __subscribeAdRequests(listener: AdRequestListener): () => void {
  requestListeners.add(listener);
  listener(activeRequest); // 마운트 시점에 진행 중 요청이 있으면 즉시 그린다
  return () => {
    requestListeners.delete(listener);
  };
}

/** 현재 활성 요청 스냅샷(AdHost 초기 상태용). */
export function __getActiveAdRequest(): AdRequest | null {
  return activeRequest;
}

/**
 * 활성 광고를 완주(completed=true)/취소(false)로 종료한다.
 * AdHost가 카운트다운 끝→완주, 건너뛰기/닫기→취소로 호출. 테스트도 직접 구동.
 * 활성 요청이 없으면 no-op(중복 호출 안전).
 */
export function resolveActive(completed: boolean): void {
  const resolve = activeResolve;
  activeRequest = null;
  activeResolve = null;
  emitActive(); // UI에 "닫힘" 통지
  if (resolve) resolve(completed);
}

/** 새 광고 요청을 활성화하고, 종료 시 completed로 resolve되는 Promise를 만든다. */
function openRequest(req: AdRequest): Promise<boolean> {
  // 이미 진행 중이면 기존 것을 취소(false)로 닫고 새 요청을 올린다(겹침 방지).
  if (activeResolve) resolveActive(false);
  return new Promise<boolean>((resolve) => {
    activeRequest = req;
    activeResolve = resolve;
    emitActive();
  });
}

// ---------------------------------------------------------------------------
// DevMock — 실제 SDK 전까지 "진짜로 동작"하는 가짜 광고. adFree는 외부 공급자로 주입.
// ---------------------------------------------------------------------------

/** rewarded 카운트다운(초) — 건너뛰기는 끝나야 활성(§13 "절제"보다 데모 체감용 짧게). */
export const DEV_REWARDED_SEC = 4;
/** interstitial 노출(초) — 스킵 가능. */
export const DEV_INTERSTITIAL_SEC = 3;

export class DevMockAdService implements AdService {
  /** adFree 판정 주입(metaStore.isAdFree). 기본 false. */
  constructor(private readonly adFreeFn: () => boolean = () => false) {}

  isAdFree(): boolean {
    return this.adFreeFn();
  }

  async showRewarded(p: AdPlacement): Promise<boolean> {
    // 가드레일: adFree면 UI 없이 즉시 false(광고 안 띄움). 호출부는 보상 미지급 → 무손실.
    if (this.isAdFree()) return false;
    return openRequest({ kind: "rewarded", placement: p, durationSec: DEV_REWARDED_SEC });
  }

  async showInterstitial(): Promise<void> {
    if (this.isAdFree()) return; // 즉시 resolve(진행 막지 않음)
    await openRequest({
      kind: "interstitial",
      placement: "interstitial",
      durationSec: DEV_INTERSTITIAL_SEC,
    });
    // interstitial은 결과(완주/스킵) 무관 — 항상 void.
  }
}

// ---------------------------------------------------------------------------
// 싱글톤 — 적용처는 getAdService()만 사용.
// ---------------------------------------------------------------------------

let singleton: AdService | null = null;

/**
 * 공유 AdService 싱글톤. adFree 판정은 metaStore.isAdFree로 지연 주입(순환 import 회피 위해
 * 동적 require 대신 함수 클로저로 연결). 테스트는 setAdService로 교체 가능.
 */
export function getAdService(): AdService {
  if (singleton) return singleton;
  // 지연 import: metaStore → adService 역참조가 없으므로 정적 import도 안전하지만,
  // 배관 독립성을 위해 함수 주입만 사용한다.
  singleton = new DevMockAdService(() => {
    // metaStore.isAdFree를 런타임에 읽는다(adFree 토글이 즉시 반영되도록).
    return getAdFreeProvider()();
  });
  return singleton;
}

/** 테스트/대체 구현 주입(예: 실제 SDK 어댑터). null로 초기화도 가능. */
export function setAdService(impl: AdService | null): void {
  singleton = impl;
}

// adFree 공급자 — metaStore가 등록(순환 의존 없이 느슨 결합). 미등록 시 항상 false.
let adFreeProvider: () => boolean = () => false;

/** metaStore(또는 테스트)가 adFree 판정 함수를 등록. */
export function registerAdFreeProvider(fn: () => boolean): void {
  adFreeProvider = fn;
}

function getAdFreeProvider(): () => boolean {
  return adFreeProvider;
}
