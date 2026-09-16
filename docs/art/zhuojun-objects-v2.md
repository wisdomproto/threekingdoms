# Zhuojun object art v2

Generated with the built-in image generation tool on 2026-09-14. Twelve shared local object assets were replaced: tree_leafy, rock_cluster, rock_boulder, village_hut, village_hut2, shrub, banner_command, pennants, campfire, supply_cart, debris_cart, debris_weapons.

The atlas, exact prompt, crop coordinates, reproducible slicing script, exported lossless RGBA WebPs and original backups are in `.studio/map-art/zhuojun-objects-v2/`. Source atlas is 1448 by 1086 with true alpha. Nonuniform row spacing required individual crop rectangles; alpha above 16 determines trim bounds while interior alpha is preserved.

Active files are in `apps/web/public/assets/objects/`. Existing object keys, placement coordinates and collision data remain unchanged. Other maps using these shared keys also receive the new local art. No remote upload was performed.

Studio map rendering and the add-object picker prefer local object files with an editor-session cache version and fall back to the published asset URL, so regeneration can be reviewed before publishing.

Validation: all twelve crops retain alpha; inspected isolated sprites and the full map in Studio. Stage editor module syntax check passed.
