/**
 * SceneStage (막간 v4 — 어드벤처 맵 씬) — 얇은 Pixi 러너. 전투 렌더러는 불변, 검증된
 * 레이어(TerrainLayer 타일 폴백·UnitView 이동/포즈·painted 배경 규약)만 재사용한다.
 *
 * - 부팅 = BattleRenderer.mount 미러: loadTiles(바닥/오브젝트) → rebake, loadSprites(점진 refresh),
 *   loadMapBackground(`/assets/maps/{scene.map}.webp` — 있으면 painted, 없으면 타일 폴백).
 * - **지형 구동 오브젝트(성벽 오토타일·성문)는 생성하지 않는다**(스펙 — 씬 벽은 painted 담당).
 *   scene.decorations만 ObjectLayer.placeDeco 문법(그림자+바닥 앵커)으로 얹는다.
 * - 스프라이트 키 트릭: SceneUnit.sprite("liubei-foot")를 commanderId로 전달 —
 *   spriteMap 기본 규칙(commanderId=spriteId)으로 해석. classId는 제네릭 매핑에 없는
 *   "scene"이라 병종 제네릭 오폴백이 없다(미보유 = 진영색 사각 폴백).
 * - 진행 상태의 진실은 인터프리터(sceneUnitStates) — skipToState가 언제든 그 상태로 스냅.
 *   걷기는 타일 단위 moveAlong 조각으로 실행해 탭 스킵(actionGen)이 ~1타일 안에 끊는다.
 */
import { Application, Container, Graphics, Sprite, Text } from "pixi.js";
import type { BattleMap, MapScene, MapSceneLine } from "@tk/data";
import { gameData } from "@tk/data";
import type { BattleContext } from "@tk/engine";
import { TILE_SIZE } from "../../pixi/projection";
import { TextureResolver } from "../../pixi/textures";
import { TweenRunner } from "../../pixi/tweens";
import { TerrainLayer } from "../../pixi/layers/TerrainLayer";
import { UnitView } from "../../pixi/layers/UnitView";
import { playSfx, SFX } from "../../audio";
import { findScenePath, type Cell, type SceneUnitState, type Walkable } from "./interpreter";
import { ActorView, SCENE_ACTOR_HEIGHT } from "./ActorView";
import { MOTION_URL, validateLibrary } from "../motions";

/** 스프라이트 표시 높이(UnitView SPRITE_DISPLAY_H와 동일 산식) — 말풍선 머리 위 배치용. */

/** 말풍선 청동 톤 — battle/hud/frames.ts HUD 토큰(HUD_INK/HUD_BRONZE_DIM/HUD_PARCHMENT)의 hex 대응. */
const BUBBLE_INK = 0x18140d;
const BUBBLE_BRONZE = 0x6f5a34;
const BUBBLE_PARCHMENT = 0xe8d9b0;

interface Booted {
  app: Application;
  tweens: TweenRunner;
  textures: TextureResolver;
  world: Container;
  resizeObserver: ResizeObserver;
  tick: () => void;
}

export class SceneStage {
  private booted: Booted | null = null;
  private destroyRequested = false;
  private readonly views = new Map<string, UnitView>();
  private readonly actors = new Map<string, ActorView>();
  private readonly bubbles = new Map<string, Container>();
  private walkable: Walkable = () => false;
  private cinematic = false;
  private cameraActor: string | null = null;
  private cameraSpeaker: string | null = null;
  private mapW = 0;
  private mapH = 0;
  /** skipToState/새 줄 시작이 올린다 — 진행 중 걷기 체인 무효화(타일 경계에서 끊김). */
  private actionGen = 0;
  /** 마지막 skip 상태 — 끊긴 걷기의 잔여 트윈이 스냅을 덮은 경우 재정합용. */
  private lastSnap: ReadonlyMap<string, SceneUnitState> | null = null;

