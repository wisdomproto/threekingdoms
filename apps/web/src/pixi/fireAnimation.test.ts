import { describe, expect, it } from 'vitest';
import { fireFrame, FIRE_FRAME_COUNT, FIRE_FRAME_MS } from './fireAnimation';

describe('persistent fire animation', () => {
  it('advances while idle and loops exactly after eight frames', () => {
    const frames=Array.from({length:FIRE_FRAME_COUNT},(_,i)=>fireFrame(i*FIRE_FRAME_MS,9,13));
    expect(new Set(frames).size).toBe(FIRE_FRAME_COUNT);
    expect(fireFrame(FIRE_FRAME_COUNT*FIRE_FRAME_MS,9,13)).toBe(frames[0]);
  });
  it('gives neighbouring cells stable different phases without randomness', () => {
    expect(fireFrame(350,9,13)).not.toBe(fireFrame(350,10,13));
    expect(fireFrame(350,9,13)).toBe(fireFrame(350,9,13));
  });
});
