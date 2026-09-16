# Five-chapter content expansion

Status: the five-chapter battle art and environmental-event batch is installed. See the completion audit below; earlier entries are historical progress snapshots. Preserve existing duels, reinforcements, rewards and user edits.

## Completion audit — September 15

- All 27 battle terrain images are installed as WebP. Large maps were generated in separate chunks and stitched; generation sources and previous runtime images remain under `.studio/campaign-five`.
- All 198 commander/class combinations referenced by the 27 stages, including reinforcements, resolve to complete 32-frame front/rear base motions. These resolve to 148 distinct sprite sets. Per-chapter coverage is 31/31, 38/38, 60/60, 75/75 and 73/73; chapter counts overlap.
- All 148 sprite sets also have four dedicated low-health frames: two front and two rear. The existing 30% health threshold and red pulse remain; the resolver now uses the weak pose belonging to the loaded idle sprite.
- Continuous fire uses eight transparent WebP animation frames, with stable coordinate-based phase offsets. The renderer animates active fire cells while idle and removes their visuals when those cells expire. Rendering does not change deterministic damage or spread rules. The motion preview provides persistent-fire and extinguish controls.
- New environmental scripts cover Luoyang and Bowangpo fire, Xiapi flooding, Zhang Fei's Changban Bridge intimidation, Wulin camp fire, and Chibi fleet fire. Chibi's area now follows the actual chained-deck cells at x=9..18, y=13..15. These are authored adaptations of local scenario dialogue, not verified copies of original game event scripts.
- The existing Studio project and published game snapshot were synchronized to revision 9 using a field-preserving event merge. Character art and map assets are shared by the editor and game.
- Validation: repository tests, repository typecheck and simulator report-card passed. After the persistent-fire renderer changes, the web suite passed 793 tests across 77 files and web typecheck passed. Seven campaign environmental-event tests verify one-shot triggers, affected areas and determinism.
- Browser checks verified fire at 2x alongside the character, removal through the extinguish control, and a representative mounted weak pose. Terrain overviews were inspected before installation. Full manual playthroughs of every battle and every frame are not implied by this audit; minor terrain blend variations remain in some stitched maps. Higher-tier costume expansion and separate story costumes are outside this completed base-battle-art batch.
- Reproduce coverage with `.studio/campaign-five/audit-motion.cjs` and `.studio/campaign-five/final-audit.cjs`. Machine-readable results: `.studio/campaign-five/final-audit.json`.

## Environmental events

The current campaign already includes most duels and reinforcements. The missing layer is environmental combat scripting. The following additions are authored adaptations of the existing local scenario dialogue, not verified transcriptions of original game scripts:

- Luoyang, turn 5: fire in a small central city block; initial nonlethal damage and three turns of burning.
- Bowangpo, turn 4: fire along the enemy approach corridor, initial nonlethal damage and a one-turn enemy stun in that corridor. Existing reinforcements remain untouched.
- Chibi, turn 8: a localized fire on the chained-deck cells at x=9..18, y=13..15, initial nonlethal enemy damage and one-turn stun; remaining flames affect any unit entering them. Existing turn-8 dialogue supplies the story cue.

These events must use existing editable `scriptEvents`, remain deterministic, and survive project round trips. Do not replace whole battle resources while syncing them into a user project. Balance validation is required before declaring the additions ready.

## Art

- Sishuiguan: six regenerated terrain chunks assembled at 96 px/tile, 5376x3072 WebP. Previous image saved under `.studio/campaign-five/sishuiguan/previous.webp`.
- Huaxiong: cavalry depiction matching the stage class, 32 front/rear motion frames. Previous assets preserved locally.
- Huluguan: six regenerated terrain chunks assembled at 96 px/tile, 3072x4608 WebP. Previous image preserved locally.
- Luoyang: six regenerated chunks, 4608x2880 WebP. Corrected the spurious orange patch in the southeast chunk before installation.
- Dong Zhuo chase: six regenerated chunks, 4608x3264 WebP. Refined the northeastern river boundary before stitching.
- Li Jue infantry, Guo Si infantry and Xu Rong cavalry: installed 32-frame chibi sets with class-specific selection. Targeted sprite-variant tests and web typecheck pass.
- Jo Jam, Li Su (archer), Hu Zhen (footman), Zhang Liao: 32 front/rear motion frames each. Class-specific variants preserve later-stage cavalry appearances.
- Lu Bu: first atlas rejected for adult proportions. Installed a 32-frame chibi redraw with larger head, compact torso and short horse legs, matching Guan Yu/Zhang Fei. Added a side-by-side preview group. Original and rejected sources remain in `.studio/campaign-five`; generation used the built-in image tool with approved sprites as references, followed by magenta-background cleanup and WebP packing.
- Remaining chapter 2–5 maps and characters are not yet complete.
- Guo Si archer and Xu Rong infantry: separate 32-frame variants, selected by battle class; tier-specific assets retain priority when available.
- Sun Qian, Li Ru, Cao Xing and Wang Kai: 32 front/rear frames each, packed as transparent WebP and registered in the runtime manifest. Added two preview groups. Existing files were backed up before replacement.
- Validation after this batch: sprite-variant tests (2/2) and web TypeScript check pass. Remaining work includes other chapter 2 variants, chapter 3–5 terrain redraws and wider in-game visual verification.

