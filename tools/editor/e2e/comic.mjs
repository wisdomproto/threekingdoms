// tools/editor/e2e/comic.mjs — story editor v2 comic part e2e (spec 2026-09-12-story-editor-v2-comic-design §6):
// editor 05 → 전투 전 이야기 → + 만화 장면 추가 → page image → delete default panel → 2 panels by synthetic-PointerEvent drag
// on the thumbnail → line "[COMIC]" on panel 1 → ▶ 전투 전 이야기 → game tab ComicScenePlayer: text, tap → camera transform
// changes, silent panel auto-advances → leaveSandbox closes the tab. Desktop pass, then the same scene under mobile metrics.
// Real Chrome via CDP + own serve.py :8095 (cdp.mjs). Needs next dev on GAME (http://localhost:3000). Preview writes only _draft/.
// Run: node tools/editor/e2e/comic.mjs   (from repo root)
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { openEditor, Tab, pages, check, finish, sleep, EDITOR_READY, REPO } from "./cdp.mjs";

const H = "window.__stageEditor";
const DRAFT_DIR = path.join(REPO, "apps/web/public/_draft");
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const click = (sel) => `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return 'no:' + ${JSON.stringify(sel)}; b.click(); return 'ok'; })()`;
const THUMB = "document.querySelector('#tabbody .comic .cthumb')";
const PARTS = `((i) => Array.isArray(i) ? i : [i])(${H}.getStage().scenario.intro)`;   // 05 intro = single VN object until a part is appended
const COMIC = `${PARTS}.at(-1)`;   // the part we append
const PANELS = `${COMIC}.pages[0].panels`;
/** Drag on the thumbnail from fraction (x0,y0) to (x1,y1) — box re-measured now, synthetic PointerEvents, commit on pointerup. */
const drag = (x0, y0, x1, y1) => `(() => { const t = ${THUMB}; const b = t.getBoundingClientRect();
  const ev = (type, fx, fy) => t.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: b.left + b.width * fx, clientY: b.top + b.height * fy }));
  ev('pointerdown', ${x0}, ${y0}); ev('pointermove', ${(x0 + x1) / 2}, ${(y0 + y1) / 2}); ev('pointermove', ${x1}, ${y1}); ev('pointerup', ${x1}, ${y1});
  return { box: { w: Math.round(b.width), h: Math.round(b.height) }, n: ${PANELS}.length, rects: ${PANELS}.map(p => p.rect) }; })()`;
const CAM = "getComputedStyle(document.querySelector('[data-testid=comic-camera]')).transform";
const draftFiles = () => new Set(readdirSync(DRAFT_DIR).filter((f) => /^05-sishuiguan-\d+\.json$/.test(f)));
async function waitPage(re, tries = 60) { for (let i = 0; i < tries; i++) { const p = (await pages()).find((p) => re.test(p.url)); if (p) return p; await sleep(500); } return null; }
async function gone(id, tries = 30) { for (let i = 0; i < tries; i++) { if (!(await pages()).some((p) => p.id === id)) return true; await sleep(500); } return false; }
const rectOk = (r) => Array.isArray(r) && r.length === 4 && r.every((v) => v >= 0 && v <= 1) && r[2] > 0 && r[3] > 0 && r[0] + r[2] <= 1 + 1e-6 && r[1] + r[3] <= 1 + 1e-6;

