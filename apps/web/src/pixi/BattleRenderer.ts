/**
 * BattleRenderer (설계 §2.2) — Pixi 조립 루트이자 Presenter 구현체.
 * React에서 보면 mount(parent)/destroy() 블랙박스. Pixi 객체는 이 모듈 내부에 봉인.
 *
 * - Application 비동기 init + StrictMode 가드: init 중 destroy 요청 시 init 완료 후 파괴 (설계 리스크 §9-1)
 * - Presenter: 설계 §6 이벤트→연출 표 그대로. unitMoved는 path.ts 경로를 타일당 150ms 트윈 (직선 금지)
 * - sync(committed): 드레인 시 진실로 강제 정합. snapshot()은 dev 단언용 투영 상태
 * - 연출 전 상태를 만들지 않는 순수 소비자 — 모든 수치는 이벤트/committed에서만 온다
 *
 * 결선 순서: renderer 생성 → store 생성(presenter=renderer) → renderer.connect(store) → mount.
 */
import { Application, Container } from "pixi.js";
import type { Side } from "@tk/data";
import type { BattleContext, BattleEvent, BattleState, Coord } from "@tk/engine";
import type { Presenter, PresentedSnapshot } from "../battle/eventPlayer";
import type { InputState, UiEvent } from "../battle/inputMachine";
import { findPath } from "../battle/path";
import { CameraController } from "./camera";
import { gridToWorld, TILE_SIZE } from "./projection";
import { TextureResolver } from "./textures";
import { TweenRunner } from "./tweens";
import { InputAdapter } from "./inputAdapter";
import { TerrainLayer } from "./layers/TerrainLayer";
import { HighlightLayer } from "./layers/HighlightLayer";
import { UnitLayer } from "./layers/UnitLayer";
import { FxLayer } from "./layers/FxLayer";

type Ev<T extends BattleEvent["type"]> = Extract<BattleEvent, { type: T }>;

/** BattleStore의 구조적 부분집합 — 클래스 직접 의존 대신 필요한 표면만 */
export interface RendererStore {
  dispatchUi(event: UiEvent): void;
  subscribe(listener: () => void): () => void;
  readonly committedState: BattleState;
  readonly settledState: BattleState;
  readonly uiState: InputState;
}

const PHASE_BANNER_MS = 600; // 설계 §6
const DUEL_BANNER_MS = 1100;
const END_BANNER_MS = 1200;
const FOCUS_MS = 250;
const WHEEL_ZOOM_STEP = 1.12;

interface Scene {
  app: Application;
  world: Container;
  tweens: TweenRunner;
  textures: TextureResolver;
  terrain: TerrainLayer;
  highlights: HighlightLayer;
  units: UnitLayer;
  fx: FxLayer;
  camera: CameraController;
  input: InputAdapter;
  unsubscribe: () => void;
  onWheel: (e: WheelEvent) => void;
  tick: () => void;
  resizeObserver: ResizeObserver;
}

export class BattleRenderer implements Presenter {
  private readonly ctx: BattleContext;
  private store: RendererStore | null = null;
  private scene: Scene | null = null;
  private destroyRequested = false;
  private mounting = false;
  private phase: Side = "player";

  constructor(ctx: BattleContext) {
    this.ctx = ctx;
  }

  /** store 생성(presenter=this) 후, mount 이전에 호출 */
  connect(store: RendererStore): void {
    this.store = store;
    this.phase = store.settledState.phase;
  }