## September 15 continuation

- Song Qian infantry and archer, Yang Ang archer, Lu Qian cavalry: four new 32-frame sets installed as WebP. Song Qian variants follow stage class while preserving tier and generic fallbacks. Added preview groups.
- Targeted class-selection tests and web typecheck pass after these changes.
- Banhe: six ground chunks generated and revised at 96 px/tile output (4608x3264). Installed the second stitched WebP with organic meadow transitions. First candidate and previous runtime image are preserved. Slight river-bank blending variation remains; a complete in-battle object-overlay review is still pending. Source prompts and preserved originals are under `.studio/campaign-five/sep15-prompts.json` and `.studio/campaign-five/banhe`.

## Chapter 2 motion coverage milestone

- Corrected the coverage boundary: chapter 2 includes stages 05–09, including Banhe and its reinforcements. The earlier character inventory omitted stage 09.
- Installed twelve additional 32-frame transparent WebP sets: Li Su cavalry, Hu Zhen cavalry, Xu Shang, Zhao Yun, Qu Yi, Gongsun Yue, Feng Ji, Geng Wu, Guan Chun, Han Meng, Yan Gang and Yuan Yin. Stage classes are preserved; Li Su and Hu Zhen use explicit cavalry variants. Sources and previous assets are preserved locally.
- Generated original atlases with the built-in image tool, using approved character references. Prompt records: `.studio/campaign-five/remaining2-prompts.json` and `banhe-character-prompts.json`.
- Xuzhou: six terrain chunks stitched to 5760x3456 WebP and installed. Sources, prompt records, candidate and previous runtime image are preserved under `.studio/campaign-five/xuzhou`. A small blend variation near the western water endpoint and complete object-overlay review remain open.
- Runtime candidate audit, including reinforcements, finds 32-frame coverage for chapter 1: 31/31, chapter 2: 38/38, chapter 3: 25/60, chapter 4: 24/75, chapter 5: 28/73 commander/class combinations. Reproduce with `node .studio/campaign-five/audit-motion.cjs`.
- These counts describe base motion availability, not completion of higher-tier art, weak poses, scenario costumes, per-frame visual QA or battle-event playthroughs. Chapters 3–5 remain in progress.
- Web typecheck passes after preview groups were added. Class-selection regression tests passed after adding cavalry routing.

## Xuzhou character continuation

- Added 32-frame sets for Tao Qian, Yu Jin, Xiahou Yuan, Li Dian, Yue Jin, Cao Ren and Taishi Ci. All use the existing stage classes; Tao Qian retains a small horse cart, Cao Ren and Taishi Ci are mounted, and the two archers use bows.
- Sources were generated with the built-in image tool. Prompt records are in `.studio/campaign-five/xuzhou-character-prompts.json`; accepted Tao Qian and Taishi Ci sources use the `-redraw-source.png` suffix. Original candidates remain preserved.
- Initial Tao Qian/Taishi Ci previews displayed colored RGB in transparent regions. Alpha inspection showed transparency was present, but packing detected touching/merged sprites. Redrawn atlases passed 32-frame packing and replaced these candidates. Do not infer alpha correctness from the image viewer alone.
- Added three preview groups and corrected right-facing front guard frames for Xiahou Yuan and Yue Jin through manifest metadata.
- Coverage snapshot after installation: chapter 3 has 32/60 commander/class combinations with base 32-frame motion. This is not a full chapter completion claim. New maps after Xuzhou, higher-tier art, remaining weak poses and full battle-event verification remain open.
- Targeted sprite/texture tests: 5 passed. Web typecheck passed. Preview checked the first three characters at 2x; complete stage playthrough QA remains pending.

## Xiaopei continuation

- Installed Mi Fang, Chen Deng, Gao Shun and Chen Gong: 32 transparent WebP frames each. Added infantry and strategist preview groups. Chen Deng and Chen Gong use fan gestures; manifest orientation metadata normalizes reversed front casting/guard poses.
- Xiaopei terrain: nine separately generated 20x16-tile chunks, stitched to 4608x3840 WebP at 96 px/tile. Previous runtime image and all generated chunks are preserved in `.studio/campaign-five/xiaopei`. Prompts are in `.studio/campaign-five/xiaopei-prompts.json`; generation used the built-in image tool.
- Whole-map inspection found slight river-bank alignment and northern foundation blending variation. These remain visual QA limitations; collision grid and object positions were not changed. In-battle object-overlay review remains pending.
- Chapter 3 base-motion coverage is now 36/60 commander/class combinations. Xiaopei's remaining characters, later stages, higher-tier/weak art and end-to-end event validation remain incomplete. Web typecheck passed after installation.
