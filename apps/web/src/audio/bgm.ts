/**
 * BGM 매니저 — 경로/상황별 트랙을 크로스페이드. 절차적 앰비언트 드론 폴백 + 파일 루프 드롭인.
 *
 * 절차적 BGM은 "분위기"용이라 의도적으로 낮고 잔잔하다(멜로디 아님). 진짜 음악은 §3 파이프라인
 * (AI 작곡 Suno/Udio급)으로 만들어 manifest.json에 등록하면 같은 자리에서 자동 교체된다.
 *
 * 자동재생 정책: 컨텍스트가 suspended여도 드론 오실레이터를 미리 start해두면 resume 시 자동 가청
 *   → 라우트 진입(playBgm)에서 바로 보이스를 만들고, 첫 제스처가 소리를 켠다.
 */
import { audio } from "./engine";
import { resolveAudioPath, type AudioManifest } from "./manifest";

/** 재생 중 한 트랙의 노드 묶음 + 페이드아웃 정지. */
interface BgmVoice {
  stop: (fadeSec: number) => void;
}

/** 절차적 드론 1트랙의 음색 스펙. */
interface DroneSpec {
  /** 루트 주파수(Hz). */
  root: number;
  /** 화음 반음 오프셋(루트 기준). */
  semis: number[];
  type: OscillatorType;
  /** 로우패스 컷오프(Hz). */
  cutoff: number;
  /** 필터 LFO 속도(Hz)·깊이(Hz) — 느린 움직임. */
  lfoHz: number;
  lfoDepth: number;
  /** 보이스 합계 게인(0..~0.3, bgmBus·master로 한 번 더 줄어듦). */
  gain: number;
  /** 전투 긴장용 저음 펄스(트레몰로). */
  pulse?: boolean;
}

const CROSSFADE_S = 1.5;
const FADE_IN_S = 1.2;

// 절차적 드론은 품질이 낮아(길중 피드백 "겁나 구리다") 기본 비활성 — 실제 음원이 매니페스트로
// 들어온 트랙만 재생한다. 그 전까지 BGM 무음(SFX는 영향 없음). 생성형 음악(§3) 도입 시 true 복귀 검토.
const PROCEDURAL_BGM_ENABLED: boolean = false;

/** 트랙 id → 드론 스펙. id는 manifest.bgm 키와 동일(파일 있으면 그쪽 우선). */
const TRACKS = {
  // 타이틀 — 사색적 단조 패드.
  title: { root: 110, semis: [0, 3, 7], type: "triangle", cutoff: 720, lfoHz: 0.05, lfoDepth: 180, gain: 0.26 },
  // 막간/메뉴 — 따뜻한 장조, 약간 밝게.
  menu: { root: 130.8, semis: [0, 4, 7], type: "triangle", cutoff: 900, lfoHz: 0.07, lfoDepth: 220, gain: 0.24 },
  // 전투 — 긴장된 단7, 저음 펄스.
  battle: { root: 73.4, semis: [0, 3, 7, 10], type: "sawtooth", cutoff: 820, lfoHz: 0.12, lfoDepth: 260, gain: 0.2, pulse: true },
  // 보스/대전 — 더 어둡고 낮게.
  battleBoss: { root: 55, semis: [0, 1, 7], type: "sawtooth", cutoff: 600, lfoHz: 0.1, lfoDepth: 200, gain: 0.22, pulse: true },
  // 시나리오 씬 — 아주 조용한 드론.
  scene: { root: 98, semis: [0, 7], type: "sine", cutoff: 640, lfoHz: 0.04, lfoDepth: 120, gain: 0.16 },
} satisfies Record<string, DroneSpec>;

export type BgmTrackId = keyof typeof TRACKS;

/** 드롭인 파일 버퍼(preload). */
const fileBuffers = new Map<string, AudioBuffer>();
let fileManifest: AudioManifest["bgm"] = {};

let desiredId: BgmTrackId | null = null;
let currentId: BgmTrackId | null = null;
let currentVoice: BgmVoice | null = null;

const FLOOR = 0.0001;

