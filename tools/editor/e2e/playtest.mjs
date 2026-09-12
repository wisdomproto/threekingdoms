// tools/editor/e2e/playtest.mjs — editor "test" button -> new tab /playtest?draft= -> /battle?stage=__lab -> quit -> tab closes -> editor intact.
// Needs next dev on the editor's GAME_ORIGIN (http://localhost:3000). Run: node tools/editor/e2e/playtest.mjs
import { openEditor, Tab, pages, check, finish, sleep } from "./cdp.mjs";

const H = "window.__stageEditor";
let t, g;
try {
  t = await openEditor();
  const editorUrl = await t.eval("location.href");
  const x0 = await t.eval(`${H}.getStage().units[0].x`);
  await t.eval(`(() => { const s = ${H}.getStage(); s.units[0].x += 1; ${H}.refreshValidation(); })()`);
  check("unsaved edit: x+1, validation ok", await t.eval(`${H}.getStage().units[0].x === ${x0 + 1} && document.getElementById('valbanner').className.includes('ok')`));

  const before = (await pages()).map((p) => p.id);
  await t.eval("document.getElementById('playtestBtn').click(); 'clicked'");
  let game = null;
  for (let i = 0; i < 40 && !game; i++) { await sleep(500); game = (await pages()).find((p) => !before.includes(p.id)); }
  check("new tab opened at /playtest?draft=", !!game && /\/playtest\?draft=|\/battle\?stage=__lab/.test(game.url), game?.url ?? (await t.eval("document.getElementById('toast').textContent")));
  if (!game) throw new Error("no game tab");

  g = await Tab.open(game);
  check("game tab reached /battle?stage=__lab", await g.waitFor("location.href.includes('/battle?stage=__lab')"), await g.eval("location.href"));
  check("battle canvas mounted", await g.waitFor("!!document.querySelector('canvas')", 120));
  const lab = await g.eval("JSON.parse(sessionStorage.getItem('tk.lab') || 'null')");
  check("tk.lab stage = draft (id, edited x)", lab?.stage?.id === "05-sishuiguan" && lab?.stage?.units?.[0]?.x === x0 + 1, { id: lab?.stage?.id, x: lab?.stage?.units?.[0]?.x });
  check("tk.lab returnUrl = editor url", lab?.returnUrl === editorUrl, lab?.returnUrl);
  check("window.opener is the editor tab", await g.eval("window.opener != null && !window.opener.closed"));

  await sleep(1500);
  check("click menu", (await g.clickText("☰")) === "ok"); await sleep(600);
  check("click quit battle", (await g.clickText("전투 그만두기")) === "ok"); await sleep(600);
  check("click leave", (await g.clickText("나가기")) === "ok");
  let closed = false;
  for (let i = 0; i < 20 && !closed; i++) { await sleep(500); closed = !(await pages()).some((p) => p.id === game.id); }
  check("game tab closed", closed, closed ? undefined : (await pages()).find((p) => p.id === game.id)?.url);
  check("editor edit intact after return", (await t.eval(`${H}.getStage().units[0].x`)) === x0 + 1);
  check("editor still dirty", await t.eval(`${H}.history.isDirty()`));
} catch (e) {
  check("script error", false, String(e?.stack || e));
} finally {
  try { g?.close(); } catch {}
  try { t?.close(); } catch {}
  finish({ script: "playtest" });
}
