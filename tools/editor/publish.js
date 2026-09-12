// tools/editor/publish.js — Publish UX. spec 2026-09-12-creator-ux-p2-design §7
// 상단 = 순수(diffStage · checklist, node 테스트). DOM 모달·fetch 래퍼는 아래에 이어 붙는다(Chunk 4).
import { slotParts } from "./story-model.js";

const J = (v) => JSON.stringify(v);
const lineCount = (slot) => slotParts(slot).reduce((n, p) => n + (p.lines?.length ?? 0), 0);

/**
 * 최상위 키 합집합 비교. before=null 이면 새 스테이지(전 키 added).
 * 배열 = 길이 델타(count) 아니면 changed / scenario = 슬롯별 줄 수(lines) / 그 외 = JSON 불일치면 changed(before/after 동봉).
 * @returns {{ key: string, kind: "added"|"removed"|"changed"|"count"|"lines", before?: unknown, after?: unknown }[]}
 */
export function diffStage(before, after) {
  const out = [];
  const b = before ?? {}, a = after ?? {};
  const cmp = (key, x, y, deep) => {
    if (x === undefined) out.push({ key, kind: "added" });
    else if (y === undefined) out.push({ key, kind: "removed" });
    else if (deep) deep(key, x, y);
    else if (J(x) !== J(y)) out.push({ key, kind: "changed", before: x, after: y });
  };
  const arr = (key, x, y) => {
    if (x.length !== y.length) out.push({ key, kind: "count", before: x.length, after: y.length });
    else if (J(x) !== J(y)) out.push({ key, kind: "changed" });
  };
  const slot = (key, x, y) => {
    const [bx, by] = [lineCount(x), lineCount(y)];
    if (bx !== by) out.push({ key, kind: "lines", before: bx, after: by });
    else if (J(x) !== J(y)) out.push({ key, kind: "changed" });
  };
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (k === "scenario") for (const s of new Set([...Object.keys(b[k] ?? {}), ...Object.keys(a[k] ?? {})])) cmp(`scenario.${s}`, b[k]?.[s], a[k]?.[s], slot);
    else cmp(k, b[k], a[k], Array.isArray(b[k]) && Array.isArray(a[k]) ? arr : null);
  }
  return out;
}

/**
 * Publish 체크리스트. error 가 하나라도 있으면 canPublish=false (warn 은 허용).
 * @param {{ localErrors: string[], hasVictory: boolean, hasFail: boolean, missingAssets: string[] }} p
 */
export function checklist({ localErrors, hasVictory, hasFail, missingAssets }) {
  const items = [
    { id: "required", label: "필수 데이터", status: localErrors.length ? "error" : "ok", detail: localErrors.length ? `오류 ${localErrors.length}건` : "" },
    { id: "victory", label: "승패조건", status: !hasVictory ? "error" : hasFail ? "ok" : "warn", detail: !hasVictory ? "승리 조건이 없습니다" : hasFail ? "" : "패배 조건 없음(제한 턴만)" },
    { id: "assets", label: "에셋", status: missingAssets.length ? "warn" : "ok", detail: missingAssets.length ? `누락 ${missingAssets.length}개: ${missingAssets.join(" · ")}` : "" },
    { id: "full", label: "전수 검사", status: "ok", detail: "Publish 시 서버가 실행" },
  ];
  return { items, canPublish: items.every((i) => i.status !== "error") };
}