/** 절차적 드론 보이스 생성(suspended여도 미리 start → resume 시 가청). */
function buildDrone(ctx: AudioContext, dest: AudioNode, spec: DroneSpec): BgmVoice {
  const t0 = ctx.currentTime;
  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(FLOOR, t0);
  voiceGain.gain.exponentialRampToValueAtTime(1, t0 + FADE_IN_S);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(spec.cutoff, t0);
  filter.Q.setValueAtTime(0.7, t0);
  filter.connect(voiceGain).connect(dest);

  const nodes: { stop: (t: number) => void }[] = [];

  spec.semis.forEach((s, i) => {
    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.root * Math.pow(2, s / 12), t0);
    osc.detune.setValueAtTime((i - (spec.semis.length - 1) / 2) * 5, t0); // 살짝 퍼짐
    const og = ctx.createGain();
    og.gain.setValueAtTime(spec.gain / spec.semis.length, t0);
    osc.connect(og).connect(filter);
    osc.start(t0);
    nodes.push(osc);
  });

  // 필터 컷오프 LFO — 느린 호흡감.
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(spec.lfoHz, t0);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(spec.lfoDepth, t0);
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start(t0);
  nodes.push(lfo);

  // 전투 긴장: 루트 저음 + 트레몰로(맥박).
  if (spec.pulse) {
    const pulseOsc = ctx.createOscillator();
    pulseOsc.type = "sine";
    pulseOsc.frequency.setValueAtTime(spec.root / 2, t0);
    const pulseGain = ctx.createGain();
    pulseGain.gain.setValueAtTime(spec.gain * 0.5, t0);
    const trem = ctx.createOscillator();
    trem.type = "sine";
    trem.frequency.setValueAtTime(1.6, t0); // ~96bpm 맥박
    const tremGain = ctx.createGain();
    tremGain.gain.setValueAtTime(spec.gain * 0.4, t0);
    trem.connect(tremGain).connect(pulseGain.gain);
    pulseOsc.connect(pulseGain).connect(voiceGain);
    pulseOsc.start(t0);
    trem.start(t0);
    nodes.push(pulseOsc, trem);
  }

  return {
    stop: (fadeSec) => {
      const t = ctx.currentTime;
      voiceGain.gain.cancelScheduledValues(t);
      voiceGain.gain.setValueAtTime(Math.max(FLOOR, voiceGain.gain.value), t);
      voiceGain.gain.exponentialRampToValueAtTime(FLOOR, t + fadeSec);
      const stopAt = t + fadeSec + 0.05;
      for (const n of nodes) {
        try {
          n.stop(stopAt);
        } catch {
          // 이미 정지.
        }
      }
    },
  };
}

/** 파일 루프 보이스 생성. */
function buildFileLoop(ctx: AudioContext, dest: AudioNode, buf: AudioBuffer): BgmVoice {
  const t0 = ctx.currentTime;
  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(FLOOR, t0);
  voiceGain.gain.exponentialRampToValueAtTime(1, t0 + FADE_IN_S);
  voiceGain.connect(dest);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(voiceGain);
  src.start(t0);
  return {
    stop: (fadeSec) => {
      const t = ctx.currentTime;
      voiceGain.gain.cancelScheduledValues(t);
      voiceGain.gain.setValueAtTime(Math.max(FLOOR, voiceGain.gain.value), t);
      voiceGain.gain.exponentialRampToValueAtTime(FLOOR, t + fadeSec);
      try {
        src.stop(t + fadeSec + 0.05);
      } catch {
        // 이미 정지.
      }
    },
  };
}

/** desiredId를 실제 재생에 반영(컨텍스트 준비됐을 때만). */
function apply(): void {
  const id = desiredId;
  if (!id) return;
  const ctx = audio.context();
  const dest = audio.bgmDestination();
  if (!ctx || !dest) return; // 아직 미해제 — unlock 후 재호출됨
  if (id === currentId && currentVoice) return; // 동일 트랙 재생 중

  const buf = fileBuffers.get(id);
  // 파일 없고 절차적 비활성이면 무음(기존 재생 중이면 페이드아웃). desired는 추적 유지 →
  // preloadBgmFiles로 파일이 도착하면 그때 재적용.
  if (!buf && !PROCEDURAL_BGM_ENABLED) {
    if (currentVoice) currentVoice.stop(CROSSFADE_S);
    currentVoice = null;
    currentId = id;
    return;
  }
  const next = buf ? buildFileLoop(ctx, dest, buf) : buildDrone(ctx, dest, TRACKS[id]);
  if (currentVoice) currentVoice.stop(CROSSFADE_S);
  currentVoice = next;
  currentId = id;
}

/** 트랙 전환 요청(라우트 변경 등). 같은 트랙이면 무시. */
export function playBgm(id: BgmTrackId): void {
  desiredId = id;
  apply();
}

/** 현재 BGM 정지(페이드아웃). 씬 등 무음 구간용. */
export function stopBgm(): void {
  desiredId = null;
  if (currentVoice) currentVoice.stop(CROSSFADE_S);
  currentVoice = null;
  currentId = null;
}

/** 컨텍스트 해제 직후 호출 — desired 트랙을 실제로 켠다. */
export function resumeBgm(): void {
  apply();
}

/** 매니페스트 BGM 파일을 디코드해 적재(드롭인). preload 실패 키는 절차적 폴백. */
export async function preloadBgmFiles(manifest: AudioManifest): Promise<void> {
  const ctx = audio.context();
  if (!ctx) return;
  fileManifest = manifest.bgm;
  await Promise.all(
    Object.entries(fileManifest).map(async ([id, path]) => {
      try {
        const res = await fetch(resolveAudioPath(path));
        if (!res.ok) return;
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        fileBuffers.set(id, buf);
      } catch {
        // 폴백 = 절차적 드론.
      }
    }),
  );
  // 이미 절차적으로 재생 중인 트랙에 파일이 도착했으면 그 트랙만 파일로 재전환.
  if (currentId && fileBuffers.has(currentId)) {
    currentId = null; // apply가 동일 id 가드를 통과하도록
    apply();
  }
}
