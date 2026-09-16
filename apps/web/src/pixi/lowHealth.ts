/** Presentation-only warning; never changes combat stats or RNG. */
export function isLowHealth(troops: number, maxTroops: number): boolean {
  return troops > 0 && maxTroops > 0 && troops / maxTroops <= 0.3;
}

/** Follow the loaded idle artwork, including a missing tier's base fallback.
 * Never borrow a generic soldier's weak animation for a loaded named character. */
export function hasLoadedWeakPose(
  candidates: readonly string[],
  hasIdle: (id: string) => boolean,
  hasWeak: (id: string) => boolean,
): boolean {
  const loaded = candidates.find(hasIdle);
  return loaded !== undefined && hasWeak(loaded);
}

/** A gentle 1.6-second red tint pulse, preserving full silhouette opacity. */
export function lowHealthTint(elapsedMs: number): number {
  const strength = (1 - Math.cos(Math.max(0, elapsedMs) * Math.PI * 2 / 1600)) / 2;
  const green = Math.round(255 - 65 * strength);
  const blue = Math.round(255 - 60 * strength);
  return (255 << 16) | (green << 8) | blue;
}
