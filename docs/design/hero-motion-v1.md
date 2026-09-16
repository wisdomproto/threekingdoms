# Three brothers: battle motion v1

User-directed delivery on 2026-09-14: create battle action drawings for Liu Bei, Guan Yu, and Zhang Fei, with the additional effects needed for their attacks.

## Installed artwork

- 96 transparent WebP drawings: three characters × front/rear views × 16 drawings. Each view contains idle 2, movement 4, attack 6, hit 2, and guard 2.
- Paths: `apps/web/public/assets/sprites/{liubei,guanyu,zhangfei}/{front,back}_{action}_{frame}.webp`. Existing static drawings and promotion artwork remain available.
- Four new effect sequences, four PNG frames each: `apps/web/public/assets/fx/hero-{dual,crescent,spear,impact}-{0,1,2,3}.png`.
- Liu Bei retains his white-horse chariot and paired swords. Guan Yu retains his brown horse and crescent blade. Zhang Fei retains his black horse and serpent spear.
- Runtime character frames are 256×256, aligned to a common bottom baseline within each sheet. The source sheets are preserved at their generated resolution. Character frames total 1,756,780 bytes; effect frames total 610,328 bytes. Added art totals 2,367,108 bytes.
- Built-in image generation was used. Exact prompts and selected source paths are recorded in `.studio/hero-motion-v1/sources.json` and `fx-source.json`; selected original sheets are copied beside them. No remote publication or upload was performed.

## Rendering contract

`spriteClips.ts` defines frame timing. The six-frame attack lasts 420 ms, with contact at 180 ms. Complete clips are selected only after every frame loads; incomplete or absent clips retain static-pose fallback. Loading remains scoped to the battle's sprite IDs. Promotion artwork has precedence and retains static motion until matching promotion clips are authored.

`UnitView` plays gait, attack, recoil, and guarding drawings through the existing tween clock. It suppresses idle pose changes during actions and uses a target-directed attack displacement. Existing skeleton/scene-art paths remain separate.

`BattleRenderer` now starts hit reaction and damage text at contact, rather than at attack start. Supporting flank participants match the lead attack duration. Their extra animations do not change damage, action consumption, or game rules. New signature effects distinguish paired swords, a crescent blade, and a spear. A four-frame compact spark replaces the common impact when loaded. Missing FX frames retain the previous effect fallback, and one failed FX request no longer discards every loaded effect.

## Review surface

`/battle-motion-preview` uses the real battle `UnitView` and `FxLayer` classes, with front/rear, movement, attack, hit, guard, zoom, and playback-speed controls. It does not write battle data and has no background music. One-times view uses the battle's 48-world-pixel grid and 60-world-pixel sprite canvas height; an actual battle camera may apply additional zoom.

## Validation

- All 96 installed character frames have an alpha channel, transparent pixels, and transparent outer borders. Installed-file hashes are recorded in `.studio/hero-motion-v1/asset-audit.json`. The combined review sheet is `all-frames.png` in the same directory.
- Reviewed the complete contact sheet, front/rear attacks with distinct effects, movement, hit, and guard in the browser. A local HTTP fetch verified all 130 relevant sprite/effect files returned successfully, totaling 3,269,580 bytes including existing static poses (not the entire battle download).
- Five focused tests cover the contact-frame boundary, looping/clamping, partial-load fallback, and rear/promotion isolation. Full `pnpm test` and `pnpm typecheck` passed; web tests total 776.
- Production build passed using `TK_NEXT_DIST_DIR=.next/hero-motion-build`, isolated from the running development server. Reported first-load JavaScript: battle 104 kB, motion preview 105 kB. These JavaScript figures exclude the separately loaded art.
- This is the first animation art pass. Higher promotion tiers and other characters are not newly animated. The original source game's unique frame count is not being claimed or reproduced.
