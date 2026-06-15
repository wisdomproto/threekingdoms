/**
 * 에셋 매니페스트 CLI (W1). `pnpm --filter @tk/sim asset-manifest`.
 * 필요한 이미지(초상·씬 배경·맵)를 스캔하고 public/ 존재여부를 붙여 docs/reference/asset-manifest.md로 굽는다.
 * = 길중의 "이 이미지 만들어주세요" 요청서. 파일을 경로에 넣으면 게임이 자동 반영(AssetImage 드롭-인).
 */
import { existsSync } from "node:fs";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gameData } from "@tk/data";
import { collectRequiredAssets } from "./manifest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", ".."); // src/assets → repo root
const publicAssets = resolve(repoRoot, "apps", "web", "public", "assets");
const outPath = resolve(repoRoot, "docs", "reference", "asset-manifest.md");

const req = collectRequiredAssets(gameData.stages, gameData.commanders);

const has = (rel: string) => existsSync(resolve(publicAssets, rel));
const mark = (ok: boolean) => (ok ? "✅" : "⬜");

let s = "";
s += "# 에셋 매니페스트 (생성 요청서)\n\n";
s += "캠페인 루프에 필요한 이미지 목록. ⬜ = 미보유(placeholder 표시 중) · ✅ = 보유. 파일을 경로에 넣으면 자동 반영.\n";
s += "경로 규약: 초상 `apps/web/public/assets/ui/portraits/{id}.webp` · 씬 배경 `.../assets/scenes/{bgId}.webp` · 맵 `.../assets/maps/{stageId}.webp`.\n\n";

// 요약
const pHave = req.portraits.filter((p) => has(`ui/portraits/${p.id}.webp`)).length;
const sHave = req.scenes.filter((sc) => has(`scenes/${sc.bgId}.webp`)).length;
const mHave = req.maps.filter((m) => has(`maps/${m.stageId}.webp`) || has(`maps/${m.stageId}.png`)).length;
s += `요약: 초상 ${pHave}/${req.portraits.length} · 씬 배경 ${sHave}/${req.scenes.length} · 맵 ${mHave}/${req.maps.length}\n\n`;

s += "## 1. 초상 (portraits)\n\n";
s += "톱다운 수묵 채색 인물 흉상(투명/단색 배경). id = 파일명.\n\n";
s += "| 보유 | id | 이름 | 최초 등장 | 경로 |\n|--|--|--|--|--|\n";
for (const p of req.portraits) {
  s += `| ${mark(has(`ui/portraits/${p.id}.webp`))} | ${p.id} | ${p.name} | ${p.firstStage} | ui/portraits/${p.id}.webp |\n`;
}

s += "\n## 2. 씬 배경 (scenes)\n\n";
s += "막간 시나리오 풀스크린 배경(가로, 수묵 풍경). 장면 맥락은 프롬프트 힌트.\n\n";
s += "| 보유 | bgId | 스테이지 | 유형 | 장면 맥락(힌트) |\n|--|--|--|--|--|\n";
for (const sc of req.scenes) {
  const hint = sc.firstLine.length > 40 ? sc.firstLine.slice(0, 40) + "…" : sc.firstLine;
  s += `| ${mark(has(`scenes/${sc.bgId}.webp`))} | ${sc.bgId} | ${sc.stageId} | ${sc.type} | ${hint} |\n`;
}

s += "\n## 3. 맵 배경 (maps)\n\n";
s += "전투 painted 배경(톱다운, §3-1). 격자 데이터에 맞춘 img2img 출력.\n\n";
s += "| 보유 | 스테이지 | mapId | 경로 |\n|--|--|--|--|\n";
for (const m of req.maps) {
  const ok = has(`maps/${m.stageId}.webp`) || has(`maps/${m.stageId}.png`);
  s += `| ${mark(ok)} | ${m.stageId} | ${m.mapId} | maps/${m.stageId}.webp |\n`;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, s, "utf8");
console.log(`매니페스트 생성: ${outPath}`);
console.log(`필요: 초상 ${req.portraits.length}(보유 ${pHave}) · 씬 ${req.scenes.length}(${sHave}) · 맵 ${req.maps.length}(${mHave})`);
