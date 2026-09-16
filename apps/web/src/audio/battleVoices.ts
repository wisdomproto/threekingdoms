import { audio } from "./engine";
import { assetUrl } from "../assetUrl";

export type BattleVoiceAction = "attack" | "ultimate";
const speakers: Record<string, string> = { "유비":"liubei", "관우":"guanyu", "장비":"zhangfei" };
// Human-recorded CC0 clips. Versioned names keep rejected TTS out of browser caches.
export const BATTLE_VOICES_ENABLED = false;
export function battleVoicePath(commanderId: string, action: BattleVoiceAction): string | null {
  const speaker = speakers[commanderId];
  return speaker ? `/assets/audio/voices/${speaker}-${action}-recorded-v1.mp3` : null;
}

/** Presentation only: bounded overlap, cooldown and no delayed voices after leaving a battle. */
export class BattleVoicePlayer {
  constructor(private readonly enabled = BATTLE_VOICES_ENABLED) {}
  private files = new Map<string, ArrayBuffer>();
  private buffers = new Map<string, AudioBuffer>();
  private active = new Set<AudioBufferSourceNode>();
  private last = new Map<string, number>();
  private disposed = false;

  async preload(commanderIds: string[]): Promise<void> {
    if (!this.enabled) return;
    const paths = [...new Set(commanderIds.flatMap(id => [battleVoicePath(id,"attack"), battleVoicePath(id,"ultimate")]).filter((p): p is string => !!p))];
    await Promise.allSettled(paths.map(async path => {
      const response = await fetch(assetUrl(path));
      if (!response.ok) return;
      const bytes = await response.arrayBuffer();
      if (!this.disposed) this.files.set(path, bytes);
    }));
  }
  async play(commanderId: string, action: BattleVoiceAction = "attack", gain = 0.55): Promise<void> {
    if (!this.enabled) return;
    const ctx = audio.context(), destination = audio.sfxDestination();
    const path = battleVoicePath(commanderId,action);
    if (this.disposed || !ctx || ctx.state !== "running" || !destination || !path || this.active.size >= 2) return;
    const started = ctx.currentTime;
    if (started - (this.last.get(commanderId) ?? -Infinity) < 0.8) return;
    this.last.set(commanderId,started);
    try {
      let buffer = this.buffers.get(path);
      if (!buffer) {
        const bytes = this.files.get(path); if (!bytes) return;
        buffer = await ctx.decodeAudioData(bytes.slice(0)); this.buffers.set(path,buffer);
      }
      if (this.disposed || ctx.currentTime - started > 0.2 || this.active.size >= 2) return;
      const source = ctx.createBufferSource(), volume = ctx.createGain();
      source.buffer = buffer; volume.gain.value = gain;
      source.connect(volume); volume.connect(destination); this.active.add(source);
      source.onended = () => { this.active.delete(source); source.disconnect(); volume.disconnect(); };
      source.start();
    } catch { /* Missing or undecodable voice never interrupts combat. */ }
  }
  destroy(): void {
    this.disposed = true;
    for (const source of this.active) source.stop();
    this.active.clear(); this.files.clear(); this.buffers.clear();
  }
}
