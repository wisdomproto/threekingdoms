# Battle sprite audit — 2026-09-16

Reviewed all 297 local front-idle sprite variants on a consistent green contact-sheet background. This is an idle-art audit, not a claim that every animation frame has been reviewed. Inspection sheets are under `.studio/sprite-audit-20260916/page-{1..7}.png`.

## Findings and correction

- 110 existing tier-2/3 variants retain an older, taller art direction; some also contain baked checkerboards, erased armor or neighboring-cell fragments. `rejectedSpriteVariants.json` prevents automatic runtime selection of these specific assets. Originals remain available on disk. Promotion mechanics remain unchanged; reviewed base artwork is used until replacement tier artwork is approved. This does not complete tier-art regeneration.
- Campaign class artwork previously matched only exact class IDs. Promoted infantry/archer/cavalry now resolves through its class family before falling back to old commander artwork. This corrects Xu Chu and Cao Hong selecting their damaged old variants.
- Xu Huang cavalry has a new 32-frame front/rear atlas with a more substantial horse and a battle axe. Source: `exec-48e094b4-25f6-44db-804e-5875d1652410.png`.
- Xiahou Yuan cavalry has a new 16-pose front/rear atlas, packed into existing timing slots (repeated hold frames where needed), including wounded slumps. Source: `exec-c050c8d5-e7c3-4386-9c48-f94ec8c4d834.png`. The earlier crowded 32-frame candidates were rejected. Source files remain in the local Codex generated_images folder. Runtime files are WebP in `sprites/{xuhuang,xiahouyuan}-cavalry-v2`.
- Changban Bridge: moved Xiahou Dun, Xu Chu and Yue Jin off forest cells, and Cao Cao away from the painted canopy. Terrain and battle objectives are unchanged. Only those four unit positions were synchronized into the existing Studio project, preserving other project edits. Backup: `.studio/sprite-audit-20260916`.

## Reviewed promotion batch

Added twelve tier sets (tier 2 and 3 for Xiahou Dun, Xu Chu infantry, Cao Hong infantry, Li Dian archer, Xu Huang cavalry and Xiahou Yuan cavalry), plus a new Li Dian archer base. Each uses 16 unique front/rear poses packed into 42 WebP runtime slots; repeated hold frames are intentional, not 42 unique drawings. `pack-reviewed-tier.py` extracts connected alpha silhouettes without color-key erasure and backs up existing output before replacing it. Source basenames are recorded in the sprite manifest.

Li Dian now resolves to bow/crossbow artwork for the archer class family while retaining separate infantry art. Only regenerated Xiahou Dun tier paths were removed from the legacy quarantine; the other replacements use new class-specific paths. There are still 108 quarantined legacy IDs, including superseded counterparts of the new class variants. This is not 108 additional unique characters.

Validation: all 546 output WebP files have transparent alpha, 256px canvases and clear canvas margins. Front idle and rear attack comparison sheet: `.studio/tier-repair-20260916/review.png`. Web suite: 806 tests passed; web typecheck passed. Changban playtest loaded successfully and showed clear backgrounds and corrected deployment; this does not claim that every promoted animation was exercised in battle.

## Generic base repair batch

Replaced nine damaged generic bases: `heavyCavalry_enemy`, `heavyCavalry_player`, `lightCavalry_enemy`, `lightCavalry_player`, `bandit_player`, `footman_player`, `archer_player`, `lord_player`, and `lord_enemy`. Runtime output is in `apps/web/public/assets/sprites/<id>/`; source basenames are recorded in `manifest.json`. Originals are retained in `.studio/tier-repair-20260916/originals`. These are base replacements, not newly drawn promotion tiers.

Each set contains 16 unique poses and 42 WebP playback files. All 378 files passed alpha, dimension and canvas-margin checks. Small-size contact sheet: `.studio/tier-repair-20260916/generic-review.png`. Rear footman poses natively face screen-right, so their manifest direction metadata is set explicitly using `--rear-right`. The packer now refuses sheets with anything other than 16 substantial disconnected silhouettes, instead of silently taking the largest 16 from a wrong-sized sheet.

The repaired generic bases retain their existing IDs, so renderer/editor consumers need no mapping changes. Previously rejected generic promotion variants remain excluded. Focused sprite-selection and native-facing tests: 7 passed. This batch was inspected as extracted frames/contact sheets; it does not claim every generic animation was exercised in battle.

Generation used the built-in image tool. Prompt set: compact three-head Chinese SD regular soldiers, consistent four-column/four-row front/rear idle/walk/windup/contact/recovery/guard/fatigue atlas, actual transparent alpha, no checkerboard, no ground shadow, no baked VFX, complete isolated weapons and generous gutters. Heavy cavalry uses open-face Han helmets, lamellar horse armor and lances; light cavalry uses light armor and dao swords; bandit uses brown headwrap/leather and a blue sash; allied infantry uses green lamellar armor with blue cloth and spear/shield or bow/quiver; generic lords retain a compact one-horse wooden chariot, official hat and blue/crimson banner. Faction variants preserve anatomy/poses and change cloth/armor palette. Initial clipped/overcrowded/European-helmet candidates were rejected and revised before final packing.

## Remaining requests

The nine damaged generic bases above are now replaced. Unused legacy named bases remain inconsistent and their files are preserved; remaining promotion artwork still needs replacement rather than indiscriminate color erasure. Xu Huang's base set still needs a dedicated wounded pose (new tier sets include one). Story costume/direction completion and longer scenario writing remain separate unfinished requests; this audit does not mark them complete.

## Verification

Data tests: 291 passed. Web tests: 806 passed, including promoted-class selection and rejection regression coverage. Typecheck passed. Report card: all 27 HEALTHY after initial-position changes. Active Studio project synchronized to revision 15; local game snapshot updated. Browser playtest uses a separate snapshot to avoid changing campaign progress.
