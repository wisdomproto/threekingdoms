// tools/editor/publish.js — Publish UX. spec 2026-09-12-creator-ux-p2-design §7
// 상단 = 순수(diffStage · checklist, node 테스트). 하단 = DOM 모달(openPublishModal)·에셋 프로브(probeAssets) — 브라우저 전용.
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
    { id: "full", label: "전수 검사", status: "ok", detail: "스키마·참조 전수 검사 — Publish 시 서버가 실행" },
  ];
  return { items, canPublish: items.every((i) => i.status !== "error") };
}

/* ═══════════ DOM 모달 + fetch (브라우저 전용) — spec §7 ═══════════ */

/**
 * 에셋 HEAD 프로브 → 누락 라벨 목록. 네트워크 실패면 ["확인 불가 …"] 1건(경고).
 * 초상 키: 씬 줄 = portraitId, 전투 대사 = speaker(런타임 규약). 맵 배경 파일명 = mapId(게임 LoadingTransition 규약).
 */
export async function probeAssets(stage, base) {
  const urls = new Map();   // label → url
  if (stage.mapId) urls.set(`painted 맵 배경 ${stage.mapId}`, `${base}/assets/maps/${encodeURIComponent(stage.mapId)}.webp`);
  const portraits = new Set();
  for (const slot of Object.values(stage.scenario ?? {})) for (const p of slotParts(slot)) {
    if (p.bg) urls.set(`씬 배경 ${p.bg}`, `${base}/assets/scenes/${encodeURIComponent(p.bg)}.webp`);
    for (const l of p.lines ?? []) { if (l.bg) urls.set(`씬 배경 ${l.bg}`, `${base}/assets/scenes/${encodeURIComponent(l.bg)}.webp`); if (l.portraitId) portraits.add(l.portraitId); }
  }
  for (const d of stage.dialogue ?? []) for (const l of d.lines ?? []) if (l.speaker) portraits.add(l.speaker);
  for (const id of portraits) urls.set(`초상 ${id}`, `${base}/assets/ui/portraits/${encodeURIComponent(id)}.webp`);
  try {
    const hit = await Promise.all([...urls].map(async ([label, url]) => ((await fetch(url, { method: "HEAD" })).ok ? null : label)));
    return hit.filter(Boolean);
  } catch { return ["확인 불가 (에셋 서버 응답 없음)"]; }
}

const fmtVal = (v) => (v === null || ["string", "number", "boolean"].includes(typeof v) ? String(v) : "…");
/** diffStage 결과 → 사람 말 한 줄 */
export function describeDiff(d) {
  switch (d.kind) {
    case "added": return `${d.key} 추가`;
    case "removed": return `${d.key} 삭제`;
    case "count": return `${d.key} ${d.before} → ${d.after}`;
    case "lines": return `${d.key} 줄 ${d.before} → ${d.after}`;
    default: return "before" in d ? `${d.key} ${fmtVal(d.before)} → ${fmtVal(d.after)}` : `${d.key} 변경됨`;
  }
}

const GLYPH = { ok: "✓", warn: "!", error: "✗" };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
async function postJson(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ...j, ok: r.ok && j.ok === true, status: r.status, error: j.error ?? (r.ok ? undefined : `HTTP ${r.status}`) };
}

/**
 * Publish 모달. #publishModal 을 만들고(재사용) 체크리스트·변경사항·[취소][Publish] → 결과(성공: 백업 있으면 [롤백]) 를 그린다.
 * 실패(ok:false, rolledBack)는 서버가 백업 meta 를 지우므로 [롤백] 을 제공하지 않는다.
 * @param p { stage, stageText, mapText?(바뀐 맵만), repoStage(null=새 스테이지), localErrors, probe():Promise<string[]>, onPublished(result), onRolledBack?(result) }
 */
