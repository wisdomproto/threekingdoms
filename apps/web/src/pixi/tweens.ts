/**
 * 공유 Ticker 기반 미니 트윈 러너 — UnitView/FxLayer/CameraController의 연출 Promise 공급원.
 * 외부 트윈 라이브러리 없이 deltaMS 누적만으로 동작. destroy 시 진행 중 트윈을
 * 전부 완료 상태(t=1)로 결속해 Promise를 resolve — EventPlayer 큐가 영원히 매달리는 것을 방지.
 */
import type { Ticker } from "pixi.js";

interface ActiveTween {
  elapsed: number;
  duration: number;
  onUpdate: (t: number) => void;
  resolve: () => void;
}

/** ease-in-out (부드러운 가감속) */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** ease-out (감속만) — 빠르게 튀어나가 부드럽게 멈춤 (피격 넉백·플래시 페이드) */
export function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * ease-out-back — 목표를 살짝 넘어섰다(overshoot) 돌아오는 탄성 곡선.
 * lunge 전진·복귀의 "찰진" 타격감용. s가 클수록 오버슈트 폭이 커진다.
 */
export function easeOutBack(t: number, s = 1.7): number {
  const c1 = s;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

export class TweenRunner {
  private readonly ticker: Ticker;
  private active: ActiveTween[] = [];
  /** 배속 — 모든 트윈(이동/공격/배너/팝업) 진행을 일괄 가속. 1=기본 */
  private timeScale = 1;
  /** 히트스톱 잔여(ms, scaled). >0이면 이번 프레임 트윈 진행을 멈추고 이 시간을 소모한다. */
  private holdMs = 0;
  private readonly tick = (ticker: Ticker): void => {
    let dt = ticker.deltaMS * this.timeScale;
    // 히트스톱: 모든 진행 중 트윈을 freeze하고 hold를 소진 (배속 존중 — scaled dt로 차감).
    if (this.holdMs > 0) {
      this.holdMs -= dt;
      if (this.holdMs > 0) return; // 아직 정지 중 — 트윈 미진행
      dt = -this.holdMs; // 정지 종료, 남은 dt만큼 이번 프레임 진행
      this.holdMs = 0;
    }
    if (this.active.length === 0) return;
    const still: ActiveTween[] = [];
    for (const tw of this.active) {
      tw.elapsed += dt;
      const t = tw.duration <= 0 ? 1 : Math.min(1, tw.elapsed / tw.duration);
      tw.onUpdate(t);
      if (t >= 1) tw.resolve();
      else still.push(tw);
    }
    this.active = still;
  };

  constructor(ticker: Ticker) {
    this.ticker = ticker;
    ticker.add(this.tick);
  }

  /** 배속 설정 — 진행 중·이후 트윈에 즉시 반영 (1=기본, 2·3 등) */
  setTimeScale(scale: number): void {
    this.timeScale = scale > 0 ? scale : 1;
  }

  /**
   * 히트스톱 (§4 타격 주스) — durationMs(논스케일) 동안 모든 진행 중 트윈을 freeze.
   * 묵직한 임팩트용. 내부적으로 timeScale을 곱해 소진하므로 배속 시 실제 정지도 짧아진다.
   * 중첩 호출은 더 긴 쪽으로 갱신(연속 타격이 서로 잡아먹지 않게).
   */
  hitstop(durationMs: number): void {
    const scaled = durationMs * this.timeScale;
    if (scaled > this.holdMs) this.holdMs = scaled;
  }

  /**
   * 히트스톱/연출 정지용 대기. TweenRunner 경유라 배속(timeScale)을 존중한다 —
   * 2배속이면 실제 정지 시간도 절반. destroy 시 즉시 resolve.
   */
  delay(durationMs: number): Promise<void> {
    return this.run(durationMs, () => {});
  }

  /** onUpdate(t)는 0..1 선형 진행률로 호출 (이징은 호출측에서 적용). t=1 보장 후 resolve */
  run(durationMs: number, onUpdate: (t: number) => void): Promise<void> {
    if (durationMs <= 0) {
      onUpdate(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.active.push({ elapsed: 0, duration: durationMs, onUpdate, resolve });
    });
  }

  destroy(): void {
    this.ticker.remove(this.tick);
    this.holdMs = 0;
    const remaining = this.active;
    this.active = [];
    for (const tw of remaining) {
      tw.onUpdate(1);
      tw.resolve();
    }
  }
}
