# Zhuojun terrain draft v2

Generated with the built-in image generation tool on 2026-09-14.

This is a terrain art experiment; map collision tiles, unit placements and gameplay data are unchanged. Lush meadow, forest-floor litter, cool rocky ground and a cosmetic village footpath replace the uniformly muted dirt treatment. Trees and buildings remain separate runtime objects.

The existing painted files contain four June 21 chunks, but the current layout manifest specifies two square 24-by-24 chunks with an eight-tile horizontal overlap. Do not stitch those old painted chunks using the newer manifest.

The new matching set lives in `.studio/map-art/zhuojun-v2/`: layout references, manifest, both exact prompts, two generated PNGs, stitched WebP, and `original.webp` backup. Generated chunks are 1254 by 1254 pixels. The 3840-by-2304 output uses the existing 96-pixels-per-tile stitch density; resizing does not add source detail. A denser chunk pass may still be needed for close zoom.

Reproduce the draft without replacing the active game image:

```powershell
python tools/sprite-pipeline/stitch_chunks.py zhuojun 96 .studio/map-art/zhuojun-v2 .studio/map-art/zhuojun-v2/zhuojun.webp
```

Active local asset: `apps/web/public/assets/maps/zhuojun.webp`. No remote assets have been uploaded.