export function openPublishModal({ stage, stageText, mapText, repoStage, localErrors, probe, onPublished, onRolledBack }) {
  let modal = document.getElementById("publishModal");
  if (!modal) { modal = el("div"); modal.id = "publishModal"; document.body.appendChild(modal); }
  modal.innerHTML = ""; modal.classList.add("on");
  const close = () => modal.classList.remove("on");
  modal.onclick = (e) => { if (e.target === modal) close(); };
  const box = el("div", "pbox"); modal.appendChild(box);
  box.appendChild(el("h3", null, `${stage.name} → packages/data/json/stages/${stage.id}.json${mapText ? " (+ map)" : ""}`));

  const hasVictory = (stage.objectives?.length ?? 0) > 0 || !!stage.victory;
  const hasFail = (stage.failConditions?.length ?? 0) > 0;
  const list = el("div", "pchk"); box.appendChild(list);
  const draw = (missing, probing) => {
    const { items, canPublish } = checklist({ localErrors, hasVictory, hasFail, missingAssets: missing });
    list.innerHTML = "";
    for (const it of items) {
      const row = el("div", `prow ${it.status}`); row.dataset.testid = `publish-check-${it.id}`;
      row.append(el("span", "g", GLYPH[it.status]), el("span", "l", it.label), el("span", "d", it.id === "assets" && probing ? "확인 중…" : it.detail));
      list.appendChild(row);
    }
    if (repoStage === null) {
      const row = el("div", "prow warn"); row.dataset.testid = "publish-check-new";
      row.append(el("span", "g", "!"), el("span", "l", "새 스테이지"), el("span", "d", "index.ts 등록 필요 — 전수 검사가 이 파일을 보지 않음"));
      list.appendChild(row);
    }
    return canPublish;
  };
  let canPublish = draw([], true);
  Promise.resolve().then(probe).then((m) => { canPublish = draw(m, false); run.disabled = !canPublish; }, () => { canPublish = draw(["확인 불가 (프로브 실패)"], false); run.disabled = !canPublish; });

  const det = el("details"); det.appendChild(el("summary", null, "변경사항 보기 ▾"));
  const dl = el("ul", "pdiff"); dl.dataset.testid = "publish-diff";
  const diffs = diffStage(repoStage, JSON.parse(stageText)).map(describeDiff);
  if (mapText) diffs.push("맵 타일 변경됨");
  if (diffs.length === 0) dl.appendChild(el("li", "dim", "변경 없음"));
  for (const d of diffs) dl.appendChild(el("li", null, d));
  det.appendChild(dl); box.appendChild(det);

  const row = el("div", "prow-btns");
  const cancel = el("button", "btn", "취소"); cancel.dataset.testid = "publish-cancel"; cancel.onclick = close;
  const run = el("button", "btn go", "Publish"); run.dataset.testid = "publish-run"; run.disabled = !canPublish;
  row.append(cancel, run); box.appendChild(row);

  const result = el("div", "presult"); result.dataset.testid = "publish-result"; result.style.display = "none"; box.appendChild(result);
  const showResult = (nodes) => { result.innerHTML = ""; result.style.display = ""; row.style.display = "none"; det.style.display = "none"; result.append(...nodes); };
  const closeBtn = () => { const b = el("button", "btn", "닫기"); b.onclick = close; return b; };

  run.onclick = async () => {
    run.disabled = true; cancel.disabled = true; run.textContent = "Publish 중… (전수 검사 5~15초)";
    let r;
    try { r = await postJson("/publish-stage", mapText ? { stage: stageText, map: mapText } : { stage: stageText }); }
    catch (e) { r = { ok: false, error: "요청 실패: " + e.message }; }
    if (!r.ok) {
      showResult([el("div", "bad", `✗ Publish 실패${r.rolledBack ? " — 자동 롤백됨" : ""}${r.error ? " — " + r.error : ""}`), el("pre", null, r.output || ""), closeBtn()]);
      return;
    }
    const at = new Date(r.at || Date.now()).toLocaleTimeString();
    const btns = el("div", "prow-btns");
    if (r.backup && (r.backup.stage || r.backup.map)) {   // 백업 있을 때만 롤백 (새 파일이면 없음)
      const rb = el("button", "btn warn", "롤백"); rb.dataset.testid = "publish-rollback";
      rb.onclick = async () => {
        rb.disabled = true; rb.textContent = "롤백 중…";
        let x;
        try { x = await postJson("/publish-rollback", { stageId: stage.id }); } catch (e) { x = { ok: false, error: "요청 실패: " + e.message }; }
        showResult([el("div", x.ok ? "ok" : "bad", x.ok ? `↶ 롤백 완료 · ${(x.restored || []).join(", ")} · 검사 통과` : `✗ 롤백 실패 — ${x.error || "검사 실패"}`), el("pre", null, x.ok ? "" : x.output || ""), closeBtn()]);
        onRolledBack?.(x);
      };
      btns.appendChild(rb);
    }
    btns.appendChild(closeBtn());
    showResult([el("div", "ok", `✓ Publish 완료 · ${at} · ${(r.wrote || []).join(", ")} · 검사 통과`),
      el("div", "hint", `버전 이력은 git — git log -- packages/data/json/stages/${stage.id}.json`), btns]);
    onPublished?.(r);
  };
  return modal;
}
