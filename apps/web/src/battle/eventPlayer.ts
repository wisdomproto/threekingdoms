/**
 * EventPlayer (설계 §2.1) — BattleEvent[] 직렬 큐 소비기.
 * 이벤트 1개 → Presenter 메서드 1개(Promise) 매핑. 재정렬/병합/스킵 금지 — 배속은 Presenter가
 * duration만 단축한다.
 *
 * 드레인 시퀀스: ① 화면 투영 스냅샷 캡처(sync 이전) ② presenter.sync(committed)
 * ③ dev 단언 — 캡처한 스냅샷 ≡ committed (sync가 드리프트를 "덮어서" 버그를 숨기는 것 방지)
 * ④ onDrained(store가 settled 갱신 + drained 디스패치) ⑤ enqueue 대기 Promise resolve.
 *
 * dev 계약 2종:
 * - battleEnded는 항상 큐의 마지막 — 배치 중간의 battleEnded, 종료 후 추가 enqueue는 위반.
 * - 드레인 시 presenter 투영 상태(좌표/troops/retreated/phase)가 committed와 일치해야 한다.
 */
import type { Side } from "@tk/data";
import type { BattleEvent, BattleState } from "@tk/engine";

type Ev<T extends BattleEvent["type"]> = Extract<BattleEvent, { type: T }>;

export interface PresentedUnit {
  id: string;
  x: number;
  y: number;
  troops: number;
  retreated: boolean;
}

export interface PresentedSnapshot {
  phase: Side;
  units: PresentedUnit[];
}

export interface Presenter {
  unitMoved(e: Ev<"unitMoved">): Promise<void>;
  damageDealt(e: Ev<"damageDealt">): Promise<void>;
  strategyCast(e: Ev<"strategyCast">): Promise<void>;
  /** 도구 사용 피드백 — 미구현(옵셔널)이면 default로 흘러도 무방(W1). */
  itemUsed?(e: Ev<"itemUsed">): Promise<void>;
  unitRetreated(e: Ev<"unitRetreated">): Promise<void>;
  duelTriggered(e: Ev<"duelTriggered">): Promise<void>;
  phaseChanged(e: Ev<"phaseChanged">): Promise<void>;
  battleEnded(e: Ev<"battleEnded">): Promise<void>;
  /** 드레인 시 committed로 강제 정합 — 연출 결과가 어긋났어도 진실로 덮는다 */
  sync(state: BattleState): void;
  /** dev 단언용 화면 투영 상태. 미구현/null이면 단언 생략 */
  snapshot?(): PresentedSnapshot | null;
}

export interface EventPlayerOptions {
  presenter: Presenter;
  getCommitted: () => BattleState;
  onDrained: () => void;
  /** dev 단언 활성화 (기본 false) */
  dev?: boolean;
  /** dev 위반 핸들러 — 기본은 throw */
  onDevViolation?: (message: string) => void;
}

function diffSnapshot(snap: PresentedSnapshot, committed: BattleState): string | null {
  if (snap.phase !== committed.phase) {
    return `phase 불일치: presented=${snap.phase} committed=${committed.phase}`;
  }
  const byId = new Map(snap.units.map((u) => [u.id, u]));
  for (const u of committed.units) {
    const p = byId.get(u.id);
    if (!p) return `유닛 ${u.id} 투영 누락`;
    if (p.x !== u.x || p.y !== u.y) {
      return `유닛 ${u.id} 좌표 불일치: presented=(${p.x},${p.y}) committed=(${u.x},${u.y})`;
    }
    if (p.troops !== u.troops) {
      return `유닛 ${u.id} troops 불일치: presented=${p.troops} committed=${u.troops}`;
    }
    if (p.retreated !== u.retreated) {
      return `유닛 ${u.id} retreated 불일치: presented=${p.retreated} committed=${u.retreated}`;
    }
  }
  return null;
}

export class EventPlayer {
  private readonly opts: EventPlayerOptions;
  private queue: BattleEvent[] = [];
  private pumping = false;
  private waiters: Array<() => void> = [];
  private ended = false;

  constructor(opts: EventPlayerOptions) {
    this.opts = opts;
  }

  get playing(): boolean {
    return this.pumping;
  }

  /** 이벤트 배치 투입. 반환 Promise는 큐가 완전히 드레인될 때 resolve */
  enqueue(events: readonly BattleEvent[]): Promise<void> {
    if (this.opts.dev) {
      if (this.ended && events.length > 0) {
        this.violate("battleEnded 이후 enqueue 금지 — 최후 재생 계약 위반");
      }
      const endIdx = events.findIndex((e) => e.type === "battleEnded");
      if (endIdx >= 0 && endIdx !== events.length - 1) {
        this.violate(`battleEnded가 배치 마지막이 아님 (index ${endIdx}/${events.length - 1})`);
      }
    }
    if (events.some((e) => e.type === "battleEnded")) this.ended = true;
    this.queue.push(...events);
    const done = new Promise<void>((resolve) => this.waiters.push(resolve));
    if (!this.pumping) void this.pump();
    return done;
  }

  private violate(message: string): void {
    if (this.opts.onDevViolation) this.opts.onDevViolation(message);
    else throw new Error(`[EventPlayer dev] ${message}`);
  }

  private async pump(): Promise<void> {
    this.pumping = true;
    try {
      while (this.queue.length > 0) {
        const e = this.queue.shift()!;
        await this.dispatch(e);
      }
    } finally {
      // 드레인 콜백(onDrained → dispatchUi)에서 playing이 false로 보여야
      // store가 대기자를 풀 수 있다 — 드레인은 펌프 종료 후 실행
      this.pumping = false;
    }
    this.drain();
  }

  private dispatch(e: BattleEvent): Promise<void> {
    const p = this.opts.presenter;
    switch (e.type) {
      case "unitMoved":
        return p.unitMoved(e);
      case "damageDealt":
        return p.damageDealt(e);
      case "strategyCast":
        return p.strategyCast(e);
      case "itemUsed":
        return p.itemUsed?.(e) ?? Promise.resolve();
      case "unitRetreated":
        return p.unitRetreated(e);
      case "duelTriggered":
        return p.duelTriggered(e);
      case "phaseChanged":
        return p.phaseChanged(e);
      case "battleEnded":
        return p.battleEnded(e);
      default:
        // 연출이 없는 메타 이벤트(levelUp 등)는 프레젠터 없이 통과 — 결산 연출은 별도 화면에서 처리
        return Promise.resolve();
    }
  }

  private drain(): void {
    const committed = this.opts.getCommitted();
    // sync 이전에 투영 상태를 캡처해야 드리프트가 보인다
    const snap = this.opts.dev ? (this.opts.presenter.snapshot?.() ?? null) : null;
    this.opts.presenter.sync(committed);
    if (snap) {
      const diff = diffSnapshot(snap, committed);
      if (diff) this.violate(`드레인 정합 단언 실패 — ${diff}`);
    }
    this.opts.onDrained();
    const ws = this.waiters;
    this.waiters = [];
    for (const w of ws) w();
  }
}
