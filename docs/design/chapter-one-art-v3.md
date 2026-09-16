# Chapter-one art revision

User-directed scope: redraw the four chapter-one battle maps and all characters used by those battles, including reinforcement entries in the current Studio project. Preserve terrain, placements, events, and battle rules.

## Art delivery

- Source project: `791e33c0-eb83-4b40-8b91-f58843ad3a64`.
- Four backgrounds: Zhuojun, Yingchuan, Guangzong, Zhang Jue. Eighteen independently painted, overlapping chunks, assembled at 96 pixels per terrain tile. Layout references match the project's terrain arrays.
- Character delivery: front/back × idle/move/attack. Named characters retain separate assets; anonymous troops share class artwork. Liu Pi needs both archer and bandit artwork because the existing battles use both classes.
- Proportion standard: approximately three heads for a standing person, compact mounted silhouettes with readable rider faces. Compare at the same display size before installing.
- Built-in image generation only. Selected source sheets, exact prompts, chunk manifests, preparation scripts, and original-file backups are retained in `.studio/chapter-one-art-v3/`. No external upload.
- Alpha and silhouette checks are part of sprite preparation. A visually displayed checkerboard is not proof of transparency: PNG alpha is checked before extraction. Sprite extraction follows disconnected silhouettes instead of blindly cutting equal cells, preventing long weapons from leaking into adjacent poses.
- New backgrounds preserve their existing public filenames. The runtime sprite manifest must include the new rear poses and class-specific variant.

## Character class and role editing

The old editor showed only roster assignments, leaving enemy and allied characters blank even when they had a class in battle data. Studio now derives a read-time profile from the current project's battles, including reinforcements. An existing roster class has priority; otherwise an explicit character default is used, then the most frequent battle class (stable first-appearance ties). No battle evidence means unspecified, not an invented infantry assignment.

`Commander.defaultClassId` and `Commander.battleRole` are optional authoring fields. They round-trip through the existing commander catalog. Defaults do not rewrite existing battle placements. Creating a new map unit and previewing character art use the resolved default. Editing an active roster character's class also updates their roster class. Combat roles use Korean labels; guest membership remains a roster property rather than a combat role.

Existing project data and unknown fields are retained. Character archetypes do not change attack rules, promotion chains, or battle statistics.

## Installed and verified

- Installed 27 chapter-one character designs plus Liu Pi's second class variant, with six poses each. Eight anonymous troop aliases reuse these designs. Guanyu's six tier-two/tier-three front images were also cleaned. Other promotion tiers and characters outside chapter one are outside this redraw.
- Nine proportion outliers were redrawn again against the same compact SD reference. Those exports used a generator-produced solid magenta matte, decoded into alpha before silhouette extraction. Source prompts and files are listed in `generated-keyed.json`; original alpha sources remain in the other generated manifests.
- Final sprite frames are 384×384 WebP with alpha; 174 unique pose files total approximately 6.72 MiB. All four map backgrounds were stitched from 18 chunks and installed at their original filenames. `installed.json` records 227 file hashes including aliases and the sprite manifest; backups preserve replaced files.
- Visual checks: a labeled 28-variant contact sheet (`characters-final.png`), Studio's Zhuojun map preview, and actual battle-camera rendering of Liu Bei, Guan Yu, Zhang Fei and Jian Yong. The direct battle route resumed Sishui Pass, so this last check verifies sprite rendering rather than a chapter-one battle run.
- Validation: full tests and typecheck passed; final web suite 771 tests passed. Character/stage editor inline scripts passed Node syntax checks. Report card: 26 HEALTHY, Zhang Jue EASY. No terrain grids, deployment coordinates, battle events or combat statistics were modified by the artwork installation.
