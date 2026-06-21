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
import { ObjectLayer } from "./layers/ObjectLayer";
import { HighlightLayer } from "./layers/HighlightLayer";
import { ThreatLayer } from "./layers/ThreatLayer";
import { UnitLayer } from "./layers/UnitLayer";
import { FxLayer } from "./layers/FxLayer";
import { threatTiles } from "../battle/threatRange";

type Ev<T extends BattleEvent["type"]> = Extract<BattleEvent, { type: T }>;

/**
 * 커맨드 메뉴(레퍼런스 §9 세로 리스트)가 떠 있는 ui 상태의 활성 유닛 id.
 * postMoveMenu/strategyMenu/itemMenu + 표적 조준(targetSelect/strategyTarget/itemTarget)에서
 * 메뉴/취소가 유닛 옆에 앵커된다. selected(이동범위만 표시)·기타 상태는 null.
 */
function menuUnitId(ui: InputState): string | null {
  switch (ui.kind) {
    case "selected": // 이동범위 표시 중 — 메뉴는 아직이지만 UnitPanel 좌/우 전환용 앵커 필요
    case "postMoveMenu":
    case "strategyMenu":
    case "itemMenu":
    case "targetSelect":
    case "strategyTarget":
    case "itemTarget":
      return ui.unitId;
    default:
      return null;
  }
}

/** BattleStore의 구조적 부분집합 — 클래스 직접 의존 대신 필요한 표면만 */
export interface RendererStore {
  dispatchUi(event: UiEvent): void;
  subscribe(listener: () => void): () => void;
  readonly committedState: BattleState;
  readonly settledState: BattleState;
  readonly uiState: InputState;
  /** 연출 배속 — mount 시 초기 적용 (이후 toggle은 setSpeed 직접 호출) */
  readonly speed: number;
  /** 조회(호버/탭) 중인 유닛 id — Tier 1-2/1-3 위협범위·팝업 구동 */
  readonly inspectedId: string | null;
  /** 호버/탭 조회 채널 (Tier 1-2). inputMachine 무관 — 좌표에 유닛 없으면 null */
  setInspected(unitId: string | null): void;
  /**
   * 커맨드 메뉴 앵커 (레퍼런스 §9·§263) — 활성 유닛의 스크린 좌표를 매 틱 push.
   * 메뉴 비표시 상태면 null. ε 이내 변화는 store가 무시(불필요 리렌더 방지).
   */
  setMenuAnchor(anchor: { x: number; y: number; half: number; preferRight: boolean } | null): void;
  /** 조회(호버/탭) 유닛 스크린 앵커 — InspectPopup 커서 옆 배치용. 매 틱 push */
  setInspectAnchor(anchor: { x: number; y: number; half: number; preferRight: boolean } | null): void;
  /** 미니맵 뷰포트 박스(§6) — 카메라 가시영역을 타일 좌표로 매 틱 push */
  setViewport(rect: { x: number; y: number; w: number; h: number } | null): void;
}

const PHASE_BANNER_MS = 600; // 설계 §6
const DUEL_BANNER_MS = 1100;
const FLANK_BANNER_MS = 650; // 협공 — 데미지 직전 짧은 펀치(블로킹 최소)
const END_BANNER_MS = 1200;
const FOCUS_MS = 250;
const WHEEL_ZOOM_STEP = 1.12;
/** 자동 포커스 발동 조건: 화면 중앙 ±CENTER_MARGIN 밖일 때만 이동 */
const CENTER_MARGIN = 0.35;
/** 스테이지 camera.zoom 미지정 시 기본 줌 (유닛 가독성). 스테이지별은 stage.camera로 오버라이드 */
const DEFAULT_ZOOM = 1.5;
/** "기본 줌 복귀" 버튼 트윈 시간 */
const RESET_CAMERA_MS = 320;
/** 카메라 미세 흔들림 (§4): 기본 타격 진폭(px) / 큰 피해·일기토 진폭 / 감쇠 시간상수(ms) */
const SHAKE_PX_HIT = 2.4;
const SHAKE_PX_BIG = 5.5;
const SHAKE_DECAY_MS = 90; // 작을수록 빨리 잦아듦 (묵직한 1회 펀치)
/** 히트스톱(연출 정지) — 기본 타격 / 큰 피해·일기토 (ms, TweenRunner 경유라 배속 존중) */
const HITSTOP_MS_HIT = 55;
const HITSTOP_MS_BIG = 95;

