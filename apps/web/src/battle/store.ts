/**
 * BattleStore (설계 §2.1) — 단일 진실 상태 컨테이너.
 *
 * 3단계 상태 흐름 (설계 §4):
 *   committed(엔진 진실, applyAction 동기 커밋) → EventPlayer 직렬 연출 → settled(드레인 시 갱신).
 * HUD 뷰모델은 settled에서만 파생 — 연출 중 committed가 앞서가도 화면 수치는 드레인 시점에 갱신.
 *
 * dispatchUi(uiEvent) → InputMachine 순수 리듀서 → effects 실행:
 *   - commit: applyAction 연쇄 커밋(원자) + actionLog.push, events를 이어붙여 큐에 한 번에 투입
 *   - focus: onFocus 콜백 (Stage 4에서 카메라로 연결)
 * 큐 드레인 → settled 갱신 → dispatchUi({type:"drained"}) → 상태기계가 idle/enemyTurn/battleOver 분기.
 * enemyTurn 진입 시 EnemyTurnDriver를 비동기로 기동한다.
 *
 * useSyncExternalStore 어댑터: subscribe/getSnapshot. 스냅샷은 직렬화 가능 슬라이스
 * { ui, vm, previewWalking }이며 참조 캐시로 불필요한 React 리렌더를 막는다.
 *
 * previewWalking 플래그 (원작 UX §수정명세):
 *   postMoveMenu(preview≠from) 진입 시 true, 워크 완료/취소 시 false.
 *   순수 데이터 — Pixi import 없음. 렌더러(onPreviewWalk/onPreviewCancel 콜백)가 실제 트윈을 실행.
 *   ActionMenu/타깃 하이라이트는 previewWalking=false일 때만 표시.
 */
import { applyAction, createBattle } from "@tk/engine";
import type { Action, BattleContext, BattleEvent, BattleState, Coord } from "@tk/engine";
import { reduceInput, type InputState, type UiEvent } from "./inputMachine";
import { EventPlayer, type Presenter } from "./eventPlayer";
import { runEnemyPhase, runGreedyPhase } from "./enemyTurnDriver";
import { battleVM, type BattleVM } from "./viewmodel";

export interface BattleStoreOptions {
  presenter?: Presenter;
  /** dev 단언 (드레인 정합·battleEnded 최후 계약) 활성화 */
  dev?: boolean;
  onDevViolation?: (message: string) => void;
  onFocus?: (coord: Coord) => void;
  /**
   * 프리뷰 워크 콜백 (원작 UX §수정명세-1).
   * postMoveMenu(preview≠from) 진입 시 렌더러가 등록. 완료되면 store.setPreviewWalking(false)를 호출해야 함.
   * 미등록(헤드리스/테스트)이면 즉시 완료로 간주.
   */
  onPreviewWalk?: (unitId: string, from: Coord, to: Coord) => Promise<void>;
  /**
   * 프리뷰 취소 콜백 (원작 UX §수정명세-2).
   * menuCancel 시 렌더러가 유닛을 원위치(from)로 스냅/트윈 복귀.
   * 미등록이면 무시.
   */
  onPreviewCancel?: (unitId: string, to: Coord) => void;
}

export interface StoreSnapshot {
  ui: InputState;
  vm: BattleVM;
  /** 프리뷰 워크 진행 중 — ActionMenu·타깃 하이라이트 숨김 조건 */
  previewWalking: boolean;
  /** 자동전투 ON 여부 — 컨트롤 버튼 표시 상태 */
  autoBattle: boolean;
  /** 연출 배속 (1·2·3) — 버튼 라벨 + 렌더러 연동 */
  speed: number;
}

/** 헤드리스 기본 Presenter — 모든 연출을 즉시 완료 (테스트·시뮬레이션용) */
export function createInstantPresenter(): Presenter {
  const done = () => Promise.resolve();
  return {
    unitMoved: done,
    damageDealt: done,
    unitRetreated: done,
    duelTriggered: done,
    phaseChanged: done,
    battleEnded: done,
    sync: () => {},
  };
}

export class BattleStore {
  readonly ctx: BattleContext;
  readonly seed: number;

  private committed: BattleState;
  private settled: BattleState;
  private ui: InputState = { kind: "idle" };
  private readonly log: Action[] = [];
  private readonly player: EventPlayer;
  private readonly opts: BattleStoreOptions;
  /** 프리뷰 워크 진행 중 플래그 — 순수 데이터, Pixi 무관 */
  private _previewWalking = false;
  /** 자동전투 ON — 아군 페이즈를 그리디 드라이버가 구동 (적 페이즈는 항상 자동) */
  private _autoBattle = false;
  /** 연출 배속 (1=기본). 순수 표현 — 게임 상태 불변, 렌더러 TweenRunner에 전달 */
  private _speed = 1;

