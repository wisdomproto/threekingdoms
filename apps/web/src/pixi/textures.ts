/**
 * TextureResolver (설계 §2.2) — `(kind, id) => Texture`.
 * v0: 부팅 시 Graphics로 지형 14종 + 진영 2색 베이스 + 하이라이트용 백색 타일을
 * RenderTexture로 1회 베이크 → 전 스프라이트가 공유(풀 배칭).
 * v0.1(에셋 통합): loadSprites()로 manifest.json을 읽어 스프라이트 텍스처를 비동기 로드.
 *   getSprite(spriteId, pose) → Texture | null (null = 폴백 색 사각형 유지 필수)
 * v0.2(지형 타일): loadTiles()로 tiles-manifest.json v2를 읽어 지형 이미지 타일을 비동기 로드.
 *   manifest v2 형식: { terrainId: { kind: "macro"|"tile", size: 6|1, count: N } }
 *   - kind="macro": terrainId_macro_{n}.png (288×288). getTerrain(id, x, y)에서
 *     (x%6, y%6) 기반 서브렉트 Texture를 반환 — 인접 타일이 같은 매크로를 공유해 이어진 지도처럼 보임.
 *     캐시 키: "${id}:macro:${n}:${mx}:${my}" (지형당 최대 6×6×count개).
 *   - kind="tile": terrainId_{n}.png (96×96). 기존 변형 해시 방식 유지.
 *   getTerrain 시그니처: (terrainId, x, y) — variant 해시는 내부에서 처리.
 *   미보유 지형/로드 전엔 기존 단색 베이크 반환 (폴백 유지 필수).
 *   외곽선: macro 지형은 없음(이어짐이 핵심), tile 지형은 alpha 0.25로 완화.
 * 향후 atlas frame 반환 구현으로 교체해도 소비측 호출은 불변 — placeholder→에셋 교체 경로의 핵심.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Texture, type Renderer } from "pixi.js";
import { TILE_SIZE } from "./projection";

/** 지형 14종 베이스 색 (terrains.json의 id와 1:1) */
export const TERRAIN_COLORS: Record<string, number> = {
  plain: 0xd9cf9d, // 평지 — 밝은 황토
  grass: 0xa8c686, // 초원
  bridge: 0xb08a5a, // 다리
  waste: 0xc7b58f, // 황무지
  village: 0xe0b87a, // 촌락
  barracks: 0xcf9e6a, // 병영
  depot: 0xc9a86e, // 보물창고
  forest: 0x5e8c5a, // 삼림
  mountain: 0x8c7a5e, // 산지
  fort: 0x9e8e7a, // 요새
  gate: 0x7a6a52, // 성문
  river: 0x6a9ec9, // 하천
  wall: 0x6e6e76, // 성벽
  cliff: 0x5a5048, // 절벽
};

/** 진영 2색 — 유닛 베이스 */
export const SIDE_COLORS: Record<"player" | "enemy", number> = {
  player: 0x2f6fce,
  enemy: 0xc23b3b,
};

export type TextureKind = "terrain" | "side" | "white";

/** manifest.json 형식 (slice_sheets.py 출력) */
interface ManifestEntry {
  poses: string[];
  source: string;
  method: string;
  note?: string;
}
type Manifest = Record<string, ManifestEntry>;

/** tiles-manifest.json v2 형식 */
interface TileManifestEntry {
  kind: "macro" | "tile";
  size: number; // macro=6, tile=1
  count: number;
}
type TilesManifest = Record<string, TileManifestEntry>;

/** 스프라이트 포즈 키: "{view}_{pose}" */
export type SpritePose = "front_idle" | "front_move" | "front_attack" | "back_idle" | "back_move" | "back_attack";

const SPRITE_BASE = "/assets/sprites";
const TILE_BASE = "/assets/tiles";

