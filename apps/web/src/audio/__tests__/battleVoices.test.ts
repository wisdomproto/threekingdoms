import { describe, expect, it, vi, afterEach } from "vitest";
import { BattleVoicePlayer, battleVoicePath } from "../battleVoices";
import { audio } from "../engine";

afterEach(() => vi.restoreAllMocks());
describe("battle voice playback", () => {
  it("uses character-specific clips and does not invent voices for other units", () => {
    expect(battleVoicePath("관우","ultimate")).toBe("/assets/audio/voices/guanyu-ultimate-recorded-v1.mp3");
    expect(battleVoicePath("장각","attack")).toBeNull();
  });
  it("limits overlap, applies the character cooldown and stops sound on disposal", async () => {
    vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})));
    const created: any[]=[];
    const ctx={state:"running",currentTime:1,decodeAudioData:async()=>({}),createGain:()=>({gain:{value:0},connect:vi.fn(),disconnect:vi.fn()}),createBufferSource:()=>{const s={connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};created.push(s);return s;}};
    vi.spyOn(audio,"context").mockReturnValue(ctx as any);
    vi.spyOn(audio,"sfxDestination").mockReturnValue({} as any);
    const player=new BattleVoicePlayer(true);
    await player.preload(["유비","관우","장비"]);
    await Promise.all([player.play("유비"),player.play("관우"),player.play("장비")]);
    expect(created).toHaveLength(2);
    await player.play("유비");expect(created).toHaveLength(2);
    player.destroy();expect(created.every(s=>s.stop.mock.calls.length===1)).toBe(true);
    await player.play("장비");expect(created).toHaveLength(2);
    vi.unstubAllGlobals();
  });
});
