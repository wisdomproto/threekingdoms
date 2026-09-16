/** Presentation-only overrides; every unit retains the universal fallback. */
export type SpecialHit = "critical" | "ultimate";
export type HeroWeapon = "dual" | "crescent" | "spear";

export function specialFxCandidates(hit: SpecialHit, weapon?: HeroWeapon | null): string[] {
  return hit === "ultimate" && weapon ? [`ultimate-${weapon}`, "ultimate"] : [hit];
}

export const SPECIAL_FX_KINDS = ["critical", "ultimate", "ultimate-dual", "ultimate-crescent", "ultimate-spear"] as const;
