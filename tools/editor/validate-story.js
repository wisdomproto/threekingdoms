// tools/editor/validate-story.js — 씬/대사 검증 (DOM 무관, 순수). spec 2026-09-12-creator-ux-p2-design §9
// 에디터 validate() 가 결과를 합친다. 나머지 형식 검사는 서버 zod(StageSchema).
import { slotParts, isMapScene, isComicScene } from "./story-model.js";

const SLOT_LABEL = { intro: "전투 전 이야기", outro: "전투 후 이야기", outroDefeat: "패배 후 이야기" };
const blank = (s) => typeof s !== "string" || s.trim() === "";
const RECT_EPS = 1e-6;   // schemas ComicPanelSchema 와 동일(드래그 float 오차)
const rectOk = (r) => Array.isArray(r) && r.length === 4 && r.every((v) => typeof v === "number" && v >= 0 && v <= 1)
  && r[2] > 0 && r[3] > 0 && r[0] + r[2] <= 1 + RECT_EPS && r[1] + r[3] <= 1 + RECT_EPS;

/** 만화 파트 — 페이지 image·칸 rect·줄 text·hold. 문구 = `${at} N번째 페이지 N번째 칸 N번째 줄: …`. */
function validateComic(part, at, errs) {
  const pages = Array.isArray(part.pages) ? part.pages : [];
  if (pages.length === 0) errs.push(`${at}(만화): 페이지가 없습니다`);
  pages.forEach((pg, gi) => {
    const atPg = `${at} ${gi + 1}번째 페이지`;
    if (blank(pg?.image)) errs.push(`${atPg}: 지면 이미지가 비어 있습니다`);
    const panels = Array.isArray(pg?.panels) ? pg.panels : [];
    if (panels.length === 0) errs.push(`${atPg}: 칸이 없습니다`);
    panels.forEach((pn, ni) => {
      const atPn = `${atPg} ${ni + 1}번째 칸`;
      if (!rectOk(pn?.rect)) errs.push(`${atPn}: 칸 사각형이 이미지 범위(0~1)를 벗어났습니다`);
      if (pn?.hold !== undefined && !(Number.isInteger(pn.hold) && pn.hold >= 1)) errs.push(`${atPn}: 자동 진행(hold)은 1 이상 정수(ms)여야 합니다`);
      (Array.isArray(pn?.lines) ? pn.lines : []).forEach((l, li) => {
        if ("speaker" in l && blank(l.speaker)) errs.push(`${atPn} ${li + 1}번째 줄: 화자가 비어 있습니다 (내레이션이면 화자 없음으로)`);
        if (blank(l.text)) errs.push(`${atPn} ${li + 1}번째 줄: 본문이 비어 있습니다`);
      });
    });
  });
}

/**
 * @param stage  편집 모델(scenario·dialogue 는 optional)
 * @param ctx    { placedIds: 배치 유닛 id(증원 포함), duelIds: stage.events[].id }
 * @returns 사람 말 오류 문구 배열(빈 배열 = 정상)
 */
export function validateStory(stage, { placedIds = [], duelIds = [] } = {}) {
  const errs = [];
  const placed = new Set(placedIds), duels = new Set(duelIds);

  for (const [key, slot] of Object.entries(stage?.scenario ?? {})) {
    const label = SLOT_LABEL[key] ?? key;
    slotParts(slot).forEach((part, pi) => {
      const at = `${label} ${pi + 1}번째 장면`;
      const lines = Array.isArray(part?.lines) ? part.lines : [];
      if (isComicScene(part)) { validateComic(part, at, errs); return; }   // VN 폴백("줄이 없습니다") 앞
      if (isMapScene(part)) {
        if (blank(part.map)) errs.push(`${at}(맵 씬): map이 비어 있습니다`);
        if (!Array.isArray(part.units) || part.units.length === 0) errs.push(`${at}(맵 씬): 등장 유닛이 없습니다`);
        if (lines.length === 0) errs.push(`${at}(맵 씬): 줄이 없습니다`);
        return;
      }
      if (lines.length === 0) errs.push(`${at}: 줄이 없습니다`);
      lines.forEach((l, li) => {
        if ("speaker" in l && blank(l.speaker)) errs.push(`${at} ${li + 1}번째 줄: 화자가 비어 있습니다 (내레이션이면 화자 없음으로)`);
        if (blank(l.text)) errs.push(`${at} ${li + 1}번째 줄: 본문이 비어 있습니다`);
      });
    });
  }

  const dialogue = Array.isArray(stage?.dialogue) ? stage.dialogue : [];
  const seen = new Set();
  dialogue.forEach((d, di) => {
    const at = `전투 중 대사 ${di + 1}번째`;
    if (blank(d.id)) errs.push(`${at}: id가 비어 있습니다`);
    else if (seen.has(d.id)) errs.push(`${at}: id "${d.id}"가 중복됩니다`);
    seen.add(d.id);
    const t = d.trigger ?? {};
    if (t.kind === "turn" && !(Number.isInteger(t.n) && t.n >= 1)) errs.push(`${at}: 턴은 1 이상이어야 합니다`);
    if (t.kind === "unitRetreated" && !placed.has(t.unitId)) errs.push(`${at}: 퇴각 유닛 "${t.unitId}"가 배치되어 있지 않습니다`);
    if (t.kind === "duelOccurred" && !duels.has(t.duelId)) errs.push(`${at}: 일기토 "${t.duelId}"가 없습니다`);
    const lines = Array.isArray(d.lines) ? d.lines : [];
    if (lines.length === 0) errs.push(`${at}: 줄이 없습니다`);
    lines.forEach((l, li) => {
      if (blank(l.speaker)) errs.push(`${at} ${li + 1}번째 줄: 화자가 비어 있습니다`);
      if (blank(l.text)) errs.push(`${at} ${li + 1}번째 줄: 본문이 비어 있습니다`);
    });
  });
  return errs;
}
