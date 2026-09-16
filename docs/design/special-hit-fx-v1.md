# Critical and ultimate presentation

Implemented 2026-09-14 following the user's direction: universal effects first, named hero overrides second.

- Universal critical: compact gold fracture, four frames, 220 ms, 44 world pixels maximum texture extent.
- Universal ultimate: condensed gold light and expanding rays, four frames, 360 ms, 68 world pixels.
- Liu Bei ultimate: ivory/gold and emerald crossed sword trails.
- Guan Yu ultimate: heavy jade crescent.
- Zhang Fei ultimate: red/orange spear streak rotated toward the target.
- Named ultimate art falls back to the universal ultimate when any frame is missing; universal art falls back to the existing impact renderer.
- Critical and ultimate effects replace the ordinary weapon trail and impact rather than stacking them. Ultimate announcement lasts 650 ms; contact VFX is deferred to the following matching damage event.
- Battle rules, SP, critical probability and damage are unchanged. Character poses still use the existing attack clips; this delivery adds VFX, not new character animation sheets or illustrated cut-ins.

Assets: `apps/web/public/assets/fx/special-*.png`, 20 indexed PNG frames, 561,976 bytes total. Originals and exact generation prompt remain outside source control under `.studio/special-fx-v1/`. Repack using `tools/pack-special-fx.cjs` with `TK_SHARP_PATH` pointing to Sharp when needed.

Preview: `/battle-motion-preview`, buttons `치명타` / `필살기`; `기본 필살기 비교` bypasses hero overrides for visual comparison. Uses the production FxLayer and UnitView; displayed damage values are illustrative.

Validation: targeted Pixi/battle tests (77 passing), web type check, visual comparison of the generated atlas and runtime effects at 1x/2x. Production build output is logged in `.studio/special-fx-v1/build.log`.
