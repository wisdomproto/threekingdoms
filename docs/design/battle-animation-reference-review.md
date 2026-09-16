# Battle animation reference review

Reviewed on 2026-09-14. Scope: representative recorded battle sequences and the current chapter-one sprite rendering path; this is not an exhaustive audit of every character or skill.

## Observed reference sequences

- [Liu Bei campaign 1, 5:44–5:46](https://www.youtube.com/watch?v=qvSF_J5TtsE&t=344s): sampled paused frames show an energy buildup, a bright sweeping weapon arc, a concentrated contact flash, damage text, and a fading trail. Attacker and defender portraits frame the action at the bottom. Burning buildings remain animated in the background.
- At approximately 5:44.81, green/cyan energy is visible with a darkened surrounding field. At 5:45.01–5:45.14, a white/purple arc develops with a yellow contact flash. At 5:45.34, red damage text and a narrow weapon trail are visible. At 5:45.74, the large arc has largely disappeared while residual trail/sparks remain. These samples may span repeated strikes; they do not establish the duration of one attack.
- [Liu Bei campaign 2, 9:14–9:35](https://www.youtube.com/watch?v=AjK70WF_Pvo&t=554s): additional samples show the ordinary battlefield, movement, target selection, and attack-labelled states. Terrain, unit silhouettes, status markers, and action labels remain readable without a persistent large attack effect. This second sample was not used to count attack poses.

The recording is 60 fps and displays game speed ×4. Video frames are not unique sprite drawings. Compression, effect occlusion, and accelerated playback prevent a reliable count of the original game's source frames or normal-speed timing. The production counts below are recommendations for this project, not measurements of the reference game's assets.

## Current implementation

Chapter-one art supplies front/back × idle/move/attack, six static poses per design. In `apps/web/src/pixi/layers/UnitView.ts`, `applySpriteTexture` selects a single texture for a pose. `moveAlong` translates the move pose; `playAttack` translates and stretches the attack pose, then restores idle. Skeleton and external scene-art paths are separate exceptions.

This means adding artwork alone will not play an animation. The battle sprite path needs ordered frames, per-frame duration, looping rules, and a contact marker synchronized with impact, damage text, and defender reaction. Its current attack displacement is horizontal; vertical targets also need target-directed movement.

## Proposed art budget

Counts are total unique drawings per front/back view, including reusable existing poses, not all additional drawings.

| Action | Drawings per view | Purpose |
| --- | ---: | --- |
| Idle | 2 | Small breathing/cloth variation |
| Move | 4 | Alternating footfall or mount gait |
| Attack | 6 | Windup, acceleration, contact, follow-through, recovery |
| Hit | 2 | Recoil and recovery |
| Guard | 2 | Raise weapon/shield and brace |

Core target: 16 drawings per view, 32 across front/back. With all three existing poses reusable per view, approximately 26 additional drawings per design. Casters may add 3–4 casting drawings per view. Mounted gait can expand to 6 if four is insufficient. Defeat/retreat is a later optional clip.

### Character and class priorities

- Liu Bei: preserve the equipped form; make sword/dual-sword motion or chariot rider motion readable, with a distinct contact pose.
- Guan Yu: a heavy broad blade arc; separate the raised weapon, downward swing, and recovery silhouettes.
- Zhang Fei: a spear draw-back, forward thrust, and withdrawal, distinct from Guan Yu's sweep.
- Infantry/bandits: share a class choreography template, while preserving each design's clothing and weapon.
- Archers: draw, release, and recovery; spawn the projectile at release.
- Casters/healers: gather, cast, and release; spell effects remain separate assets.
- Mounted units: animate horse legs and rider/weapon coherently. Do not slide one fixed horse image across the battlefield.

Start with Liu Bei, Guan Yu, Zhang Fei, and one common enemy. Validate them at the real battle camera scale before expanding the full roster. Keep canvas size, foot anchor, proportions, and weapon clearance consistent between drawings. Separate character drawings from slash, spark, and spell overlays.

## Delivery and validation in this work session

- Studio battle editor now provides an image/assets panel for merged map backgrounds, searchable object previews, and effect previews/replacement. Source map chunks are not edited through the merged-background uploader.
- Raster slash, thrust, impact, and retreat effects now normalize source dimensions to world-space sizes, avoiding oversized effects from high-resolution textures.
- Flank events carry participant IDs; the renderer starts supporting participants' attack animations alongside the lead attack and uses the normal hit effect instead of a second flank flash. This still uses the existing static-pose animation until frame clips are implemented.
- `pnpm test`, `pnpm typecheck`, and the simulation report card passed. The report has 26 HEALTHY stages and the existing Zhang Jue EASY classification. Participant IDs have test coverage; simultaneous visual playback has not yet been manually verified in a live flank battle.
- No new motion-frame artwork or frame-clip runtime has been produced as part of this reference review.
