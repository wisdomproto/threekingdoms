# Serendipity treasure tiers

The expanded pool contains four treasures per tier: common, fine, rare, legendary.
Existing owned items keep their identifiers and effects. No schema fields are added:
tiers are presentation appraisals derived from supported effects, so editor round trips
and existing saves remain compatible.

Appraisal budget = attack% + defense% + spirit% + movement × 10.
Thresholds: common <5, fine 5–9, rare 10–14, legendary >=15. Double strike is legendary.
The new pool has no extra attacks, guaranteed hits, range bonuses or healing loops.
Single-stat bonuses cap at 10%; legendary hybrids have 8% + 8%, or movement +1 and spirit +5%.
Campaign treasures with specialized 12–15% single-stat effects remain stronger specialists.

Treasure chance remains 8%, and ten attempts without a treasure still guarantee a treasure
of any tier. Within treasure drops, grade weights are 40/35/20/5%, uniformly divided among
the four items in each grade. Ordinary per-attempt grade chances are 3.2/2.8/1.6/0.4%.
Guaranteed treasure attempts use 40/35/20/5%. Gold and consumable weights are unchanged.
The guarantee never claims a legendary reward. Repeated items use the existing inventory rules.

Validation: schema parsing, equal tier counts, reachability of all drops, normalized weights,
effect caps and the campaign report card. The campaign report alone does not simulate every
possible player equipment combination; the numerical caps are conservative design limits.
