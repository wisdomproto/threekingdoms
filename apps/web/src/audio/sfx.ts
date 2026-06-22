/**
 * 효과음 재생 — 키→소리(드롭인 파일 우선, 없으면 절차적 합성).
 *
 * SFX 상수 = 이벤트→키 단일 진실(fxKeys.ts의 FX와 동형). playSfx(SFX.slash)처럼 호출하면
 * sfx 버스로 1회 재생된다. 실제 파일이 preload돼 있으면 그 AudioBuffer를, 아니면 SYNTHS[key]를.
 *
 * 가드: 컨텍스트 미생성/미해제(suspended)면 무음(스케줄 낭비 방지). 동일 키 25ms 스로틀
 *   (한 프레임에 같은 소리 다중 발사 시 클리핑 방지). 게임 상태 불변 — 순수 표현.
 */
import { audio } from "./engine";
import { SYNTHS, type SynthKey } from "./synth";
import { resolveAudioPath, type AudioManifest } from "./manifest";

/** 이벤트 의미 키 → 합성 키(현재 1:1). 호출부는 SFX.* 만 참조. */
export const SFX = {
  // UI
  click: "click",
  confirm: "confirm",
  cancel: "cancel",
  // 전투 타격
  slash: "slash",
  pierce: "pierce",
  hit: "hit",
  crit: "crit",
  ultimate: "ultimate",
  defeat: "defeat",
  // 책략/연출
  spell: "spell",
  flank: "flank",
  combo: "combo",
  duel: "duel",
  reinforce: "reinforce",
  phase: "phase",
  // 결산/보상
  star: "star",
  chest: "chest",
  coin: "coin",
  levelup: "levelup",
  victory: "victory",
  lose: "lose",
} satisfies Record<string, SynthKey>;

export type SfxKey = (typeof SFX)[keyof typeof SFX];

/** 드롭인 파일 버퍼(preload로 채워짐). 키 존재 시 절차적보다 우선. */
const fileBuffers = new Map<string, AudioBuffer>();
/** 동일 키 마지막 재생 시각(스로틀). */
const lastPlayed = new Map<string, number>();
const THROTTLE_S = 0.025;

function playBuffer(ctx: AudioContext, dest: AudioNode, buf: AudioBuffer, t0: number): void {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(dest);
  src.start(t0);
}

/** 효과음 1회 재생. 미해제/비지원 환경은 무음(no-op). */
export function playSfx(key: SfxKey): void {
  const ctx = audio.context();
  const dest = audio.sfxDestination();
  if (!ctx || !dest || ctx.state !== "running") return; // 해제 전엔 무음
  const now = ctx.currentTime;
  const last = lastPlayed.get(key) ?? -1;
  if (now - last < THROTTLE_S) return;
  lastPlayed.set(key, now);

  const buf = fileBuffers.get(key);
  if (buf) {
    playBuffer(ctx, dest, buf, now);
    return;
  }
  const synth = SYNTHS[key as SynthKey];
  if (synth) synth(ctx, dest, now);
}

/**
 * 매니페스트에 등록된 SFX 파일을 디코드해 버퍼로 적재(드롭인 업그레이드).
 * 실패한 키는 절차적 폴백을 유지. 해제(컨텍스트 생성) 이후 1회 호출.
 */
export async function preloadSfxFiles(manifest: AudioManifest): Promise<void> {
  const ctx = audio.context();
  if (!ctx) return;
  await Promise.all(
    Object.entries(manifest.sfx).map(async ([key, path]) => {
      try {
        const res = await fetch(resolveAudioPath(path));
        if (!res.ok) return;
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        fileBuffers.set(key, buf);
      } catch {
        // 폴백 = 절차적.
      }
    }),
  );
}