/** Open ▶ 전투 전 이야기 preview, play the VN parts through, then drive the comic scene until the tab closes. */
async function previewScene(t, label, metrics) {
  let g = null;
  try {
    const before = (await pages()).map((p) => p.id);
    await t.eval(click("#playtestMenuBtn"));
    check(`${label}: playtest menu intro enabled (story valid)`, await t.waitFor("(() => { const b = document.querySelector('#playtestMenu [data-scene=intro]'); return !!b && !b.disabled && document.getElementById('playtestMenu').classList.contains('on'); })()", 10, 200));
    await t.eval(click("#playtestMenu [data-scene=intro]"));
    const scenePage = await waitPage(/\/scene\?stage=__lab&type=intro/);
    check(`${label}: new tab at /scene?stage=__lab&type=intro`, !!scenePage && !before.includes(scenePage.id), scenePage?.url ?? (await pages()).map((p) => p.url));
    if (!scenePage) return;
    g = await Tab.open(scenePage);
    if (metrics) await g.send("Emulation.setDeviceMetricsOverride", metrics);
    // VN parts first (05 intro) — tap through until the comic player mounts
    for (let i = 0; i < 80 && !(await g.eval("!!document.querySelector('[data-testid=comic-scene]')").catch(() => false)); i++) {
      await g.eval(`document.querySelector('[aria-label="대사 진행 (탭)"]')?.click(); 0`).catch(() => {});
      await sleep(250);
    }
    check(`${label}: [data-testid=comic-scene] mounted`, await g.eval("!!document.querySelector('[data-testid=comic-scene]')"));
    if (metrics) {
      const m = await g.eval("(() => { const r = document.querySelector('[data-testid=comic-scene]').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), dpr: devicePixelRatio }; })()");
      check(`${label}: viewport ${metrics.width}×${metrics.height}`, m.w === metrics.width && m.h === metrics.height, m);
    }
    check(`${label}: page text shows [COMIC] (draft line)`, await g.waitFor("document.body.innerText.includes('[COMIC]')", 40, 250), await g.eval("document.body.innerText.slice(0, 200)"));
    const cam0 = await g.eval(CAM);
    check(`${label}: camera has a transform`, typeof cam0 === "string" && cam0.startsWith("matrix"), cam0);
    // tap: reveal (if typing) then next panel → camera eases to panel 2 within ~600 ms
    let changed = false;
    for (let i = 0; i < 3 && !changed; i++) {
      await g.eval("document.querySelector('[data-testid=comic-scene]').click(); 0");
      changed = await g.waitFor(`${CAM} !== ${JSON.stringify(cam0)}`, 10, 100);
    }
    check(`${label}: tap → comic-camera transform changes`, changed, { before: cam0, after: await g.eval(CAM) });
    await sleep(700);
    const cam1 = await g.eval(CAM);
    check(`${label}: camera settled on a different transform after 600 ms`, cam1 !== cam0, cam1);
    // panel 2 is silent → auto hold 1200 ms → complete → leaveSandbox → window.close (opener = editor)
    g.close(); g = null;
    check(`${label}: tab closed after last panel`, await gone(scenePage.id, 40));
  } finally {
    try { g?.close(); } catch {}
  }
}