interface Scene {
  app: Application;
  world: Container;
  tweens: TweenRunner;
  textures: TextureResolver;
  terrain: TerrainLayer;
  objects: ObjectLayer;
  highlights: HighlightLayer;
  threat: ThreatLayer;
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
  /** 위협범위 캐시 키 (inspectedId + committed 식별) — 호버 변경/상태 변화 시에만 재산출 */
  private threatKey: string | null = null;
  /**
   * 카메라 미세 흔들림 상태 (§4 타격 주스) — 순수 표현. 남은 진폭(px)과 위상.
   * tick에서 camera.apply() 직후 world.position에 가산·감쇠한다(camera.ts 불간섭).
   * deltaMS×speed로 감쇠해 배속을 존중한다.
   */
  private shakeAmp = 0;
  private shakePhase = 0;

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
    const fx = new FxLayer(tweens, textures);

    // 씬그래프: stage → world(카메라 변환) → terrain/highlight/unit/fx.world, stage → fx.screen
    const world = new Container();
    world.sortableChildren = true;
    const terrain = new TerrainLayer(this.ctx, textures);
    terrain.zIndex = 0;
    const highlights = new HighlightLayer(textures, {
      width: this.ctx.map.width,
      height: this.ctx.map.height,
    });
    highlights.zIndex = 1;
    // 위협범위(Tier 1-3): 하이라이트 위·유닛 아래. sortableChildren으로 채움/외곽선 정렬.
    const threat = new ThreatLayer(textures);
    threat.sortableChildren = true;
    threat.zIndex = 1.5;
    const units = new UnitLayer(this.ctx, store.settledState, textures, tweens);
    units.zIndex = 2;
    // 에셋 로드 완료 → 폴백으로 생성된 기존 UnitView에 스프라이트 적용
    spritesReady
      .then(() => units.refreshSprites())
      .catch((e) => console.warn("[BattleRenderer] loadSprites 예외 (폴백 유지):", e));
    // 자체 컷아웃 리그(§4) — spriteId에 스켈레톤이 있으면 베이크 스프라이트를 리그로 격상.
    // 비동기·방어적: 리그 없으면 베이크 유지(무회귀). 스프라이트 로드와 독립 진행.
    units.applySkeletons();
    const objects = new ObjectLayer(this.ctx, textures);
    objects.zIndex = 1.8; // highlights(1)/threat(1.5) 위, units(2) 아래
    // 지형 타일 로드 완료 → TerrainLayer 이미지 텍스처로 교체 + 청크 캐시 재생성
    // (terrain은 아래에서 선언되므로, Promise 콜백은 terrain 참조 가능 — JS 클로저)
    tilesReady
      .then(() => { terrain.rebake(); objects.rebake(); })
      .catch((e) => console.warn("[BattleRenderer] loadTiles 예외 (단색 폴백 유지):", e));
    fx.world.zIndex = 3;
    world.addChild(terrain, highlights, threat, objects, units, fx.world);

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
        // objects 레이어는 painted 배경과 무관하게 항상 표시(설계 §3) — terrain만 끈다.
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
      // 호버/탭 조회 (Tier 1-2): 칸→유닛 해석 후 store.setInspected. 내 활성 유닛 선택은 거른다.
      onInspect: (coord) => this.resolveInspect(coord),
    });
    input.attach();

    // 데스크톱 마우스 휠 줌 — 핀치와 동일하게 앵커 고정
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
      camera.zoomAt({ x: e.offsetX, y: e.offsetY }, camera.current.scale * factor);
    };
    app.canvas.addEventListener("wheel", onWheel, { passive: false });

    // 카메라 트윈 진행 + 청크 컬링 + 타격 흔들림 + 커맨드 메뉴 앵커 추종
    const tick = (): void => {
      const dt = app.ticker.deltaMS * this.speed; // 배속 시 카메라 추적·흔들림도 함께 가속
      camera.update(dt); // camera.apply()가 world.position을 base로 세팅
      // 커맨드 메뉴 앵커 (레퍼런스 §9·§263): 활성 유닛 스크린좌표를 store에 push.
      // shake 가산 전 camera.current 기준으로 투영해 메뉴가 타격 흔들림에 떨지 않게 한다.
      this.updateMenuAnchor(camera, units);
      // 미니맵 뷰포트 박스(§6): 카메라 가시영역(월드px) → 타일 좌표로 store에 push.
      const vr = camera.viewWorldRect();
      store.setViewport({
        x: vr.x / TILE_SIZE,
        y: vr.y / TILE_SIZE,
        w: vr.width / TILE_SIZE,
        h: vr.height / TILE_SIZE,
      });
      // 카메라 미세 흔들림: camera 적용 직후 world.position에 가산·감쇠 (camera.ts 불간섭).
      if (this.shakeAmp > 0.05) {
        this.shakePhase += dt * 0.06;
        const ox = Math.sin(this.shakePhase * 2.7) * this.shakeAmp;
        const oy = Math.cos(this.shakePhase * 3.1) * this.shakeAmp * 0.8;
        world.position.set(world.position.x + ox, world.position.y + oy);
        this.shakeAmp *= Math.exp(-dt / SHAKE_DECAY_MS); // 지수 감쇠 (배속 존중)
      } else {
        this.shakeAmp = 0;
      }
      terrain.cull(camera.viewWorldRect());
      objects.cull(camera.viewWorldRect());
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
        ui.kind === "strategyMenu" || ui.kind === "strategyTarget" ||
        ui.kind === "itemMenu" || ui.kind === "itemTarget"
      ) {
        return ui.unitId;
      }
      return null;
    };
    const unsubscribe = store.subscribe(() => {
      highlights.update(store.uiState, store.committedState);
      units.setSelected(getSelectedUnitId(store.uiState));
      this.updateThreat(threat); // 조회 변경/상태 변화 시 위협범위 갱신 (캐시로 재산출 최소화)
    });
    highlights.update(store.uiState, store.committedState);
    units.setSelected(getSelectedUnitId(store.uiState));
    this.updateThreat(threat);

    this.scene = {
      app, world, tweens, textures, terrain, objects, highlights, threat, units, fx, camera, input,
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
   * 호버/탭 조회 해석 (Tier 1-2): 칸 → 유닛 → store.setInspected.
   * **선택 가능한 내 아군**(미행동·아군 페이즈)은 조회에서 제외 — 선택 플로우를 가로채지 않게.
   * 좌표가 null이거나 유닛이 없으면 조회 해제(null). committed(엔진 진실) 기준으로 해석.
   */
  private resolveInspect(coord: Coord | null): void {
    const store = this.store;
    if (!store) return;
    if (!coord) {
      store.setInspected(null);
      return;
    }
    const battle = store.committedState;
    const u = battle.units.find((x) => !x.retreated && x.x === coord.x && x.y === coord.y);
    if (!u) {
      store.setInspected(null);
      return;
    }
    // 선택 가능한 아군은 선택 흐름 우선 — 조회로 가로채지 않는다(팝업은 적/행동완료 아군에 의미).
    const selectableAlly =
      u.side === "player" &&
      !u.acted &&
      !u.retreated &&
      battle.phase === "player" &&
      battle.status === "ongoing";
    store.setInspected(selectableAlly ? null : u.id);
  }

  /**
   * 위협범위 갱신 (Tier 1-3): 조회 중인 **적** 유닛의 위협 칸을 ThreatLayer에 반영.
   * 캐시 키(inspectedId + 적 위치·이동력 식별)로 호버/상태 변화 시에만 threatTiles 재산출 —
   * 다익스트라가 매 프레임 돌지 않게. 아군 조회/미조회면 빈 집합(기본 적만 표시).
   */
  private updateThreat(threat: ThreatLayer): void {
    const store = this.store;
    if (!store) return;
    const id = store.inspectedId;
    const battle = store.committedState;
    const u = id ? battle.units.find((x) => x.id === id) : undefined;
    // 적(hostile)만 + 생존만. 아군·우군(friendly)/미조회/퇴각이면 비운다 — 우군은 위협 표시 안 함.
    if (!u || u.retreated || u.side !== "enemy") {
      if (this.threatKey !== null) {
        this.threatKey = null;
        threat.setTiles([]);
      }
      return;
    }
    // 캐시 키: id + 위치 + 이동력 + 사거리 (이동/사거리가 바뀌면 위협도 달라진다)
    const k = `${u.id}@${u.x},${u.y}:${u.move}:${u.rangeMin}-${u.rangeMax}`;
    if (k === this.threatKey) return;
    this.threatKey = k;
    threat.setTiles(threatTiles(this.ctx, battle, u.id));
  }

  /**
   * 커맨드 메뉴 앵커 갱신 (레퍼런스 §9 "유닛 옆 세로 리스트" + §263 "카메라 행동 유닛 따라 팬").
   * 활성(메뉴 표시) ui 상태의 유닛을 그 **시각 위치**(UnitView gridX/gridY — 프리뷰 워크 반영)에서
   * 스크린 px로 투영해 store에 push한다. shake 가산 전 camera.current 기준이라 흔들림에 떨지 않는다.
   * 비표시 상태면 null. ε 이내 변화는 store.setMenuAnchor가 무시한다(불필요 리렌더 방지).
   */
  private updateMenuAnchor(camera: CameraController, units: UnitLayer): void {
    const store = this.store;
    if (!store) return;
    const ui = store.uiState;
    const unitId = menuUnitId(ui);
    if (!unitId) {
      store.setMenuAnchor(null);
      return;
    }
    const view = units.tryView(unitId);
    if (!view) {
      store.setMenuAnchor(null);
      return;
    }
    // 셀 중심 월드좌표 → 스크린 px (CSS px, 캔버스 좌상단 기준 = BattleScreen 컨테이너 기준)
    const centerWorld = gridToWorld({ x: view.gridX, y: view.gridY });
    const center = camera.worldToScreen(centerWorld);
    // 셀의 화면상 반폭 = (타일/2) × 현재 줌. 좌/우 자동 전환 시 유닛을 가리지 않을 거리.
    const half = (TILE_SIZE / 2) * camera.current.scale;
    // 메뉴 기본 배치 쪽 = 빈 쪽(원작 "유닛 옆" + 가림 최소화). 선택 유닛 좌/우 밴드(가로 1~3칸·세로 ±3칸)
    // 의 다른 living 유닛 수를 비교해 적은 쪽을 우선. 동률이면 우측(기본).
    const gx = view.gridX, gy = view.gridY;
    const band = (lo: number, hi: number): number =>
      store.committedState.units.filter(
        (u) => !u.retreated && u.id !== unitId &&
          u.x - gx >= lo && u.x - gx <= hi && Math.abs(u.y - gy) <= 3,
      ).length;
    const preferRight = band(1, 3) <= band(-3, -1);
    store.setMenuAnchor({ x: center.x, y: center.y, half, preferRight });
    this.updateInspectAnchor(camera, units);
  }

  /** 조회(호버/탭) 유닛 스크린 앵커를 push — InspectPopup이 커서 옆 좌/우 플립 배치(§7-A). */
  private updateInspectAnchor(camera: CameraController, units: UnitLayer): void {
    const store = this.store;
    if (!store) return;
    const insId = store.inspectedId;
    const iv = insId ? units.tryView(insId) : null;
    if (!iv) {
      store.setInspectAnchor(null);
      return;
    }
    const c = camera.worldToScreen(gridToWorld({ x: iv.gridX, y: iv.gridY }));
    // preferRight는 InspectPopup 미사용(자체 좌/우 플립) — 타입 충족용 기본값.
    store.setInspectAnchor({ x: c.x, y: c.y, half: (TILE_SIZE / 2) * camera.current.scale, preferRight: true });
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

  /** 타격 카메라 흔들림 발동 (§4) — 진폭을 max로 갱신(중첩 시 더 큰 쪽 유지). 순수 표현. */
  private triggerShake(amp: number): void {
    if (amp > this.shakeAmp) this.shakeAmp = amp;
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
    const aPos = gridToWorld({ x: attacker.gridX, y: attacker.gridY });
    const popupAt = gridToWorld({ x: defender.gridX, y: defender.gridY });

    // 빗나감(시드확률 §2-1): 피해 0 — 공격 모션 + "빗나감" 텍스트만, 슬래시/플래시/넉백/병력변동 없음.
    if (e.hit === false) {
      await Promise.all([attacker.play("attack"), s.fx.missPopup(popupAt)]);
      return;
    }

    // ── 타격 주스 파라미터 산출 (§4, 순수 표현) ──
    // 간접(궁/포): 공격자-방어자 그리드 거리>1 → 베기 대신 관통 톤.
    const dist = Math.abs(attacker.gridX - defender.gridX) + Math.abs(attacker.gridY - defender.gridY);
    const indirect = dist > 1;
    // 강도: 피해/최대병력 비율 + 퇴각 임박(남은 병력 0) 보정. 0.3~1.4로 클램프.
    const ratio = defender.maxTroops > 0 ? e.damage / defender.maxTroops : 0.3;
    const lethal = defender.troops - e.damage <= 0;
    const intensity = Math.max(0.3, Math.min(1.4, ratio * 2 + (lethal ? 0.5 : 0)));
    // 넉백/플래시 방향: 공격자가 방어자 기준 어느 x쪽인가 (+1=오른쪽, -1=왼쪽)
    const fromDir: 1 | -1 = attacker.gridX >= defender.gridX ? 1 : -1;
    const big = intensity >= 0.85 || e.counter; // 큰 피해·반격은 더 묵직하게

    // 타격 프레임(공격자 돌진이 닿는 순간)에 슬래시·플래시·흔들림·히트스톱을 동기 발사.
    // 공격 모션 시작 후 ~110ms(배속존중) 지연 — playAttack의 lunge 정점(LUNGE_END≈0.5)에 근접.
    const strike = (): void => {
      void s.fx.slashArc(aPos, popupAt, indirect);
      void s.fx.impactFlash(popupAt, big);
      void defender.flash();
      this.triggerShake(big ? SHAKE_PX_BIG : SHAKE_PX_HIT);
      s.tweens.hitstop(big ? HITSTOP_MS_BIG : HITSTOP_MS_HIT); // 묵직한 정지(배속 존중)
    };
    void s.tweens.delay(110).then(strike);

    await Promise.all([
      attacker.play("attack"),
      defender.playHitFrom(fromDir, intensity),
      s.fx.damagePopup(popupAt, e.damage, e.counter),
    ]);
    defender.setTroops(defender.troops - e.damage);
  }

  // 상태이상(Phase D). statusTick은 troops 차감 필수(엔진 정합), 부여/만료는 표시 전용(diffSnapshot 미비교).
  async statusTick(e: Ev<"statusTick">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    const u = s.units.view(e.unitId);
    const at = gridToWorld({ x: u.gridX, y: u.gridY });
    await Promise.all([u.flash(), s.fx.damagePopup(at, e.damage, false)]);
    u.setTroops(u.troops - e.damage);
  }

  async statusApplied(e: Ev<"statusApplied">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    await s.units.view(e.unitId).flash(); // 부여 순간 깜빡임(상태 아이콘 표시는 후속)
  }

  async statusExpired(_e: Ev<"statusExpired">): Promise<void> {
    // 만료 — 표시 전용, 현재 no-op(아이콘 제거는 후속).
  }

  // 회복(흡혈·회복책략) — 초록 "+amount" 팝업 + 막대 증가(엔진 정합).
  async troopsHealed(e: Ev<"troopsHealed">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    const u = s.units.view(e.unitId);
    await s.fx.healPopup(gridToWorld({ x: u.gridX, y: u.gridY }), e.amount);
    u.setTroops(u.troops + e.amount);
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
    // 격파/퇴각 VFX (§11): 유닛 위치에 흰빛+연두 파편 버스트를 retreat 모션과 병행.
    // 순수 표현 — 게임 상태 불변, FxLayer가 TweenRunner로 배속(timeScale)을 존중한다.
    const view = s.units.view(e.unitId);
    const burstAt = gridToWorld({ x: view.gridX, y: view.gridY });
    await Promise.all([view.play("retreat"), s.fx.retreatBurst(burstAt)]);
  }

  /**
   * 도구 사용 연출 (W4). supplyItem(회복약)=대상 아군 위 초록 "+amount" 팝업 + 막대 갱신.
   * attackItem(공격아이템)은 이 이벤트 앞에 damageDealt가 선행해 빨강 팝업·막대 갱신을 이미
   * 처리했으므로 여기선 도구명 배너만 — 이중 팝업 방지.
   */
  async itemUsed(e: Ev<"itemUsed">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    const item = this.ctx.data.items[e.itemId];
    const name = item?.name ?? e.itemId;
    // target 생략 = 시전자 자신 위치 (useItem 계약). 좌표→대상 유닛은 committed에서 해석.
    const self = this.store?.committedState.units.find((x) => x.id === e.unitId);
    const coord = e.target ?? (self ? { x: self.x, y: self.y } : { x: 0, y: 0 });
    s.units.view(e.unitId).faceToward(coord);
    if (item?.category === "supplyItem") {
      this.autoFocus(gridToWorld(coord), FOCUS_MS);
      const target = this.store?.committedState.units.find(
        (x) => x.x === coord.x && x.y === coord.y && !x.retreated,
      );
      await Promise.all([
        s.fx.healPopup(gridToWorld(coord), e.amount),
        s.fx.banner(`도구 · ${name}`, DUEL_BANNER_MS),
      ]);
      // committed는 이미 회복 반영 — 막대만 그 값으로 갱신(드레인 sync와 일치)
      if (target) s.units.view(target.id).setTroops(target.troops);
    } else {
      // attackItem: 선행 damageDealt가 빨강 팝업·막대를 처리 — 여기선 도구명 배너만
      await s.fx.banner(`도구 · ${name}`, DUEL_BANNER_MS);
    }
  }

  async duelTriggered(e: Ev<"duelTriggered">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    const name = (id: string): string => this.ctx.data.commanders[id]?.name ?? id;
    // 일기토 발동 — 큰 화면 흔들림 1회로 무게감(§4 "특히 일기토/큰 피해").
    this.triggerShake(SHAKE_PX_BIG);
    await s.fx.banner(
      `일기토! ${name(e.attackerId)} vs ${name(e.defenderId)} — ${name(e.winnerId)} 승리`,
      DUEL_BANNER_MS,
    );
  }

  async flank(e: Ev<"flank">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    // 협공 발동(데미지 직전) — 대상에 잭팟 플래시 + 가벼운 흔들림 + 짧은 「협공!」 배너.
    const defender = s.units.view(e.defenderId);
    const at = gridToWorld({ x: defender.gridX, y: defender.gridY });
    void s.fx.impactFlash(at);
    this.triggerShake(SHAKE_PX_HIT);
    await s.fx.banner(`협공! +${e.bonusPercent}%`, FLANK_BANNER_MS);
  }

  async combo(e: Ev<"combo">): Promise<void> {
    const s = this.scene;
    if (!s || e.count < 2) return; // 단일 격파는 연출 생략, 2연속부터 「콤보」
    await s.fx.banner(`콤보 ×${e.count}!  +${e.gold}G`, FLANK_BANNER_MS);
  }

  async ultimate(e: Ev<"ultimate">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    // 필살 발동(데미지 직전) — 큰 흔들림 + 대상 플래시 + 「필살!」 배너(일기토급 무게).
    const attacker = this.ctx.data.commanders[e.attackerId]?.name ?? e.attackerId;
    const defender = s.units.view(e.defenderId);
    const at = gridToWorld({ x: defender.gridX, y: defender.gridY });
    this.triggerShake(SHAKE_PX_BIG);
    void s.fx.impactFlash(at, true);
    // 네임드 시그니처면 그 이름(「청룡언월!」), 아니면 일반 「필살! 장수」
    await s.fx.banner(e.name ? `${e.name}!  ${attacker}` : `필살! ${attacker}`, DUEL_BANNER_MS);
  }

  async phaseChanged(e: Ev<"phaseChanged">): Promise<void> {
    const s = this.scene;
    this.phase = e.phase;
    if (!s) return;
    const label =
      e.phase === "player" ? `${e.turn}턴 — 아군 페이즈`
      : e.phase === "ally" ? "우군 페이즈"
      : "적군 페이즈";
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

  /** 증원 도착 — 새 유닛 스프라이트를 *드레인 전*에 생성(투영 누락 단언 방지) + 증원 배너. */
  async reinforcementArrived(e: Ev<"reinforcementArrived">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    s.units.spawn(e.units, e.side);
    const label = e.side === "enemy" ? "적 증원 도착!" : e.side === "ally" ? "우군 증원!" : "증원 도착!";
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
