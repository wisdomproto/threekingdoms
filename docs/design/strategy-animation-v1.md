# Strategy animation pass

Eight categories now have eight generated transparent WebP frames each (64 frames total): fire, water, wind, earth, heal, debuff, weather, special.

`FxLayer.strategyEffect` uses complete frame sequences when loaded, otherwise keeps the existing procedural fallback. Playback lasts 640 ms and respects battle speed. The fixed 88 px canvas preserves growth between frames; no individual-frame trimming or scaling is applied. Ground effects align to unit feet; the special impact aligns to the torso. Rendering does not change damage, range, status effects or deterministic engine behavior.

Sources are preserved locally in `.studio/campaign-five/spell-*-source.png`; `pack-spell.cjs` splits the fixed 4-by-2 grid into 256 px lossless WebP frames. Generated sources are not for commit.

The battle motion preview includes category playback and slow playback at actual battle scale. Web typecheck and 790 web tests passed after integration. A browser playback capture confirmed the water frames render.

These are category-level effects. Qinglong, Zhuque, Xuanwu and Baihu currently share the special impact, not individual summon animations. Weather uses a neutral invocation effect, not a rain animation for every weather change. Five-chapter art and event expansion remains in progress.
