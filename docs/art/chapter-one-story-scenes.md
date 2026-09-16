# Chapter one story staging

## Night camp prompt

Generate a 1536x1024 painted 2D historical Chinese SRPG story background, compact campsite on eve of battle. Match referenced camp art, elevated quarter-view 30-degree orthographic-like camera no horizon. Evening blue ambient but clearly readable bright characters will be overlaid. Soft warm light from a SMALL low campfire centered at normalized x0.50 y0.46, fire footprint only 6% width and 7% height; low stones encircle fire. Central clearing flat earth, open space all around fire for four seated people. Modest canvas tents at upper corners only, bundled blankets and water pot beside upper left tent, dark tree silhouettes at borders. Warm gold/cool muted blue balanced, not gloomy or black, painterly hand illustrated crisp story game art. No people, no benches in center, no grid, no UI, no text. Same intimate scale as reference, no large landscape.

## Town gate prompt

Create a 1536x1024 landscape painted 2D historical Chinese SRPG STORY background. Same art and camera as reference, slightly elevated quarter-view 30 degrees, NO horizon, no people or UI. A compact Han-dynasty town gate courtyard after liberation. Uppermost 25% includes gray masonry wall and OPEN modest timber town gate centered near x55%, warm daylight shining through gateway. A few red lanterns, small cloth awning on upper-left, barrels and civilian baskets near right boundary, weathered flag at top no readable writing. Central 65% flat broad walkable packed earth and occasional irregular stone paving, uncluttered. Small grass/plants at edge only. Intimate conversation space scaled for cute three-head-tall story characters, not a huge battlefield. Readable hand-painted texture warm earth moss green gray brick soft top-left sunlight. No burned corpses/weapons, no people, no text, no grid. Buildings must not occupy central or lower clearing.

## Day camp prompt

Create a polished 1536x1024 painted 2D SRPG STORY SCENE background of a late Han dynasty military camp, daylight after rain. Slight quarter-view camera looking down 30 degrees, orthographic-like, no horizon or sky. Consistent hand-painted crisp cute historical strategy RPG style, readable at small scale, mossy muted greens warm ochre, rich but not photoreal. This is a compact intimate conversation stage, not a vast battle map. Composition: open flat packed-earth clearing occupies central 65%, a modest cream command tent in upper-right corner, one rolled cloth map on low table beside tent NOT center, supply cart and stacked sacks at upper-left edge, short wooden palisade along top border, flags with NO TEXT, tufts grass only at borders, small rocks. Keep all of center and lower center clear walkable earth, no center table/fire/building. Ground-level soft shadows consistent top-left sunlight, no dramatic perspective. No humans, no characters, no UI, no grid, no lettering. Full bleed.

2026-09-15. Added seven before/after slots across battles 01–04, retaining the existing Peach Garden introduction. All original dialogue, speaker, portrait and side values remain in order. Combat data is unchanged. Later chapters still use their existing scenes; this pass does not complete chapters 2–5.

- Zhuojun victory: townspeople emerge, Zhang Fei celebrates, Liu Bei salutes.
- Yingchuan introduction: departure, Cao Cao enters, Zhang Fei steps forward and objects.
- Yingchuan victory: Cao Cao leaves while the brothers react.
- Guangzong introduction: Gongsun Zan reunion and a separate gate briefing.
- Guangzong victory: civilian emerges through the gate and the commanders exchange thanks.
- Zhang Jue introduction: seated night council, gestures while seated, departure.
- Zhang Jue victory: relief and reflection outside the town gate.

Three painted backgrounds are saved as `apps/web/public/assets/maps/scene-{camp-day,town-gate,camp-night}.webp`. Walkable grids exclude perimeter buildings and the night fire. Background fire is painted, not animated in this scene.

Six previously generated cloth-robed supporting actors are now sliced into lossless alpha WebP and registered in the motion library. Cao Cao, Gongsun Zan and Mi Zhu are used here; Zhao Yun, Jian Yong and Sun Qian are available for subsequent scenes. Supporting actors currently have side-facing motions; they are staged horizontally. Existing historical casting (including Mi Zhu at chapter-one council) is retained, not newly researched or rewritten.

Brothers have new cross-legged `rest`, `rest-talk`, `rest-emphasize` frames under `apps/web/public/assets/scene-motions/brothers-rest-v1`. These avoid using the oath bow as a resting pose. Existing tavern sitting clips remain intact.

Generation used the built-in image tool. Background prompts requested a compact quarter-view 1536×1024 Han camp/gate/night camp, clear central walking space, border props, no baked characters or UI; night camp requested a small central fire. Resting atlas prompt requested a transparent 3×3 sheet: Liu Bei/Guan Yu/Zhang Fei rows, cross-legged listening/palm-out speaking/raised-hand emphasis columns, heads upright, no bow or kneeling. Source images remain in Codex generated_images: `exec-61177663-ee4b-42e0-8776-54f45fce2789.png`, `exec-a331ee92-d6ba-4c62-b9e1-1e3624346722.png`, `exec-9a972c73-d982-4368-ba77-e2e20ac896df.png`, `exec-9039daa6-9402-4859-afb4-ba753878958a.png`.

Authoring recipe: `tools/content/chapter-one-story.py`; skips already-staged slots. Original data/project backup: `.studio/backups/chapter-one-story-before`. Active project and game snapshot were updated through revision-checked API to revision 12. Server port 3000 uses an isolated `.next-story` build directory to avoid another local server's cache.

Validation: full workspace tests and typecheck passed; 27-stage report-card HEALTHY. Additional scene contract checks cover actor/map references and non-wall action coordinates. Real browser review covered Yingchuan meeting and night council; other five slots have data validation, not full manual playback.
