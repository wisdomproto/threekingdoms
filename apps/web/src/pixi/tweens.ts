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

export class TweenRunner {
  private readonly ticker: Ticker;
  private active: ActiveTween[] = [];
  /** 배속 — 모든 트윈(이동/공격/배너/팝업) 진행을 일괄 가속. 1=기본 */
  private timeScale = 1;
  private readonly tick = (ticker: Ticker): void => {
    if (this.active.length === 0) return;
    const dt = ticker.deltaMS * this.timeScale;
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
    const remaining = this.active;
    this.active = [];
    for (const tw of remaining) {
      tw.onUpdate(1);
      tw.resolve();
    }
  }
}
