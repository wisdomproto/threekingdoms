/**
 * 테스트용 Presenter 2종 (설계 §2.1 "FakePresenter로 vitest 검증 가능").
 *
 * - FakePresenter: 호출 순서·이벤트 원본 기록. auto=false면 release() 호출까지 각 연출이
 *   멈춘다 — EventPlayer의 직렬 소비(앞 연출 완료 전 다음 미시작)를 검증하는 용도.
 * - TrackingPresenter: 이벤트만으로 화면 투영 상태(좌표/troops/retreated/phase)를 유지하고
 *   snapshot()으로 노출 — 드레인 dev 정합 단언(presented ≡ committed)을 실전 구동으로 검증.
 */
import type { Side } from "@tk/data";
import type { BattleEvent, BattleState } from "@tk/engine";
import type { PresentedSnapshot, PresentedUnit, Presenter } from "../eventPlayer";

type Ev<T extends BattleEvent["type"]> = Extract<BattleEvent, { type: T }>;

export class FakePresenter implements Presenter {
  /** 연출 호출 + sync 통합 순서 로그 (이벤트는 type, sync는 "sync") */
  readonly log: string[] = [];
  /** 받은 이벤트 원본 (sync 제외) */
  readonly events: BattleEvent[] = [];
  readonly synced: BattleState[] = [];
  /** false면 각 연출이 release()까지 대기 */
  auto = true;
  /** dev 정합 단언용 화면 투영 — 테스트가 주입. 미설정이면 단언 생략 */
  snapshot: (() => PresentedSnapshot | null) | undefined = undefined;

  private pending: Array<() => void> = [];

  get pendingCount(): number {
    return this.pending.length;
  }

  /** 대기 중인 가장 오래된 연출 1개 완료 */
  release(): void {
    const r = this.pending.shift();
    if (r) r();
  }

  /** 서브클래스 훅 — 이벤트 수신 즉시 호출 */
  protected onEvent(_e: BattleEvent): void {}

  private handle(e: BattleEvent): Promise<void> {
    this.log.push(e.type);
    this.events.push(e);
    this.onEvent(e);
    if (this.auto) return Promise.resolve();
    return new Promise((resolve) => this.pending.push(resolve));
  }

  unitMoved(e: Ev<"unitMoved">): Promise<void> {
    return this.handle(e);
  }
  damageDealt(e: Ev<"damageDealt">): Promise<void> {
    return this.handle(e);
  }
  strategyCast(e: Ev<"strategyCast">): Promise<void> {
    return this.handle(e);
  }
  unitRetreated(e: Ev<"unitRetreated">): Promise<void> {
    return this.handle(e);
  }
  duelTriggered(e: Ev<"duelTriggered">): Promise<void> {
    return this.handle(e);
  }
  phaseChanged(e: Ev<"phaseChanged">): Promise<void> {
    return this.handle(e);
  }
  statusApplied(e: Ev<"statusApplied">): Promise<void> {
    return this.handle(e);
  }
  statusTick(e: Ev<"statusTick">): Promise<void> {
    return this.handle(e);
  }
  statusExpired(e: Ev<"statusExpired">): Promise<void> {
    return this.handle(e);
  }
  reinforcementArrived(e: Ev<"reinforcementArrived">): Promise<void> {
    return this.handle(e);
  }
  battleEnded(e: Ev<"battleEnded">): Promise<void> {
    return this.handle(e);
  }

  sync(state: BattleState): void {
    this.log.push("sync");
    this.synced.push(state);
  }
}

/** 이벤트 스트림만으로 투영 상태를 재구성 — "이벤트가 상태 변화를 전부 서술한다" 계약 검증 */
export class TrackingPresenter extends FakePresenter {
  private units = new Map<string, PresentedUnit>();
  private phase: Side = "player";

  constructor() {
    super();
    this.snapshot = () => ({
      phase: this.phase,
      units: [...this.units.values()].map((u) => ({ ...u })),
    });
  }

  /** 초기 상태로 투영 초기화 (BattleRenderer가 부팅 시 하는 일에 해당) */
  prime(state: BattleState): void {
    this.phase = state.phase;
    this.units = new Map(
      state.units.map((u) => [
        u.id,
        { id: u.id, x: u.x, y: u.y, troops: u.troops, retreated: u.retreated },
      ]),
    );
  }

  protected override onEvent(e: BattleEvent): void {
    switch (e.type) {
      case "unitMoved": {
        const u = this.units.get(e.unitId);
        if (u) {
          u.x = e.to.x;
          u.y = e.to.y;
        }
        break;
      }
      case "damageDealt": {
        const d = this.units.get(e.defenderId);
        if (d) d.troops = Math.max(0, d.troops - e.damage);
        break;
      }
      case "statusTick": { // 중독 1틱 — troops 차감(damageDealt와 동형 자기서술)
        const d = this.units.get(e.unitId);
        if (d) d.troops = Math.max(0, d.troops - e.damage);
        break;
      }
      case "statusApplied": // 표시 전용 — diffSnapshot은 statuses 미비교(투영 불필요)
      case "statusExpired":
        break;
      case "unitRetreated": {
        const u = this.units.get(e.unitId);
        if (u) {
          u.retreated = true;
          u.troops = 0;
        }
        break;
      }
      case "phaseChanged":
        this.phase = e.phase;
        break;
      case "reinforcementArrived": // 중도 스폰 — 이벤트 데이터로 투영에 유닛 추가(자기서술 계약)
        for (const u of e.units) {
          this.units.set(u.id, { id: u.id, x: u.x, y: u.y, troops: u.troops, retreated: false });
        }
        break;
      case "strategyCast": // 시전 알림만 — 실제 피해는 후속 damageDealt가 투영 반영
      case "duelTriggered":
      case "battleEnded":
        break;
    }
  }

  override sync(state: BattleState): void {
    super.sync(state);
    this.prime(state); // 계약: sync는 committed로 강제 정합
  }
}
