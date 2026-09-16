const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.TK_SHARP_PATH || 'sharp');

(async () => {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: node tools/pack-special-fx.cjs atlas.png');
  const kinds = ['critical', 'ultimate', 'ultimate-dual', 'ultimate-crescent', 'ultimate-spear'];
  const meta = await sharp(source).metadata();
  const output = 'apps/web/public/assets/fx';
  let bytes = 0;
  for (const [row, kind] of kinds.entries()) for (let col = 0; col < 4; col++) {
    const left = Math.round(col * meta.width / 4), top = Math.round(row * meta.height / 5);
    const width = Math.round((col + 1) * meta.width / 4) - left;
    const height = Math.round((row + 1) * meta.height / 5) - top;
    const dest = path.join(output, `special-${kind}-${col}.png`);
    await sharp(source).extract({ left, top, width, height }).resize(256, 256)
      .png({ palette: true, colours: 128, dither: 0.5 }).toFile(dest);
    bytes += fs.statSync(dest).size;
  }
  console.log({ effects: kinds.length, frames: kinds.length * 4, bytes });
})().catch(error => { console.error(error); process.exitCode = 1; });
