/**
 * Poki SDK 어댑터 (§13 포털 1티어 — developers.poki.com).
 *
 * 매핑: showRewarded → PokiSDK.rewardedBreak(완주 boolean 그대로),
 *       showInterstitial → PokiSDK.commercialBreak(결과 무관 void).
 * 심사 요건: 브레이크 동안 게임 오디오 음소거(onStart 콜백에서 muteBegin) +
 *  gameLoadingFinished/gameplayStart/gameplayStop 신호(어댑터 lifecycle — index가 배선).
 * SDK 문서: https://sdk.poki.com — API가 바뀌면 이 어댑터만 고친다(호출부 불변).
 */
import type { AdPlacement, AdService } from "../adService";
import {
  DEFAULT_AD_TIMEOUT_MS,
  DEFAULT_SDK_TIMEOUT_MS,
  withTimeout,
  type PortalDeps,
} from "./loader";
import type { PortalLifecycle } from "./lifecycle";

/** 우리가 호출하는 PokiSDK 표면(전체 아님) — 없어도 되는 건 전부 optional. */
export interface PokiSdkLike {
  rewardedBreak(onStart?: () => void): Promise<boolean>;
  commercialBreak(onStart?: () => void): Promise<void>;
  gameLoadingFinished?(): void;
  gameplayStart?(): void;
  gameplayStop?(): void;
}

export class PokiAdService implements AdService, PortalLifecycle {
  private sdkPromise: Promise<PokiSdkLike> | null = null;

  constructor(private readonly deps: PortalDeps<PokiSdkLike>) {}

  private sdk(): Promise<PokiSdkLike> {
    this.sdkPromise ??= this.deps.loadSdk();
    return withTimeout(
      this.sdkPromise,
      this.deps.sdkTimeoutMs ?? DEFAULT_SDK_TIMEOUT_MS,
      "poki sdk",
    );
  }

  isAdFree(): boolean {
    return this.deps.adFree();
  }

  async showRewarded(_p: AdPlacement): Promise<boolean> {
    if (this.isAdFree()) return false; // §13 — SDK 로드조차 안 함
    try {
      const sdk = await this.sdk();
      const done = await withTimeout(
        sdk.rewardedBreak(() => this.deps.muteBegin()),
        this.deps.adTimeoutMs ?? DEFAULT_AD_TIMEOUT_MS,
        "poki rewarded",
      );
      return done === true;
    } catch {
      return false; // 애드블록/무광고/타임아웃 → 보상만 없음(무손실)
    } finally {
      this.deps.muteEnd();
    }
  }

  async showInterstitial(): Promise<void> {
    if (this.isAdFree()) return;
    try {
      const sdk = await this.sdk();
      await withTimeout(
        sdk.commercialBreak(() => this.deps.muteBegin()),
        this.deps.adTimeoutMs ?? DEFAULT_AD_TIMEOUT_MS,
        "poki interstitial",
      );
    } catch {
      // 조용한 통과 — 전면은 결과 무관(§13 진행 인질 금지)
    } finally {
      this.deps.muteEnd();
    }
  }

  // ── PortalLifecycle — 실패는 전부 무시(신호는 보너스, 게임이 우선) ──
  boot(): void {
    void this.sdk().catch(() => {});
  }
  loadingFinished(): void {
    void this.sdk().then((s) => s.gameLoadingFinished?.()).catch(() => {});
  }
  gameplayStart(): void {
    void this.sdk().then((s) => s.gameplayStart?.()).catch(() => {});
  }
  gameplayStop(): void {
    void this.sdk().then((s) => s.gameplayStop?.()).catch(() => {});
  }
}
