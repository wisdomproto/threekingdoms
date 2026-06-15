/**
 * 밸런스 리포트 카드 생성 CLI (§11-A). `pnpm --filter @tk/sim report-card`.
 * docs/reference/balance-report.md 를 굽고, 콘솔에 요약 + (회귀 게이트용) 라벨 맵을 찍는다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReportCard } from "./reportCard";

const here = dirname(fileURLToPath(import.meta.url));
// packages/sim/src → repo root
const repoRoot = resolve(here, "..", "..", "..");
const outPath = resolve(repoRoot, "docs", "reference", "balance-report.md");

const card = buildReportCard();
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, card.markdown, "utf8");

console.log(`리포트 생성: ${outPath}`);
console.log(
  `요약: 건강 ${card.summary.HEALTHY} · 어려움 ${card.summary.HARD} · 쉬움 ${card.summary.EASY} · 불가 ${card.summary.IMPASSABLE}`,
);
// 회귀 게이트 BASELINE_LABELS 갱신용(복붙 가능한 형태)
console.log("\n--- BASELINE_LABELS (gate snapshot) ---");
const map = Object.fromEntries(card.rows.map((r) => [r.stageId, r.label]));
console.log(JSON.stringify(map, null, 2));
