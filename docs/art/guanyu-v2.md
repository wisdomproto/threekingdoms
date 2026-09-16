# Guan Yu battle sprite study v2

Generated with the built-in image tool on 2026-09-14. Six tier-one poses (front/back idle, move, attack) share a broader upper body, deep green robe, dark armor with gold accents and a forward crescent blade. Screen-left source orientation and runtime display height are unchanged. Higher promotion tiers remain existing art.

Source sheet, exact prompt, six lossless WebP outputs, slicing script and original backups: `.studio/map-art/guanyu-v2/`. Source is a 1536-by-1024 RGB atlas with a painted checkerboard. Use only the existing checkerboard remover: the general cleanup also removes dark outlines and beard pixels. Background compositing inspection confirmed intact silhouette after correcting this. Do not run black-background cleanup on this sheet.

Active tier-one assets: `apps/web/public/assets/sprites/guanyu/{front,back}_{idle,move,attack}.webp`.

Development map/object/sprite URLs now resolve through `/api/local-assets/`, which reads the local public file first and redirects missing files to the configured CDN. It is disabled outside development; production asset URLs remain unchanged. The route rejects traversal and sends local files with no-store cache headers. No CDN upload performed.

Validation: workspace typecheck (web rerun passed after fixing optional path typing), local map HEAD 200 with image/webp and no-store; real Zhuojun battle preview at stage camera zoom 1.6. Unit placements and combat rules unchanged.
