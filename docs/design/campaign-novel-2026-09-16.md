# Campaign novel and staged interludes — 2026-09-16

## Direction and source

The user selected calm novel narration and natural dialogue, with substantial scenes between battles. Their own webtoon is the narrative reference: https://www.tangobook.co.kr/samgukji-master.html (volumes 1–15 for this campaign). This is an adaptation of that material to the existing 27-battle sequence, not a verbatim reproduction or a claim of historical chronology.

Recurring details connect the episodes: Liu Bei's shoes and casualty ledger, the hand restraining Zhang Fei, returned seals, Guan Yu's unspoken obligations. Added connective scenes include Lu Zhi's arrest, the inspector incident, reunion, Xu Shu's departure and the three visits. Corrected contradictory fire-attack timing and premature disclosure of Guan Yu's decision. Zhang Jue's playable confrontation remains a game adaptation; battle rules and recruitment timing have not changed.

## Implementation

- `tools/content/campaign-novel.md`: 54 authored before/after passages, 490 paragraphs/dialogue turns.
- `expand-campaign-novel.py`: imports them without changing fields outside `scenario`, with pre-write backups and duplicate detection.
- `stage-novel-scenes.py`: explicit cue-based blocking, speaking/listening poses, persistent sitting/resting, entrances/exits; 44 single scenes plus five scenes in two split sequences. Existing scenes and choices are preserved except reviewed continuity corrections.
- Map scenes increase from 58 to 107. Total top-level story turns: 826; approximately 44,402 Korean characters including original dialogue. Two extra transition beats are in the staging script.
- Xu Shu: night conversation → departure road and return → three visits at Longzhong → first military council.
- Huarong: meeting Cao Cao and yielding the road → report and petition → aftermath.
- `/chronicle`: reads live game scenario data, with chapter/stage selector, text size and previous/next. Optional dialogue responses are separately expandable, never concatenated as though both choices happened. Reading does not complete stages or reset progress.
- Active project `791e33c0-eb83-4b40-8b91-f58843ad3a64` synchronized using revision-checked API saves (15 → 18). Original scenes matched before updates; unrelated project fields retained. Backups in `.studio/novel-backups/20260916-125912` and `.studio/staging-backups/20260916-130800`.

The newly staged scenes reuse existing civilian actor motions. Narrated time passages and scenes without the required cast remain illustrated narration. No claim is made that every actor has newly drawn custom motion or that the entire campaign was watched end to end.

## Longzhong background

Built-in image generation, no external API runner. Final runtime asset: `apps/web/public/assets/maps/scene-longzhong-courtyard.webp` (1536×1024, WebP quality 92; format conversion only). Source remains outside the repository at `C:/Users/101024/.codex/generated_images/01a09d5e-5c60-7bc3-a7f2-c46d9930ab0f/exec-e75c0274-fcc5-488b-91bb-5f5d6416beab.png`.

Prompt:

Use case: historical-scene. Create a finished background image ONLY for a 2D Three Kingdoms narrative RPG, Longzhong cottage courtyard in early spring, no characters. Landscape 3:2. High-angle orthographic painted top-down view, no horizon, no strong perspective convergence. Warm detailed hand-painted strategy game environment, readable medium contrast, ochre earth and muted fresh bamboo greens. Composition for a 12 by 8 invisible grid: the uppermost 3 rows show a modest scholar's thatched cottage with wood-framed doorway at upper right and bamboo fence along the upper edge, a small study window and rolled bamboo blinds; bamboo and irregular stones frame the extreme left and right edges. Rows 3 through 6 must be a continuous unobstructed broad flat courtyard for animated characters to walk, with ONLY low subtle ground texture; no tables, rocks, trees, water, stairs or large objects in this central 80 percent width ground zone. Bottom edge has a quiet narrow path leading out of the frame. Gentle spring morning, humble inhabited home with a few pots beside the cottage confined to top edge. NO peach blossom grove, NO altar, NO ceremonial table, NO palace, NO text, NO grid, NO UI, NO people, NO shadows of people. Render as an opaque full-bleed raster environment asset, crisp painted textures without photographic noise.

## Validation

- Full workspace tests and typecheck run; editor round-trip and campaign import/playtest tests included.
- Campaign story contract checks actor/image resolution, visible speakers, reachable movement and overlapping actors. Background assertion now matches runtime WebP/legacy PNG support.
- Campaign asset audit: 27 stages, 107 map scenes, no missing referenced files/poses.
- 27 battle report-card labels remain HEALTHY; story changes do not alter battle fields.
- Browser checks: reading view and chapter selection, Xu Shu departure/return, Longzhong entrance, Huarong scene.
- Runtime asset source files and local backup records are not for committing. The final new WebP must accompany any subsequent deployment.
