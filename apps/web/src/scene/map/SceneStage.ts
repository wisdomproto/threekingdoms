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

/** 스프라이트 표시 높이(UnitView SPRITE_DISPLAY_H와 동일 산식) — 말풍선 머리 위 배치용. */
const SPRITE_H = Math.round(TILE_SIZE * 1.25);
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
  private readonly bubbles = new Map<string, Container>();
  private walkable: Walkable = () => false;
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
    const textures = new TextureResolver(app.renderer);
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
        { bars: false },
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
      .loadSprites(() => scheduleRefresh())
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
  }

  /** 카메라 = 맵 전체 화면 fit(레터박스 중앙 정렬). 씬 맵은 ~15×10이라 팬/줌 불필요. */
  private fit(): void {
    const b = this.booted;
    if (!b) return;
    const sw = b.app.screen.width;
    const sh = b.app.screen.height;
    const ww = this.mapW * TILE_SIZE;
    const wh = this.mapH * TILE_SIZE;
    if (ww <= 0 || wh <= 0 || sw <= 0 || sh <= 0) return;
    const scale = Math.min(sw / ww, sh / wh);
    b.world.scale.set(scale);
    b.world.position.set((sw - ww * scale) / 2, (sh - wh * scale) / 2);
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
   * 한 줄의 액션을 순차 실행 — 정렬 = 인터프리터 계약과 동일(exit→move→face→enter→pose).
   * 미매칭 id·도달 불가 경로 = no-op(무붕괴). 탭 스킵(skipToState)이 끼어들면 타일 경계에서
   * 끊고 조용히 종료(플레이어는 자체 토큰으로 이중 전이를 거른다).
   */
  async runLineActions(line: MapSceneLine, target: ReadonlyMap<string, SceneUnitState>): Promise<void> {
    const gen = ++this.actionGen; // 새 줄 = 이전 잔여 걷기 무효화
    for (const { id, to } of line.exit ?? []) {
      const v = this.views.get(id);
      if (!v) continue;
      await this.walk(gen, id, v, to);
      if (this.actionGen !== gen) return;
      v.visible = false;
    }
    for (const { id, to } of line.move ?? []) {
      const v = this.views.get(id);
      if (!v) continue;
      await this.walk(gen, id, v, to);
      if (this.actionGen !== gen) return;
    }
    for (const { id, dir } of line.face ?? []) {
      this.views.get(id)?.setFacing(dir === "right" ? 1 : -1);
    }
    for (const { id, from, to } of line.enter ?? []) {
      const v = this.views.get(id);
      if (!v) continue;
      v.snapTo(from[0], from[1]);
      v.visible = true;
      await this.walk(gen, id, v, to);
      if (this.actionGen !== gen) return;
    }
    for (const { id, pose } of line.pose ?? []) {
      const v = this.views.get(id);
      if (!v) continue;
      v.setPose(pose);
      const t = target.get(id);
      if (t) v.setFacing(t.facing === "right" ? 1 : -1); // setPose가 텍스처 재적용 — facing 재보증
    }
  }

  /**
   * 타일 단위 걷기 — moveAlong(발소리 SFX 주입, 전투 배선 미러)을 1타일 조각으로 호출해
   * skipToState가 다음 타일 경계에서 끊을 수 있게 한다. 끊긴 뒤엔 lastSnap으로 재정합
   * (잔여 트윈이 스냅 위치를 덮었을 수 있으므로).
   */
  private async walk(gen: number, id: string, v: UnitView, to: Cell): Promise<void> {
    const path = findScenePath(this.walkable, [v.gridX, v.gridY], to);
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1]!;
      const step = path[i]!;
      await v.moveAlong(
        [{ x: from[0], y: from[1] }, { x: step[0], y: step[1] }],
        undefined,
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
    // 컨테이너 원점 = 타일 중심. 발 = +TILE/2, 머리 = 발 - 스프라이트 높이 → 그 위 여백.
    bubble.position.set(0, TILE_SIZE / 2 - SPRITE_H - 14);
    v.addChild(bubble);
    this.bubbles.set(id, bubble);
  }

  destroy(): void {
    this.destroyRequested = true;
    const b = this.booted;
    if (!b) return; // init 진행 중이면 init 내부 가드가 마무리
    this.booted = null;
    this.views.clear();
    this.bubbles.clear();
    b.resizeObserver.disconnect();
    b.app.ticker.remove(b.tick);
    b.tweens.destroy(); // 진행 중 걷기 Promise 전부 resolve — 플레이어 교착 방지
    b.textures.destroy();
    b.app.destroy(true, { children: true });
  }
}
