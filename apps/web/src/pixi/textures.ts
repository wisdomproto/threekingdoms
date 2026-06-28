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
import type { Side } from "@tk/data";
import { TILE_SIZE } from "./projection";
import { assetUrl } from "../assetUrl";
import type { Skeleton } from "./skeleton";

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

/** 진영 3색 — 유닛 베이스 (Tier 2-1: 아군 파랑 / 우군 주황 / 적 빨강) */
export const SIDE_COLORS: Record<Side, number> = {
  player: 0x2f6fce,
  ally: 0xe08a2a, // 우군(AI 아군측 NPC) — 아군 파랑과 적 빨강 사이의 주황으로 피아 즉시 구분
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

/**
 * 특징 지형 → 오브젝트 데코 스프라이트 (slice_extras.py, /assets/tiles/).
 * 톱다운 문법: 바닥은 베이스 텍스처, 그 위에 오브젝트를 얹는다 — 바닥을 그림 조각으로 채우지 않는다.
 */
const DECO_FILES: Record<string, string> = {
  // forest는 캐노피 바닥(E-3)이 곧 숲 — 나무 데코 없음.
  mountain: "mountain.png", // 바위 바닥(E-2) 위 봉우리 액센트 (희소 배치, TerrainLayer DECO_DENSITY)
  gate: "gate.png",
  village: "hut.png",
  barracks: "camp.png",
  depot: "storehouse.png",
  bridge: "bridge.png",
};

/** 맵 구조물 오브젝트 텍스처 (ObjectLayer). 성벽 세그먼트(오토타일) + 성문 상태. /assets/objects/.
 *  미보유 키는 로드 실패 → null, ObjectLayer가 스킵(아트는 후속 컷 도구로 채움). */
const OBJECT_FILES: Record<string, string> = {
  wall_single: "wall_single.png", wall_end: "wall_end.png", wall_straight: "wall_straight.png",
  wall_corner: "wall_corner.png", wall_tee: "wall_tee.png", wall_cross: "wall_cross.png",
  gate_closed: "gate_closed.png", gate_open: "gate_open.png", gate_destroyed: "gate_destroyed.png",
  // K-5/K-6 데코 오브젝트 (objectModel.DECO_OBJECT_MAP가 지형→이 키로 매핑). 미보유 시 옛 데코 폴백.
  rock_cluster: "rock_cluster.png", rock_cliff: "rock_cliff.png", tree_leafy: "tree_leafy.png",
  supply_cart: "supply_cart.png", camp_gate: "camp_gate.png",
};
const OBJECT_BASE = assetUrl("/assets/objects");

// 전투 타격 fx 텍스처(검은배경 발광, additive). 미보유 키는 FxLayer가 절차적 폴백.
const FX_FILES: Record<string, string> = {
  slash: "slash.png", flash: "flash.png", sparkle: "sparkle.png", coin: "coin.png",
};
const FX_BASE = assetUrl("/assets/fx");

/**
 * 지형 → 시임리스 바닥 텍스처 (E-* 에셋, 576×576). getGround에서 (gx,gy) wrap 서브렉트.
 * 미등록 지형은 단색 베이크 폴백.
 */
const GROUND_FILES: Record<string, string> = {
  plain: "ground_plain.png",
  grass: "ground_grass.png",
  waste: "ground_waste.png",
  mountain: "ground_mountain.png", // E-2 바위 스크리
  forest: "ground_forest.png", // E-3 캐노피
  river: "ground_river.png", // E-4 강물 (파일 없으면 단색 폴백 — loadGround 파일별 내성)
  // 전용 바닥 미보유 지형 — 기존 텍스처 재사용으로 회색 단색 폴백 제거(리뷰 P0).
  wall: "ground_mountain.png", // 성벽 = 돌
  fort: "ground_mountain.png", // 요새 = 돌
  cliff: "ground_mountain.png", // 절벽 = 돌
  gate: "ground_plain.png", // 관문 바닥(데코=문) = 흙
  barracks: "ground_plain.png", // 병영(데코=막사) = 흙
  village: "ground_plain.png", // 촌락(데코=오두막)
  depot: "ground_plain.png", // 창고(데코=곳간)
  bridge: "ground_plain.png", // 다리 — 물 텍스처(E-4) 전까지 흙
};
const GROUND_SIZE = 576; // 48 × 12 — 서브렉트가 깔끔히 wrap

/** 스프라이트 포즈 키: "{view}_{pose}" */
export type SpritePose = "front_idle" | "front_move" | "front_attack" | "back_idle" | "back_move" | "back_attack";

// assetUrl로 베이스를 한 번만 해석 → 이하 `${SPRITE_BASE}/...` 조합이 자동으로 R2/CDN을 탄다.
const SPRITE_BASE = assetUrl("/assets/sprites");
const TILE_BASE = assetUrl("/assets/tiles");

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
   * spriteId → 리그(스켈레톤 + 파트 텍스처) | null(미보유/부분실패 → 베이크 폴백).
   * loadSkeleton() 결과 캐시 — 같은 spriteId 유닛이 여럿이어도 1회만 로드. null도 캐시(재시도 안 함).
   */
  private readonly skeletons = new Map<string, { skeleton: Skeleton; textures: Map<string, Texture> } | null>();
  private readonly skeletonPromises = new Map<string, Promise<{ skeleton: Skeleton; textures: Map<string, Texture> } | null>>();
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
  /** 특징 지형 오브젝트 데코: terrainId → Texture. loadTiles() 내에서 로드. */
  private readonly decoTex = new Map<string, Texture>();
  /** 맵 구조물 오브젝트 텍스처: 키(wall_단어 | gate_상태) → Texture. loadObjects() 후 채워짐. */
  private readonly objectTex = new Map<string, Texture>();
  /** 전투 타격 fx 텍스처: 키(slash|flash|sparkle|coin 등) → Texture. loadFx() 후 채워짐. */
  private readonly fxTex = new Map<string, Texture>();
  /** 시임리스 바닥 원본: terrainId → Texture (576×576). */
  private readonly groundTex = new Map<string, Texture>();
  /** 바닥 서브렉트 캐시: "${terrainId}:${mx}:${my}" → Texture (48×48). */
  private readonly groundSubCache = new Map<string, Texture>();
  /** Pixi Renderer 참조 — 타일 텍스처 베이크에 필요 */
  private readonly renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    // 지형 14종 단색 폴백 — 바닥 텍스처(getGround) 미보유 지형에만 보인다.
    // 평평한 단색만. 빗금/삼각형 장식은 "미완성"으로 보여 제거(리뷰 P2). 그리드는 HighlightLayer 담당.
    for (const [id, color] of Object.entries(TERRAIN_COLORS)) {
      const g = new Graphics();
      g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(color);
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
   *
   * onProgress: 텍스처 1개가 도착해 등록될 때마다 호출(점진 표시). 호출측이 디바운스해
   *   해당 유닛을 refreshSprite하면, 매니페스트 전 종(60종×3≈180컷)의 로드를 기다리지 않고
   *   먼저 도착한 스프라이트부터 화면에 뜬다. 종전엔 allSettled로 *전부* settle된 뒤에야
   *   refreshSprites를 불러, cross-origin 180컷이 6연결로 직렬화되는 수십 초 동안 화면에
   *   실제 등장하는 소수 유닛(예: 삼형제)도 색사각으로 남았다. 매니페스트 선두가 삼형제라
   *   점진 적용 시 첫 라운드(수백 ms)에 바로 표시된다.
   */
  async loadSprites(onProgress?: () => void): Promise<void> {
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

    // 개별 로드 + 도착 즉시 등록(allSettled로 전체 완료만 대기 — 반환 시점용).
    // - per-file 내성: 매니페스트에 등록됐으나 파일이 없는(삭제/미생성) 포즈가 404여도 그 포즈만 빠지고
    //   나머지는 정상(단일 배치 Assets.load는 1개 실패에 전체 거부라 위험 — loadGround와 동일).
    // - 점진 적용: 각 .then에서 즉시 sprites에 넣고 onProgress로 통지 → 호출측이 그 유닛만 갱신.
    await Promise.allSettled(
      loadQueue.map((q) =>
        Assets.load<Texture>(q.url).then((tex) => {
          if (!tex) return;
          if (!this.sprites.has(q.spriteId)) {
            this.sprites.set(q.spriteId, new Map());
          }
          this.sprites.get(q.spriteId)!.set(q.pose, tex);
          onProgress?.();
        }),
      ),
    );

    const loadedCount = [...this.sprites.values()].reduce((s, m) => s + m.size, 0);
    console.info(`[TextureResolver] 스프라이트 로드 완료: ${this.sprites.size}종 ${loadedCount}컷`);
  }

  /**
   * tiles-manifest.json v2 { terrainId: { kind, size, count } } 를 로드.
   * - kind="macro": {terrainId}_macro_{n}.png (288×288) 로드 → 서브렉트는 온디맨드.
   * - kind="tile": {terrainId}_{n}.png (96×96) 로드 → 기존 외곽선 합성 베이크.
   * 실패 시 조용히 폴백(단색 베이크) 유지 — mount는 계속 진행.
   */
  /** 특징 지형 오브젝트 데코 로드 (실패해도 베이스 유지 — throw 안 함). */
  private async loadDecos(): Promise<void> {
    const entries = Object.entries(DECO_FILES);
    const urls = entries.map(([, f]) => `${TILE_BASE}/${f}`);
    try {
      const loaded = await Assets.load<Texture>(urls);
      for (const [terrainId, f] of entries) {
        const tex = loaded[`${TILE_BASE}/${f}`];
        if (tex) this.decoTex.set(terrainId, tex);
      }
      console.info(`[TextureResolver] 지형 데코 로드 완료: ${this.decoTex.size}종`);
    } catch (e) {
      console.warn("[TextureResolver] 지형 데코 로드 오류 — 베이스만 유지", e);
    }
  }

  /** 전투 배경(원경 패럴랙스) 텍스처. loadBackground() 후에만 채워진다. */
  private bgTex: Texture | null = null;

  /**
   * 스테이지 painted 맵 배경 로드 (/assets/maps/{stageId}.{webp,png}).
   * webp 우선(업스케일 고해상 배경은 webp로 용량 절감), 없으면 png 폴백.
   * 있으면 타일 렌더 대신 이 그림 한 장을 깔고, 격자 데이터는 게임 로직에만 쓴다.
   * 없으면 null → 기존 타일 렌더 유지.
   */
  async loadMapBackground(stageId: string): Promise<Texture | null> {
    for (const ext of ["webp", "png"]) {
      const url = assetUrl(`/assets/maps/${stageId}.${ext}`);
      try {
        const head = await fetch(url, { method: "HEAD" });
        if (!head.ok) continue;
        const tex = await Assets.load<Texture>(url);
        if (tex) {
          console.info(`[TextureResolver] 맵 배경 로드: ${stageId}.${ext}`);
          return tex;
        }
      } catch (e) {
        console.warn(`[TextureResolver] 맵 배경 로드 오류(${stageId}.${ext})`, e);
      }
    }
    return null; // 둘 다 없음 → 타일 렌더 유지
  }

  /**
   * 자체 컷아웃 리그 로드 (/assets/skeletons/{spriteId}/{spriteId}.skeleton.json + 파트 PNG).
   * rig-editor.html이 내보낸 스켈레톤 JSON과 파트 PNG를 읽어 {skeleton, textures}를 반환.
   * 방어적 폴백: JSON 없음·파싱 실패·파트 이미지 0장이면 null → UnitView는 베이크 스프라이트 유지(무회귀).
   * 결과(null 포함) 캐시 — 같은 spriteId 유닛이 여럿이어도 1회만 로드.
   */
  async loadSkeleton(spriteId: string): Promise<{ skeleton: Skeleton; textures: Map<string, Texture> } | null> {
    if (this.skeletons.has(spriteId)) return this.skeletons.get(spriteId)!;
    const pending = this.skeletonPromises.get(spriteId);
    if (pending) return pending;
    const p = this.loadSkeletonInner(spriteId);
    this.skeletonPromises.set(spriteId, p);
    const result = await p;
    this.skeletons.set(spriteId, result);
    return result;
  }

  private async loadSkeletonInner(
    spriteId: string,
  ): Promise<{ skeleton: Skeleton; textures: Map<string, Texture> } | null> {
    const base = assetUrl(`/assets/skeletons/${spriteId}`);
    // dev에선 리그를 자주 갈아끼우므로 캐시버스터로 항상 최신 fetch(브라우저 stale 방지). prod은 캐시 유지.
    const dev = process.env.NODE_ENV !== "production";
    const bust = dev ? `?t=${Date.now()}` : "";
    const fetchOpts: RequestInit = dev ? { cache: "no-store" } : {};
    let skeleton: Skeleton;
    try {
      const res = await fetch(`${base}/${spriteId}.skeleton.json${bust}`, fetchOpts);
      if (!res.ok) return null; // 리그 미보유 — 베이크 폴백
      skeleton = (await res.json()) as Skeleton;
    } catch {
      return null;
    }
    if (!skeleton || skeleton.version !== 1 || !Array.isArray(skeleton.bones)) return null;

    // 어태치먼트가 참조하는 모든 파트 이미지 수집 → 개별 로드(하나 실패해도 나머지 유지).
    const images = new Set<string>();
    for (const atts of Object.values(skeleton.attachments ?? {})) {
      for (const att of Object.values(atts)) images.add(att.image);
    }
    if (images.size === 0) return null;

    const textures = new Map<string, Texture>();
    await Promise.all(
      [...images].map(async (img) => {
        try {
          const tex = await Assets.load<Texture>(`${base}/${img}${bust}`);
          if (tex) textures.set(img, tex);
        } catch {
          /* 개별 파트 누락 — 해당 슬롯만 미표시 */
        }
      }),
    );
    // 파트가 하나도 없으면 리그 미적용(빈 유닛 방지) → 베이크 폴백.
    if (textures.size === 0) return null;
    console.info(`[TextureResolver] 리그 로드: ${spriteId} (${textures.size}/${images.size} 파트)`);
    return { skeleton, textures };
  }

  /** 맵 뒤 배경 텍스처 로드. 실패해도 null 반환(배경 없이 진행). */
  async loadBackground(): Promise<Texture | null> {
    try {
      const tex = await Assets.load<Texture>(assetUrl("/assets/bg/battle_dawn.png"));
      this.bgTex = tex ?? null;
      if (tex) console.info("[TextureResolver] 전투 배경 로드 완료");
      return this.bgTex;
    } catch (e) {
      console.warn("[TextureResolver] 전투 배경 로드 오류 — 배경 없이 진행", e);
      return null;
    }
  }

  /** 시임리스 바닥 텍스처 로드 (실패해도 단색 베이크 유지). */
  private async loadGround(): Promise<void> {
    // 파일별 독립 로드 — 한 지형 파일이 없어도(404) 나머지는 정상(그 지형만 단색 폴백).
    // 배치 Assets.load는 한 url 404 시 전체 reject라, 신규 바닥(ground_river 등) 추가에 취약했음.
    const entries = Object.entries(GROUND_FILES);
    await Promise.all(entries.map(async ([terrainId, f]) => {
      try {
        const tex = await Assets.load<Texture>(`${TILE_BASE}/${f}`);
        if (tex) this.groundTex.set(terrainId, tex);
      } catch { /* 파일 없음 → 그 지형은 단색 폴백 */ }
    }));
    console.info(`[TextureResolver] 시임리스 바닥 로드 완료: ${this.groundTex.size}종`);
  }

  /** 특징 지형의 오브젝트 데코 텍스처. 없으면 null (베이스만 표시). */
  getDeco(terrainId: string): Texture | null {
    return this.decoTex.get(terrainId) ?? null;
  }

  /** 구조물 오브젝트 텍스처(없으면 null → ObjectLayer 스킵). */
  getObject(key: string): Texture | null {
    return this.objectTex.get(key) ?? null;
  }

  /** 전투 fx 텍스처(없으면 null → FxLayer 절차적 폴백). */
  getFx(key: string): Texture | null {
    return this.fxTex.get(key) ?? null;
  }

  /**
   * 시임리스 바닥의 (gx,gy) wrap 서브렉트 (48×48). 인접 칸이 이어진다.
   * 미보유 지형/로드 전이면 null (호출자가 단색 베이크로 폴백).
   */
  getGround(terrainId: string, gx: number, gy: number): Texture | null {
    const base = this.groundTex.get(terrainId);
    if (!base) return null;
    const period = Math.max(1, Math.floor(GROUND_SIZE / TILE_SIZE));
    const mx = ((gx % period) + period) % period;
    const my = ((gy % period) + period) % period;
    const key = `${terrainId}:${mx}:${my}`;
    const cached = this.groundSubCache.get(key);
    if (cached) return cached;
    const frame = new Rectangle(mx * TILE_SIZE, my * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    const sub = new Texture({ source: base.source, frame });
    this.groundSubCache.set(key, sub);
    return sub;
  }

  /** 구조물 오브젝트 텍스처 로드 (실패해도 빈 맵 유지 — throw 안 함). */
  private async loadObjects(): Promise<void> {
    const entries = Object.entries(OBJECT_FILES);
    const urls = entries.map(([, f]) => `${OBJECT_BASE}/${f}`);
    try {
      const loaded = await Assets.load<Texture>(urls);
      for (const [key, f] of entries) {
        const tex = loaded[`${OBJECT_BASE}/${f}`];
        if (tex) this.objectTex.set(key, tex);
      }
      console.info(`[TextureResolver] 구조물 오브젝트 로드 완료: ${this.objectTex.size}종`);
    } catch (e) {
      console.warn("[TextureResolver] 구조물 오브젝트 로드 오류(아트 미보유 단계 정상):", e);
    }
  }

  /** fx 텍스처 로드 (실패해도 빈 맵 유지 — throw 안 함, 전부 폴백). */
  private async loadFx(): Promise<void> {
    const entries = Object.entries(FX_FILES);
    const urls = entries.map(([, f]) => `${FX_BASE}/${f}`);
    try {
      const loaded = await Assets.load<Texture>(urls);
      for (const [key, f] of entries) {
        const tex = loaded[`${FX_BASE}/${f}`];
        if (tex) this.fxTex.set(key, tex);
      }
      console.info(`[TextureResolver] fx 로드 완료: ${this.fxTex.size}종`);
    } catch (e) {
      console.warn("[TextureResolver] fx 로드 오류(아트 미보유 단계 정상):", e);
    }
  }

  async loadTiles(): Promise<void> {
    await this.loadDecos();
    await this.loadObjects();
    await this.loadFx();
    await this.loadGround();
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
   * 폴백 순서: 정확한 키 → 같은 뷰 idle → **front 동일 포즈 → front idle** → null.
   * 즉 **back 프레임은 선택**(없으면 front로 대체) — 위로 이동해도 깨지지 않고 정면을 유지한다.
   */
  getSprite(spriteId: string, view: "front" | "back", pose: "idle" | "move" | "attack"): Texture | null {
    const poseMap = this.sprites.get(spriteId);
    if (!poseMap) return null;
    return (
      poseMap.get(`${view}_${pose}`) ??
      poseMap.get(`${view}_idle`) ??
      poseMap.get(`front_${pose}`) ??
      poseMap.get("front_idle") ??
      null
    );
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
