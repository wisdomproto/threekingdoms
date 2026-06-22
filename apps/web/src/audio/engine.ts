/**
 * AudioEngine — Web Audio 컨텍스트 + 게인 그래프 싱글톤.
 *
 * 그래프: (sfxBus | bgmBus) → master → destination.
 *   - effective SFX = sfx * master,  effective BGM = bgm * master,  muted면 master=0.
 * 자동재생 정책: AudioContext는 'suspended'로 생성되며 **사용자 제스처 안에서 resume()** 해야
 *   소리가 난다. AudioController가 첫 pointerdown/keydown에서 ensureUnlocked()를 호출한다.
 *   해제 전 생성된 지속음(드론/루프)은 suspend 동안 무음으로 스케줄되고, resume 시 자동 가청.
 *
 * SSR 안전: 모듈 로드/생성자에서 window·AudioContext를 만지지 않는다(설정만 로드, guard됨).
 *   AudioContext는 ensureContext()(클라이언트·제스처 경로)에서만 생성.
 */
import { loadAudioSettings, saveAudioSettings, type AudioSettings } from "./settings";

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private settings: AudioSettings = loadAudioSettings();
  private unlocked = false;
  /** 설정 변경 구독자(뮤트 버튼 UI 리렌더용). */
  private readonly subs = new Set<() => void>();

  /** AudioContext + 게인 그래프를 1회 생성(클라이언트 전용). 실패 시 null 경로로 폴백. */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      const sfxBus = ctx.createGain();
      const bgmBus = ctx.createGain();
      sfxBus.connect(master);
      bgmBus.connect(master);
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.sfxBus = sfxBus;
      this.bgmBus = bgmBus;
      this.applyGains();
      return ctx;
    } catch {
      return null;
    }
  }

  /** 현재 설정값을 게인 노드에 반영(즉시·짧은 램프로 클릭 방지). */
  private applyGains(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.sfxBus || !this.bgmBus) return;
    const t = ctx.currentTime;
    const m = this.settings.muted ? 0 : this.settings.master;
    this.master.gain.setTargetAtTime(m, t, 0.015);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx, t, 0.015);
    this.bgmBus.gain.setTargetAtTime(this.settings.bgm, t, 0.015);
  }

  /**
   * 사용자 제스처 안에서 호출 — 컨텍스트 생성 + resume + iOS 무음버퍼 킥. 멱등.
   * @returns 방금 처음 해제됐으면 true(호출부가 BGM 재개 등에 사용).
   */
  ensureUnlocked(): boolean {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") void ctx.resume();
    const firstUnlock = !this.unlocked;
    if (firstUnlock) {
      this.unlocked = true;
      // iOS 완전 해제용 1샘플 무음 재생.
      try {
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        // 무시.
      }
    }
    return firstUnlock;
  }

  /** 해제 여부(소리 가능 여부). */
  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** 컨텍스트(소리 노드 스케줄용). 미생성/비지원 시 null. */
  context(): AudioContext | null {
    return this.ctx;
  }

  /** 효과음 버스(synth가 여기에 연결). */
  sfxDestination(): AudioNode | null {
    return this.sfxBus;
  }

  /** BGM 버스(bgm 보이스가 여기에 연결). */
  bgmDestination(): AudioNode | null {
    return this.bgmBus;
  }

  /** 현재 스케줄 기준 시각(초). 컨텍스트 없으면 0. */
  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** 설정 스냅샷(읽기용). */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /** 설정 일부 갱신 → 게인 반영 + 저장 + 구독자 알림. */
  setSettings(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    saveAudioSettings(this.settings);
    this.applyGains();
    for (const fn of this.subs) fn();
  }

  /** 뮤트 토글(편의). */
  toggleMute(): void {
    this.setSettings({ muted: !this.settings.muted });
  }

  /** 설정 변경 구독(뮤트 UI). 해제 함수 반환. */
  subscribe(fn: () => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }
}

/** 전역 오디오 엔진 싱글톤. */
export const audio = new AudioEngine();
