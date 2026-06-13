import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReportBody, damageTable, hitsToKillTable, skirmishSweep, growthCurveTable } from "./balance";

/**
 * 일기토 없는 순수 교전 밸런스 리포트 러너.
 *  - 콘솔에 (a)(b)(c) + 성장곡선 출력
 *  - docs/reference/balance-report.md 갱신 (해석/권장은 수기 머리말 — 자동 튜닝 없음)
 * 재실행: pnpm --filter @tk/sim balance  (또는 pnpm --filter @tk/sim balance -- --runs 16)
 */

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v ?? fallback;
}

const runs = Number(arg("runs", "8"));

// ── 콘솔 출력 ─────────────────────────────────────────────────────────────────
console.log("=".repeat(72));
console.log("일기토 없는 순수 교전 밸런스 리포트 (sim 합성 픽스처 — shipped 데이터 무변경)");
console.log("=".repeat(72));
console.log();
console.log(damageTable().markdown);
console.log(hitsToKillTable().markdown);
console.log(skirmishSweep(runs).markdown);
console.log(growthCurveTable());

// ── 마크다운 파일 출력 ────────────────────────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
// packages/sim/src → repo root → docs/reference/balance-report.md
const reportPath = resolve(here, "../../../docs/reference/balance-report.md");

const today = new Date().toISOString().slice(0, 10);
const header = `# 밸런스 리포트 — 일기토 없는 순수 교전 측정

> 자동 생성 (\`pnpm --filter @tk/sim balance\`). 표의 수치는 측정값이며 **이 리포트 갱신은 밸런스 데이터를 바꾸지 않는다**.
> 생성기: \`packages/sim/src/balance.ts\` + \`balance-cli.ts\`, 합성 픽스처 \`packages/sim/src/fixtures.ts\`.
> 측정 대상 공식: \`packages/engine/src/combat.ts\`(computeDamage), \`growth.ts\`(corpsStat 등급계수 증분성장).
> 마지막 생성: ${today}

## 왜 이 리포트가 필요했나

유일한 실전 스테이지(05-sishuiguan)는 스크립트 일기토(관우→화웅 즉승)가 victory를 가로채
\`computeDamage\`가 한 번도 실행되지 않는다 → 등급계수 증분성장이 이식됐어도 데미지·성장 밸런스가
측정 불능. 그래서 \`events: []\`(일기토 0개)인 평지 합성 픽스처로 그리디 vs 그리디 교전을 돌려
데미지 공식·성장 곡선이 실제로 돌게 만들고 측정한다. shipped 스테이지/데이터·apps/web은 무변경.

## 측정 조건

- 데미지 공식: \`데미지 = ((공격력 − 방어력 × 상성계수) ÷ 2 + 공격자Lv + 25) × (1 − guard)\` (최소 ${"1"}).
- 상성계수: 유리 0.75 / 불리 1.25 (기병>보병>궁병>기병). 평지 guard=0.
- 부대능력 = floor(장수능력/2) + 등급계수 누적성장(corpsStat). 명중 100%·무분산(결정론).
- 대표 장수(합성, commanders.json 무관): 에이스(무96·통98·지90), 군주(무78·통72), 적맹장(무90·통82),
  쫄병(무60·통60), 책사(지88). 대표 병종: 경기병/단병(보병)/궁병/책사.

## 해석 & 권장 (제안만 — 수치 변경 없음)

아래는 측정값에서 읽히는 양상과 조정 방향 **제안**이다. 어떤 밸런스 데이터도 바꾸지 않는다.

1. **상성 체감은 명확하나 폭이 좁다.** (a)에서 같은 공/방의 유리/불리 격차는 타격당 8~9(예: 쫄병기병→보병 유리 30 vs 궁병 불리 22, Lv1). 방향성은 살아 있지만 "상성 한 수로 판이 갈린다"는 느낌엔 약할 수 있음. 0.75/1.25를 더 벌리는 건 §10 "확정 데미지" 철학과 충돌하지 않으나, 먼저 (b)의 격파 타수 변동으로 체감 임계를 확인할 것.

2. **쫄병 처치 체감(길중 지표)은 양호.** (b)에서 병력 120 쫄병은 대개 4~5타에 격파(상성 유리 3~4타, 에이스급 3타). 영걸전식 "한참 두드리는" 느낌이 아니라 조조전식 압축 공방(3~5타)에 부합. 다만 동급 보병↔보병 5타는 약간 길게 느껴질 수 있어, "쫄병은 3~4타 안에 정리" 목표라면 보병 방어 등급(def S)이 과한지 검토 여지.

3. **레벨 격차 민감도가 매우 가파르다 (⚠️ 핵심 발견).** (c) 6v6 대칭 편성에서 동레벨은 패배(군주 격파)지만 아군 +1Lv에서 즉시 100% 승리로 뒤집힌다. +Lv 가산항(데미지 +공격자Lv)과 등급계수 누적성장이 **레벨 1당 양쪽으로 작용**(내 데미지↑ + 적 데미지 상대적↓)해 1~2레벨 차가 전투를 결정. → 스테이지 레벨캡(§10, 번호×1.5+5)과 후발 합류 레벨 보정이 **밸런스의 지배 변수**임을 시사. 적 배치 페이싱(§11)보다 레벨 곡선이 먼저 잡혀야 함.

4. **등급계수 증분성장은 레벨에 따라 부드럽게 벌어진다.** (참고표) atk S 에이스 공격력 50→239(Lv1→50), def S 쫄병보병 32→203. 구간 경계(50/70/90)를 넘을 때 가산폭이 커지는 "특화 구간"이 보이나 폭주는 없음(레벨캡 50 전제). 다만 50→239처럼 풀레벨 절대치가 커서, 데미지 상수항 +25·÷2 압축이 풀리는 고레벨 후반에서 공방이 다시 벌어질 수 있음 — 후반 스테이지에서 재측정 권장.

> **요약 제안**: ① 데이터는 그대로 두고, 먼저 **레벨 곡선·레벨캡**을 1차 밸런스 손잡이로 삼을 것(가장 민감). ② 상성 폭은 현행 유지가 §철학에 맞고, 더 키우려면 (b) 격파 타수 임계로 검증 후. ③ 보병 def S가 동급 교전을 길게 만드는지 별도 확인. (전부 제안 — 본 작업에선 미적용.)

---

`;

writeFileSync(reportPath, header + buildReportBody(runs), "utf8");
console.log();
console.log(`마크다운 리포트 작성: ${reportPath}`);
