/**
 * 밸런스 리포트 카드 (§11-A) — 순수 md 빌더 + 분류기.
 * docs/superpowers/specs/2026-06-15-balance-report-card-design.md.
 *
 * 결정론 엔진이라 셀당 1런 — {정책 티어}×{레벨 오프셋} 매트릭스가 시드 분포를 대체한다.
 * balance.ts와 동일 패턴(순수 산출 → md). report-card-cli가 파일로 굽고, reportCard.test가 게이트.
 */
import { stages } from "@tk/data";
import type { Stage, BattleMap } from "@tk/data";
import { runStage, type RunResult } from "./runner";
import { greedyPolicy, naivePolicy } from "./policy";

export interface Cell {
  result: "victory" | "defeat" | "timeout";
  turns: number;
  retreats: number;
}

/** greedy/naive × 레벨오프셋(키=문자열 "-2"/"0"/"2") 셀 맵. */
export interface MatrixResult {
  greedy: Record<string, Cell>;
  naive: Record<string, Cell>;
}

export type Label = "IMPASSABLE" | "BRITTLE" | "HARD" | "EASY" | "HEALTHY";

/** 매트릭스 축·임계(튜닝 파라미터). */
export const LEVEL_OFFSETS = [-2, 0, 2] as const;
/** naive@-2가 이 턴 이내 무퇴각 승이면 trivial(EASY). */
export const EASY_TURNS = 4;
/** greedy@0 퇴각 이 수 이상이면 harsh 신호. */
export const RETREAT_FLAG = 3;
/** greedy@0 턴 > turnLimit × 이 비율이면 slow 신호. */
export const SLOW_RATIO = 1.0;

function toCell(r: RunResult): Cell {
  return { result: r.result, turns: r.turns, retreats: r.playerRetreats };
}

/**
 * 임의 Stage의 6셀 매트릭스(등록 불필요 — §11-B 생성 스테이지 분류). 결정론(셀당 1런).
 * mapOverride 지정 시 미등록 생성 맵으로 측정(§11-C 합성).
 */
export function runMatrixOnStage(stage: Stage, mapOverride?: BattleMap): MatrixResult {
  const greedy: Record<string, Cell> = {};
  const naive: Record<string, Cell> = {};
  for (const off of LEVEL_OFFSETS) {
    greedy[String(off)] = toCell(runStage(stage, { policy: greedyPolicy, levelOffset: off, mapOverride }));
    naive[String(off)] = toCell(runStage(stage, { policy: naivePolicy, levelOffset: off, mapOverride }));
  }
  return { greedy, naive };
}

/** 등록된 stageId의 6셀 매트릭스. */
export function runMatrix(stageId: string): MatrixResult {
  const stage = stages[stageId];
  if (!stage) throw new Error(`unknown stage: ${stageId}`);
  return runMatrixOnStage(stage);
}

/**
 * 6셀 → 1 라벨(우선순위 순). g0=정렙 숙련(정준 밸런스 베이스라인), g2=+2 고렙 숙련.
 *  IMPASSABLE: g0·g2 둘 다 패(숙련이 정렙·고렙 다 못 깸 = 진짜 데이터 버그) → 게이트 하드 실패.
 *  BRITTLE: g0 승·g2 패(비단조 — +2가 봇 결정을 교란해 진다). **봇 아티팩트**(사람은 +2면 더 쉬움) →
 *    하드 실패 아님, 사람 검토 플래그. 그리디 정책의 myopic 한계 신호(17 여남 등).
 *  HARD: g0 패·g2 승 → 오버레벨 필요(보스/후반 의도 가능).
 *  EASY: g0·g2 승 + naive@-2가 EASY_TURNS 이내 무퇴각 승 → trivial.
 *  HEALTHY: 그 외(= g0·g2 승, trivial 아님).
 */
