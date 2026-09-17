export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;

/** Contain, never crop: input and renderers retain the same logical coordinates. */
export function gameViewportScale(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
  return Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
}
