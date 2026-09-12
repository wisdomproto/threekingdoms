// tools/editor/e2e/creator.mjs — creator UX P2 e2e (spec 2026-09-12-creator-ux-p2-design §11 ①~⑦):
// chapter rail, breadcrumb, story editor + scene preview round trip, dialogue add/undo, quick edit entry,
// Publish (no-change → git delta 0, turnLimit change → file → rollback), game PauseMenu ✏ edit link.
// Real Chrome via CDP + own serve.py :8095 (cdp.mjs). Needs next dev on GAME (http://localhost:3000).
// Run: node tools/editor/e2e/creator.mjs   (from repo root)
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { openEditor, Tab, pages, check, finish, sleep, EDITOR_READY, REPO, TOOLS_ORIGIN } from "./cdp.mjs";

const GAME = process.env.E2E_GAME_ORIGIN || "http://localhost:3000";
const H = "window.__stageEditor";
const STAGE_FILE = path.join(REPO, "packages/data/json/stages/05-sishuiguan.json");
const BACKUP_DIR = path.join(REPO, "apps/web/public/_draft/publish-backup");
const gitStatus = () => execSync("git status --porcelain packages/data/json", { cwd: REPO, encoding: "utf8" });
const TL_INPUT = `Array.from(document.querySelectorAll('#tabbody input[type=number]')).find(i => Number(i.value) === ${H}.getStage().turnLimit)`;
const click = (sel) => `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return 'no:' + ${JSON.stringify(sel)}; b.click(); return 'ok'; })()`;
const text = (sel) => `(document.querySelector(${JSON.stringify(sel)})?.textContent ?? '')`;
const closeModal = "(() => { const b = Array.from(document.querySelectorAll('#publishModal .presult button')).find(b => b.textContent === '닫기'); b?.click(); return !!b; })()";   // .presult 의 첫 button 은 [롤백]
const undoAll = async (t) => { for (let i = 0; i < 20 && (await t.eval(`${H}.history.canUndo()`)); i++) await t.eval(`${H}.doUndo()`); };
async function waitPage(re, tries = 60) { for (let i = 0; i < tries; i++) { const p = (await pages()).find((p) => re.test(p.url)); if (p) return p; await sleep(500); } return null; }
async function gone(id, tries = 30) { for (let i = 0; i < tries; i++) { if (!(await pages()).some((p) => p.id === id)) return true; await sleep(500); } return false; }

