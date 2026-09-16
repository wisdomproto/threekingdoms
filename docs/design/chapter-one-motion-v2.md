# Chapter one battle art expansion

## Delivered assets

The accepted Liu Bei, Guan Yu and Zhang Fei animation sets remain in place. Twenty-five additional sprite designs now have 32 frames each: two idle, four move, six attack, two hit and two guard frames, from both front and rear views. This includes generic enemy types and Liu Pi's separate archer/bandit versions. Generic commander aliases share the same drawings. Higher promotion tiers retain their existing art.

Game assets: `apps/web/public/assets/sprites/{spriteId}/*.webp`. Runtime native-facing metadata in `sprites/manifest.json` normalizes several right-facing rear cuts without modifying the source drawings. Both static fallback poses and complete clips are covered. All 800 newly packed frames have transparent outer margins and pass alpha/edge checks.

The four chapter-one backgrounds were regenerated from the existing terrain chunk references, then blended using their original overlap coordinates:

| Battle | Background | Chunks | Installed size |
| --- | --- | ---: | --- |
| Zhuojun | `maps/zhuojun.webp` | 2 | 3840 × 2304 |
| Yingchuan | `maps/yingchuan.webp` | 6 | 4608 × 3072 |
| Guangzong | `maps/guangzong.webp` | 6 | 4608 × 3264 |
| Zhang Jue | `maps/zhangjue.webp` | 4 | 4224 × 2880 |

Backgrounds live under `apps/web/public/assets/`. Terrain rules, objects, unit placements and story/event data are unchanged. Trees, buildings and other existing objects remain a separate rendered layer. The exported resolution includes resampling from generated chunks; it is not a claim of native model resolution.

## Source and recovery

All artwork used the built-in image-generation tool, not a paid API fallback. Exact per-output prompts and reference paths: `.studio/chapter-one-motion-v2/jobs.json` and `map-jobs.json`. Completed generation records, original source images, packed frames and chunk stitch outputs are preserved in that directory. Gongsun Zan was regenerated against a magenta key background to preserve white armor and the white horse; see `white-knight-fix.json` and `sources/gongsunzan-magenta.png`.

Previous installed files are preserved once per path in `.studio/chapter-one-motion-v2/backups/`. `installed-sprites.json` and `installed-maps.json` record installed paths and SHA-256 hashes. Generation originals are local work material and must not be committed.

## Review and validation

`/battle-motion-preview` now offers ten character groups using the actual UnitView/FxLayer renderer. It includes front/rear, movement, attack, hit, guard, critical and ultimate previews. Groups beyond the three heroes use the universal ultimate art. Previewing does not change the saved project or battle data.

Validation scripts and reports are in `.studio/chapter-one-motion-v2/`: `review.cjs` checks all 800 packed frames; `verify.cjs` checks every chapter-one stage unit and referenced reinforcement against the installed manifest and all 32 required frames. `coverage.json` records per-battle sprite and map file sizes. These are file sizes, not measured browser transfer budgets.

The web suite passed 779 tests; TypeScript and the isolated production build passed. Visual review covered all stitched backgrounds, sprite contact sheets, the white horse fix, rear attacks in the game renderer and the Zhuojun Studio composition.
