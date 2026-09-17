import { audio } from "../../audio";
import type { treasureGrade } from "../treasureGrade";

export type RewardGrade = ReturnType<typeof treasureGrade>["grade"];
const names = ["unlock", "open", "common", "fine", "rare", "legendary"] as const;
type Sound = typeof names[number];
let preload: Promise<Record<Sound, ArrayBuffer>> | undefined;
const decoded = new WeakMap<AudioContext, Promise<Record<Sound, AudioBuffer>>>();
export function preloadPachinkoAudio() {
  return preload ??= Promise.all(names.map(async name => {
    const response = await fetch(`/audio/chest/${name}.ogg`);
    if (!response.ok) throw new Error(`Chest audio unavailable: ${name}`);
    return [name, await response.arrayBuffer()] as const;
  })).then(entries => Object.fromEntries(entries) as Record<Sound, ArrayBuffer>)
    .catch(error => { preload = undefined; throw error; });
}
function buffers(ctx: AudioContext) {
  let pending = decoded.get(ctx);
  if (!pending) {
    pending = preloadPachinkoAudio().then(data => Promise.all(names.map(async name =>
      [name, await ctx.decodeAudioData(data[name].slice(0))] as const
    ))).then(entries => Object.fromEntries(entries) as Record<Sound, AudioBuffer>);
    decoded.set(ctx, pending);
    void pending.catch(() => decoded.delete(ctx));
  }
  return pending;
}
/** Uses the shared mute/volume bus. Cancellation also prevents late decode playback. */
function sequence(beats: readonly (readonly [number, Sound, number])[]) {
  audio.ensureUnlocked();
  const ctx = audio.context(), bus = audio.sfxDestination();
  let cancelled = false;
  const sources: AudioBufferSourceNode[] = [];
  const started = ctx?.currentTime ?? 0;
  if (ctx && bus) void buffers(ctx).then(bank => {
    if (cancelled) return;
    for (const [delay, name, volume] of beats) {
      const when = started + delay;
      if (when < ctx.currentTime - .4) continue;
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = bank[name];
      gain.gain.value = volume;
      source.connect(gain); gain.connect(bus);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start(Math.max(ctx.currentTime, when)); sources.push(source);
    }
  }).catch(() => { /* Audio failure must never block a reward. */ });
  return () => { cancelled = true; for (const source of sources) { try { source.stop(); } catch { /* ended */ } } };
}
export function startPachinkoAudio() {
  return sequence([[0, "unlock", .65], [1.45, "open", .5]]);
}
export function playPachinkoReward(grade: RewardGrade) {
  return sequence([[0, grade, grade === "legendary" ? .55 : .45]]);
}
