import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseBakdata } from "./bakdata";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return (i >= 0 ? process.argv[i + 1] : undefined) ?? fallback;
}

const heroDir = arg("hero-dir", "C:\\HERO");
const outDir = arg("out-dir", join(import.meta.dirname, "..", "..", "..", "packages", "data", "json"));

const bak = parseBakdata(readFileSync(join(heroDir, "BAKDATA.R3")));
mkdirSync(outDir, { recursive: true });
const write = (file: string, data: unknown) =>
  writeFileSync(join(outDir, file), JSON.stringify(data, null, 2) + "\n", "utf8");
write("commanders.json", bak.commanders);
write("items.json", bak.items);
write("initialForces.json", bak.initialForces);
console.log(`장수 ${Object.keys(bak.commanders).length} / 아이템 ${Object.keys(bak.items).length} / 편성 ${Object.keys(bak.initialForces).length} → ${outDir}`);
// 맵 변환은 Task 6에서 이 CLI에 추가
