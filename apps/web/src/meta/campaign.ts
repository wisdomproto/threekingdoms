/**
 * 캠페인 시퀀싱 (W1 — 캠페인 루프) — 순수. 스테이지 순서·다음 스테이지·§5 챕터 매핑.
 * StageSelect·ScenePlayer·ResultSequence가 공유하는 단일 출처.
 */
import { stages } from "@tk/data";

/** §5 챕터 정의 — 스테이지 번호 구간. (StageSelect와 동일 — 여기로 단일화.) */
export const CHAPTERS: { chapter: number; title: string; from: number; to: number }[] = [
  { chapter: 1, title: "황건적의 난", from: 1, to: 4 },
  { chapter: 2, title: "반동탁연합", from: 5, to: 9 },
  { chapter: 3, title: "서주, 여포", from: 10, to: 15 },
  { chapter: 4, title: "관도 ~ 장판파", from: 16, to: 22 },
  { chapter: 5, title: "적벽", from: 23, to: 27 },
];

/** id "05-sishuiguan" → 5. 파싱 실패 시 999(맨 뒤). */
export function stageNumber(id: string): number {
  const n = Number.parseInt(id.slice(0, id.indexOf("-")), 10);
  return Number.isFinite(n) ? n : 999;
}

/** 번호 → 챕터(1~5). 구간 밖이면 0. */
export function chapterOf(num: number): number {
  const c = CHAPTERS.find((ch) => num >= ch.from && num <= ch.to);
  return c ? c.chapter : 0;
}

/** 전 스테이지 id를 번호 오름차순으로. */
export function orderedStageIds(): string[] {
  return Object.keys(stages).sort((a, b) => stageNumber(a) - stageNumber(b));
}

/** 진행 순서상 다음 스테이지 id. 마지막/미지정이면 null. */
export function nextStageId(id: string): string | null {
  const ordered = orderedStageIds();
  const i = ordered.indexOf(id);
  if (i < 0 || i === ordered.length - 1) return null;
  return ordered[i + 1]!;
}