const t0 = Date.now();
let t, g;
try {
  t = await openEditor();
  // profile dir persists across runs — rail collapse / recovery state from a previous run must not leak in
  // stale Draft from an aborted earlier suite would be loaded draft-first and then *published* in step ⑥ — delete it first
  await t.eval("fetch('/draft-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stageId: '05-sishuiguan' }) }).catch(() => null)");
  await t.eval("localStorage.clear(); location.search = '?nodraft=1'; 'r'"); await sleep(1000);   // ?nodraft=1: this script owns publish/undo steps — autosave drafts must not leak into them if a step aborts
  if (!(await t.waitFor(EDITOR_READY))) throw new Error("editor did not reload");

  // ── ① rail ────────────────────────────────────────────────────────────────
  check("rail: 27 items rendered", await t.waitFor("document.querySelectorAll('#rail .rail-item').length === 27"));
  const rail = await t.eval(`({ ch: document.querySelectorAll('#rail .rail-ch').length, items: document.querySelectorAll('#rail .rail-item').length, on: Array.from(document.querySelectorAll('#rail .rail-item.on')).map(e => e.dataset.stageId), model: ${H}.railStages().length })`);
  check("rail: 5 chapter groups, 27 items, 05-sishuiguan .on", rail.ch === 5 && rail.items === 27 && rail.model === 27 && rail.on.length === 1 && rail.on[0] === "05-sishuiguan", rail);

  // ── ② pick 06 → breadcrumb ────────────────────────────────────────────────
  await t.eval(click("#rail .rail-item[data-stage-id='06-huluguan']"));
  check("rail: click 06-huluguan loads it", await t.waitFor(`${H}.getStage().id === '06-huluguan'`));
  const crumb = await t.eval(text("#crumb"));
  check("crumb: 제2장 · 호로관", crumb.includes("제2장"), crumb);
  check("rail: .on moved to 06", (await t.eval("document.querySelector('#rail .rail-item.on')?.dataset.stageId")) === "06-huluguan");

  // ── ③ story editor + scene preview round trip ─────────────────────────────
  await t.eval(click("#rail .rail-item[data-stage-id='05-sishuiguan']"));
  check("rail: back to 05", await t.waitFor(EDITOR_READY));
  await t.eval(click(".tabs .tab[data-tab='story-intro']"));
  const nTa = await t.eval("document.querySelectorAll('#tabbody textarea:not(.json)').length");
  check("story-intro: 7 line textareas", nTa === 7, nTa);
  const line0 = await t.eval(`${H}.getStage().scenario.intro.lines[0].text`);
  await t.eval(`(() => { const ta = document.querySelector('#tabbody textarea:not(.json)'); ta.focus(); ta.value = ta.value + '[E2E]'; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.blur(); })()`);
  check("story-intro: edit → line 0 text has [E2E], canUndo", await t.eval(`${H}.getStage().scenario.intro.lines[0].text === ${JSON.stringify(line0 + "[E2E]")} && ${H}.history.canUndo()`));
  const chip = await t.eval(text("#saveState"));
  check("chip: 수정됨", chip.includes("수정됨"), chip);
  const before3 = (await pages()).map((p) => p.id);
  await t.eval(click("#playtestMenuBtn"));
  check("playtest menu: intro enabled", await t.waitFor("(() => { const b = document.querySelector('#playtestMenu [data-scene=intro]'); return !!b && !b.disabled && document.getElementById('playtestMenu').classList.contains('on'); })()", 10, 200));
  await t.eval(click("#playtestMenu [data-scene=intro]"));
  const scenePage = await waitPage(/\/scene\?stage=__lab&type=intro/);
  check("scene preview: new tab at /scene?stage=__lab&type=intro", !!scenePage && !before3.includes(scenePage.id), scenePage?.url ?? (await pages()).map((p) => p.url));
  if (!scenePage) throw new Error("no scene tab");
  g = await Tab.open(scenePage);
  check("scene: page text shows [E2E] (draft, not repo)", await g.waitFor("document.body.innerText.includes('[E2E]')", 60, 250), await g.eval("document.body.innerText.slice(0, 200)"));
  // click through: root role=button advances (reveal → next); last line → leaveSandbox → window.close (opener = editor)
  for (let i = 0; i < 60 && (await pages()).some((p) => p.id === scenePage.id); i++) {
    await g.eval(`document.querySelector('[aria-label="대사 진행 (탭)"]')?.click(); 0`).catch(() => {});
    await sleep(250);
  }
  g.close(); g = null;
  check("scene: tab closed after last line", await gone(scenePage.id));
  check("editor: [E2E] still in draft after return", await t.eval(`${H}.getStage().scenario.intro.lines[0].text.endsWith('[E2E]')`));
  await undoAll(t);
  check("story-intro: undo → clean, line 0 restored", await t.eval(`!${H}.history.isDirty() && ${H}.getStage().scenario.intro.lines[0].text === ${JSON.stringify(line0)}`));

  // ── ④ dialogue add / undo ─────────────────────────────────────────────────
  await t.eval(click(".tabs .tab[data-tab='dialogue']"));
  const nDlg = await t.eval(`(${H}.getStage().dialogue || []).length`);
  check("dialogue: click + 대사 추가", (await t.clickText("+ 대사 추가")) === "ok");
  const head = await t.eval("Array.from(document.querySelectorAll('#tabbody .card.dlg .head h3')).at(-1)?.textContent ?? ''");
  check("dialogue: new card head = 전투가 시작되면", head.includes("전투가 시작되면") && (await t.eval(`${H}.getStage().dialogue.length`)) === nDlg + 1, head);
  await t.eval(`${H}.doUndo()`);
  const afterUndo = await t.eval(`({ n: (${H}.getStage().dialogue || []).length, cards: document.querySelectorAll('#tabbody .card.dlg').length, dirty: ${H}.history.isDirty() })`);
  check("dialogue: undo → card gone, length back", afterUndo.n === nDlg && afterUndo.cards === nDlg && !afterUndo.dirty, afterUndo);

  // ── ⑤ quick edit entry URL ────────────────────────────────────────────────
  await t.eval(`window.onbeforeunload = null; location.href = ${JSON.stringify(`${TOOLS_ORIGIN}/tools/stage-editor.html?stage=05-sishuiguan&quick=1`)}; 'nav'`); await sleep(1000);
  check("quick: reload with ?quick=1", await t.waitFor(EDITOR_READY));
  const tab5 = await t.eval(`${H}.getActiveTab()`);
  check("quick: active tab battle:quick", tab5 === "battle:quick", tab5);
  const railW = await t.eval("({ w: document.getElementById('rail').getBoundingClientRect().width, collapsed: document.getElementById('rail').classList.contains('collapsed') })");
  check("quick: rail collapsed", railW.collapsed && railW.w <= 60, railW);
  const lv0 = await t.eval(`${H}.getStage().units[0].level`);
  check("quick: click Lv + (first row)", (await t.eval(click("#tabbody table.quick tbody tr:first-child button[title='레벨 +1']"))) === "ok");
  check("quick: units[0].level +1, dirty", await t.eval(`${H}.getStage().units[0].level === ${lv0 + 1} && ${H}.history.isDirty()`));
  await undoAll(t);
  check("quick: undo → level restored, clean", await t.eval(`${H}.getStage().units[0].level === ${lv0} && !${H}.history.isDirty()`));
  await t.eval(`${H}.setRailCollapsed(false); 0`);   // don't leave the collapsed flag in the profile

  // ── ⑦ game PauseMenu ✏ 이 스테이지 편집 ─────────────────────────────────
  // runs BEFORE publish: publish/rollback rewrite packages/data/json → next dev recompiles, which can wedge on Windows (.next errno -4094)
  let http = 0;
  for (let i = 0; i < 30 && http !== 200; i++) { http = await fetch(`${GAME}/battle`).then((r) => r.status).catch(() => 0); if (http !== 200) await sleep(2000); }
  check("game: /battle answers 200", http === 200, http);
  const before7 = (await pages()).map((p) => p.id);
  await t.eval(`window.open(${JSON.stringify(`${GAME}/stages`)}); 'w'`);
  let gamePage = null;
  for (let i = 0; i < 40 && !gamePage; i++) { await sleep(500); gamePage = (await pages()).find((p) => !before7.includes(p.id) && p.url.startsWith(GAME)); }
  check("game: /stages tab opened", !!gamePage, gamePage?.url);
  if (!gamePage) throw new Error("no game tab");
  g = await Tab.open(gamePage);
  await g.waitFor("document.readyState === 'complete' && !!document.querySelector('h1')");
  await g.eval("localStorage.clear(); sessionStorage.clear(); location.href = '/battle'; 'ok'");   // fresh save → default 05-sishuiguan
  check("game: battle store handle", await g.waitFor("!!window.__tkBattle && !!document.querySelector('#hudRight')", 120, 500));
  // DialogueOverlay root (zIndex 8 + pointer, see battle-ux.mjs) — click through the opening dialogue until the menu button responds
  const DLG = "Array.from(document.querySelectorAll('div')).find(d => d.style.zIndex === '8' && d.style.cursor === 'pointer')";
  let editBtn = false;
  for (let i = 0; i < 120 && !editBtn; i++) {
    await g.eval(`(${DLG})?.click(); document.querySelector('#hudRight button[aria-label="메뉴 열기"]')?.click(); 0`);
    await sleep(250);
    editBtn = await g.eval("!!document.querySelector('[data-testid=pause-edit-stage]')");
  }
  check("game: pause menu has ✏ 이 스테이지 편집 (dev)", editBtn);
  const opened = await g.eval(`(() => { window.__e2eOpen = []; window.open = (u) => { window.__e2eOpen.push(String(u)); return null; }; document.querySelector('[data-testid=pause-edit-stage]')?.click(); return window.__e2eOpen; })()`);
  check("game: ✏ opens stage-editor.html?stage=05-sishuiguan&quick=1", opened.length === 1 && opened[0].includes("stage-editor.html?stage=05-sishuiguan&quick=1"), opened);
  // ── ⑥ Publish: no-change → git delta 0; turnLimit → file → rollback ───────
  const gitBefore = gitStatus();
  const fileBefore = readFileSync(STAGE_FILE, "utf8");
  if (await t.eval(`${H}.history.isDirty()`)) { await t.eval("window.onbeforeunload = null; location.reload(); 'r'"); await sleep(1000); await t.waitFor(EDITOR_READY); }
  check("publish: editor clean before publish", await t.eval(`!${H}.history.isDirty()`));
  const runPublish = async (label) => {
    await t.eval(click("#publishOpen"));
    check(`${label}: modal open, run enabled`, await t.waitFor("(() => { const m = document.getElementById('publishModal'); const b = document.querySelector('[data-testid=publish-run]'); return !!m && m.classList.contains('on') && !!b && !b.disabled; })()", 40, 250),
      await t.eval("Array.from(document.querySelectorAll('#publishModal .prow')).map(r => r.textContent)"));
    const diff = await t.eval(text("[data-testid=publish-diff]"));
    await t.eval(click("[data-testid=publish-run]"));
    const done = await t.waitFor(`${text("[data-testid=publish-result]")}.includes('Publish 완료')`, 120, 500);
    check(`${label}: Publish 완료`, done, await t.eval(text("[data-testid=publish-result]")));
    return diff;
  };
  const diff1 = await runPublish("publish#1 (no change)");
  check("publish#1: diff = 변경 없음", diff1.includes("변경 없음"), diff1);
  check("publish#1: git status packages/data/json unchanged", gitStatus() === gitBefore, { before: gitBefore, after: gitStatus() });
  check("publish#1: file identical to before", readFileSync(STAGE_FILE, "utf8") === fileBefore);
  await t.eval(closeModal);

  const tl0 = await t.eval(`${H}.getStage().turnLimit`);
  await t.eval(`${H}.switchTab('battle:meta'); 0`);
  await t.eval(`(() => { const i = ${TL_INPUT}; i.focus(); i.value = String(${tl0 + 1}); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); })()`);
  check("publish#2: turnLimit +1 in draft", (await t.eval(`${H}.getStage().turnLimit`)) === tl0 + 1);
  const diff2 = await runPublish("publish#2 (turnLimit)");
  check("publish#2: diff mentions turnLimit", diff2.includes("turnLimit"), diff2);
  check("publish#2: file has new turnLimit", readFileSync(STAGE_FILE, "utf8").includes(`"turnLimit": ${tl0 + 1}`));
  check("publish#2: editor clean after publish", await t.eval(`!${H}.history.isDirty()`));
  await t.eval(click("[data-testid=publish-rollback]"));
  const rolled = await t.waitFor(`${text("[data-testid=publish-result]")}.includes('롤백 완료')`, 120, 500);
  check("rollback: 롤백 완료", rolled, await t.eval(text("[data-testid=publish-result]")));
  check("rollback: file has original turnLimit", readFileSync(STAGE_FILE, "utf8").includes(`"turnLimit": ${tl0}`));
  check("rollback: file identical to before", readFileSync(STAGE_FILE, "utf8") === fileBefore);
  check("rollback: git status packages/data/json unchanged", gitStatus() === gitBefore, { before: gitBefore, after: gitStatus() });
  await t.eval(closeModal);
  await t.eval(`${H}.doUndo(); window.onbeforeunload = null; 0`);   // draft back to repo value

} catch (e) {
  check("script error", false, String(e?.stack || e));
} finally {
  rmSync(BACKUP_DIR, { recursive: true, force: true });
  try { g?.close(); } catch {}
  try { t?.close(); } catch {}
  finish({ script: "creator", ms: Date.now() - t0 });
}
