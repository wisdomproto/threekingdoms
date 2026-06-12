/**
 * TextureResolver (설계 §2.2) — `(kind, id) => Texture`.
 * v0: 부팅 시 Graphics로 지형 14종 + 진영 2색 베이스 + 하이라이트용 백색 타일을
 * RenderTexture로 1회 베이크 → 전 스프라이트가 공유(풀 배칭).
 * v0.1(에셋 통합): loadSprites()로 manifest.json을 읽어 스프라이트 텍스처를 비동기 로드.
 *   getSprite(spriteId, pose) → Texture | null (null = 폴백 색 사각형 유지 필수)
 * 향후 atlas frame 반환 구현으로 교체해도 소비측 호출은 불변 — placeholder→에셋 교체 경로의 핵심.
 */
import { Assets, Graphics, Texture, type Renderer } from "pixi.js";
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

  constructor(renderer: Renderer) {
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
  }
}
