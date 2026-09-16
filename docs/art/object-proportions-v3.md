# Object proportions v3

Local visual tuning, 2026-09-14. Shared `propScale` applies category defaults to authored decoration scales in both the battle renderer and Studio preview: campfire 0.48, command banner 0.56, pennants 0.52, supply cart 0.72, debris cart 0.62, weapons 0.50, shrub 0.62. Unknown types keep scale 1. Authored values and collision tiles are unchanged. Small-prop shadows scale down with their sprites.

Terrain patches now account for exposed edges: border patches shrink and shift slightly inward; internal patches overlap more. Deterministic per-position variation provides uneven canopy and rock silhouettes. Village proportions remain unchanged. This improves existing sprite arrangement; it does not introduce a painted mountain-range asset.

Validation: terrain coverage/determinism and preview preservation tests passed (3 tests); web typecheck and editor JavaScript syntax passed. Studio visual review completed.
