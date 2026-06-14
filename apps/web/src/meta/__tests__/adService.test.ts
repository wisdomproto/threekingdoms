/**
 * AdService DevMock 단위테스트(env=node — AdHost 없음).
 * UI 없이 모듈 큐를 직접 구동: 광고 요청을 가로채(__subscribeAdRequests) resolveActive로
 * 완주/취소를 시뮬레이션한다. adFree 분기는 UI 없이 즉시 판정되는지 확인.
 */
import { describe, it, expect } from "vitest";
import {
  DevMockAdService,
  __subscribeAdRequests,
  __getActiveAdRequest,
  resolveActive,
  type AdRequest,
} from "../adService";

/** 다음 광고 요청이 큐에 올라오면 완주/취소로 자동 종료(테스트 헬퍼 = AdHost 대역). */
function autoResolveNext(completed: boolean): () => void {
  const unsub = __subscribeAdRequests((req: AdRequest | null) => {
    if (req) {
      // 마이크로태스크 뒤에 종료 — Promise가 활성화될 시간 부여.
      queueMicrotask(() => resolveActive(completed));
    }
  });
  return unsub;
}

describe("DevMockAdService.showRewarded", () => {
  it("adFree면 UI 없이 즉시 false(광고 요청 미생성)", async () => {
    const svc = new DevMockAdService(() => true);
    expect(svc.isAdFree()).toBe(true);
    const result = await svc.showRewarded("shop_gold");
    expect(result).toBe(false);
    expect(__getActiveAdRequest()).toBeNull(); // 모달 안 띄움
  });

  it("완주(resolveActive true)면 true", async () => {
    const svc = new DevMockAdService(() => false);
    const stop = autoResolveNext(true);
    const result = await svc.showRewarded("result_double");
    stop();
    expect(result).toBe(true);
  });

  it("취소(resolveActive false)면 false — 무손실", async () => {
    const svc = new DevMockAdService(() => false);
    const stop = autoResolveNext(false);
    const result = await svc.showRewarded("qiyuan_extra");
    stop();
    expect(result).toBe(false);
  });

  it("요청 시 rewarded AdRequest가 큐에 올라온다", async () => {
    const svc = new DevMockAdService(() => false);
    const seen: AdRequest[] = [];
    const unsub = __subscribeAdRequests((req) => {
      if (req) {
        seen.push(req);
        queueMicrotask(() => resolveActive(true));
      }
    });
    await svc.showRewarded("merchant_restock");
    unsub();
    expect(seen[0]).toMatchObject({ kind: "rewarded", placement: "merchant_restock" });
    expect(seen[0]!.durationSec).toBeGreaterThan(0);
  });
});

describe("DevMockAdService.showInterstitial", () => {
  it("adFree면 즉시 resolve(요청 미생성)", async () => {
    const svc = new DevMockAdService(() => true);
    await svc.showInterstitial();
    expect(__getActiveAdRequest()).toBeNull();
  });

  it("interstitial 요청이 큐에 올라오고 종료 시 void resolve", async () => {
    const svc = new DevMockAdService(() => false);
    let kind: string | undefined;
    const unsub = __subscribeAdRequests((req) => {
      if (req) {
        kind = req.kind;
        queueMicrotask(() => resolveActive(true));
      }
    });
    await expect(svc.showInterstitial()).resolves.toBeUndefined();
    unsub();
    expect(kind).toBe("interstitial");
  });
});

describe("resolveActive 안전성", () => {
  it("활성 요청 없을 때 호출해도 no-op", () => {
    expect(() => resolveActive(true)).not.toThrow();
    expect(__getActiveAdRequest()).toBeNull();
  });
});
