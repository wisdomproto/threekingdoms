/**
 * 절차적 효과음 합성 (Web Audio). 다운로드/저작권 0 — 코드에서 직접 소리를 만든다.
 *
 * 각 SFX는 `(ctx, dest, t0) => void` 시그니처로 오실레이터/노이즈 노드를 스케줄한다.
 * sfx.ts가 키→합성함수 레지스트리를 들고, 실제 오디오 파일이 있으면 그 버퍼를 우선 재생한다
 * (드롭인 — FxLayer의 getFx 폴백 패턴과 동형).
 *
 * 설계 톤: 수묵 동양 전장. 타격은 또렷하되 날카롭지 않게, UI는 작고 짧게, 보상은 밝게.
 */

/** SFX 합성 함수 시그니처. dest는 보통 sfxBus. t0는 ctx.currentTime 기준 시작 시각. */
export type SynthFn = (ctx: AudioContext, dest: AudioNode, t0: number) => void;

// ── 노이즈 버퍼 캐시(컨텍스트당 1개) ─────────────────────────────────────────
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (buf) return buf;
  buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1초 화이트노이즈
  const data = buf.getChannelData(0);
  // 결정적 LCG로 채움 — Math.random 회피(테스트/재현 일관성, 들리는 차이 없음).
  let seed = 0x2545f491;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x3fffffff) - 1; // -1..1
  }
  noiseBuffers.set(ctx, buf);
  return buf;
}

const FLOOR = 0.0001; // exponential ramp는 0에 못 감 — 바닥값.

/** 게인 엔벨로프(어택→서스테인→릴리즈) 적용. */
function env(
  g: GainNode, t0: number, peak: number, attack: number, dur: number, release: number,
): void {
  const p = Math.max(FLOOR, peak);
  const a = Math.max(0.001, attack);
  const susEnd = Math.max(t0 + a, t0 + dur - release);
  g.gain.setValueAtTime(FLOOR, t0);
  g.gain.exponentialRampToValueAtTime(p, t0 + a);
  g.gain.setValueAtTime(p, susEnd);
  g.gain.exponentialRampToValueAtTime(FLOOR, t0 + dur);
}

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  freqEnd?: number;
  t0: number;
  dur: number;
  peak: number;
  attack?: number;
  release?: number;
  detune?: number;
}

/** 단일 오실레이터 톤(주파수 글라이드·디튠 옵션). */
function tone(ctx: AudioContext, dest: AudioNode, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, o.t0);
  if (o.freqEnd && o.freqEnd > 0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), o.t0 + o.dur);
  }
  if (o.detune) osc.detune.setValueAtTime(o.detune, o.t0);
  const g = ctx.createGain();
  env(g, o.t0, o.peak, o.attack ?? 0.005, o.dur, o.release ?? Math.min(0.1, o.dur * 0.6));
  osc.connect(g).connect(dest);
  osc.start(o.t0);
  osc.stop(o.t0 + o.dur + 0.03);
}

interface NoiseOpts {
  t0: number;
  dur: number;
  peak: number;
  type?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  attack?: number;
  release?: number;
}

/** 필터링된 노이즈 버스트(쉭/타격/파편). */
function noise(ctx: AudioContext, dest: AudioNode, o: NoiseOpts): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filt = ctx.createBiquadFilter();
  filt.type = o.type ?? "bandpass";
  filt.frequency.setValueAtTime(o.freq ?? 1200, o.t0);
  if (o.freqEnd && o.freqEnd > 0) {
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, o.freqEnd), o.t0 + o.dur);
  }
  filt.Q.setValueAtTime(o.q ?? 1, o.t0);
  const g = ctx.createGain();
  env(g, o.t0, o.peak, o.attack ?? 0.002, o.dur, o.release ?? Math.min(0.12, o.dur * 0.6));
  src.connect(filt).connect(g).connect(dest);
  src.start(o.t0);
  src.stop(o.t0 + o.dur + 0.03);
}

/** 음이름 → 주파수(A4=440). 보상/팡파레 멜로디용. */
function note(semitonesFromA4: number): number {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

// ── 명명된 효과음 ────────────────────────────────────────────────────────────
// UI ----------------------------------------------------------------------
const click: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "triangle", freq: 880, t0: t, dur: 0.05, peak: 0.16, release: 0.04 });
};
const confirm: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "triangle", freq: note(3), t0: t, dur: 0.09, peak: 0.22 }); // C5
  tone(ctx, d, { type: "triangle", freq: note(10), t0: t + 0.07, dur: 0.12, peak: 0.22 }); // G5
};
const cancel: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "triangle", freq: note(0), t0: t, dur: 0.09, peak: 0.2 }); // A4
  tone(ctx, d, { type: "triangle", freq: note(-5), t0: t + 0.06, dur: 0.12, peak: 0.2 }); // E4
};

