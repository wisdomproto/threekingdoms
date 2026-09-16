/** Presentation-only timing. Frame names remain compatible with sprite manifests. */
export const SPRITE_CLIPS = {
  idle: [650, 650],
  weak: [800, 800],
  move: [90, 90, 90, 90],
  attack: [65, 70, 45, 55, 80, 105],
  hit: [100, 140],
  guard: [100, 140],
} as const;
export type SpriteClip = keyof typeof SPRITE_CLIPS;
export const ATTACK_CONTACT_MS = 180;
export const ATTACK_CLIP_MS = 420;

export function isSpriteClip(pose: string): pose is SpriteClip {
  return Object.prototype.hasOwnProperty.call(SPRITE_CLIPS, pose);
}

export function spriteFrameAt(pose: SpriteClip, elapsedMs: number, loop = false): number {
  const frames = SPRITE_CLIPS[pose];
  const duration = frames.reduce<number>((sum, ms) => sum + ms, 0);
  let time = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  time = loop ? time % duration : Math.min(time, duration);
  for (let i = 0; i < frames.length; i++) {
    if (time < frames[i]!) return i;
    time -= frames[i]!;
  }
  return frames.length - 1;
}
