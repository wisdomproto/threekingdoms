import { resolveActiveAsset } from "./studio/asset-bindings";
/**
 * assetUrl — 생성 에셋(씬 배경·초상·맵 배경·스프라이트·지형 타일·VFX·영상)의
 * 서빙 출처를 한 겹으로 결정한다.
 *
 * CLAUDE.md §3 "배포/CDN = Vercel + Cloudflare R2(이그레스 무료)" + §2-7 "모든 에셋은
 * 재생성 가능한 생성 산출물" — 물량 큰 생성 에셋은 R2/CDN에서 서빙해 Vercel 대역폭과
 * git 비대화를 피한다. 코드는 항상 "/assets/..." 절대경로만 알고, 실제 호스트는 이 함수가 붙인다.
 *
 *  - dev/로컬: NEXT_PUBLIC_ASSET_BASE 미설정 → "" → 기존처럼 apps/web/public 동일출처 로드.
 *  - prod:    NEXT_PUBLIC_ASSET_BASE=https://cdn.example.com → 전부 R2/CDN으로 전환(호출부 무변경).
 *
 * NEXT_PUBLIC_ 접두사라 빌드 타임에 클라이언트 번들로 인라인된다(Vercel 프로젝트 env에 설정).
 * R2를 커스텀 도메인으로 붙이면 fetch(manifest)/HEAD도 크로스오리진 → 버킷 CORS에 웹 오리진 GET/HEAD 허용 필요.
 * 업로드·버킷 설정은 docs/asset-pipeline/03-r2-asset-hosting.md, tools/upload-assets.py 참조.
 */

// 끝 슬래시 정규화 — "https://cdn.x/" + "/assets" 이중 슬래시 방지.
const ASSET_BASE = (process.env.NEXT_PUBLIC_ASSET_BASE ?? "").replace(/\/+$/, "");

const PROJECT_ASSETS: Record<string, string> = {
  ...Object.fromEntries(["troy-return-stage", "greek-council-stage", "departure-stage", "ship-briefing-stage"].flatMap(id => ["maps", "scenes"].map(kind => [`/assets/${kind}/troia-${id}.webp`, `/assets/troia/war-bridge/${id}.webp`]))),
  ...Object.fromEntries(["agamemnon", "menelaus", "hector", "odysseus"].map(id => [`/assets/ui/portraits/troia-${id}.webp`, `/assets/troia/war-bridge/${id}-portrait.webp`])),
  ...Object.fromEntries(["apple-banquet", "judgment-stage", "sparta-stage"].flatMap(id => ["maps", "scenes"].map(kind => [`/assets/${kind}/troia-${id}.webp`, `/assets/troia/prologue/${id}.webp`]))),
  ...Object.fromEntries(["paris", "helen", "hera", "athena", "aphrodite"].map(id => [`/assets/ui/portraits/troia-${id}.webp`, `/assets/troia/prologue/${id}-portrait-alpha.webp`])),
  ...Object.fromEntries(["landing-stage", "camp-stage"].flatMap(id => ["maps", "scenes"].map(kind => [`/assets/${kind}/troia-${id}.webp`, `/assets/troia/story/${id}.webp`]))),
  "/assets/maps/troia-coast.webp": "/assets/maps/troia-coast.webp",
  "/assets/scenes/troia-coast.webp": "/assets/maps/troia-coast.webp",
  "/assets/scenes/troia-opening.webp": "/assets/troia/opening.png",
  ...Object.fromEntries([
    ["achilles", "아킬레우스", "achilles-v2"],
    ["patroclus", "파트로클로스", "patroclus"],
    ["diores", "디오레스", "diores"],
  ].flatMap(([id, name, art]) => [id, name].map(key => [`/assets/ui/portraits/${key}.webp`, `/assets/troia/${art}.png`]))),
};

/**
 * "/assets/scenes/x.webp" → `${ASSET_BASE}/assets/scenes/x.webp`.
 * 이미 완전한 http(s) URL이면 그대로 둔다(호출부가 절대 URL을 넘긴 경우 보호).
 */
export function assetUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const p = resolveActiveAsset(path.startsWith("/") ? path : `/${path}`);
  let decoded = p;
  try { decoded = decodeURIComponent(p); } catch { /* Preserve malformed paths for the normal loader. */ }
  if (Object.hasOwn(PROJECT_ASSETS, decoded)) return resolveActiveAsset(PROJECT_ASSETS[decoded]!);
  // Local authoring and battle previews share regenerated files before CDN publishing.
  if (process.env.NODE_ENV === "development" && /^\/assets\/(library|maps|objects|sprites|fx|ui\/(items|portraits)|audio\/voices)(\/|$)/.test(p)) {
    return p.replace(/^\/assets\//, "/api/local-assets/");
  }
  return (process.env.NEXT_PUBLIC_HOSTED_STUDIO === "1" ? "" : ASSET_BASE) + p;
}

export { ASSET_BASE };
