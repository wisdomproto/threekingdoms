# Campaign presentation audit — 2026-09-16

## Verified

- `python tools/content/audit-campaign-assets.py`: 27 stages, 58 map scenes, 336 top-level dialogue lines, 28 motion actors; zero missing references in the checked sprite manifest, motion frame files, scene backgrounds, map definitions and requested poses. This is a file/reference audit, not an art quality or complete gameplay verdict.
- Browser: title loads synchronized project revision 15; Zhuojun intro narration transitions into its street map with Liu Bei, civilian and guard visible. Changbanqiao intro transitions into the bridge scene with Zhang Fei visible.
- Campaign, project migration, scene interpreter, opening staging and motion tests: 34 passed. Web typecheck passed.

## Fixed

The scene motion loader applied legacy color-key background removal even to authored transparent images. Flood fill could reach light clothing from transparent surroundings and erase opaque or antialiased character pixels. Frames with existing transparency now keep their alpha unchanged. Fully opaque legacy sheets retain edge-connected matte removal. Regression tests cover both paths.

Changban intro also reached preparation successfully. This exposed Xu Shu's missing battle sprite: neither his named image nor the strategist generic existed. Created `apps/web/public/assets/sprites/xushu-strategist-v1/` (42 WebP runtime frames) and connected it via `campaignSpriteVariants.json`. Browser now shows “서서 전신” instead of the missing-image placeholder. A roster-wide manifest coverage regression was added.

Generation: built-in image tool, reference `assets/scene-motions/xushu-robes-v1/0.webp`. Prompt: Xu Shu, matching indigo headwrap, beard and gray-green robes; consistent three-head SD proportions; transparent 4×4 atlas with 16 isolated poses; front/back left-facing idle, two walking steps, attack anticipation, slash, recovery, guard and wounded posture; no horse, armor, text or detached effects. Source `exec-26845567-9e2e-4184-962a-aad7a0844f0e.png` remains in the local generated-image archive; runtime frames extracted with `pack-reviewed-tier.py` preserving alpha.

## Still open

- All 27 battles have not been manually completed in this audit. Combat event timing, all spawn/object overlaps and victory-to-next-scene transitions still need full playthrough coverage.
- Reference existence does not establish consistent character proportions, costumes, pose quality or scenario length. Remaining promotion artwork and story expansion are not marked complete.
- The existing campaign save was not reset for this review. No deployment or asset CDN upload was performed.