function darken(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/** 유닛 베이스 사각형 크기 (타일보다 약간 작게 — 지형이 비쳐 보이도록) */
export const UNIT_BASE_SIZE = TILE_SIZE - 10;

export class TextureResolver {
  private readonly baked = new Map<string, Texture>();
  /** spriteId → pose → Texture. loadSprites() 완료 후에만 채워진다 */
  private readonly sprites = new Map<string, Map<string, Texture>>();
  /**
   * 지형 메타: terrainId → TileManifestEntry.
   * loadTiles() 완료 후에만 채워진다.
   */
  private readonly tileMeta = new Map<string, TileManifestEntry>();
  /**
   * tile 지형: terrainId → variant[] → Texture (이미지+외곽선 합성, 96×96).
   */
  private readonly tileTex = new Map<string, Texture[]>();
  /**
   * macro 지형: terrainId → variantIndex → rawTexture (288×288 원본).
   * 서브렉트 텍스처는 macroSubRect 캐시에서 온디맨드 생성.
   */
  private readonly macroTex = new Map<string, Texture[]>();
  /**
   * macro 서브렉트 텍스처 캐시.
   * 키: "${terrainId}:${variantIdx}:${mx}:${my}" → Texture (48×48 서브렉트)
   */
  private readonly macroSubCache = new Map<string, Texture>();
  /** Pixi Renderer 참조 — 타일 텍스처 베이크에 필요 */
  private readonly renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    // 지형 14종: 베이스 색 + 살짝 어두운 외곽선(그리드 가독성)
    for (const [id, color] of Object.entries(TERRAIN_COLORS)) {
      const g = new Graphics();
      g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(color);
      g.rect(0, 0, TILE_SIZE, TILE_SIZE).stroke({ width: 1, color: darken(color, 0.8), alpha: 0.9 });
      // 통행 불가/구조물 계열은 음영 패턴 한 줄로 구분감만 부여
      if (id === "wall" || id === "cliff" || id === "river") {
        g.moveTo(0, TILE_SIZE).lineTo(TILE_SIZE, 0).stroke({ width: 2, color: darken(color, 0.65) });
      }
      if (id === "mountain" || id === "fort") {
        g.moveTo(8, TILE_SIZE - 10)
          .lineTo(TILE_SIZE / 2, 10)
          .lineTo(TILE_SIZE - 8, TILE_SIZE - 10)
          .stroke({ width: 2, color: darken(color, 0.7) });
      }
      if (id === "forest") {
        g.circle(TILE_SIZE / 2, TILE_SIZE / 2, 9).stroke({ width: 2, color: darken(color, 0.7) });
      }
      if (id === "gate") {
        g.rect(10, 8, TILE_SIZE - 20, TILE_SIZE - 16).stroke({ width: 2, color: darken(color, 0.6) });
      }
      this.bake(renderer, `terrain:${id}`, g);
    }

    // 진영 2색: 유닛 베이스 (라운드 사각 + 진한 테두리)
    for (const [side, color] of Object.entries(SIDE_COLORS)) {
      const g = new Graphics();
      g.roundRect(0, 0, UNIT_BASE_SIZE, UNIT_BASE_SIZE, 8).fill(color);
      g.roundRect(0, 0, UNIT_BASE_SIZE, UNIT_BASE_SIZE, 8).stroke({ width: 2, color: darken(color, 0.55) });
      this.bake(renderer, `side:${side}`, g);
    }

    // 백색 타일 — 하이라이트/고스트/커서가 tint+alpha로 재사용
    const w = new Graphics();
    w.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0xffffff);
    this.bake(renderer, "white:tile", w);
  }

  private bake(renderer: Renderer, key: string, g: Graphics): void {
    const tex = renderer.generateTexture(g);
    g.destroy();
    this.baked.set(key, tex);
  }

  /** 미지의 id는 즉시 throw — 데이터 오타를 조용히 흡수하지 않는다 */
  get(kind: TextureKind, id: string): Texture {
    const tex = this.baked.get(`${kind}:${id}`);
    if (!tex) throw new Error(`TextureResolver: 미등록 텍스처 ${kind}:${id}`);
    return tex;
  }

  /**
   * manifest.json을 로드하고 등록된 스프라이트 텍스처를 비동기 로드.
   * BattleRenderer.mount() 내에서 await — 실패해도 폴백(색 사각형)이 유지되므로 throw하지 않음.
   */
  async loadSprites(): Promise<void> {
    let manifest: Manifest;
    try {
      const res = await fetch(`${SPRITE_BASE}/manifest.json`);
      if (!res.ok) {
        console.warn(`[TextureResolver] manifest.json 로드 실패 (${res.status}) — 색 사각형 폴백 유지`);
        return;
      }
      manifest = (await res.json()) as Manifest;
    } catch (e) {
      console.warn("[TextureResolver] manifest.json fetch 오류 — 색 사각형 폴백 유지", e);
      return;
    }

    const loadQueue: Array<{ spriteId: string; pose: string; url: string }> = [];
    for (const [spriteId, entry] of Object.entries(manifest)) {
      for (const pose of entry.poses) {
        const url = `${SPRITE_BASE}/${spriteId}/${pose}.png`;
        loadQueue.push({ spriteId, pose, url });
      }
    }

    // Assets.load는 URL 배열을 한 번에 처리 (내부적으로 병렬)
    const urls = loadQueue.map((q) => q.url);
    let loaded: Record<string, Texture> = {};
    try {
      loaded = await Assets.load<Texture>(urls);
    } catch (e) {
      console.warn("[TextureResolver] 스프라이트 텍스처 로드 오류 — 부분 폴백", e);
    }

    for (const { spriteId, pose, url } of loadQueue) {
      const tex = loaded[url];
      if (!tex) continue;
      if (!this.sprites.has(spriteId)) {
        this.sprites.set(spriteId, new Map());
      }
      this.sprites.get(spriteId)!.set(pose, tex);
    }

    const loadedCount = [...this.sprites.values()].reduce((s, m) => s + m.size, 0);
    console.info(`[TextureResolver] 스프라이트 로드 완료: ${this.sprites.size}종 ${loadedCount}컷`);
  }

  /**
   * tiles-manifest.json v2 { terrainId: { kind, size, count } } 를 로드.
   * - kind="macro": {terrainId}_macro_{n}.png (288×288) 로드 → 서브렉트는 온디맨드.
   * - kind="tile": {terrainId}_{n}.png (96×96) 로드 → 기존 외곽선 합성 베이크.
   * 실패 시 조용히 폴백(단색 베이크) 유지 — mount는 계속 진행.
   */
  async loadTiles(): Promise<void> {
    let manifest: TilesManifest;
    try {
      const res = await fetch(`${TILE_BASE}/tiles-manifest.json`);
      if (!res.ok) {
        console.warn(`[TextureResolver] tiles-manifest.json 로드 실패 (${res.status}) — 단색 폴백 유지`);
        return;
      }
      manifest = (await res.json()) as TilesManifest;
    } catch (e) {
      console.warn("[TextureResolver] tiles-manifest.json fetch 오류 — 단색 폴백 유지", e);
      return;
    }

    // manifest v2와 v1(숫자) 둘 다 허용 — 이전 파일 호환
    const normalizedManifest: TilesManifest = {};
    for (const [tid, entry] of Object.entries(manifest)) {
      if (typeof entry === "number") {
        // v1 호환: 숫자 = tile kind
        normalizedManifest[tid] = { kind: "tile", size: 1, count: entry as number };
      } else {
        normalizedManifest[tid] = entry as TileManifestEntry;
      }
    }

    // URL 수집
    const loadQueue: Array<{ terrainId: string; variant: number; url: string; kind: "macro" | "tile" }> = [];
    for (const [terrainId, meta] of Object.entries(normalizedManifest)) {
      for (let n = 0; n < meta.count; n++) {
        const url = meta.kind === "macro"
          ? `${TILE_BASE}/${terrainId}_macro_${n}.png`
          : `${TILE_BASE}/${terrainId}_${n}.png`;
        loadQueue.push({ terrainId, variant: n, url, kind: meta.kind });
      }
    }

    const urls = loadQueue.map((q) => q.url);
    let loaded: Record<string, Texture> = {};
    try {
      loaded = await Assets.load<Texture>(urls);
    } catch (e) {
      console.warn("[TextureResolver] 지형 타일 텍스처 로드 오류 — 부분 폴백", e);
    }

    // 지형별 분류
    const macroGrouped = new Map<string, Array<{ variant: number; url: string }>>();
    const tileGrouped = new Map<string, Array<{ variant: number; url: string }>>();

    for (const q of loadQueue) {
      if (q.kind === "macro") {
        if (!macroGrouped.has(q.terrainId)) macroGrouped.set(q.terrainId, []);
        macroGrouped.get(q.terrainId)!.push(q);
      } else {
        if (!tileGrouped.has(q.terrainId)) tileGrouped.set(q.terrainId, []);
        tileGrouped.get(q.terrainId)!.push(q);
      }
    }

    // macro 지형: 원본 텍스처를 그대로 저장 (서브렉트는 온디맨드)
    for (const [terrainId, entries] of macroGrouped) {
      entries.sort((a, b) => a.variant - b.variant);
      const textures: Texture[] = [];
      for (const { url } of entries) {
        const rawTex = loaded[url];
        if (!rawTex) continue;
        textures.push(rawTex);
      }
      if (textures.length > 0) {
        this.macroTex.set(terrainId, textures);
        this.tileMeta.set(terrainId, normalizedManifest[terrainId]!);
      }
    }

    // tile 지형: 기존 외곽선 합성 베이크 (alpha 0.25로 완화)
    for (const [terrainId, entries] of tileGrouped) {
      entries.sort((a, b) => a.variant - b.variant);
      const variants: Texture[] = [];
      for (const { url } of entries) {
        const rawTex = loaded[url];
        if (!rawTex) continue;
        const baked = this.bakeImageTile(rawTex, terrainId);
        variants.push(baked);
      }
      if (variants.length > 0) {
        this.tileTex.set(terrainId, variants);
        this.tileMeta.set(terrainId, normalizedManifest[terrainId]!);
      }
    }

    const macroCount = [...this.macroTex.values()].reduce((s, v) => s + v.length, 0);
    const tileCount = [...this.tileTex.values()].reduce((s, v) => s + v.length, 0);
    console.info(`[TextureResolver] 지형 타일 로드 완료: macro ${this.macroTex.size}종 ${macroCount}장, tile ${this.tileTex.size}종 ${tileCount}변형`);
  }

  /**
   * tile 지형: 이미지 Texture + 1px 외곽선 합성 (alpha 0.25로 완화).
   * 그리드 가독성은 선택 하이라이트가 담당 — 외곽선은 보조 역할만.
   */
  private bakeImageTile(imageTex: Texture, terrainId: string): Texture {
    const container = new Container();
    const sprite = new Sprite(imageTex);
    sprite.width = TILE_SIZE;
    sprite.height = TILE_SIZE;

    const baseColor = TERRAIN_COLORS[terrainId] ?? 0x333333;
    const outlineColor = darken(baseColor, 0.75);

    const outline = new Graphics();
    outline.rect(0, 0, TILE_SIZE, TILE_SIZE).stroke({ width: 1, color: outlineColor, alpha: 0.25 });

    container.addChild(sprite, outline);
    const tex = this.renderer.generateTexture(container);
    container.destroy({ children: true });
    return tex;
  }

  /**
   * macro 지형: (x%6, y%6) 기반 48×48 서브렉트 Texture를 반환 (온디맨드 생성, 캐시).
   * 매크로 텍스처 1장이 6×6 타일을 커버 → 인접 타일이 연속된 그림처럼 보임.
   */
  private getMacroSubRect(terrainId: string, variantIdx: number, mx: number, my: number): Texture | null {
    const macros = this.macroTex.get(terrainId);
    if (!macros || macros.length === 0) return null;
    const baseTex = macros[variantIdx % macros.length];
    if (!baseTex) return null;

    const cacheKey = `${terrainId}:${variantIdx % macros.length}:${mx}:${my}`;
    const cached = this.macroSubCache.get(cacheKey);
    if (cached) return cached;

    // 매크로 텍스처 실제 크기 (devicePixelRatio 무관하게 논리 크기 기준)
    const macroLogical = TILE_SIZE * 6; // 288px
    const cellSize = macroLogical / 6;  // 48px = TILE_SIZE

    const frame = new Rectangle(mx * cellSize, my * cellSize, cellSize, cellSize);
    const sub = new Texture({ source: baseTex.source, frame });
    this.macroSubCache.set(cacheKey, sub);
    return sub;
  }

  /**
   * 지형 이미지 타일 텍스처 조회.
   * @param terrainId  지형 ID
   * @param x          그리드 x 좌표 (macro: x%6 → 서브렉트 컬럼)
   * @param y          그리드 y 좌표 (macro: y%6 → 서브렉트 행)
   * @returns Texture. 미보유(로드 전 또는 미지원 지형) 시 단색 베이크 폴백.
   */
  getTerrain(terrainId: string, x: number, y: number): Texture {
    const meta = this.tileMeta.get(terrainId);

    if (meta?.kind === "macro") {
      // macro: 어떤 변형을 선택할지 결정 (count가 1이면 항상 0)
      const variantIdx = meta.count > 1 ? ((x * 7 + y * 13) % meta.count) : 0;
      const mx = x % meta.size;
      const my = y % meta.size;
      const sub = this.getMacroSubRect(terrainId, variantIdx, mx, my);
      if (sub) return sub;
    } else if (meta?.kind === "tile") {
      const variants = this.tileTex.get(terrainId);
      if (variants && variants.length > 0) {
        const variant = (x * 7 + y * 13) % variants.length;
        return variants[variant]!;
      }
    }

    // 폴백: 기존 단색 베이크 (로드 전 또는 미지원 지형)
    return this.get("terrain", terrainId);
  }

  /**
   * 스프라이트 텍스처 조회. 미보유 시 null (폴백: 색 사각형 — 설계 §필수).
   * view: "front"|"back", pose: "idle"|"move"|"attack"
   */
  getSprite(spriteId: string, view: "front" | "back", pose: "idle" | "move" | "attack"): Texture | null {
    const poseKey = `${view}_${pose}`;
    const poseMap = this.sprites.get(spriteId);
    if (!poseMap) return null;

    // 정확한 포즈 키 우선, 없으면 같은 뷰의 idle로 그레이스풀 폴백
    return poseMap.get(poseKey) ?? poseMap.get(`${view}_idle`) ?? null;
  }

  destroy(): void {
    for (const tex of this.baked.values()) tex.destroy(true);
    this.baked.clear();
    // sprites는 Assets 전역 캐시가 관리 — 여기서 개별 destroy 안 함 (공유 참조 보호)
    this.sprites.clear();
    // tileTex: bakeImageTile()이 생성한 RenderTexture — TextureResolver가 소유
    for (const variants of this.tileTex.values()) {
      for (const tex of variants) tex.destroy(true);
    }
    this.tileTex.clear();
    // macroTex: Assets 전역 캐시가 관리 — 공유 참조 보호
    this.macroTex.clear();
    // macroSubCache: source 공유 Texture — source는 macroTex가 소유하므로 frame만 정리
    for (const tex of this.macroSubCache.values()) tex.destroy(false);
    this.macroSubCache.clear();
    this.tileMeta.clear();
  }
}
