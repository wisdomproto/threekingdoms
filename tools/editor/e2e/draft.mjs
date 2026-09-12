// tools/editor/e2e/draft.mjs — Draft autosave (spec 2026-09-12-project-store-draft §2/§5): edit → 1.5 s → `Draft 저장됨` chip + _draft file,
// draft-first reload, undo-to-repo deletes the draft, ⚙ Draft 버리기, offline (fetch monkeypatch) → retry, 409 conflict stop, Ctrl+S immediate.
// Real Chrome via CDP (see cdp.mjs). Run: node tools/editor/e2e/draft.mjs  (from repo root; needs python for serve.py)
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { openEditor, check, finish, sleep, EDITOR_READY, REPO } from "./cdp.mjs";

const H = "window.__stageEditor";
const ID = "05-sishuiguan";
const DRAFT_URL = `/apps/web/public/_draft/stages/${ID}.json`;
const TL_INPUT = `Array.from(document.querySelectorAll('input[type=number]')).find(i => Number(i.value) === ${H}.getStage().turnLimit)`;
const CHIP = "document.getElementById('saveState').textContent";
const BADGE = "document.querySelector('[data-testid=draft-badge]').textContent";
const POST = (ep, body) => `fetch(${JSON.stringify(ep)}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(${body}) }).then(r => r.status)`;
const DEL = POST("/draft-delete", `{ stageId: ${JSON.stringify(ID)} }`);
const FILE_STATUS = `fetch(${JSON.stringify(DRAFT_URL)}, { cache: 'no-store' }).then(r => r.status)`;
const FILE_TL = `fetch(${JSON.stringify(DRAFT_URL)}, { cache: 'no-store' }).then(r => r.ok ? r.json().then(j => j.turnLimit) : 'http ' + r.status)`;
const tl0 = JSON.parse(readFileSync(path.join(REPO, `packages/data/json/stages/${ID}.json`), "utf8")).turnLimit;
const gitJson = () => spawnSync("git", ["status", "--porcelain", "packages/data/json"], { cwd: REPO, encoding: "utf8" }).stdout;
const git0 = gitJson();

let t;
const setTL = (v, blur = true) => t.eval(`(() => { const inp = ${TL_INPUT}; inp.focus(); inp.value = '${v}'; inp.dispatchEvent(new Event('input', { bubbles: true })); ${blur ? "inp.blur();" : ""} return inp.value; })()`);
const reload = async () => { await t.eval("window.onbeforeunload = null; location.reload(); 'r'"); await sleep(1500); return t.waitFor(EDITOR_READY); };
const chipHas = (s, tries = 8) => t.waitFor(`${CHIP}.includes(${JSON.stringify(s)})`, tries, 500);   // 8×500 = 4 s ≥ 1.5 s debounce + post
const badgeIs = (s, tries = 8) => t.waitFor(`${BADGE} === ${JSON.stringify(s)}`, tries, 500);
const fileIs = (code, tries = 8) => t.waitFor(`${FILE_STATUS}.then(s => s === ${code})`, tries, 500);