// 전투 타격 ----------------------------------------------------------------
/** 베기 — 휘두르는 쉭(밴드패스 노이즈 하강) + 짧은 금속 틱. */
const slash: SynthFn = (ctx, d, t) => {
  noise(ctx, d, { t0: t, dur: 0.13, peak: 0.32, type: "bandpass", freq: 2600, freqEnd: 800, q: 0.8 });
  tone(ctx, d, { type: "square", freq: 1800, freqEnd: 900, t0: t + 0.01, dur: 0.06, peak: 0.1 });
};
/** 관통(궁/포) — 하이패스 쉭 + 위로 스치는 화살 지프. */
const pierce: SynthFn = (ctx, d, t) => {
  noise(ctx, d, { t0: t, dur: 0.12, peak: 0.24, type: "highpass", freq: 1600, freqEnd: 4000, q: 0.7 });
  tone(ctx, d, { type: "sawtooth", freq: 700, freqEnd: 1700, t0: t, dur: 0.1, peak: 0.12 });
};
/** 타격 — 묵직한 저음 텀 + 임팩트 노이즈 클릭. */
const hit: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "sine", freq: 160, freqEnd: 70, t0: t, dur: 0.16, peak: 0.5, attack: 0.002 });
  noise(ctx, d, { t0: t, dur: 0.06, peak: 0.28, type: "lowpass", freq: 2200, q: 0.5 });
};
/** 회심/큰 타격 — 저음 붐 + 톱니 하강 스윕 + 노이즈 크래시. */
const crit: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "sine", freq: 200, freqEnd: 60, t0: t, dur: 0.32, peak: 0.6, attack: 0.002 });
  tone(ctx, d, { type: "sawtooth", freq: 520, freqEnd: 120, t0: t, dur: 0.22, peak: 0.22 });
  noise(ctx, d, { t0: t, dur: 0.18, peak: 0.34, type: "lowpass", freq: 3200, freqEnd: 600, q: 0.6 });
};
/** 필살(궁극기) — crit보다 크고 길게: 붐 + 상승 차징 + 광폭 크래시. */
const ultimate: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "sawtooth", freq: 120, freqEnd: 360, t0: t, dur: 0.28, peak: 0.3, attack: 0.08 }); // 차징
  tone(ctx, d, { type: "sine", freq: 240, freqEnd: 55, t0: t + 0.22, dur: 0.5, peak: 0.62, attack: 0.002 }); // 임팩트 붐
  noise(ctx, d, { t0: t + 0.22, dur: 0.3, peak: 0.4, type: "lowpass", freq: 4000, freqEnd: 500, q: 0.5 });
  tone(ctx, d, { type: "square", freq: note(12), t0: t + 0.24, dur: 0.3, peak: 0.16 }); // A5 광채
};
/** 격파/퇴각 — 부드러운 "퍽" 하강(잔혹X, §10 퇴각만). */
const defeat: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "sine", freq: 300, freqEnd: 90, t0: t, dur: 0.26, peak: 0.32 });
  noise(ctx, d, { t0: t, dur: 0.2, peak: 0.16, type: "lowpass", freq: 1400, freqEnd: 300, q: 0.4 });
};

// 이동 ----------------------------------------------------------------------
/** 이동 발소리 — 짧고 부드러운 "툭"(저음 thud + 약한 흙 노이즈). moveAlong이 타일당 1회, 작게. */
const step: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "sine", freq: 130, freqEnd: 62, t0: t, dur: 0.09, peak: 0.12, attack: 0.002, release: 0.06 });
  noise(ctx, d, { t0: t, dur: 0.05, peak: 0.05, type: "lowpass", freq: 800, q: 0.5 });
};

