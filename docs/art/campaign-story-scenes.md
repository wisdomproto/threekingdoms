# Campaign story staging, chapters 2–5

2026-09-15. Added moving-character staging to all 46 intro/outro slots for battles 05–27. Together with chapter one, all 54 slots now include a MapScene. Original dialogue, speaker, portrait, side and order are retained. Combat rules, roster and battle maps are unchanged by this pass.

## Assets and staging

Six new story sets: council hall, refugee road, ruined city, river landing, command deck and Changban bridge. Fifteen new appearance profiles cover official/later-leader outfits for the brothers, advisors and envoys, Tao Qian, Huang Gai, mounted Zhao Yun carrying A Dou and Zhang Fei guarding the bridge. Existing cloth-robed actors and two copied battle profiles are reused where appropriate. These are scene appearances, not new playable commanders.

Art is original generated imagery. Backgrounds use quality-93 WebP; sprites use lossless alpha WebP. Source PNGs remain outside the repository in the local Codex generated_images folder. `tools/content/campaign-story-assets.py` records source filenames and extraction. Advisor rows touch at robe/hat tips and require cell segmentation before trimming. Mounted Zhao Yun has displayScale 1.55 so the rider does not read as a miniature beside walking actors.

`tools/content/campaign-story.py` records authored cast, sets, entrances, exits, gestures and reaction beats. It skips already-converted slots. New costumes have side-facing clips (right mirrored); no rear-facing art is falsely registered. Dialogue/gestures are limited-frame animation, not fully animated cinematics. Intro establishing stills are preserved. Background flames remain painted in these story sets; battle fire animation is separate.

## Integration and verification

Active Studio project 791e33c0-eb83-4b40-8b91-f58843ad3a64 updated to revision 14 and published to the local game snapshot. Original project and source stages are backed up in `.studio/backups/chapters-two-five-story-before`. Only targeted scene resources and new maps were synchronized; battle edits were preserved.

Coverage test checks all 54 slots, and the 46 new slots additionally validate schema, image references, motion clips, visible speaking actors, walkable starting positions, reachable moves and non-overlapping final cells. Browser checks found and corrected advisor atlas row merging, mounted actor size and Zhang Fei overlapping the bridge railing. Portrait-less crowd dialogue omits the empty portrait frame.

Full tests passed, followed by changed-package reruns: data 291, engine 187, sim 73, web 804 (9 importer fixture tests skipped). Typecheck passed. Battle report remains 27 HEALTHY. These automated checks do not certify every animation frame visually.

## Generation prompts

### hallPrompt

Paint one 1536x1024 historical Chinese SRPG conversation background, compact Han governor council hall, elevated 30-degree quarter-view orthographic-like no horizon, hand-painted crisp illustrated strategy RPG style like reference. Warm wood and jade textile, cream plaster, modest civic hall not imperial palace. Upper 25% has raised low official desk and scroll shelves, pillars only perimeter, left/right curtains, lamps soft daytime light. Central 65% OPEN flat wooden floor uninterrupted for six standing characters, no table in center, no people, no lettering no UI grid. Intimate set, soft top-left lighting, matching cute 3-head tall characters overlaid later. Reference is art style only; make a new indoor location.

### roadPrompt

Create 1536x1024 painted 2D Chinese historical SRPG story map, refugee road and wooded mountain pass. Elevated quarter-view 30 degrees orthographic-like no sky/horizon. Hand-painted crisp warm ochre and muted green style matching reference. Flat broad packed-earth path runs HORIZONTALLY through middle 65% of frame, enough open clearing for six small characters. Upper edge scrub slope small rocks and bamboo forest, lower edges grass, a single abandoned luggage basket at FAR lower left. Quiet late afternoon, readable not gloomy. No people, no horses, no bodies, no UI no grid no text. Compact intimate conversation and retreat set rather than huge battle field. Center/lower-middle entirely unobstructed walkable earth; rocky cliffs stay at uppermost 20%.

### ruinsPrompt

Create one 1536x1024 painted 2D Han China SRPG story set: ruined Luoyang street after fire. Same slightly elevated 30 degree quarter-view orthographic-like camera, crisp illustrated warm muted art style as reference. No horizon. Central 65% broad flat cobbled/earth street clear to stand and walk. Burnt collapsed tiled roofs and blackened wall at UPPER edge and far corners only, faint pale smoke, a few tiny embers near edge; no huge flames. Desaturated ash gray, brick ochre and subtle gold evening light. A quiet tragic scene but readable. No bodies no people no characters no UI grid text. Keep center free of structural debris. Intimate close story set rather than panorama.

