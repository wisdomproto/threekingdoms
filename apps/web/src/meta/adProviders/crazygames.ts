/**
 * CrazyGames SDK v3 어댑터 (§13 — docs.crazygames.com, 셀프서브 제출이라 첫 포털로 유력).
 *
 * 매핑: showRewarded → SDK.ad.requestAd("rewarded") 콜백(adFinished=완주 true / adError=false),
 *       showInterstitial → requestAd("midgame") — 성공/실패 무관 void(§13 무손실).
 * SDK는 콜백 스타일이라 Promise로 감싼다. adStarted에서 muteBegin(심사 요건).
 * 로컬 개발에서도 SDK가 'local' 환경으로 동작해 테스트 광고를 보여준다(제출 전 QA 가능).
 */
import type { AdPlacement, AdService } from "../adService";
import {
  DEFAULT_AD_TIMEOUT_MS,
  DEFAULT_SDK_TIMEOUT_MS,
  withTimeout,
  type PortalDeps,
} from "./loader";
import type { PortalLifecycle } from "./lifecycle";

/** 우리가 호출하는 CrazyGames SDK v3 표면(전체 아님). */
export interface CrazySdkLike {
  ad?: {
    requestAd(
      type: "midgame" | "rewarded",
      callbacks: {
        adStarted?: () => void;
        adFinished?: () => void;
        adError?: (e?: unknown) => void;
      },
    ): void;
  };
  game?: {
    gameplayStart?(): void;
    gameplayStop?(): void;
    loadingStart?(): void;
    loadingStop?(): void;
  };
}

export class CrazyGamesAdService implements AdService, PortalLifecycle {
  private sdkPromise: Promise<CrazySdkLike> | null = null;

  constructor(private readonly deps: PortalDeps<CrazySdkLike>) {}

  private sdk(): Promise<CrazySdkLike> {
    this.sdkPromise ??= this.deps.loadSdk();
    return withTimeout(
      this.sdkPromise,
      this.deps.sdkTimeoutMs ?? DEFAULT_SDK_TIMEOUT_MS,
      "crazygames sdk",
    );
  }

  /** 콜백 스타일 requestAd를 Promise<완주 여부>로 변환. ad 네임스페이스 부재 = 즉시 실패. */
  private requestAd(sdk: CrazySdkLike, type: "midgame" | "rewarded"): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      if (!sdk.ad?.requestAd) {
        reject(new Error("crazygames sdk: ad namespace missing"));
        return;
      }
      sdk.ad.requestAd(type, {
        adStarted: () => this.deps.muteBegin(),
        adFinished: () => resolve(true),
        adError: () => resolve(false), // 광고 없음/오류 = 미완주(무손실) — reject 아님
      });
    });
  }

  isAdFree(): boolean {
    return this.deps.adFree();
  }

  async showRewarded(_p: AdPlacement): Promise<boolean> {
    if (this.isAdFree()) return false;
    try {
      const sdk = await this.sdk();
      return await withTimeout(
        this.requestAd(sdk, "rewarded"),
        this.deps.adTimeoutMs ?? DEFAULT_AD_TIMEOUT_MS,
        "crazygames rewarded",
      );
    } catch {
      return false;
    } finally {
      this.deps.muteEnd();
    }
  }

  async showInterstitial(): Promise<void> {
    if (this.isAdFree()) return;
    try {
      const sdk = await this.sdk();
      await withTimeout(
        this.requestAd(sdk, "midgame"),
        this.deps.adTimeoutMs ?? DEFAULT_AD_TIMEOUT_MS,
        "crazygames interstitial",
      );
    } catch {
      // 조용한 통과(§13)
    } finally {
      this.deps.muteEnd();
    }
  }

  // ── PortalLifecycle ──
  boot(): void {
    void this.sdk().catch(() => {});
  }
  loadingFinished(): void {
    void this.sdk().then((s) => s.game?.loadingStop?.()).catch(() => {});
  }
  gameplayStart(): void {
    void this.sdk().then((s) => s.game?.gameplayStart?.()).catch(() => {});
  }
  gameplayStop(): void {
    void this.sdk().then((s) => s.game?.gameplayStop?.()).catch(() => {});
  }
}