  /**
   * Pixi 부팅 + 맵/유닛 조립. 에셋(바닥·스프라이트·painted)은 fire-and-forget 로드 —
   * 도착 전엔 단색/색사각 폴백(전투와 동일 규약), 도착하는 대로 교체(무회귀).
   */
  async init(parent: HTMLElement, scene: MapScene, map: BattleMap, walkable: Walkable): Promise<void> {
    if (this.booted) throw new Error("SceneStage: 이미 init됨");
    this.walkable = walkable;
    this.cinematic = scene.map === "scene-01-tavern" || scene.map === "scene-01-orchard";
    this.mapW = map.width;
    this.mapH = map.height;

    const app = new Application();
    const initW = parent.clientWidth || 300;
    const initH = parent.clientHeight || 150;
    await app.init({
      width: initW,
      height: initH,
      background: 0x100e0a, // 씬 여백 = 먹빛(막간 톤)
      antialias: true,
      resolution: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1,
      autoDensity: true,
    });
    // StrictMode 가드(BattleRenderer 미러): init 중 destroy 요청 시 완료 후 즉시 파괴.
    if (this.destroyRequested) {
      app.destroy(true, { children: true });
      return;
    }
    parent.appendChild(app.canvas);
    app.canvas.style.touchAction = "none";

    const tweens = new TweenRunner(app.ticker);
    const textures = new TextureResolver(app.renderer, process.env.NODE_ENV === "development");
    const world = new Container();
    world.sortableChildren = true;

    // TerrainLayer는 ctx.map + ctx.data.terrains만 읽는다(terrainAt) — stage는 미접근이라 stub.
    const ctx = { data: gameData, map, stage: null } as unknown as BattleContext;
    const terrain = new TerrainLayer(ctx, textures);
    terrain.zIndex = 0;

    // painted 배경(있으면 타일 폴백 대체 — BattleRenderer 시딩 미러)
    const mapBg = new Sprite();
    mapBg.zIndex = -1;
    mapBg.visible = false;

    // 씬 소품(실내 탁자 등) — ObjectLayer.placeDeco 문법. 지형 구동 오브젝트(성벽/성문)는 없음.
    const decoLayer = new Container();
    decoLayer.zIndex = 1.8;

    const unitsLayer = new Container();
    unitsLayer.sortableChildren = true;
    unitsLayer.zIndex = 2;

    world.addChild(mapBg, terrain, decoLayer, unitsLayer);
    app.stage.addChild(world);

    // ── 유닛 스폰 (씬 모드 — 바 없음, hidden은 enter 전 비표시) ──
    for (const u of scene.units) {
      const view = new UnitView(
        {
          id: u.id,
          commanderId: u.sprite, // 스프라이트 키 직접 저작 — spriteMap 기본 규칙(commanderId=spriteId)
          classId: "scene", // 제네릭 매핑에 없는 값 = 병종 오폴백 차단
          name: u.id,
          side: "player",
          x: u.cell[0],
          y: u.cell[1],
          troops: 1,
          maxTroops: 1,
          retreated: false,
        },
        textures,
        tweens,
        { bars: false, spriteHeight: SCENE_ACTOR_HEIGHT },
      );
      view.setFacing(u.facing === "right" ? 1 : -1);
      view.visible = !(u.hidden ?? false);
      this.views.set(u.id, view);
      unitsLayer.addChild(view);
    }

    // ── 에셋 로드(비차단·방어적 — 전투 부트 미러) ──
    // 바닥/오브젝트(getObject — 데코 소품 텍스처 포함) → rebake + 데코 재생성.
    void textures
      .loadTiles()
      .then(() => {
        if (!this.booted) return;
        terrain.rebake();
        this.buildDecos(decoLayer, textures, scene);
      })
      .catch((e) => console.warn("[SceneStage] loadTiles 예외 (단색 폴백 유지):", e));
    // 스프라이트 점진 로드 — 도착하는 대로 refresh(queueMicrotask 디바운스, BattleRenderer 미러).
    let refreshQueued = false;
    const scheduleRefresh = (): void => {
      if (refreshQueued) return;
      refreshQueued = true;
      queueMicrotask(() => {
        refreshQueued = false;
        if (!this.booted) return;
        for (const v of this.views.values()) v.refreshSprite();
      });
    };
    void textures
      .loadSprites(() => scheduleRefresh(), new Set(scene.units.map(u => u.sprite)))
      .then(() => scheduleRefresh())
      .catch((e) => console.warn("[SceneStage] loadSprites 예외 (폴백 유지):", e));
    // painted 배경 — /assets/maps/{scene.map}.webp 규약(맵 id 키).
    void textures
      .loadMapBackground(map.id)
      .then((tex) => {
        if (!tex || !this.booted) return;
        mapBg.texture = tex;
        mapBg.width = this.mapW * TILE_SIZE;
        mapBg.height = this.mapH * TILE_SIZE;
        mapBg.position.set(0, 0);
        mapBg.visible = true;
        terrain.visible = false; // 타일 끄고 그림으로(§3-1)
      })
      .catch((e) => console.warn("[SceneStage] loadMapBackground 예외:", e));

    // ── idle 호흡 틱 ──
    const tick = (): void => {
      for (const v of this.views.values()) v.tickIdle(app.ticker.deltaMS);
      for (const a of this.actors.values()) a.tick(app.ticker.deltaMS);
      this.updateCamera(app.ticker.deltaMS);
    };
    app.ticker.add(tick);

    // ── 리사이즈 → 렌더러 전파 → 카메라 재fit (BattleRenderer 미러) ──
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) app.renderer.resize(width, height);
    });
    resizeObserver.observe(parent);
    app.renderer.on("resize", () => this.fit());

    this.booted = { app, tweens, textures, world, resizeObserver, tick };
    this.fit();
    // Await scene actors before allowing dialogue to advance: never play their entrance unseen.
    try {
      const response = await fetch(MOTION_URL, { cache: "no-store" });
      const library: unknown = await response.json();
      if (validateLibrary(library)) await Promise.all(scene.units.map(async u => {
        const motion = library.actors[u.sprite]; if (!motion) return;
        const actor = new ActorView(motion, scene.map === "scene-01-tavern" ? { x: u.id === "zhangfei" ? -22 : 0, y: 8 } : undefined); await actor.load();
        if (this.destroyRequested) { actor.destroy({ children: true }); return; }
        const view = this.views.get(u.id)!;
        // Retain UnitView as the position/bubble carrier, replacing just its artwork.
        view.useExternalSceneArt();
        view.addChild(actor); this.actors.set(u.id, actor);
        actor.setState("idle", u.facing ?? "left");
      }));
    } catch (e) { console.warn("[SceneStage] 동작 이미지 로드 실패", e); }
  }

  /** Frame the actors, keeping the lower dialogue area clear and map edges covered. */
  private fit(): void { this.updateCamera(0, true); }

  private updateCamera(ms: number, snap = false): void {
    const b = this.booted;
    if (!b) return;
    const sw = b.app.screen.width, sh = b.app.screen.height;
    const ww = this.mapW * TILE_SIZE, wh = this.mapH * TILE_SIZE;
    if (Math.min(sw, sh, ww, wh) <= 0) return;
    const scale = Math.min(sw / ww, sh / wh) * (this.cinematic ? 2.1 : 1);
    let x = ww / 2, y = wh / 2;
    if (this.cinematic) {
      const followed = this.views.get(this.cameraActor ?? "");
      const speaker = this.views.get(this.cameraSpeaker ?? "");
      const heroes = ["liubei", "guanyu", "zhangfei"]
        .map(id => this.views.get(id)).filter((v): v is UnitView => !!v?.visible);
      const anchor = followed?.visible ? followed : speaker?.visible ? speaker : heroes[0];
      const subjects = followed?.visible ? [followed] : anchor
        ? [anchor, ...heroes.filter(v => v !== anchor && Math.hypot(v.x-anchor.x, v.y-anchor.y) < TILE_SIZE*4)] : [];
      if (subjects.length) {
        x = subjects.reduce((n,v) => n+v.x,0)/subjects.length;
        y = subjects.reduce((n,v) => n+v.y,0)/subjects.length - 8;
      } else { x = TILE_SIZE*7.5; y = TILE_SIZE*8; }
    }
    const clamp = (pos: number, viewport: number, size: number) => size <= viewport
      ? (viewport-size)/2 : Math.max(viewport-size, Math.min(0,pos));
    const tx = clamp(sw/2-x*scale, sw, ww*scale);
    const ty = clamp(sh*(this.cinematic ? 0.43 : 0.5)-y*scale, sh, wh*scale);
    const blend = snap ? 1 : 1-Math.exp(-Math.min(ms,100)/220);
    b.world.scale.set(scale);
    b.world.position.set(b.world.x+(tx-b.world.x)*blend, b.world.y+(ty-b.world.y)*blend);
  }

  /** 씬 소품 배치 — ObjectLayer.placeDeco 문법(그림자 타원 + 바닥 앵커). 미보유 키 = 조용히 생략. */
  private buildDecos(layer: Container, textures: TextureResolver, scene: MapScene): void {
    layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    for (const d of scene.decorations ?? []) {
      const tex = textures.getObject(d.kind);
      if (!tex || tex.width === 0) continue; // 드롭인 — 아트 미생성 시 생략(painted가 그릴 수 있음)
      const s = ((TILE_SIZE * 1.18) / tex.width) * (d.scale ?? 1);
      const cx = d.cell[0] * TILE_SIZE + TILE_SIZE / 2;
      const cy = d.cell[1] * TILE_SIZE + TILE_SIZE - 1;
      const shadow = new Graphics();
      shadow.ellipse(0, 0, tex.width * s * 0.32, TILE_SIZE * 0.16).fill({ color: 0x000000, alpha: 0.18 });
      shadow.position.set(cx, cy - 2);
      layer.addChild(shadow);
      const deco = new Sprite(tex);
      deco.anchor.set(0.5, 1);
      deco.scale.set(d.flip ? -s : s, s);
      deco.position.set(cx, cy);
      layer.addChild(deco);
    }
  }

  /**
   * 한 줄의 액션을 순차 실행 — 정렬 = 인터프리터 계약과 동일(exit→move→enter→face→pose).
   * 미매칭 id·도달 불가 경로 = no-op(무붕괴). 탭 스킵(skipToState)이 끼어들면 타일 경계에서
   * 끊고 조용히 종료(플레이어는 자체 토큰으로 이중 전이를 거른다).
   * 종료 시 그 줄의 인터프리터 target facing을 전 유닛에 재보증(F-1) — moveAlong이 걸음
   * x방향으로 덮은 facing을 인터프리터 상태로 수렴시킨다(라이브 종료 == 스킵 == 인터프리터).
   */
  async runLineActions(line: MapSceneLine, target: ReadonlyMap<string, SceneUnitState>): Promise<void> {
    this.cameraSpeaker = ({ "유비": "liubei", "관우": "guanyu", "장비": "zhangfei", "주인장": "innkeeper", "의병": "jeonryeong" } as Record<string,string>)[line.speaker ?? ""] ?? line.bubble?.id ?? line.enter?.at(-1)?.id ?? line.move?.at(-1)?.id ?? null;
    const gen = ++this.actionGen; // 새 줄 = 이전 잔여 걷기 무효화
    for (const { id, to } of line.exit ?? []) {
      const v = this.views.get(id);
      if (!v) continue;
      await this.walk(gen, id, v, to);
      if (this.actionGen !== gen) return;
      this.cameraActor = null;
      const state = target.get(id);
      if (state) this.actors.get(id)?.setState(state.pose, state.facing);
      v.visible = false;
    }
    for (const { id, to } of line.move ?? []) {
      const v = this.views.get(id);
      if (!v) continue;
      await this.walk(gen, id, v, to);
      if (this.actionGen !== gen) return;
      this.cameraActor = null;
      const state = target.get(id);
      if (state) this.actors.get(id)?.setState(state.pose, state.facing);
    }
    for (const { id, from, to } of line.enter ?? []) {
      const v = this.views.get(id);
      if (!v) continue;
      v.snapTo(from[0], from[1]);
      v.visible = true;
      await this.walk(gen, id, v, to);
      if (this.actionGen !== gen) return;
      this.cameraActor = null;
      const state = target.get(id);
      if (state) this.actors.get(id)?.setState(state.pose, state.facing);
    }
    // face = enter 뒤(같은 줄 face가 걸음 파생 facing을 교정하는 최종 발언권 — 인터프리터 미러)
    for (const { id, dir } of line.face ?? []) {
      this.views.get(id)?.setFacing(dir === "right" ? 1 : -1);
    }
    for (const { id, pose } of line.pose ?? []) {
      this.views.get(id)?.setPose(pose);
    }
    // 종료 재보증(F-1): 라이브 걸음이 남긴 facing을 이 줄의 인터프리터 상태로 수렴.
    for (const [id, t] of target) {
      const v = this.views.get(id);
      if (v) v.setFacing(t.facing === "right" ? 1 : -1);
      this.actors.get(id)?.setState(t.pose, t.facing);
    }
  }

  /**
   * 타일 단위 걷기 — moveAlong(발소리 SFX 주입, 전투 배선 미러)을 1타일 조각으로 호출해
   * skipToState가 다음 타일 경계에서 끊을 수 있게 한다. 끊긴 뒤엔 lastSnap으로 재정합
   * (잔여 트윈이 스냅 위치를 덮었을 수 있으므로).
   */
  private async walk(gen: number, id: string, v: UnitView, to: Cell): Promise<void> {
    this.cameraActor = id;
    const path = findScenePath(this.walkable, [v.gridX, v.gridY], to);
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1]!;
      const step = path[i]!;
      this.actors.get(id)?.setState("move", step[0] !== from[0] ? (step[0] > from[0] ? "right" : "left") : (step[1] > from[1] ? "down" : "up"));
      await v.moveAlong(
        [{ x: from[0], y: from[1] }, { x: step[0], y: step[1] }],
        260,
        () => playSfx(SFX.step),
      );
      if (this.actionGen !== gen) {
        this.applySnapFor(id);
        return;
      }
    }
  }

  /** 인터프리터 상태를 즉시 적용(탭 스킵/최종 상태) — 걷기 중단·순간 배치·포즈·표시 강제. */
  skipToState(states: ReadonlyMap<string, SceneUnitState>): void {
    this.actionGen++;
    this.cameraActor = null;
    this.lastSnap = states;
    for (const id of this.views.keys()) this.applySnapFor(id);
  }

  private applySnapFor(id: string): void {
    const s = this.lastSnap?.get(id);
    const v = this.views.get(id);
    if (!s || !v) return;
    v.snapTo(s.cell[0], s.cell[1]);
    v.setFacing(s.facing === "right" ? 1 : -1);
    v.setPose(s.pose);
    this.actors.get(id)?.setState(s.pose, s.facing);
    v.visible = !s.hidden;
  }

  /** 유닛 머리 위 소형 말풍선(청동 톤 — frames.ts HUD 토큰 대응). mark=null이면 해제. 미매칭 id = no-op. */
  setBubble(id: string, mark: string | null): void {
    const prev = this.bubbles.get(id);
    if (prev) {
      prev.destroy({ children: true });
      this.bubbles.delete(id);
    }
    const v = this.views.get(id);
    if (!v || !mark) return;
    const label = new Text({
      text: mark,
      style: { fontFamily: "serif", fontSize: 14, fontWeight: "700", fill: BUBBLE_PARCHMENT },
    });
    label.anchor.set(0.5);
    const w = Math.max(26, label.width + 14);
    const h = 22;
    const g = new Graphics();
    g.roundRect(-w / 2, -h / 2, w, h, 7).fill({ color: BUBBLE_INK, alpha: 0.92 });
    g.poly([-5, h / 2 - 1, 0, h / 2 + 6, 5, h / 2 - 1]).fill({ color: BUBBLE_INK, alpha: 0.92 });
    g.roundRect(-w / 2, -h / 2, w, h, 7).stroke({ width: 1.5, color: BUBBLE_BRONZE });
    const bubble = new Container();
    bubble.addChild(g, label);
    // Include the bubble half-height AND tail; its bottom stays 12px above the actor's head.
    const headY = TILE_SIZE / 2 - SCENE_ACTOR_HEIGHT;
    bubble.position.set(0, headY - h / 2 - 6 - 12);
    v.addChild(bubble);
    this.bubbles.set(id, bubble);
  }

  destroy(): void {
    // 진행 중 걷기 체인 무효화 — tweens.destroy가 resolve한 walk 루프가 microtask에서 재개될 때
    // gen 불일치 → applySnapFor로 빠지고(views.clear() 후라 no-op) 파괴된 UnitView 접근이 없다.
    this.actionGen++;
    this.destroyRequested = true;
    const b = this.booted;
    if (!b) return; // init 진행 중이면 init 내부 가드가 마무리
    this.booted = null;
    this.views.clear();
    this.actors.clear();
    this.bubbles.clear();
    b.resizeObserver.disconnect();
    b.app.ticker.remove(b.tick);
    b.tweens.destroy(); // 진행 중 걷기 Promise 전부 resolve — 플레이어 교착 방지
    b.textures.destroy();
    b.app.destroy(true, { children: true });
  }
}