  async mount(parent: HTMLElement): Promise<void> {
    if (this.mounting || this.scene) throw new Error("BattleRenderer: 이미 mount됨");
    const store = this.store;
    if (!store) throw new Error("BattleRenderer: mount 전에 connect(store) 필요");
    this.mounting = true;

    const app = new Application();
    // resizeTo 대신 mount 시점 크기로 초기화 + ResizeObserver 사용.
    // ResizePlugin의 resizeTo는 globalThis 'resize' 이벤트에 의존해
    // iframe 기반 프리뷰나 CSS-only 레이아웃 변화에선 발화하지 않는다.
    const initW = parent.clientWidth || 300;
    const initH = parent.clientHeight || 150;
    await app.init({
      width: initW,
      height: initH,
      background: 0x1b1f24,
      antialias: true,
      resolution: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1,
      autoDensity: true,
    });
    this.mounting = false;

    // StrictMode 가드: init 진행 중 destroy()가 요청됐다면 init 완료 후 즉시 파괴
    if (this.destroyRequested) {
      app.destroy(true, { children: true });
      return;
    }

    parent.appendChild(app.canvas);
    app.canvas.style.touchAction = "none"; // 브라우저 팬/줌 가로채기 방지 (설계 리스크 §9-4)

    const tweens = new TweenRunner(app.ticker);
    const textures = new TextureResolver(app.renderer);
    // 스프라이트 비동기 로드 — 실패 시 폴백(색 사각형) 유지, mount는 계속 진행
    textures.loadSprites().catch((e) =>
      console.warn("[BattleRenderer] loadSprites 예외 (폴백 유지):", e),
    );
    const fx = new FxLayer(tweens);

    // 씬그래프: stage → world(카메라 변환) → terrain/highlight/unit/fx.world, stage → fx.screen
    const world = new Container();
    world.sortableChildren = true;
    const terrain = new TerrainLayer(this.ctx, textures);
    terrain.zIndex = 0;
    const highlights = new HighlightLayer(textures);
    highlights.zIndex = 1;
    const units = new UnitLayer(this.ctx, store.settledState, textures, tweens);
    units.zIndex = 2;
    fx.world.zIndex = 3;
    world.addChild(terrain, highlights, units, fx.world);
    app.stage.addChild(world, fx.screen);

    const worldSize = {
      width: this.ctx.map.width * TILE_SIZE,
      height: this.ctx.map.height * TILE_SIZE,
    };
    const camera = new CameraController(world, worldSize, {
      width: app.screen.width,
      height: app.screen.height,
    });
    fx.resize(app.screen.width, app.screen.height);

    // ResizeObserver: 컨테이너 크기 변화를 Pixi renderer에 직접 전파.
    // globalThis 'resize' 이벤트(ResizePlugin)와 달리 iframe·CSS 리플로우에도 발화하며,
    // 마운트 해제 시 disconnect()로 정확히 정리된다 (StrictMode 가드).
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        app.renderer.resize(width, height);
        // app.renderer.on("resize") 핸들러가 camera.resize + fx.resize를 호출한다.
      }
    });
    resizeObserver.observe(parent);

    const input = new InputAdapter({
      stage: app.stage,
      screen: app.screen,
      camera,
      store,
      mapWidth: this.ctx.map.width,
      mapHeight: this.ctx.map.height,
    });
    input.attach();

    // 데스크톱 마우스 휠 줌 — 핀치와 동일하게 앵커 고정
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
      camera.zoomAt({ x: e.offsetX, y: e.offsetY }, camera.current.scale * factor);
    };
    app.canvas.addEventListener("wheel", onWheel, { passive: false });

    // 카메라 트윈 진행 + 청크 컬링
    const tick = (): void => {
      camera.update(app.ticker.deltaMS);
      terrain.cull(camera.viewWorldRect());
    };
    app.ticker.add(tick);

    app.renderer.on("resize", () => {
      camera.resize({ width: app.screen.width, height: app.screen.height });
      fx.resize(app.screen.width, app.screen.height);
    });

    // 하이라이트 = InputMachine 상태의 수동적 뷰 (좌표 해석은 committed 기준)
    const unsubscribe = store.subscribe(() => {
      highlights.update(store.uiState, store.committedState);
    });
    highlights.update(store.uiState, store.committedState);

    this.scene = {
      app, world, tweens, textures, terrain, highlights, units, fx, camera, input,
      unsubscribe, onWheel, tick, resizeObserver,
    };

    // 초기 상태 반영 + 군주(첫 아군 유닛)로 카메라 스냅
    this.sync(store.settledState);
    const lord = store.settledState.units.find((u) => u.side === "player" && !u.retreated);
    if (lord) camera.focusOn(gridToWorld({ x: lord.x, y: lord.y }), 0);
    terrain.cull(camera.viewWorldRect());
  }

  destroy(): void {
    this.destroyRequested = true;
    const s = this.scene;
    if (!s) return; // init 진행 중이면 mount()의 가드가 마무리한다
    this.scene = null;
    s.unsubscribe();
    s.resizeObserver.disconnect();
    s.input.detach();
    s.app.canvas.removeEventListener("wheel", s.onWheel);
    s.app.ticker.remove(s.tick);
    s.tweens.destroy(); // 진행 중 연출 Promise를 전부 resolve — EventPlayer 교착 방지
    s.textures.destroy();
    s.app.destroy(true, { children: true });
  }

  /** store onFocus 결선용 — 그리드 좌표를 화면 중앙으로 */
  focusOn(coord: Coord, ms: number = FOCUS_MS): void {
    this.scene?.camera.focusOn(gridToWorld(coord), ms);
  }

  // ── Presenter 구현 (설계 §6 이벤트→연출 표) ────────────────────────────────
  async unitMoved(e: Ev<"unitMoved">): Promise<void> {
    const s = this.scene;
    const store = this.store;
    if (!s || !store) return;
    const view = s.units.view(e.unitId);
    // 멱등 규칙 (수정명세-3): 프리뷰 워크로 이미 목적지에 도착한 유닛에 대해
    // 커밋된 unitMoved가 재생되면 같은 경로를 다시 걷게 된다.
    // 유닛의 현재 시각 위치가 이벤트 목적지와 같으면 즉시 resolve — 이중 워크 방지.
    if (view.gridX === e.to.x && view.gridY === e.to.y) return;
    // committed는 이미 이동(+후속 피해) 적용 후 — 유닛을 from으로 되돌린 가상 상태로 경로 재계산.
    // 반격 퇴각으로 retreated가 됐어도 경로 계산은 가능해야 하므로 함께 해제한다.
    const committed = store.committedState;
    const patched: BattleState = {
      ...committed,
      units: committed.units.map((u) =>
        u.id === e.unitId ? { ...u, x: e.from.x, y: e.from.y, retreated: false } : u,
      ),
    };
    const path = findPath(this.ctx, patched, e.unitId, e.to) ?? [e.from, e.to];
    s.camera.focusOn(gridToWorld(e.to), Math.max(FOCUS_MS, path.length * 150 * 0.6));
    await view.moveAlong(path); // 타일당 150ms — 직선 금지 (벽/성문 관통 방지)
  }

  /**
   * 프리뷰 워크 (원작 UX §수정명세-1) — postMoveMenu(preview≠from) 진입 시 store가 호출.
   * 유닛 스프라이트를 BFS 경로를 따라 목적지까지 워크 트윈. 타일당 ~100ms (확정 이동보다 약간 빠름).
   * 반환 Promise 완료 → store.setPreviewWalking(false).
   */
  async previewWalk(unitId: string, from: Coord, to: Coord): Promise<void> {
    const s = this.scene;
    const store = this.store;
    if (!s || !store) return;
    const view = s.units.view(unitId);
    // 경로 재계산: 현재 committed 기준, unitId를 from에 배치한 가상 상태
    const committed = store.committedState;
    const patched: BattleState = {
      ...committed,
      units: committed.units.map((u) =>
        u.id === unitId ? { ...u, x: from.x, y: from.y, retreated: false } : u,
      ),
    };
    const path = findPath(this.ctx, patched, unitId, to) ?? [from, to];
    s.camera.focusOn(gridToWorld(to), Math.max(FOCUS_MS, path.length * 100 * 0.6));
    await view.moveAlong(path, 100); // 타일당 100ms — 확정 이동(150ms)보다 약간 빠르게
  }

  /**
   * 프리뷰 취소 (원작 UX §수정명세-2) — menuCancel 시 store가 호출.
   * 유닛 스프라이트를 원위치(from)로 즉시 스냅 (원작은 즉시 복귀에 가까움).
   */
  previewCancel(unitId: string, to: Coord): void {
    const s = this.scene;
    if (!s) return;
    const view = s.units.view(unitId);
    view.snapTo(to.x, to.y);
  }

  async damageDealt(e: Ev<"damageDealt">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    const attacker = s.units.view(e.attackerId);
    const defender = s.units.view(e.defenderId);
    attacker.faceToward({ x: defender.gridX, y: defender.gridY });
    defender.faceToward({ x: attacker.gridX, y: attacker.gridY });
    const popupAt = gridToWorld({ x: defender.gridX, y: defender.gridY });
    await Promise.all([
      attacker.play("attack"),
      defender.play("hit"),
      s.fx.damagePopup(popupAt, e.damage, e.counter),
    ]);
    defender.setTroops(defender.troops - e.damage);
  }

  async unitRetreated(e: Ev<"unitRetreated">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    await s.units.view(e.unitId).play("retreat");
  }

  async duelTriggered(e: Ev<"duelTriggered">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    const name = (id: string): string => this.ctx.data.commanders[id]?.name ?? id;
    await s.fx.banner(
      `일기토! ${name(e.attackerId)} vs ${name(e.defenderId)} — ${name(e.winnerId)} 승리`,
      DUEL_BANNER_MS,
    );
  }

  async phaseChanged(e: Ev<"phaseChanged">): Promise<void> {
    const s = this.scene;
    this.phase = e.phase;
    if (!s) return;
    const label = e.phase === "player" ? `${e.turn}턴 — 아군 페이즈` : "적군 페이즈";
    await s.fx.banner(label, PHASE_BANNER_MS);
  }

  async battleEnded(e: Ev<"battleEnded">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    await s.fx.banner(e.result === "victory" ? "승리!" : "패배...", END_BANNER_MS);
  }

  sync(state: BattleState): void {
    this.phase = state.phase;
    this.scene?.units.sync(state);
  }

  snapshot(): PresentedSnapshot | null {
    const s = this.scene;
    if (!s) return null;
    return { phase: this.phase, units: s.units.snapshot() };
  }
}