const t0 = Date.now();
const draftsBefore = draftFiles();
let t;
try {
  t = await openEditor();
  await t.eval("localStorage.clear(); location.search = '?stage=05-sishuiguan&nodraft=1'; 'r'"); await sleep(1000);   // no autosave — this script owns undo cleanup
  if (!(await t.waitFor(EDITOR_READY))) throw new Error("editor did not reload");

  // ── ① comic part ───────────────────────────────────────────────────────────
  await t.eval(click(".tabs .tab[data-tab='story-intro']"));
  const nParts = await t.eval(`${PARTS}.length`);
  check("story-intro: + 만화 장면 추가", (await t.clickText("+ 만화 장면 추가")) === "ok");
  const part = await t.eval(`(() => { const p = ${COMIC}; return { kind: p.kind, pages: p.pages?.length, panels: p.pages?.[0]?.panels?.length, image: p.pages?.[0]?.image, n: ${PARTS}.length }; })()`);
  check("comic part appended: kind=comic, 1 page, 1 default panel, image ''", part.kind === "comic" && part.pages === 1 && part.panels === 1 && part.image === "" && part.n === nParts + 1, part);
  check("comic card: gray 3:4 thumbnail rendered", await t.waitFor(`(() => { const r = ${THUMB}?.getBoundingClientRect(); return !!r && r.width > 100 && Math.abs(r.height / r.width - 4 / 3) < 0.05; })()`, 10, 200),
    await t.eval(`(() => { const r = ${THUMB}?.getBoundingClientRect(); return r && { w: r.width, h: r.height }; })()`));

  // page image → thumbnail img 404s → onerror → gray box again (wait for the box to come back before dragging)
  await t.eval(`(() => { const i = document.querySelector('#tabbody .comic .cpage input[list=tk-comics]'); i.focus(); i.value = 'e2e-page'; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); })()`);
  check("page image = e2e-page in model", (await t.eval(`${COMIC}.pages[0].image`)) === "e2e-page");
  check("thumbnail back to gray box after 404", await t.waitFor(`(() => { const r = ${THUMB}?.getBoundingClientRect(); return !!r && r.height > 100; })()`, 20, 250));

  // delete the default full-page panel: select via list row, Delete on the (focused) thumbnail scope
  await t.eval("(() => { const r = document.querySelector('#tabbody .comic .cplist .pn'); r.click(); })()");
  await t.eval(`(() => { const t = ${THUMB}; t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); })()`);
  check("default panel deleted (0 panels)", (await t.eval(`${PANELS}.length`)) === 0);

  // two drags → two panels (box re-measured inside each drag)
  const d1 = await t.eval(drag(0.05, 0.05, 0.95, 0.45));
  check("drag 1 → panel 1 (top half)", d1.n === 1 && rectOk(d1.rects[0]) && d1.rects[0][1] < 0.1 && d1.rects[0][3] > 0.3, d1);
  check("panel inspector visible for panel 1", await t.eval("(() => { const i = document.querySelector('#tabbody .comic .cinsp'); return !!i && i.style.display !== 'none' && i.textContent.includes('칸 1'); })()"));
  check("inspector: + 줄 추가", (await t.eval("(() => { const b = Array.from(document.querySelectorAll('#tabbody .comic .cinsp button')).find(b => b.textContent.trim() === '+ 줄 추가'); if (!b) return 'no'; b.click(); return 'ok'; })()")) === "ok");
  await t.eval(`(() => { const ta = document.querySelector('#tabbody .comic .cinsp textarea'); ta.focus(); ta.value = '[COMIC]'; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.blur(); })()`);
  check("panel 1 line text = [COMIC] (narration: no speaker)", await t.eval(`(() => { const l = ${PANELS}[0].lines; return l?.length === 1 && l[0].text === '[COMIC]' && !('speaker' in l[0]); })()`), await t.eval(`${PANELS}[0].lines`));
  const d2 = await t.eval(drag(0.05, 0.55, 0.95, 0.95));
  check("drag 2 → panel 2 (bottom half)", d2.n === 2 && rectOk(d2.rects[1]) && d2.rects[1][1] > 0.4, d2);
  check("panel list shows 2 rows, panel 1 has 1줄", await t.eval("(() => { const rows = Array.from(document.querySelectorAll('#tabbody .comic .cplist .pn')).map(r => r.textContent); return rows.length === 2 && rows[0].includes('1줄'); })()"),
    await t.eval("Array.from(document.querySelectorAll('#tabbody .comic .cplist .pn')).map(r => r.textContent)"));
  const ser = await t.eval(`(() => { const s = JSON.parse(${H}.serializeStage()); const p = s.scenario.intro.at(-1); return { kind: p.kind, image: p.pages[0].image, panels: p.pages[0].panels.length, keys: Object.keys(p.pages[0].panels[0]).sort(), text: p.pages[0].panels[0].lines[0].text, dirty: ${H}.history.isDirty() }; })()`);
  check("serializeStage: comic part round-trips (kind/image/2 panels/[COMIC], strict keys), dirty", ser.kind === "comic" && ser.image === "e2e-page" && ser.panels === 2 && ser.keys.join() === "lines,rect" && ser.text === "[COMIC]" && ser.dirty, ser);

  // ── ② scene preview: desktop, then mobile metrics ───────────────────────────
  await previewScene(t, "desktop", null);
  await previewScene(t, "mobile", MOBILE);

  // ── ③ cleanup: undo to clean ────────────────────────────────────────────────
  check("editor: comic part still in draft after preview", await t.eval(`${COMIC}.kind === 'comic'`));
  for (let i = 0; i < 40 && (await t.eval(`${H}.history.canUndo()`)); i++) await t.eval(`${H}.doUndo()`);
  const after = await t.eval(`({ dirty: ${H}.history.isDirty(), n: ${PARTS}.length, last: ${COMIC}.kind ?? 'vn' })`);
  check("undo → clean, comic part gone", !after.dirty && after.n === nParts && after.last !== "comic", after);
  await t.eval("window.onbeforeunload = null; 0");
} catch (e) {
  check("script error", false, String(e?.stack || e));
} finally {
  for (const f of draftFiles()) if (!draftsBefore.has(f)) rmSync(path.join(DRAFT_DIR, f), { force: true });   // playtest snapshots this run created
  try { t?.close(); } catch {}
  finish({ script: "comic", ms: Date.now() - t0 });
}
