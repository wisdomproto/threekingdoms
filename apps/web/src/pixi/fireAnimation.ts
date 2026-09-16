export const FIRE_FRAME_COUNT = 8;
export const FIRE_FRAME_MS = 100;

/** Coordinate phase keeps neighbouring flames out of sync without consuming game RNG. */
export function fireFrame(elapsedMs: number, x: number, y: number): number {
  return (Math.floor(Math.max(0, elapsedMs) / FIRE_FRAME_MS) + ((x * 3 + y * 5) % FIRE_FRAME_COUNT)) % FIRE_FRAME_COUNT;
}