### riverPrompt

Create 1536x1024 painted 2D Han Chinese SRPG STORY map river landing. Slightly elevated quarter-view 30 degree camera orthographic-like no sky/horizon. Water occupies uppermost 25%, two small wooden boats moored at top edge to short quay. Lower 70% broad flat stone/earth embankment entirely walkable unobstructed across middle. Ropes/barrels at far edges only, reed grasses at corner. Blue-green Yangtze water gold daylight mossy stone, crisp hand-painted illustrated art style like reference. Intimate place for 4-6 story characters to speak and embark, no people no horses no text grid UI. Clearly distinguish shoreline at y25%; no water intrudes into middle or lower walking space.

### deckPrompt

Paint 1536x1024 2D historical Chinese SRPG story background viewed from slightly elevated quarter-view 30 degrees. Aboard a broad Han-era wooden command ship on Yangtze. Open unobstructed wooden deck occupies central 70%, topmost edge rail with water beyond, small cabin ONLY upper-right, mast base ONLY far left edge, coils rope at corners. Soft late afternoon sunlight amber wood teal water. No people no text no grid/UI. Camera no horizon or sky; intimate story conversation set for four chibi characters. Reference style crisp hand-painted detailed but readable, no table in middle. Keep all middle and lower-middle deck free.

### bridgePrompt

1536x1024 painted 2D Chinese SRPG story set Changban bridge. Elevated quarter view 30 degrees orthographic-like NO horizon, no people/UI/text. A sturdy weathered wooden bridge runs HORIZONTALLY from left edge to right edge across image, broad deck spans middle y35%-70% full width. River water visible above and below it, banks at far left/right, bamboo foliage only corners. Bridge railing low and confined y30% and y72%, central standing space completely clear. Dramatic but natural late afternoon dusty sunlight, muted blue-green water and warm brown wood. Hand-painted crisp illustrated strategy game background like reference, intimate enough for a single hero standing center with visible plank detail. No buildings on bridge, no mast, no characters, no grids.

### missingCastPrompt

One transparent RGBA 1536x1536 sprite atlas exactly 6 equal columns x4 equal rows, 24 isolated full body cute historical Chinese story characters. Match reference clean illustrated 3-head chibi body proportions, slightly elevated quarter-view, face lower-left. NO checkerboard baked in, actual alpha. Row1 Chen Deng young shrewd thin moustache teal scholar robe black cloth official cap. Row2 Mi Fang stocky middle-aged moustache russet brown officer tunic soft leather belt, no armor, brown headwrap. Row3 Tao Qian elderly governor white long beard gray eyebrows faded lavender/cream official robe black tall cap, stooped slightly. Row4 Huang Gai elderly robust veteran gray beard scar eyebrow burnt orange robe navy sash gray headwrap, light white bandage glimpsed at collar, no armor. For EACH row columns: idle arms lowered; walk left leg; walk right leg; talk one open palm waist high; salute clasp hands at chest; kneel formal head upright hands clasped. Exactly same costume/identity per row, no weapons no backgrounds no groundshadows text or grid. Generous separation keep full body within own equal cell with 10% margin. Fixed standing scale and foot baseline per row; kneeling shorter.

### heroStoryPrompt

Generate one actual transparent RGBA 1536x1024 sprite atlas 6 equal columns x2 equal rows. Cute three-head-tall historical Chinese SRPG characters matching reference clean illustrated style, quarter-view slightly elevated, all face lower-left. Row1 Zhao Yun youthful handsome clean shaven silver/white light armor pale blue scarf, ON WHITE HORSE, holds a securely swaddled small baby in left arm and long spear upright in right. All six poses maintain baby safe, horse fully within cell. Col1 idle, col2 horse walking A, col3 horse walking B, col4 talking head slightly bowed toward companion, col5 alert head upright spear slightly raised, col6 calm respectful head dip. Row2 Zhang Fei robust black beard topknot, black/brown light armor with red scarf, ON FOOT holding long serpent spear; col1 idle, col2 walkA, col3 walkB, col4 speaking open free hand, col5 forceful shout free arm pointing ahead, col6 respectful bow spear held vertical. Full bodies never overlap cell boundaries; equal character head sizes across both rows though horse makes first silhouette wider, standing row2 occupies 75% cell height. Actual transparent alpha no grid/checkerboard/text/backdrop. Keep ample 10% margins. Original sprites, no portraits/UI.
