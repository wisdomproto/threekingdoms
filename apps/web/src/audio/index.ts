/**
 * 오디오 공개 API 배럴 — 호출부는 여기서만 import.
 *   playSfx(SFX.slash) / playBgm("battle") / <AudioController/>(layout 마운트).
 */
export { audio } from "./engine";
export { DEFAULT_SETTINGS, type AudioSettings } from "./settings";
export { SFX, playSfx, preloadSfxFiles, isSfxKey, type SfxKey } from "./sfx";
export { playBgm, stopBgm, resumeBgm, preloadBgmFiles, isBgmTrackId, type BgmTrackId } from "./bgm";
export { loadAudioManifest, type AudioManifest } from "./manifest";
