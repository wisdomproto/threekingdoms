// tools/editor/e2e/history.mjs — Undo/Redo, typing coalesce, localStorage recovery, save-state chip, keyboard focus rules.
// Real Chrome via CDP (see cdp.mjs). Run: node tools/editor/e2e/history.mjs  (from repo root; needs python for serve.py)
import { readFileSync } from "node:fs";
import path from "node:path";
import { openEditor, check, finish, sleep, EDITOR_READY, REPO } from "./cdp.mjs";

const H = "window.__stageEditor";
const KEY = JSON.stringify("tk.editor.recovery.stage:05-sishuiguan");
const TL_INPUT = `Array.from(document.querySelectorAll('input[type=number]')).find(i => Number(i.value) === ${H}.getStage().turnLimit)`;
const disk = JSON.parse(readFileSync(path.join(REPO, "packages/data/json/stages/05-sishuiguan.json"), "utf8"));
const canon = (o) => JSON.stringify(o); // key order: serializer preserves disk order (Task 1 round-trip test)

let t;
try {
  t = await openEditor();
  await t.eval("localStorage.clear(); location.reload(); 'r'"); await sleep(1500);
  check("reload after localStorage.clear", await t.waitFor(EDITOR_READY));
  check("initial: not dirty, cannot undo", await t.eval(`!${H}.history.isDirty() && !${H}.history.canUndo()`));
  const tl0 = await t.eval(`${H}.getStage().turnLimit`);
  const x0 = await t.eval(`${H}.getStage().units[0].x`);
  const opt0 = await t.eval(`!!${H}.getStage().objectives[0].optional`);

  // 1) typing burst (2 keys -> 1 entry) -> unit move -> objective toggle => 3 entries
  await t.eval(`(() => { const inp = ${TL_INPUT}; inp.focus(); inp.value = '2'; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.value = '21'; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.blur(); })()`);
  await t.eval(`(() => { const s = ${H}.getStage(); s.units[0].x += 1; ${H}.refreshValidation(); })()`);
  await t.eval(`(() => { const s = ${H}.getStage(); s.objectives[0].optional = !s.objectives[0].optional; ${H}.refreshValidation(); })()`);
  check("3 edits applied (turnLimit=21, x+1, optional toggled)", await t.eval(`${H}.getStage().turnLimit === 21 && ${H}.getStage().units[0].x === ${x0 + 1} && !!${H}.getStage().objectives[0].optional === ${!opt0}`));
  check("dirty after edits", await t.eval(`${H}.history.isDirty()`));
  check("recovery written to localStorage (1s debounce)", await t.waitFor(`!!localStorage.getItem(${KEY})`, 12, 250));

  await t.eval(`${H}.doUndo()`);
  check("undo 1: objective toggle reverted, turnLimit still 21", await t.eval(`!!${H}.getStage().objectives[0].optional === ${opt0} && ${H}.getStage().turnLimit === 21`));
  await t.eval(`${H}.doUndo()`);
  check("undo 2: unit x reverted", (await t.eval(`${H}.getStage().units[0].x`)) === x0);
  await t.eval(`${H}.doUndo()`);
  check("undo 3: typing burst reverted as one entry", (await t.eval(`${H}.getStage().turnLimit`)) === tl0);
  check("after undo to baseline: clean, cannot undo, can redo", await t.eval(`!${H}.history.isDirty() && !${H}.history.canUndo() && ${H}.history.canRedo()`));
  const chip1 = await t.eval("document.getElementById('saveState').textContent");
  check("chip shows saved", chip1.startsWith("저장됨"), chip1);
  check("recovery removed once clean (undo schedules recovery)", await t.waitFor(`localStorage.getItem(${KEY}) === null`, 12, 250));

  // 2) redo cycles + lossless round-trip: end at disk + turnLimit only
  await t.eval(`${H}.doRedo()`); await t.eval(`${H}.doRedo()`); await t.eval(`${H}.doRedo()`);
  check("redo 3: all edits back", await t.eval(`${H}.getStage().turnLimit === 21 && ${H}.getStage().units[0].x === ${x0 + 1}`));
  await t.eval(`${H}.doUndo()`); await t.eval(`${H}.doUndo()`);
  check("undo 2: only turnLimit differs", await t.eval(`${H}.getStage().turnLimit === 21 && ${H}.getStage().units[0].x === ${x0}`), await t.eval(`[${H}.getStage().turnLimit, ${H}.getStage().units[0].x]`));
  const ser = JSON.parse(await t.eval(`${H}.serializeStage()`));
  check("serializeStage() == disk + turnLimit (lossless)", canon(ser) === canon({ ...disk, turnLimit: 21 }));

  // 3) recovery: reload while dirty -> bar -> restore
  check("recovery present before reload", await t.waitFor(`!!localStorage.getItem(${KEY})`, 12, 250));
  await t.eval("window.onbeforeunload = null; location.reload(); 'r'"); await sleep(1500);
  check("reload (dirty, beforeunload disabled)", await t.waitFor(EDITOR_READY));
  check("loaded from disk: turnLimit original", (await t.eval(`${H}.getStage().turnLimit`)) === tl0);
  check("recovery bar visible", await t.eval("getComputedStyle(document.getElementById('recoveryBar')).display !== 'none'"), await t.eval(`[document.getElementById('recoveryBar').style.display, !!localStorage.getItem(${KEY})]`));
  await t.eval("document.getElementById('recoveryRestore').click(); 'c'"); await sleep(300);
  const tlR = await t.eval(`${H}.getStage().turnLimit`);
  check("restored: turnLimit=21", tlR === 21, tlR);
  check("restored: dirty, can undo", await t.eval(`${H}.history.isDirty() && ${H}.history.canUndo()`));
  check("recovery bar hidden after restore", await t.eval("getComputedStyle(document.getElementById('recoveryBar')).display === 'none'"));
  const chip2 = await t.eval("document.getElementById('saveState').textContent");
  check("chip shows modified", chip2.startsWith("수정됨"), chip2);
  const ser2 = JSON.parse(await t.eval(`${H}.serializeStage()`));
  check("after restore serializeStage() == disk + turnLimit", canon(ser2) === canon({ ...disk, turnLimit: 21 }));

  // 4) keyboard: Ctrl+Z inside a text input must not undo; on body it must
  const kz = "new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })";
  await t.eval(`(() => { const inp = ${TL_INPUT}; inp.focus(); inp.dispatchEvent(${kz}); })()`);
  check("Ctrl+Z in focused input: no undo", (await t.eval(`${H}.getStage().turnLimit`)) === 21);
  await t.eval(`document.activeElement.blur(); document.body.dispatchEvent(${kz}); 'k'`);
  check("Ctrl+Z on body: undone -> clean", await t.eval(`${H}.getStage().turnLimit === ${tl0} && !${H}.history.isDirty()`));
  await t.eval(`${H}.doRedo()`);
  check("doRedo after keyboard undo: turnLimit=21, dirty", await t.eval(`${H}.getStage().turnLimit === 21 && ${H}.history.isDirty()`));
  await t.eval(`${H}.doUndo()`);
  check("one doUndo -> clean", await t.eval(`!${H}.history.isDirty() && !${H}.history.canUndo()`));
  check("recovery removed after final undo", await t.waitFor(`localStorage.getItem(${KEY}) === null`, 12, 250));
} catch (e) {
  check("script error", false, String(e?.stack || e));
} finally {
  try { t?.close(); } catch {}
  finish({ script: "history" });
}
