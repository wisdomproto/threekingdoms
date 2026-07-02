/**
 * 포털 광고 어댑터(§13 — Poki/CrazyGames/GD) 단위테스트.
 * SDK는 가짜 객체 주입(PortalDeps.loadSdk) — 브라우저/실 SDK 없이 §13 가드레일을 검증:
 *  - adFree 단락(SDK 로드조차 안 함)
 *  - SDK 로드 실패/타임아웃 → rewarded=false·interstitial=조용히 통과(진행 무손실)
 *  - 광고 중 음소거 begin/end 짝 보장(실패 경로 포함)
 */
import { describe, it, expect, vi } from "vitest";
import { resolveProviderKind } from "../adProviders";
import { PokiAdService, type PokiSdkLike } from "../adProviders/poki";
import { CrazyGamesAdService, type CrazySdkLike } from "../adProviders/crazygames";
import { GdAdService, type GdBridgeLike } from "../adProviders/gd";

function muteSpy() {
  const calls: string[] = [];
  return {
    calls,
    muteBegin: () => calls.push("begin"),
    muteEnd: () => calls.push("end"),
  };
}

describe("resolveProviderKind", () => {
  it("미지정/모르는 값 → stub", () => {
    expect(resolveProviderKind(undefined)).toBe("stub");
    expect(resolveProviderKind("")).toBe("stub");
    expect(resolveProviderKind("banana")).toBe("stub");
  });
  it("poki/crazygames/gd 인식(공백·대문자 관용)", () => {
    expect(resolveProviderKind("poki")).toBe("poki");
    expect(resolveProviderKind(" CrazyGames ")).toBe("crazygames");
    expect(resolveProviderKind("GD")).toBe("gd");
  });
});

describe("PokiAdService", () => {
  const okSdk: PokiSdkLike = {
    rewardedBreak: async (onStart) => {
      onStart?.();
      return true;
    },
    commercialBreak: async (onStart) => {
      onStart?.();
    },
  };

  it("adFree면 SDK 로드 없이 즉시 false", async () => {
    const load = vi.fn(async () => okSdk);
    const m = muteSpy();
    const svc = new PokiAdService({ adFree: () => true, loadSdk: load, ...m });
    expect(await svc.showRewarded("shop_gold")).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("rewarded 완주 → true + 음소거 begin/end 짝", async () => {
    const m = muteSpy();
    const svc = new PokiAdService({ adFree: () => false, loadSdk: async () => okSdk, ...m });
    expect(await svc.showRewarded("result_double")).toBe(true);
    expect(m.calls).toEqual(["begin", "end"]);
  });

  it("rewarded 미완주(false) 그대로 전달", async () => {
    const sdk: PokiSdkLike = { ...okSdk, rewardedBreak: async () => false };
    const m = muteSpy();
    const svc = new PokiAdService({ adFree: () => false, loadSdk: async () => sdk, ...m });
    expect(await svc.showRewarded("qiyuan_extra")).toBe(false);
  });

  it("SDK 로드 실패 → rewarded false·interstitial 통과(무손실) + muteEnd 보장", async () => {
    const m = muteSpy();
    const svc = new PokiAdService({
      adFree: () => false,
      loadSdk: async () => {
        throw new Error("adblock");
      },
      ...m,
    });
    expect(await svc.showRewarded("merchant_restock")).toBe(false);
    await expect(svc.showInterstitial()).resolves.toBeUndefined();
    expect(m.calls.filter((c) => c === "end").length).toBe(2); // 실패 경로에도 end
  });

  it("SDK 로드 행(hang) → 타임아웃 후 false", async () => {
    vi.useFakeTimers();
    try {
      const m = muteSpy();
      const svc = new PokiAdService({
        adFree: () => false,
        loadSdk: () => new Promise<PokiSdkLike>(() => {}), // 영원히 pending
        sdkTimeoutMs: 1000,
        ...m,
      });
      const p = svc.showRewarded("shop_gold");
      await vi.advanceTimersByTimeAsync(1100);
      expect(await p).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("CrazyGamesAdService", () => {
  function sdkWith(outcome: "finished" | "error"): CrazySdkLike {
    return {
      ad: {
        requestAd: (_type, cb) => {
          cb.adStarted?.();
          if (outcome === "finished") cb.adFinished?.();
          else cb.adError?.(new Error("no fill"));
        },
      },
    };
  }

  it("rewarded adFinished → true", async () => {
    const m = muteSpy();
    const svc = new CrazyGamesAdService({ adFree: () => false, loadSdk: async () => sdkWith("finished"), ...m });
    expect(await svc.showRewarded("result_double")).toBe(true);
    expect(m.calls).toEqual(["begin", "end"]);
  });

  it("rewarded adError → false(무손실)", async () => {
    const m = muteSpy();
    const svc = new CrazyGamesAdService({ adFree: () => false, loadSdk: async () => sdkWith("error"), ...m });
    expect(await svc.showRewarded("shop_gold")).toBe(false);
  });

  it("interstitial은 성공/실패 무관 void 통과", async () => {
    const m = muteSpy();
    const ok = new CrazyGamesAdService({ adFree: () => false, loadSdk: async () => sdkWith("finished"), ...m });
    const bad = new CrazyGamesAdService({ adFree: () => false, loadSdk: async () => sdkWith("error"), ...m });
    await expect(ok.showInterstitial()).resolves.toBeUndefined();
    await expect(bad.showInterstitial()).resolves.toBeUndefined();
  });

  it("ad 네임스페이스 부재(SDK 파손) → rewarded false", async () => {
    const m = muteSpy();
    const svc = new CrazyGamesAdService({ adFree: () => false, loadSdk: async () => ({}) as CrazySdkLike, ...m });
    expect(await svc.showRewarded("qiyuan_extra")).toBe(false);
  });
});

describe("GdAdService", () => {
  it("rewarded 완주 이벤트 있으면 true, 없으면 false", async () => {
    const make = (complete: boolean): GdBridgeLike => ({
      showAd: async () => {},
      takeRewardedComplete: () => complete,
    });
    const m = muteSpy();
    const yes = new GdAdService({ adFree: () => false, loadSdk: async () => make(true), ...m });
    const no = new GdAdService({ adFree: () => false, loadSdk: async () => make(false), ...m });
    expect(await yes.showRewarded("result_double")).toBe(true);
    expect(await no.showRewarded("result_double")).toBe(false);
  });

  it("showAd 거부(광고 없음)여도 interstitial 통과·rewarded false", async () => {
    const bridge: GdBridgeLike = {
      showAd: async () => {
        throw new Error("no ad");
      },
      takeRewardedComplete: () => false,
    };
    const m = muteSpy();
    const svc = new GdAdService({ adFree: () => false, loadSdk: async () => bridge, ...m });
    expect(await svc.showRewarded("shop_gold")).toBe(false);
    await expect(svc.showInterstitial()).resolves.toBeUndefined();
  });
});
