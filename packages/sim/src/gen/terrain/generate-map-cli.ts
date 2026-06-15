/**
 * 지형 생성 CLI (§11-C). `pnpm --filter @tk/sim generate-map`.
 * 아키타입 → ASCII 프리뷰 + 맵 JSON(out/) + C→B→A 데모(생성 지형에 적 배치→밸런스 라벨).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMap, renderAscii, type Archetype } from "./mapGen";
import { autoTune, type GenSpec } from "../generator";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "..", "..", "out");

const archetype = (process.argv[2] as Archetype) || "gateBreakthrough";
const gen = generateMap(archetype, { width: 34, height: 20, seed: 1, chokeWidth: 4, coverDensity: 0.12, corridorWidth: 3 });

console.log(`아키타입: ${archetype} (${gen.map.width}×${gen.map.height}) · spawn ${gen.spawn.x},${gen.spawn.y} → goal ${gen.goal.x},${gen.goal.y}`);
console.log(renderAscii(gen.map));

// C→B→A 데모: 생성 지형에 B가 적 배치 → A 분류.
const spec: GenSpec = {
  mapId: gen.map.id,
  map: gen.map,
  spawn: gen.spawn,
  goal: gen.goal,
  playerUnits: [
    { commanderId: "유비", classId: "lord", level: 7, troops: 140, items: [], side: "player", x: gen.spawn.x, y: gen.spawn.y },
    { commanderId: "관우", classId: "lightCavalry", level: 7, troops: 140, items: ["청룡언월도"], side: "player", x: gen.spawn.x, y: gen.spawn.y - 1 },
    { commanderId: "장비", classId: "lightCavalry", level: 7, troops: 140, items: ["사모"], side: "player", x: gen.spawn.x, y: gen.spawn.y + 1 },
  ],
  mookPool: [
    { classId: "footman", troops: 90, level: 3 },
    { classId: "archer", troops: 80, level: 3 },
    { classId: "lightCavalry", troops: 85, level: 3 },
  ],
  boss: { classId: "lightCavalry", troops: 150, level: 5 },
  turnLimit: 30,
};
const res = autoTune(spec);
console.log("\nC→B→A 자동 조정:");
for (const t of res.trace) console.log(`  knob ${t.knob.toFixed(1)} → ${t.label}`);
console.log(`결과: knob ${res.knob.toFixed(1)} · ${res.label} · 수렴 ${res.converged ? "O" : "X"} · 적 ${res.stage.units.filter((u) => u.side === "enemy").length}유닛`);

mkdirSync(outDir, { recursive: true });
const mapPath = resolve(outDir, `${gen.map.id}.json`);
writeFileSync(mapPath, JSON.stringify(gen.map, null, 2), "utf8");
console.log(`맵 JSON: ${mapPath} (검수 후 maps/에 채택)`);
