import { afterEach, expect, it, vi } from "vitest";
import { audio } from "../../audio";
import { playPachinkoReward, startPachinkoAudio } from "../screens/pachinkoAudio";
vi.mock("../../audio", () => ({ audio: { ensureUnlocked: vi.fn(), context: vi.fn(), sfxDestination: vi.fn() } }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
function setup() {
  const sources: any[] = [];
  const bus = {};
  const ctx = { currentTime: 10, decodeAudioData: vi.fn(async () => ({})),
    createGain: () => ({gain:{value:0},connect:vi.fn(),disconnect:vi.fn()}),
    createBufferSource: () => { const s = {buffer:null,start:vi.fn(),stop:vi.fn(),connect:vi.fn(),disconnect:vi.fn()}; sources.push(s); return s; } };
  vi.mocked(audio.context).mockReturnValue(ctx as any);
  vi.mocked(audio.sfxDestination).mockReturnValue(bus as any);
  vi.stubGlobal("fetch", vi.fn(async () => ({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})));
  return {sources,ctx};
}
it("cancels a pending opening before decode completes", async () => {
  const {sources} = setup();
  startPachinkoAudio()();
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(sources).toHaveLength(0);
});
it("uses distinct grade clips, caches decode, and supports stopping reveal audio", async () => {
  const {sources,ctx} = setup();
  for (const grade of ["common","fine","rare","legendary"] as const) {
    const stop = playPachinkoReward(grade);
    await new Promise(resolve=>setTimeout(resolve,0));
    stop();
  }
  expect(sources).toHaveLength(4);
  expect(new Set(sources.map(s=>s.buffer)).size).toBe(4);
  expect(sources.every(s=>s.stop.mock.calls.length===1)).toBe(true);
  expect(ctx.decodeAudioData).toHaveBeenCalledTimes(6);
});