try {
  t = await openEditor();
  // (1) clean slate: no localStorage, no server draft → Published
  await t.eval(`localStorage.clear(); ${DEL}`);
  check("reload with no draft", await reload());
  check("badge Published on clean load", await badgeIs("Published"), await t.eval(BADGE));
  check("draft file absent", await fileIs(404));

  // (2) edit → 수정됨 → autosave 1.5 s → Draft 저장됨 + file + badge + rail dot
  await setTL(tl0 + 7);
  check("chip 수정됨 right after edit", (await t.eval(CHIP)).includes("수정됨"), await t.eval(CHIP));
  check("chip Draft 저장됨 within ~3 s", await chipHas("Draft 저장됨"), await t.eval(CHIP));
  check("draft file 200 with edited turnLimit", (await t.eval(FILE_TL)) === tl0 + 7);
  check("badge Draft", await badgeIs("Draft"), await t.eval(BADGE));
  check("rail item 05 has .draft-dot", await t.waitFor(`!!document.querySelector('.rail-item[data-stage-id=${JSON.stringify(ID)}] .draft-dot')`, 8, 250));
  check("clean after save (markSaved)", await t.eval(`!${H}.history.isDirty()`));

  // (3) draft-first load
  check("reload", await reload());
  check("after reload: badge Draft", await badgeIs("Draft"), await t.eval(BADGE));
  check("after reload: turnLimit input shows draft value", await t.eval(`${H}.getStage().turnLimit === ${tl0 + 7} && Number((${TL_INPUT}).value) === ${tl0 + 7}`));
  check("after reload: not dirty (draft is baseline)", await t.eval(`!${H}.history.isDirty()`));

  // (4) revert to repo value → same as Published → draft deleted without debounce
  await setTL(tl0);
  check("undo-to-repo: badge Published within ~3 s", await badgeIs("Published"), await t.eval(BADGE));
  check("undo-to-repo: draft file 404", await fileIs(404));
  check("undo-to-repo: rail dot gone", await t.waitFor(`!document.querySelector('.rail-item[data-stage-id=${JSON.stringify(ID)}] .draft-dot')`, 8, 250));

  // (5) edit → draft; ⚙ Draft 버리기 → Published, file gone, value back to repo
  await setTL(tl0 + 9);
  check("edit again: draft saved", await chipHas("Draft 저장됨") && (await t.eval(FILE_STATUS)) === 200);
  await t.eval("window.confirm = () => true; document.querySelector('[data-testid=discard-draft]').click(); 'd'");
  check("discard: badge Published", await badgeIs("Published"), await t.eval(BADGE));
  check("discard: draft file 404", await fileIs(404));
  // badge flips before the async repo reload finishes — wait for the model + input to land
  check("discard: turnLimit back to repo, clean", await t.waitFor(`${H}.getStage().turnLimit === ${tl0} && !${H}.history.isDirty() && Number((${TL_INPUT}).value) === ${tl0}`, 8, 250), await t.eval(`${H}.getStage().turnLimit`));

  // (6) offline: /draft-save rejects → 오프라인 chip (recovery kept) → restore → flush → Draft 저장됨
  await t.eval("window.__realFetch = window.fetch; window.fetch = (u, o) => String(u).includes('/draft-save') ? Promise.reject(new Error('net down')) : window.__realFetch(u, o); 'p'");
  await setTL(tl0 + 11);
  check("offline: chip 오프라인 within ~3 s", await chipHas("오프라인"), await t.eval(CHIP));
  check("offline: draft file still 404", (await t.eval(FILE_STATUS)) === 404);
  check("offline: recovery kept in localStorage", await t.waitFor(`!!localStorage.getItem('tk.editor.recovery.stage:${ID}')`, 8, 250));
  await t.eval("window.fetch = window.__realFetch; 'u'");
  await t.eval(`${H}.saver.flush(); 'f'`);   // 30 s retry would also do it — flush forces the retry now
  check("back online: chip Draft 저장됨", await chipHas("Draft 저장됨"), await t.eval(CHIP));
  check("back online: draft file has the offline edit", (await t.eval(FILE_TL)) === tl0 + 11);
  check("back online: recovery cleared", await t.waitFor(`localStorage.getItem('tk.editor.recovery.stage:${ID}') === null`, 8, 250));
  await t.eval(`localStorage.clear(); ${DEL}`);
  check("reload after offline cleanup", await reload());
  check("cleanup: badge Published", await badgeIs("Published"), await t.eval(BADGE));

  // (7) conflict: another "tab" creates rev 1 while this saver expects null → 409 → stop
  const st = await t.eval(POST("/draft-save", `{ stageId: ${JSON.stringify(ID)}, stage: ${H}.serializeStage(), baseRevision: null }`));
  check("other tab: draft-save 200 (rev 1)", st === 200, st);
  await setTL(tl0 + 13);
  check("conflict: chip 다른 탭에서 수정됨", await chipHas("다른 탭에서 수정됨"), await t.eval(CHIP));
  check("conflict: server file untouched (repo turnLimit)", (await t.eval(FILE_TL)) === tl0);
  await setTL(tl0 + 14);   // stopped — further edits must not save
  await sleep(2500);
  check("conflict: still stopped after more edits", (await t.eval(CHIP)).includes("다른 탭에서 수정됨") && (await t.eval(FILE_TL)) === tl0);
  await t.eval(`localStorage.clear(); ${DEL}`);
  check("reload after conflict cleanup", await reload());
  check("cleanup: badge Published, repo value", await badgeIs("Published") && (await t.eval(`${H}.getStage().turnLimit`)) === tl0);

  // (8) Ctrl+S inside a focused text input saves before the 1.5 s debounce
  await setTL(tl0 + 17, false);
  const t0 = Date.now();
  await t.eval(`(${TL_INPUT}).dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); 'k'`);
  const fast = await t.waitFor(`/^(저장 중…|Draft 저장됨)/.test(${CHIP})`, 10, 100);
  const dt = Date.now() - t0;
  check("Ctrl+S: saving/saved before debounce (< 1.5 s)", fast && dt < 1500, { chip: await t.eval(CHIP), ms: dt });
  check("Ctrl+S: Draft 저장됨", await chipHas("Draft 저장됨"), await t.eval(CHIP));
  check("Ctrl+S: file has the edit", (await t.eval(FILE_TL)) === tl0 + 17);

  // final cleanup: no draft for 05, repo JSON untouched
  await t.eval(`localStorage.clear(); ${DEL}`);
  check("end: draft file 404", await fileIs(404));
  check("end: /draft-list has no 05", await t.eval(`fetch('/draft-list', { cache: 'no-store' }).then(r => r.json()).then(j => !(j.drafts || {})[${JSON.stringify(ID)}])`));
  check("end: git status packages/data/json unchanged", gitJson() === git0, gitJson());
} catch (e) {
  check("script error", false, String(e?.stack || e));
} finally {
  try { t?.close(); } catch {}
  finish({ script: "draft" });
}
