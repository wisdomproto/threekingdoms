/**
 * 포털 광고 어댑터 팩토리(§13 — 2026-07-02 포털 우선 전환의 실구현).
 *
 * 선택: NEXT_PUBLIC_AD_PROVIDER = stub(기본) | poki | crazygames | gd.
 *  - stub → null 반환(getAdService가 DevMock 폴백) — 자체 도메인/개발 = 지금과 동일.
 *  - 포털 → 해당 SDK 어댑터 생성 + lifecycle 라우터에 등록. 포털 규칙("그쪽 광고만")은
 *    빌드별 env로 자연 준수: 포털 제출 빌드에서만 그 SDK가 켜진다.
 * 실 SDK 로더(스크립트 주입·init)는 전부 여기 — 어댑터는 DOM 무의존(테스트 가능).
 *
 * 포털 빌드 예: NEXT_PUBLIC_AD_PROVIDER=crazygames pnpm --filter @tk/web build
 * GD는 NEXT_PUBLIC_GD_GAME_ID(콘솔에서 게임 등록 후 발급)도 필요.
 */
import type { AdService } from "../adService";
import { audio } from "../../audio/engine";
import { loadScriptOnce, type PortalDeps } from "./loader";
import { PokiAdService, type PokiSdkLike } from "./poki";
import { CrazyGamesAdService, type CrazySdkLike } from "./crazygames";
import { GdAdService, type GdBridgeLike } from "./gd";
import { __setActivePortalLifecycle, type PortalLifecycle } from "./lifecycle";

export { adLifecycle, __registerAdServiceEnsurer } from "./lifecycle";

export type AdProviderKind = "stub" | "poki" | "crazygames" | "gd";

/** env 문자열 → 공급자 종류(관용 파싱). 모르는 값은 stub — 오타가 광고를 켜면 안 된다. */
export function resolveProviderKind(raw: string | undefined): AdProviderKind {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "poki" || v === "crazygames" || v === "gd") return v;
  return "stub";
}

// ── 광고 중 게임 오디오 음소거(포털 심사 요건) — 중첩 안전 카운터 ──────────────
function makeAudioMuter(): { muteBegin(): void; muteEnd(): void } {
  let depth = 0;
  let wasMuted = false;
  return {
    muteBegin() {
      if (depth === 0) {
        wasMuted = audio.getSettings().muted;
        if (!wasMuted) audio.setSettings({ muted: true });
      }
      depth += 1;
    },
    muteEnd() {
      if (depth === 0) return; // begin 없이 end(실패 경로 finally) — no-op
      depth -= 1;
      if (depth === 0 && !wasMuted) audio.setSettings({ muted: false });
    },
  };
}

// ── 실 SDK 로더들(브라우저 전용 — SSR/노드에선 reject → 어댑터가 무손실 폴백) ──
const POKI_SRC = "https://game-cdn.poki.com/scripts/v2/poki-sdk.js";
const CRAZY_SRC = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
const GD_SRC = "https://html5.api.gamedistribution.com/main.min.js";

async function loadPokiSdk(): Promise<PokiSdkLike> {
  await loadScriptOnce(POKI_SRC);
  const w = window as unknown as { PokiSDK?: PokiSdkLike & { init?: () => Promise<void> } };
  const sdk = w.PokiSDK;
  if (!sdk) throw new Error("PokiSDK global missing");
  await sdk.init?.();
  return sdk;
}

async function loadCrazySdk(): Promise<CrazySdkLike> {
  await loadScriptOnce(CRAZY_SRC);
  const w = window as unknown as {
    CrazyGames?: { SDK?: CrazySdkLike & { init?: () => Promise<void> } };
  };
  const sdk = w.CrazyGames?.SDK;
  if (!sdk) throw new Error("CrazyGames SDK global missing");
  await sdk.init?.();
  return sdk;
}

async function loadGdBridge(): Promise<GdBridgeLike> {
  const gameId = process.env.NEXT_PUBLIC_GD_GAME_ID;
  if (!gameId) throw new Error("NEXT_PUBLIC_GD_GAME_ID missing (GD 콘솔에서 게임 등록 후 주입)");
  if (typeof window === "undefined") throw new Error("no DOM");
  // GD_OPTIONS는 스크립트 로드 *전에* 선언해야 한다. onEvent로 rewarded 완주 이벤트를 플래그로 캡처.
  let rewardedComplete = false;
  const w = window as unknown as {
    GD_OPTIONS?: unknown;
    gdsdk?: { showAd?: (type?: string) => Promise<unknown>; AdType?: Record<string, string> };
  };
  w.GD_OPTIONS = {
    gameId,
    onEvent: (event: { name?: string }) => {
      if (event?.name === "SDK_REWARDED_WATCH_COMPLETE") rewardedComplete = true;
    },
  };
  await loadScriptOnce(GD_SRC);
  const gdsdk = w.gdsdk;
  if (!gdsdk?.showAd) throw new Error("gdsdk global missing");
  return {
    async showAd(type) {
      const adType =
        type === "rewarded" ? (gdsdk.AdType?.Rewarded ?? "rewarded") : (gdsdk.AdType?.Interstitial ?? "interstitial");
      if (type === "rewarded") rewardedComplete = false; // 직전 플래그 리셋
      await gdsdk.showAd!(adType);
    },
    takeRewardedComplete() {
      const v = rewardedComplete;
      rewardedComplete = false;
      return v;
    },
  };
}

/**
 * 포털 어댑터 생성. stub이면 null(호출부가 DevMock 폴백).
 * 생성한 어댑터는 lifecycle 라우터에 등록된다(TitleScreen/BattleScreen 신호 배선).
 */
export function createPortalAdService(
  kind: AdProviderKind,
  adFree: () => boolean,
): (AdService & PortalLifecycle) | null {
  if (kind === "stub") return null;
  const muter = makeAudioMuter();
  const base = { adFree, muteBegin: muter.muteBegin, muteEnd: muter.muteEnd };
  const svc =
    kind === "poki"
      ? new PokiAdService({ ...base, loadSdk: loadPokiSdk } satisfies PortalDeps<PokiSdkLike>)
      : kind === "crazygames"
        ? new CrazyGamesAdService({ ...base, loadSdk: loadCrazySdk } satisfies PortalDeps<CrazySdkLike>)
        : new GdAdService({ ...base, loadSdk: loadGdBridge } satisfies PortalDeps<GdBridgeLike>);
  __setActivePortalLifecycle(svc);
  return svc;
}
