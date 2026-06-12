/**
 * TextureResolver (설계 §2.2) — `(kind, id) => Texture`.
 * v0: 부팅 시 Graphics로 지형 14종 + 진영 2색 베이스 + 하이라이트용 백색 타일을
 * RenderTexture로 1회 베이크 → 전 스프라이트가 공유(풀 배칭).
 * v0.1(에셋 통합): loadSprites()로 manifest.json을 읽어 스프라이트 텍스처를 비동기 로드.
 *   getSprite(spriteId, pose) → Texture | null (null = 폴백 색 사각형 유지 필수)
 * v0.2(지형 타일): loadTiles()로 tiles-manifest.json을 읽어 지형 이미지 타일을 비동기 로드.
 *   getTerrain(terrainId, variant) → 이미지+1px 외곽선 합성 Texture.
 *   미보유 지형/로드 전엔 기존 단색 베이크 반환 (폴백 유지 필수).
 * 향후 atlas frame 반환 구현으로 교체해도 소비측 호출은 불변 — placeholder→에셋 교체 경로의 핵심.
 */
import { Assets, Container, Graphics, Sprite, Texture, type Renderer } from "pixi.js";
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
   * terrainId → variant[] → Texture (이미지+외곽선 합성).
   * loadTiles() 완료 후에만 채워진다.
   */
  private readonly tiles = new Map<string, Texture[]>();
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
   * tiles-manifest.json { terrainId: variantCount } 를 로드하고
   * {terrainId}_{n}.png 를 비동기 로드 → 이미지+1px 외곽선 합성 RenderTexture로 베이크.
   * 실패 시 조용히 폴백(단색 베이크) 유지 — mount는 계속 진행.
   */
  async loadTiles(): Promise<void> {
    let manifest: Record<string, number>;
    try {
      const res = await fetch(`${TILE_BASE}/tiles-manifest.json`);
      if (!res.ok) {
        console.warn(`[TextureResolver] tiles-manifest.json 로드 실패 (${res.status}) — 단색 폴백 유지`);
        return;
      }
      manifest = (await res.json()) as Record<string, number>;
    } catch (e) {
      console.warn("[TextureResolver] tiles-manifest.json fetch 오류 — 단색 폴백 유지", e);
      return;
    }

    // 모든 타일 URL 수집
    const loadQueue: Array<{ terrainId: string; variant: number; url: string }> = [];
    for (const [terrainId, count] of Object.entries(manifest)) {
      for (let n = 0; n < count; n++) {
        const url = `${TILE_BASE}/${terrainId}_${n}.png`;
        loadQueue.push({ terrainId, variant: n, url });
      }
    }

    const urls = loadQueue.map((q) => q.url);
    let loaded: Record<string, Texture> = {};
    try {
      loaded = await Assets.load<Texture>(urls);
    } catch (e) {
      console.warn("[TextureResolver] 지형 타일 텍스처 로드 오류 — 부분 폴백", e);
    }

    // 지형별 variants 배열 구성 + 외곽선 합성 베이크
    const grouped = new Map<string, Array<{ variant: number; url: string }>>();
    for (const q of loadQueue) {
      if (!grouped.has(q.terrainId)) grouped.set(q.terrainId, []);
      grouped.get(q.terrainId)!.push(q);
    }

    for (const [terrainId, entries] of grouped) {
      const variants: Texture[] = [];
      // 항상 원래 순서(variant 번호) 보장
      entries.sort((a, b) => a.variant - b.variant);
      for (const { url } of entries) {
        const rawTex = loaded[url];
        if (!rawTex) continue;
        // 이미지 스프라이트 + 1px 외곽선 합성 → RenderTexture (그리드 가독성 유지)
        const baked = this.bakeImageTile(rawTex, terrainId);
        variants.push(baked);
      }
      if (variants.length > 0) {
        this.tiles.set(terrainId, variants);
      }
    }

    const totalVariants = [...this.tiles.values()].reduce((s, v) => s + v.length, 0);
    console.info(`[TextureResolver] 지형 타일 로드 완료: ${this.tiles.size}종 ${totalVariants}변형`);
  }

  /**
   * 이미지 Texture + 1px 외곽선을 RenderTexture로 합성 베이크.
   * 그리드 가독성을 위해 기존 단색 타일과 동일하게 어두운 외곽선을 씌운다.
   */
  private bakeImageTile(imageTex: Texture, terrainId: string): Texture {
    // 이미지를 TILE_SIZE×TILE_SIZE 스프라이트로, 외곽선을 Graphics로 겹쳐 베이크
    const container = new Container();
    const sprite = new Sprite(imageTex);
    sprite.width = TILE_SIZE;
    sprite.height = TILE_SIZE;

    // 외곽선 색: 해당 지형 단색 베이스의 어두운 버전. 없으면 기본 어두운 회색
    const baseColor = TERRAIN_COLORS[terrainId] ?? 0x333333;
    const outlineColor = darken(baseColor, 0.75);

    const outline = new Graphics();
    outline.rect(0, 0, TILE_SIZE, TILE_SIZE).stroke({ width: 1, color: outlineColor, alpha: 0.85 });

    container.addChild(sprite, outline);
    const tex = this.renderer.generateTexture(container);
    container.destroy({ children: true });
    return tex;
  }

  /**
   * 지형 이미지 타일 텍스처 조회.
   * @param terrainId  지형 ID (TERRAIN_COLORS 키와 동일)
   * @param variant    변형 인덱스 — (x*7 + y*13) % variantCount 패턴으로 호출
   * @returns 이미지+외곽선 합성 Texture. 미보유(로드 전 또는 해당 지형 없음) 시 단색 베이크 폴백.
   */
  getTerrain(terrainId: string, variant: number): Texture {
    const variants = this.tiles.get(terrainId);
    if (variants && variants.length > 0) {
      return variants[variant % variants.length]!;
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
    // tiles는 bakeImageTile()이 생성한 RenderTexture — TextureResolver가 소유
    for (const variants of this.tiles.values()) {
      for (const tex of variants) tex.destroy(true);
    }
    this.tiles.clear();
  }
}
