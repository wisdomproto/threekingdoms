// Pack generated Troy sheets through the existing Three Kingdoms asset pipeline.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const pnpm = path.join(root, 'node_modules/.pnpm');
const sharpPackage = fs.readdirSync(pnpm).find(name => name.startsWith('sharp@'));
const sharpPath = process.env.TK_SHARP_PATH || require.resolve(path.join(pnpm, sharpPackage, 'node_modules/sharp'));
const sharp = require(sharpPath);
const jobs = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets/animation/sources.json'), 'utf8'));
const target = path.join(root, 'apps/web/public/assets/sprites');
const manifestPath = path.join(target, 'manifest.json');
async function main() {
  const report = [];
  for (const job of jobs) {
    const id = `troia-${job.id}`;
    const source = path.join(__dirname, 'assets/animation', `${job.id}.png`);
    execFileSync(process.execPath, [path.join(root, 'tools/pack-hero-motion.cjs'), source, id, 'both', target], {
      env: { ...process.env, TK_SHARP_PATH: sharpPath }, stdio: 'inherit',
    });
    const dir = path.join(target, id);
    for (const view of ['front', 'back']) {
      for (const pose of ['idle', 'move', 'attack', 'hit', 'guard']) {
        fs.copyFileSync(path.join(dir, `${view}_${pose}_0.webp`), path.join(dir, `${view}_${pose}.webp`));
      }
    }
    const frames = [];
    for (const name of fs.readdirSync(dir).filter(n => /_\d\.webp$/.test(n)).sort()) {
      const file = path.join(dir, name);
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let clear = 0, edge = 0;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const a = data[(y * info.width + x) * 4 + 3];
        if (a === 0) clear++;
        if ((x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) && a > 0) edge++;
      }
      if (info.width !== 256 || info.height !== 256 || clear < 1000 || edge !== 0) throw new Error(`Invalid alpha/frame bounds: ${file}`);
      frames.push({ name, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
    }
    if (frames.length !== 32 || new Set(frames.map(f => f.sha256)).size !== 32) throw new Error(`Missing or duplicate drawings: ${id}`);
    report.push({ id, frames });
  }
  // Merge only these new IDs, retaining all existing entries and metadata.
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const { id } of report) manifest[id] = {
    poses: fs.readdirSync(path.join(target, id)).filter(n => n.endsWith('.webp')).map(n => n.slice(0, -5)).sort(),
    source: `docs/troia/first-battle/assets/animation/${id.slice(6)}.png`,
    method: 'imagegen + pack-hero-motion.cjs',
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'assets/animation/audit.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Installed ${report.length} Troy characters, ${report.length * 32} distinct animation frames.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