  private listeners = new Set<() => void>();
  private snapshotCache: StoreSnapshot | null = null;
  private idleWaiters: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];
  private driverError: unknown = null;

  constructor(ctx: BattleContext, seed: number, opts: BattleStoreOptions = {}) {
    this.ctx = ctx;
    this.seed = seed;
    this.opts = opts;
    this.committed = createBattle(ctx, seed);
    this.settled = this.committed;
    this.player = new EventPlayer({
      presenter: opts.presenter ?? createInstantPresenter(),
      getCommitted: () => this.committed,
      onDrained: () => {
        this.settled = this.committed;
        this.dispatchUi({ type: "drained" });
      },
      ...(opts.dev !== undefined ? { dev: opts.dev } : {}),
      ...(opts.onDevViolation ? { onDevViolation: opts.onDevViolation } : {}),
    });
  }

  get committedState(): BattleState {
    return this.committed;
  }
  get settledState(): BattleState {
    return this.settled;
  }
  get uiState(): InputState {
    return this.ui;
  }
  get actionLog(): readonly Action[] {
    return this.log;
  }

  get previewWalking(): boolean {
    return this._previewWalking;
  }

  /**
   * 렌더러 워크 완료 시 호출 — previewWalking을 false로 전환하고 HUD를 갱신한다.
   * inputMachine 전이는 일어나지 않는다.
   */
  setPreviewWalking(value: boolean): void {
    if (this._previewWalking === value) return;
    this._previewWalking = value;
    this.notify();
  }

  dispatchUi(event: UiEvent): void {
    const prevUi = this.ui;
    const prevKind = this.ui.kind;
    const { next, effects } = reduceInput(this.ui, event, this.ctx, this.committed, this._autoBattle);
    this.ui = next;

    const batch: BattleEvent[] = [];
    let didCommit = false;
    for (const ef of effects) {
      if (ef.type === "commit") {
        // 연쇄 원자 커밋 — events를 이어붙여 한 번에 큐 투입 (이동 트윈→공격 연출 자연 직렬화)
        didCommit = true;
        for (const a of ef.actions) batch.push(...this.commit(a));
      } else if (ef.type === "focus") {
        this.opts.onFocus?.(ef.coord);
      }
    }
    // 커밋이 있었다면 events가 비어도(중간 wait는 이벤트 0개) 반드시 큐를 돌린다 —
    // 드레인 → drained 디스패치가 animating을 풀어주는 유일한 경로이므로 생략 시 교착
    if (didCommit) void this.player.enqueue(batch);

    // ── 프리뷰 워크 연출 트리거 (원작 UX §수정명세-1) ───────────────────────
    // selected→postMoveMenu(preview≠from)일 때만 발동 — targetSelect→postMoveMenu 복귀는 제외
    if (
      next.kind === "postMoveMenu" &&
      prevUi.kind === "selected" &&
      (next.preview.x !== next.from.x || next.preview.y !== next.from.y)
    ) {
      this._previewWalking = true;
      const unitId = next.unitId;
      const from = next.from;
      const to = next.preview;
      const walk = this.opts.onPreviewWalk
        ? this.opts.onPreviewWalk(unitId, from, to)
        : Promise.resolve();
      void walk.then(() => {
        this.setPreviewWalking(false);
      });
    }

    // ── 프리뷰 취소: 유닛 원위치 복귀 (원작 UX §수정명세-2) ─────────────────
    if (
      (event.type === "menuCancel" || event.type === "cancel") &&
      prevUi.kind === "postMoveMenu" &&
      next.kind === "selected"
    ) {
      // previewWalking 중이었을 수도 있으므로 플래그 초기화
      this._previewWalking = false;
      const prevPreview = prevUi.preview;
      const prevFrom = prevUi.from;
      const movedAway = prevPreview.x !== prevFrom.x || prevPreview.y !== prevFrom.y;
      if (movedAway) {
        this.opts.onPreviewCancel?.(prevUi.unitId, prevFrom);
      }
    }

    if (this.ui.kind === "enemyTurn" && prevKind !== "enemyTurn") this.startEnemyPhase();
    if (this.ui.kind === "autoTurn" && prevKind !== "autoTurn") this.startAutoPhase();
    if (this.ui.kind === "idle" || this.ui.kind === "battleOver") this.flushIdleWaiters();
    this.notify();
  }

  get autoBattle(): boolean {
    return this._autoBattle;
  }

  get speed(): number {
    return this._speed;
  }

  /** 배속 설정 — 게임 상태 불변. 렌더러가 store.speed를 읽거나 setSpeed를 직접 호출 */
  setSpeed(speed: number): void {
    const s = speed > 0 ? speed : 1;
    if (this._speed === s) return;
    this._speed = s;
    this.notify();
  }

  /**
   * 자동전투 토글. ON: 아군 페이즈를 그리디 드라이버가 구동(적 페이즈는 원래 자동).
   * 수동 선택 중(selected/postMoveMenu/targetSelect)에 켜면 프리뷰를 원위치로 되돌리고
   * idle로 정리한 뒤 즉시 자동 턴을 시작한다. OFF는 플래그만 내리면 드라이버가 다음
   * 드레인에서 스스로 멈추고(shouldStop) idle로 복귀한다.
   */
  setAutoBattle(on: boolean): void {
    if (this._autoBattle === on) return;
    this._autoBattle = on;
    if (
      on &&
      this.committed.phase === "player" &&
      this.committed.status === "ongoing" &&
      !this.player.playing
    ) {
      const cur = this.ui;
      if (cur.kind === "postMoveMenu" || cur.kind === "targetSelect") {
        // 진행 중 프리뷰 워크를 원위치로 되돌리고 선택 해제
        if (cur.preview.x !== cur.from.x || cur.preview.y !== cur.from.y) {
          this.opts.onPreviewCancel?.(cur.unitId, cur.from);
        }
        this._previewWalking = false;
        this.ui = { kind: "idle" };
      } else if (cur.kind === "selected") {
        this.ui = { kind: "idle" };
      }
      if (this.ui.kind === "idle") {
        this.dispatchUi({ type: "autoStart" }); // idle→autoTurn→startAutoPhase
      }
    }
    this.notify();
  }

  /** 적 페이즈가 끝나고 입력이 풀릴 때(idle/battleOver)까지 대기 — 헤드리스 완주 테스트용 */
  whenIdle(): Promise<void> {
    if (this.driverError) return Promise.reject(this.driverError);
    if ((this.ui.kind === "idle" || this.ui.kind === "battleOver") && !this.player.playing) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => this.idleWaiters.push({ resolve, reject }));
  }

  // ── useSyncExternalStore 어댑터 ──────────────────────────────────────────
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StoreSnapshot => {
    if (!this.snapshotCache) {
      this.snapshotCache = {
        ui: this.ui,
        vm: battleVM(this.ctx, this.settled),
        previewWalking: this._previewWalking,
        autoBattle: this._autoBattle,
        speed: this._speed,
      };
    }
    return this.snapshotCache;
  };

  // ── 내부 ────────────────────────────────────────────────────────────────
  private commit(action: Action): BattleEvent[] {
    const r = applyAction(this.ctx, this.committed, action);
    this.committed = r.state;
    this.log.push(action);
    return r.events;
  }

  private startEnemyPhase(): void {
    runEnemyPhase({
      ctx: this.ctx,
      getState: () => this.committed,
      commit: (a) => this.commit(a),
      play: (events) => this.player.enqueue(events),
      ...(this.opts.onFocus ? { onFocus: this.opts.onFocus } : {}),
    }).catch((err: unknown) => this.onDriverError(err));
  }

  /** 자동전투(아군 페이즈) 드라이버 — autoTurn 진입 시 기동. auto OFF면 shouldStop으로 멈춘다 */
  private startAutoPhase(): void {
    runGreedyPhase({
      ctx: this.ctx,
      side: "player",
      getState: () => this.committed,
      commit: (a) => this.commit(a),
      play: (events) => this.player.enqueue(events),
      shouldStop: () => !this._autoBattle,
      ...(this.opts.onFocus ? { onFocus: this.opts.onFocus } : {}),
    }).catch((err: unknown) => this.onDriverError(err));
  }

  private onDriverError(err: unknown): void {
    console.error("[battle driver]", err); // 진단: 드라이버 예외가 조용히 묻히지 않게
    this.driverError = err;
    const ws = this.idleWaiters;
    this.idleWaiters = [];
    for (const w of ws) w.reject(err);
  }

  private flushIdleWaiters(): void {
    if (this.player.playing) return; // 드레인 이후에만 호출되지만 방어적 가드
    const ws = this.idleWaiters;
    this.idleWaiters = [];
    for (const w of ws) w.resolve();
  }

  private notify(): void {
    this.snapshotCache = null;
    for (const l of this.listeners) l();
  }
}
