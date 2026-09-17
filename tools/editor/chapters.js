// tools/editor/chapters.js — 챕터 표 (DOM 무관). spec 2026-09-12-creator-ux-p2-design §2
// ⚠ SSOT = apps/web/src/meta/campaign.ts `CHAPTERS` — 표를 바꾸면 둘 다 고친다.
//   (packages/data/test/editor-chapters.test.ts 가 campaign.ts 를 파싱해 두 표를 대조한다.)
export const CHAPTERS = [
  { chapter: 1, title: "황건적의 난", from: 1, to: 4 },
  { chapter: 2, title: "반동탁연합", from: 5, to: 9 },
  { chapter: 3, title: "서주, 여포", from: 10, to: 15 },
  { chapter: 4, title: "관도 ~ 장판파", from: 16, to: 22 },
  { chapter: 5, title: "적벽", from: 23, to: 27 },
  { chapter: 6, title: "형주의 새 터전", from: 28, to: 30 },
  { chapter: 7, title: "입촉", from: 31, to: 34 },
  { chapter: 8, title: "한중 쟁탈", from: 35, to: 39 },
  { chapter: 9, title: "형제의 마지막 길", from: 40, to: 42 },
  { chapter: 10, title: "남중과 재건", from: 43, to: 45 },
  { chapter: 11, title: "출사표와 북벌", from: 46, to: 50 },
  { chapter: 12, title: "천하가 다시 하나로", from: 51, to: 55 },
];

/** "05-sishuiguan" → 5. 파싱 실패 시 999(맨 뒤) — campaign.ts 와 동일 규칙. */
export function stageNumber(id) {
  const s = String(id);
  const n = Number.parseInt(s.slice(0, s.indexOf("-")), 10);
  return Number.isFinite(n) ? n : 999;
}

/** 스테이지 id → 챕터 번호(1~5). 구간 밖이면 0. */
export function chapterOf(id) {
  const n = stageNumber(id);
  const c = CHAPTERS.find((ch) => n >= ch.from && n <= ch.to);
  return c ? c.chapter : 0;
}

/** 스테이지 id → 챕터 제목. 구간 밖이면 "". */
export function chapterTitle(id) {
  const c = CHAPTERS.find((ch) => ch.chapter === chapterOf(id));
  return c ? c.title : "";
}
