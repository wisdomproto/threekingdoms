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
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import type { Side } from "@tk/data";
import type { BattleContext, BattleEvent, BattleState, Coord } from "@tk/engine";
import type { Presenter, PresentedSnapshot } from "../battle/eventPlayer";
import type { InputState, UiEvent } from "../battle/inputMachine";
import { findPath } from "../battle/path";
import { AtmosphereLayer } from "./atmosphere";
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
  /** 연출 배속 — mount 시 초기 적용 (이후 toggle은 setSpeed 직접 호출) */
  readonly speed: number;
}

const PHASE_BANNER_MS = 600; // 설계 §6
const DUEL_BANNER_MS = 1100;
const END_BANNER_MS = 1200;
const FOCUS_MS = 250;
const WHEEL_ZOOM_STEP = 1.12;
/** 자동 포커스 발동 조건: 화면 중앙 ±CENTER_MARGIN 밖일 때만 이동 */
const CENTER_MARGIN = 0.35;
/** 스테이지 camera.zoom 미지정 시 기본 줌 (유닛 가독성). 스테이지별은 stage.camera로 오버라이드 */
const DEFAULT_ZOOM = 1.5;
/** "기본 줌 복귀" 버튼 트윈 시간 */
const RESET_CAMERA_MS = 320;

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
  /** 스테이지 camera 기본값 (resetCamera 복귀 지점) — mount에서 확정 */
  private defaultScale = DEFAULT_ZOOM;
  private defaultFocusWorld: { x: number; y: number } = { x: 0, y: 0 };
  /** 연출 배속 — TweenRunner와 카메라 update에 일괄 적용 */
  private speed = 1;

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
    this.speed = store.speed > 0 ? store.speed : 1; // 재마운트 시 배속 보존
    tweens.setTimeScale(this.speed);
    const textures = new TextureResolver(app.renderer);
    // 스프라이트 비동기 로드 — 실패 시 폴백(색 사각형) 유지, mount는 계속 진행.
    // 완료 시 이미 생성된 UnitView들을 갱신해야 한다 (아래 .then — 없으면 대기 유닛이 영원히 폴백).
    const spritesReady = textures.loadSprites();
    // 지형 타일 비동기 로드 — 실패 시 폴백(단색 베이크) 유지, mount는 계속 진행.
    // 완료 후 TerrainLayer.rebake()로 이미지 텍스처로 교체 + 청크 캐시 재생성.
    const tilesReady = textures.loadTiles();
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
    // 에셋 로드 완료 → 폴백으로 생성된 기존 UnitView에 스프라이트 적용
    spritesReady
      .then(() => units.refreshSprites())
      .catch((e) => console.warn("[BattleRenderer] loadSprites 예외 (폴백 유지):", e));
    // 지형 타일 로드 완료 → TerrainLayer 이미지 텍스처로 교체 + 청크 캐시 재생성
    // (terrain은 아래에서 선언되므로, Promise 콜백은 terrain 참조 가능 — JS 클로저)
    tilesReady
      .then(() => terrain.rebake())
      .catch((e) => console.warn("[BattleRenderer] loadTiles 예외 (단색 폴백 유지):", e));
    fx.world.zIndex = 3;
    world.addChild(terrain, highlights, units, fx.world);

    // painted 맵 배경 (있으면 타일 렌더 대체) + 정합 확인용 격자 오버레이.
    const mapW = this.ctx.map.width;
    const mapH = this.ctx.map.height;
    const mapBg = new Sprite();
    mapBg.zIndex = -1; // terrain(0) 아래
    mapBg.visible = false;
    const gridOverlay = new Graphics();
    for (let gx = 0; gx <= mapW; gx++) {
      gridOverlay.moveTo(gx * TILE_SIZE, 0).lineTo(gx * TILE_SIZE, mapH * TILE_SIZE);
    }
    for (let gy = 0; gy <= mapH; gy++) {
      gridOverlay.moveTo(0, gy * TILE_SIZE).lineTo(mapW * TILE_SIZE, gy * TILE_SIZE);
    }
    gridOverlay.stroke({ width: 1, color: 0xffffff, alpha: 0.12 });
    gridOverlay.zIndex = 0.5; // 배경 위, 유닛 아래 — 정합 확인용
    gridOverlay.visible = false;
    world.addChild(mapBg, gridOverlay);
    textures
      .loadMapBackground(this.ctx.map.id)
      .then((tex) => {
        if (!tex) return;
        mapBg.texture = tex;
        mapBg.width = mapW * TILE_SIZE;
        mapBg.height = mapH * TILE_SIZE;
        mapBg.position.set(0, 0);
        mapBg.visible = true;
        terrain.visible = false; // 타일 끄고 그림으로
        // gridOverlay.visible = true; // 정합 확인용 — 확정되어 기본 OFF (새 맵 검증 시 재활성)
      })
      .catch((e) => console.warn("[BattleRenderer] loadMapBackground 예외:", e));

    // 맵 뒤 배경 (화면 고정 — 카메라 변환 밖). 휑한 가장자리를 원경 산수로 채운다.
    const bg = new Sprite();
    bg.anchor.set(0.5);
    bg.visible = false;
    const fitBackground = (): void => {
      const tex = bg.texture;
      if (!tex || tex === Texture.EMPTY || tex.width === 0) return;
      const sw = app.screen.width;
      const sh = app.screen.height;
      bg.scale.set(Math.max(sw / tex.width, sh / tex.height)); // cover
      bg.position.set(sw / 2, sh / 2);
    };
    textures
      .loadBackground()
      .then((tex) => {
        if (tex) {
          bg.texture = tex;
          bg.visible = true;
          fitBackground();
        }
      })
      .catch((e) => console.warn("[BattleRenderer] loadBackground 예외:", e));
    // 분위기 오버레이 (맵 위·스크린FX 아래) — 비네팅 + 따뜻한 글로우
    const atmosphere = new AtmosphereLayer();
    atmosphere.resize(app.screen.width, app.screen.height);
    app.stage.addChild(bg, world, atmosphere, fx.screen); // bg → world → 분위기 → 스크린FX

    // 스테이지별 카메라 (feel-spec §데이터): zoom/focus를 데이터로 받아 초기 연출에 적용.
    // 미지정이면 기본 줌 + 아군 군주(없으면 맵 중앙)로 폴백. resetCamera()도 이 값으로 복귀.
    const camCfg = this.ctx.stage.camera;
    this.defaultScale = camCfg?.zoom ?? DEFAULT_ZOOM;
    let focusCoord: Coord;
    if (camCfg?.focus) {
      focusCoord = { x: camCfg.focus[0], y: camCfg.focus[1] };
    } else {
      const lord = store.settledState.units.find((u) => u.side === "player" && !u.retreated);
      focusCoord = lord
        ? { x: lord.x, y: lord.y }
        : { x: Math.floor(mapW / 2), y: Math.floor(mapH / 2) };
    }
    this.defaultFocusWorld = gridToWorld(focusCoord);

    const worldSize = {
      width: this.ctx.map.width * TILE_SIZE,
      height: this.ctx.map.height * TILE_SIZE,
    };
    const camera = new CameraController(world, worldSize, {
      width: app.screen.width,
      height: app.screen.height,
    }, this.defaultScale);
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
      camera.update(app.ticker.deltaMS * this.speed); // 배속 시 카메라 추적도 함께 가속
      terrain.cull(camera.viewWorldRect());
      units.tickIdle(app.ticker.deltaMS);
    };
    app.ticker.add(tick);

    app.renderer.on("resize", () => {
      camera.resize({ width: app.screen.width, height: app.screen.height });
      fx.resize(app.screen.width, app.screen.height);
      fitBackground();
      atmosphere.resize(app.screen.width, app.screen.height);
    });

    // 하이라이트 = InputMachine 상태의 수동적 뷰 (좌표 해석은 committed 기준)
    // 선택 연동: uiState에서 선택된 unitId를 뽑아 UnitLayer.setSelected() 호출
    const getSelectedUnitId = (ui: InputState): string | null => {
      if (
        ui.kind === "selected" || ui.kind === "postMoveMenu" || ui.kind === "targetSelect" ||
        ui.kind === "strategyMenu" || ui.kind === "strategyTarget"
      ) {
        return ui.unitId;
      }
      return null;
    };
    const unsubscribe = store.subscribe(() => {
      highlights.update(store.uiState, store.committedState);
      units.setSelected(getSelectedUnitId(store.uiState));
    });
    highlights.update(store.uiState, store.committedState);
    units.setSelected(getSelectedUnitId(store.uiState));

    this.scene = {
      app, world, tweens, textures, terrain, highlights, units, fx, camera, input,
      unsubscribe, onWheel, tick, resizeObserver,
    };

    // 초기 상태 반영 + 스테이지 기본 카메라(줌·포커스)로 즉시 스냅
    this.sync(store.settledState);
    camera.focusOn(this.defaultFocusWorld, 0, this.defaultScale);
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

  /** "기본 줌 복귀" 버튼 — 스테이지 기본 줌·포커스로 부드럽게 되돌린다 (수동 줌/팬 리셋) */
  resetCamera(): void {
    this.scene?.camera.focusOn(this.defaultFocusWorld, RESET_CAMERA_MS, this.defaultScale);
  }

  /** 배속 토글 — TweenRunner(이동/공격/배너/팝업) + 카메라 추적을 일괄 가속 */
  setSpeed(speed: number): void {
    this.speed = speed > 0 ? speed : 1;
    this.scene?.tweens.setTimeScale(this.speed);
  }

  /**
   * 자동 포커스 헬퍼 (연출 중 전용):
   * worldPoint가 화면 중앙 ±CENTER_MARGIN 밖에 있을 때만 포커스 이동.
   * scale은 변경하지 않는다 — 수동 줌 레벨 보존.
   */
  private autoFocus(worldPoint: ReturnType<typeof gridToWorld>, ms: number): void {
    const s = this.scene;
    if (!s) return;
    if (!s.camera.isInCenter(worldPoint, CENTER_MARGIN)) {
      s.camera.focusOn(worldPoint, ms);
    }
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
    // 자동 포커스: 목적지가 화면 중앙 ±35% 밖일 때만 이동 (scale 유지)
    this.autoFocus(gridToWorld(e.to), Math.max(FOCUS_MS, path.length * 150 * 0.6));
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
    // 자동 포커스: 목적지가 화면 중앙 ±35% 밖일 때만 이동 (scale 유지)
    this.autoFocus(gridToWorld(to), Math.max(FOCUS_MS, path.length * 100 * 0.6));
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
    // 공격/반격 연출 전: 방어자 위치 포커스 (화면 중앙 ±35% 밖일 때만, scale 유지)
    this.autoFocus(gridToWorld({ x: defender.gridX, y: defender.gridY }), FOCUS_MS);
    const popupAt = gridToWorld({ x: defender.gridX, y: defender.gridY });
    await Promise.all([
      attacker.play("attack"),
      defender.play("hit"),
      s.fx.damagePopup(popupAt, e.damage, e.counter),
    ]);
    defender.setTroops(defender.troops - e.damage);
  }

  async strategyCast(e: Ev<"strategyCast">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    // 시전자 방향 + 대상 포커스 + 책략명 배너. 개별 피해 팝업은 후속 damageDealt가 처리.
    s.units.view(e.casterId).faceToward(e.target);
    this.autoFocus(gridToWorld(e.target), FOCUS_MS);
    const name = this.ctx.data.strategies[e.strategyId]?.name ?? e.strategyId;
    await s.fx.banner(`책략 · ${name}!`, DUEL_BANNER_MS);
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
    // 아군 페이즈 시작 시 미행동 첫 아군 유닛으로 자동 포커스 (scale 유지)
    if (e.phase === "player" && this.store) {
      const firstUnacted = this.store.committedState.units.find(
        (u) => u.side === "player" && !u.retreated && !u.acted,
      );
      if (firstUnacted) {
        this.autoFocus(gridToWorld({ x: firstUnacted.x, y: firstUnacted.y }), FOCUS_MS);
      }
    }
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
