/**
 * 페이싱 생성기 CLI (§11-B). `pnpm --filter @tk/sim generate-stage`.
 * 예시 레시피로 autoTune → 수렴 트레이스·최종 라벨 출력 + 스테이지 JSON을 packages/sim/out/에 기록.
 * **gameData/stages에 자동 등록하지 않음** — 사람이 검수 후 채택.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { autoTune, type GenSpec } from "./generator";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "..", "out");

// 예시 레시피 — 사수관 맵에 신규 적 배치(챌린지/what-if 데모).
const spec: GenSpec = {
  mapId: "sishuiguan",
  spawn: { x: 50, y: 15 },
  goal: { x: 2, y: 14 },
  id: "gen-sishuiguan-demo",
  name: "생성 데모 — 사수관",
  playerUnits: [
    { commanderId: "유비", classId: "lord", level: 6, troops: 130, items: [], side: "player", x: 50, y: 14 },
    { commanderId: "관우", classId: "lightCavalry", level: 6, troops: 130, items: ["청룡언월도"], side: "player", x: 50, y: 15 },
    { commanderId: "장비", classId: "lightCavalry", level: 6, troops: 130, items: ["사모"], side: "player", x: 50, y: 16 },
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
console.log("자동 조정 트레이스:");
for (const t of res.trace) console.log(`  knob ${t.knob.toFixed(1)} → ${t.label}`);
console.log(`결과: knob ${res.knob.toFixed(1)} · ${res.label} · 수렴 ${res.converged ? "O" : "X"}`);
const enemyCount = res.stage.units.filter((u) => u.side === "enemy").length;
console.log(`생성 적 ${enemyCount}유닛(보스 포함).`);

mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `${spec.id}.json`);
writeFileSync(outPath, JSON.stringify(res.stage, null, 2), "utf8");
console.log(`스테이지 JSON: ${outPath} (검수 후 채택)`);
