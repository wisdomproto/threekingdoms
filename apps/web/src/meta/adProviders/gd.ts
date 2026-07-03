/**
 * GameDistribution 어댑터 (§13 — 진입 최저·Azerion 포털망 배포).
 *
 * GD는 window.GD_OPTIONS(gameId + onEvent) 선언 후 스크립트를 로드하는 방식이고,
 * rewarded "완주"는 showAd의 resolve가 아니라 SDK_REWARDED_WATCH_COMPLETE 이벤트로 온다.
 * 그 이벤트 배관을 GdBridgeLike로 감싸 어댑터는 순수하게 둔다(테스트 주입 가능):
 *  - showAd(type): 광고 플로우가 끝나면 resolve(광고 없음 등은 reject).
 *  - takeRewardedComplete(): 직전 rewarded의 완주 이벤트 수신 여부(소진성 — 읽으면 리셋).
 * ⚠️ gameId(NEXT_PUBLIC_GD_GAME_ID) 없으면 로더가 reject → 전부 무손실 폴백.
 *    실 제출 시 GD 콘솔에서 게임 등록 후 gameId를 env로 주입(§15 출시 게이트 준비물).
 */
import type { AdPlacement, AdService } from "../adService";
import {
  DEFAULT_AD_TIMEOUT_MS,
  DEFAULT_SDK_TIMEOUT_MS,
  withTimeout,
  type PortalDeps,
} from "./loader";
import type { PortalLifecycle } from "./lifecycle";

/** GD SDK 이벤트 배관을 감싼 브리지 표면 — index.ts의 실 구현이 GD_OPTIONS.onEvent를 캡처. */
export interface GdBridgeLike {
  showAd(type: "interstitial" | "rewarded"): Promise<void>;
  takeRewardedComplete(): boolean;
}

export class GdAdService implements AdService, PortalLifecycle {
  private bridgePromise: Promise<GdBridgeLike> | null = null;

  constructor(private readonly deps: PortalDeps<GdBridgeLike>) {}

  private bridge(): Promise<GdBridgeLike> {
    this.bridgePromise ??= this.deps.loadSdk();
    return withTimeout(
      this.bridgePromise,
      this.deps.sdkTimeoutMs ?? DEFAULT_SDK_TIMEOUT_MS,
      "gd sdk",
    );
  }

  isAdFree(): boolean {
    return this.deps.adFree();
  }

  async showRewarded(_p: AdPlacement): Promise<boolean> {
    if (this.isAdFree()) return false;
    try {
      const bridge = await this.bridge();
      this.deps.muteBegin();
      await withTimeout(
        bridge.showAd("rewarded"),
        this.deps.adTimeoutMs ?? DEFAULT_AD_TIMEOUT_MS,
        "gd rewarded",
      );
      // 완주 판정은 SDK_REWARDED_WATCH_COMPLETE 이벤트(브리지가 플래그로 보관).
      return bridge.takeRewardedComplete();
    } catch {
      return false;
    } finally {
      this.deps.muteEnd();
    }
  }

  async showInterstitial(): Promise<void> {
    if (this.isAdFree()) return;
    try {
      const bridge = await this.bridge();
      this.deps.muteBegin();
      await withTimeout(
        bridge.showAd("interstitial"),
        this.deps.adTimeoutMs ?? DEFAULT_AD_TIMEOUT_MS,
        "gd interstitial",
      );
    } catch {
      // 조용한 통과(§13)
    } finally {
      this.deps.muteEnd();
    }
  }

  // ── PortalLifecycle — GD는 명시 신호 API가 없어 boot(프리로드)만 의미 있음 ──
  boot(): void {
    void this.bridge().catch(() => {});
  }
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  happytime(): void {} // GD 대응 API 없음
}
