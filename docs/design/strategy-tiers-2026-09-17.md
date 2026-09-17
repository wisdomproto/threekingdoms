# Strategy tiers and area preview

Current implementation contract (not an original-game claim):

- Elemental/supply families unlock at levels 1, 3, 8, 15, 20; MP costs 6, 10, 16, 22, 26. First two spells are single-target, later spells affect a five-cell cross. Summons unlock at 25 and cost 30 MP.
- Optional `learnLevel`, `tier`, `support` fields preserve existing custom spell schemas: omitted means level 1, tier 1 and the legacy category behavior.
- `support`: MP recovery, harmful-status cleanse, attack/defense/spirit +20%, movement +2, or another ally's action refresh. Buffs last three owner-phase ticks, refresh does not stack potency, and cleanse preserves buffs. Refresh excludes the caster and unspent allies.
- One cast uses one caster stat snapshot. Actual HP/MP deltas and status changes are emitted as battle events. MP restoration clamps after casting costs; meditation may recover the caster's MP.
- Tap a cast tile to preview all affected cells and units; tap it again or choose Cast to commit. Retargeting does not spend MP or commit movement.
- Tier effects combine existing eight-frame art with bounded rings and rising accents; no giant full-resolution first frame. Shared ordinary attack/arrow/critical effects also normalize before insertion into the scene.
- The Troy sample keeps its previously authored spell balance in its own strategies catalog. This prevents global Three Kingdoms balancing from silently altering a separate MOD.

Validation: engine tests for multi-heal, MP clamping, cleanse, buff expiry, refresh restrictions and unlock gates; input tests for preview-before-commit; rendering regression tests for 1024px source images before the first animation tick. Run full tests/typecheck and all-stage report-card after rule changes.