export function classify(m: MatrixResult): Label {
  const g2win = m.greedy["2"]!.result === "victory";
  const g0win = m.greedy["0"]!.result === "victory";
  const nm2 = m.naive["-2"]!;
  if (!g0win && !g2win) return "IMPASSABLE";
  if (g0win && !g2win) return "BRITTLE";
  if (!g0win && g2win) return "HARD";
  // 여기부터 g0·g2 모두 승.
  if (nm2.result === "victory" && nm2.turns <= EASY_TURNS && nm2.retreats === 0) return "EASY";
  return "HEALTHY";
}

/** 라벨과 별개의 튜닝 참고 신호(게이트 아님). */
export interface Signals {
  harsh: boolean;
  slow: boolean;
}

export function signals(m: MatrixResult, turnLimit: number): Signals {
  const g0 = m.greedy["0"]!;
  return { harsh: g0.retreats >= RETREAT_FLAG, slow: g0.turns > turnLimit * SLOW_RATIO };
}

export interface ReportRow {
  stageId: string;
  name: string;
  label: Label;
  matrix: MatrixResult;
  signals: Signals;
}

/** stageId 오름차순 27행. stageIds 미지정 시 전 스테이지. */
export function buildRows(stageIds?: string[]): ReportRow[] {
  const ids = (stageIds ?? Object.keys(stages)).slice().sort();
  return ids.map((id) => {
    const stage = stages[id]!;
    const matrix = runMatrix(id);
    return {
      stageId: id,
      name: stage.name,
      label: classify(matrix),
      matrix,
      signals: signals(matrix, stage.turnLimit),
    };
  });
}

/** 셀 1개를 "승6/0" 식 짧은 표기로(결과기호·턴·퇴각). */
function cellText(c: Cell): string {
  const mark = c.result === "victory" ? "승" : c.result === "defeat" ? "패" : "TO";
  return `${mark}${c.turns}/${c.retreats}`;
}

const LABEL_KO: Record<Label, string> = {
  IMPASSABLE: "🚫불가",
  BRITTLE: "🟡취약",
  HARD: "⚠️어려움",
  EASY: "🟢쉬움",
  HEALTHY: "✅건강",
};

export interface ReportCard {
  rows: ReportRow[];
  markdown: string;
  summary: Record<Label, number>;
}

export function buildReportCard(stageIds?: string[]): ReportCard {
  const rows = buildRows(stageIds);
  const summary: Record<Label, number> = { IMPASSABLE: 0, BRITTLE: 0, HARD: 0, EASY: 0, HEALTHY: 0 };
  for (const r of rows) summary[r.label]++;

  let s = "";
  s += "# 밸런스 리포트 카드 (§11-A)\n\n";
  s += "결정론 엔진 — 셀당 1런. {정책}×{레벨오프셋} 매트릭스. 셀 = 결과(승/패/TO)·턴/퇴각.\n\n";
  s += "🟡취약 = g0 승이나 +2에서 봇이 짐(비단조 = 그리디 정책 한계, 사람은 +2면 더 쉬움 — 게이트 비차단).\n\n";
  s += `요약: ✅건강 ${summary.HEALTHY} · 🟡취약 ${summary.BRITTLE} · ⚠️어려움 ${summary.HARD} · 🟢쉬움 ${summary.EASY} · 🚫불가 ${summary.IMPASSABLE} (총 ${rows.length})\n\n`;
  s += "| 스테이지 | 분류 | g−2 | g0 | g+2 | n−2 | n0 | n+2 | 신호 |\n";
  s += "|---|---|--|--|--|--|--|--|--|\n";
  for (const r of rows) {
    const g = r.matrix.greedy;
    const n = r.matrix.naive;
    const sig = [r.signals.harsh ? "거침" : "", r.signals.slow ? "장기" : ""].filter(Boolean).join("·") || "-";
    s += `| ${r.stageId} | ${LABEL_KO[r.label]} | ${cellText(g["-2"]!)} | ${cellText(g["0"]!)} | ${cellText(g["2"]!)} | ${cellText(n["-2"]!)} | ${cellText(n["0"]!)} | ${cellText(n["2"]!)} | ${sig} |\n`;
  }
  return { rows, markdown: s, summary };
}