// 책략/연출 ----------------------------------------------------------------
/** 책략 시전 — 종소리/반짝(고음 디튠 사인 + 비브라토 잔향감). */
const spell: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "sine", freq: note(12), t0: t, dur: 0.5, peak: 0.18, attack: 0.01, detune: 4 }); // A5
  tone(ctx, d, { type: "sine", freq: note(16), t0: t + 0.04, dur: 0.5, peak: 0.14, detune: -5 }); // C#6
  tone(ctx, d, { type: "sine", freq: note(19), t0: t + 0.08, dur: 0.46, peak: 0.12 }); // E6
};
/** 협공 잭팟 — 빠른 더블 히트 + 밝은 반짝. */
const flank: SynthFn = (ctx, d, t) => {
  hit(ctx, d, t);
  hit(ctx, d, t + 0.08);
  tone(ctx, d, { type: "triangle", freq: note(16), t0: t + 0.1, dur: 0.18, peak: 0.2 });
};
/** 콤보 — 상승 블립 3연(연속 격파 리듬감). */
const combo: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "square", freq: note(7), t0: t, dur: 0.07, peak: 0.18 }); // E5
  tone(ctx, d, { type: "square", freq: note(11), t0: t + 0.07, dur: 0.07, peak: 0.18 }); // G#5
  tone(ctx, d, { type: "square", freq: note(14), t0: t + 0.14, dur: 0.1, peak: 0.2 }); // B5
};
/** 일기토 발동 — 묵직한 징(저음 + 금속 배음). */
const duel: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "sine", freq: 110, t0: t, dur: 0.9, peak: 0.4, attack: 0.004, release: 0.5 });
  tone(ctx, d, { type: "sine", freq: 220 * 1.5, t0: t, dur: 0.8, peak: 0.16, detune: 6 });
  tone(ctx, d, { type: "sine", freq: 220 * 2.7, t0: t, dur: 0.7, peak: 0.1 });
  noise(ctx, d, { t0: t, dur: 0.12, peak: 0.18, type: "bandpass", freq: 3000, q: 0.6 });
};
/** 증원 도착 — 뿔나팔(톱니 스택 2음). */
const reinforce: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "sawtooth", freq: note(-5), t0: t, dur: 0.24, peak: 0.18, attack: 0.03, detune: -4 }); // E4
  tone(ctx, d, { type: "sawtooth", freq: note(-5), t0: t, dur: 0.24, peak: 0.14, detune: 6 });
  tone(ctx, d, { type: "sawtooth", freq: note(2), t0: t + 0.22, dur: 0.4, peak: 0.2, attack: 0.03 }); // B4
};
/** 페이즈 전환 — 부드러운 스웰 한 음(아군/적 턴 알림). */
const phase: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "triangle", freq: note(-1), t0: t, dur: 0.3, peak: 0.18, attack: 0.06, release: 0.18 }); // G#4
};

// 결산/보상 ----------------------------------------------------------------
/** 별 꽂힘 — 또렷한 "팅". */
const star: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "triangle", freq: note(16), t0: t, dur: 0.16, peak: 0.26, attack: 0.002 }); // C#6
  tone(ctx, d, { type: "sine", freq: note(28), t0: t, dur: 0.1, peak: 0.1 }); // 한 옥타브 위 광채
};
/** 상자 개봉 — 나무 틱 + 반짝 상승. */
const chest: SynthFn = (ctx, d, t) => {
  noise(ctx, d, { t0: t, dur: 0.05, peak: 0.2, type: "lowpass", freq: 1200, q: 0.4 }); // 나무 틱
  tone(ctx, d, { type: "triangle", freq: note(9), freqEnd: note(16), t0: t + 0.05, dur: 0.22, peak: 0.2 });
};
/** 코인 — 밝은 2음 "치링". */
const coin: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "square", freq: note(19), t0: t, dur: 0.06, peak: 0.18 }); // E6
  tone(ctx, d, { type: "square", freq: note(24), t0: t + 0.05, dur: 0.12, peak: 0.18 }); // A6
};
/** 레벨업 — 메이저 아르페지오 상승(C E G C). */
const levelup: SynthFn = (ctx, d, t) => {
  const seq = [note(3), note(7), note(10), note(15)]; // C5 E5 G5 C6
  seq.forEach((f, i) => {
    tone(ctx, d, { type: "triangle", freq: f, t0: t + i * 0.08, dur: 0.18, peak: 0.22, attack: 0.004 });
  });
};
/** 승리 — 짧은 팡파레(상승 + 정점 화음). */
const victory: SynthFn = (ctx, d, t) => {
  const lead = [note(7), note(10), note(15)]; // E5 G5 C6
  lead.forEach((f, i) => {
    tone(ctx, d, { type: "sawtooth", freq: f, t0: t + i * 0.12, dur: 0.16, peak: 0.16, attack: 0.01 });
  });
  // 정점 화음(C 메이저)
  [note(15), note(19), note(22)].forEach((f) => {
    tone(ctx, d, { type: "triangle", freq: f, t0: t + 0.36, dur: 0.6, peak: 0.16, attack: 0.01, release: 0.4 });
  });
};
/** 패배 — 하강 단조 카덴스(무겁게). */
const lose: SynthFn = (ctx, d, t) => {
  tone(ctx, d, { type: "sawtooth", freq: note(0), t0: t, dur: 0.3, peak: 0.18, attack: 0.02 }); // A4
  tone(ctx, d, { type: "sawtooth", freq: note(-4), t0: t + 0.26, dur: 0.34, peak: 0.18 }); // F4
  tone(ctx, d, { type: "sine", freq: note(-12), t0: t + 0.5, dur: 0.7, peak: 0.22, attack: 0.02, release: 0.4 }); // A3
};

/** 키 → 합성함수. sfx.ts의 SFX 상수와 1:1(레지스트리). */
export const SYNTHS = {
  click, confirm, cancel,
  slash, pierce, hit, crit, ultimate, defeat,
  step,
  spell, flank, combo, duel, reinforce, phase,
  star, chest, coin, levelup, victory, lose,
} satisfies Record<string, SynthFn>;

export type SynthKey = keyof typeof SYNTHS;
