/**
 * 오디오 드롭인 매니페스트 — 실제 오디오 파일이 어디 있는지 선언(선택).
 *
 * 매니페스트가 *없으면*(404 한 번) 게임은 전부 절차적 합성으로 동작한다(현재 상태).
 * 나중에 AI 작곡 BGM / 라이선스 SFX를 `/assets/audio/`에 넣고 여기 등록하면 코드 수정 없이
 * 자동 교체된다(FxLayer getFx 드롭인과 동형). 키→경로만 나열 — 키는 sfx.ts SFX / bgm.ts TRACK_IDS.
 *
 * 예) public/assets/audio/manifest.json:
 *   { "sfx": { "slash": "sfx/slash.webm" }, "bgm": { "battle": "bgm/battle.mp3" } }
 */
import { assetUrl } from "../assetUrl";

export interface AudioManifest {
  /** SFX 키 → 파일 경로(상대 "sfx/x.webm" | 절대 "/assets/..." | 풀 URL). */
  sfx: Record<string, string>;
  /** BGM 트랙 id → 파일 경로(루프 권장). */
  bgm: Record<string, string>;
}

const EMPTY: AudioManifest = { sfx: {}, bgm: {} };

/** 매니페스트 값(상대/절대/URL)을 실제 fetch URL로 해석. assetUrl로 R2/CDN 출처 일원화. */
export function resolveAudioPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return assetUrl(path);
  return assetUrl(`/assets/audio/${path}`);
}

/** 매니페스트 로드(없거나 실패 시 빈 매니페스트 = 전부 절차적). */
export async function loadAudioManifest(): Promise<AudioManifest> {
  try {
    const res = await fetch(assetUrl("/assets/audio/manifest.json"), { cache: "no-store" });
    if (!res.ok) return EMPTY;
    const json = (await res.json()) as Partial<AudioManifest>;
    return {
      sfx: isStrMap(json.sfx) ? json.sfx : {},
      bgm: isStrMap(json.bgm) ? json.bgm : {},
    };
  } catch {
    return EMPTY;
  }
}

function isStrMap(v: unknown): v is Record<string, string> {
  return typeof v === "object" && v !== null && Object.values(v).every((x) => typeof x === "string");
}
