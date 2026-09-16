/** Size relative to the standard 1.18-tile object width; authored scale remains a multiplier. */
const PROP_SCALE: Record<string, number> = {
  campfire: 0.48,
  banner_command: 0.56,
  pennants: 0.52,
  signal_flag: 0.52,
  supply_cart: 0.72,
  debris_cart: 0.62,
  debris_weapons: 0.5,
  debris_pile: 0.55,
  shrub: 0.62,
  brazier: 0.5,
};

export function propScale(kind: string, authoredScale = 1): number {
  return (PROP_SCALE[kind] ?? 1) * authoredScale;
}
