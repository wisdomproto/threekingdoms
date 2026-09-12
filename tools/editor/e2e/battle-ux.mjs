// tools/editor/e2e/battle-ux.mjs — battle UX P1 e2e (spec §8): HUD non-overlap, defeat-condition chip,
// beginner attack confirm, suspend/resume, classic regression. Drives the dev store handle `window.__tkBattle`.
// Needs `next dev` already serving E2E_GAME_ORIGIN (default http://localhost:3000). No serve.py.
import { launchChrome, Tab, pages, check, finish, sleep } from "./cdp.mjs";

const ORIGIN = process.env.E2E_GAME_ORIGIN || "http://localhost:3000";
const t0 = Date.now();
/** DialogueOverlay root (no test id): zIndex 8 + cursor pointer, see dialogue/DialogueOverlay.tsx OVERLAY_STYLE */
const DLG = `Array.from(document.querySelectorAll('div')).find(d => d.style.zIndex === '8' && d.style.cursor === 'pointer')`;
const HUD_LEFT = `(document.querySelector('#hudLeft')?.textContent ?? '')`;
const click = (sel) => `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return 'no'; b.click(); return 'ok'; })()`;
const tapUnit = (id) => `(() => { const S = window.__tkBattle; const u = S.committedState.units.find(x => x.id === ${JSON.stringify(id)}); S.dispatchUi({ type: 'tapTile', coord: { x: u.x, y: u.y } }); return S.uiState.kind; })()`;

/** Wait for the store handle, then advance the opening dialogue until the objective chip (주의: = fail condition) shows. */
async function waitBattleReady(t, prevHandleExpr = "null") {
  if (!(await t.waitFor(`!!window.__tkBattle && window.__tkBattle !== (${prevHandleExpr}) && !!document.querySelector('#hudLeft')`, 120, 500))) {
    throw new Error("battle store handle did not appear");
  }
  for (let i = 0; i < 160; i++) {
    if (await t.eval(`${HUD_LEFT}.includes('주의:')`)) return true;
    await t.eval(`(${DLG})?.click(); 0`);
    await sleep(250);
  }
  return false;
}

/** Speed ×3 — tween animations, keeps the enemy phase short. */
async function fastForward(t) {
  for (let i = 0; i < 2; i++) await t.eval(`(() => { const b = Array.from(document.querySelectorAll('#hudRight button')).find(b => b.textContent.includes('배속')); b?.click(); return b?.textContent; })()`);
}

/** Pairwise non-intersection of a HUD column's child rects. */
const overlapExpr = (sel) => `(() => {
  const rs = Array.from(document.querySelector(${JSON.stringify(sel)})?.children ?? []).map(c => c.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0).map(r => [r.left, r.top, r.right, r.bottom].map(Math.round));
  const hits = [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) hits.push([a, b]);
  }
  return { n: rs.length, rects: rs, hits };
})()`;

/**
 * Page-side hunt for an attack: for each unacted player unit, tap it; attack from place if in range, else
 * step toward the nearest enemy (postMoveMenu → menuAttack if in range, otherwise menuWait). End the turn
 * when nobody can reach; up to `maxTurns` player turns. Leaves the store right after the target tap.
 */
const huntExpr = (maxTurns) => `(async () => {
  const S = window.__tkBattle;
  const idle = () => S.whenIdle();
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const noWalk = async () => { for (let i = 0; i < 150 && S.previewWalking; i++) await wait(100); };
  const unitAt = (id) => S.committedState.units.find(u => u.id === id);
  const enemies = () => S.committedState.units.filter(u => u.side === 'enemy' && !u.retreated);
  const trace = [];
  for (let turn = 0; turn < ${maxTurns}; turn++) {
    await idle();
    if (S.uiState.kind !== 'idle') return { found: false, reason: 'not idle: ' + S.uiState.kind, trace };
    const ids = S.committedState.units.filter(u => u.side === 'player' && !u.retreated && !u.acted).map(u => u.id);
    for (const id of ids) {
      await idle();
      if (S.uiState.kind !== 'idle') S.dispatchUi({ type: 'cancel' });
      const u = unitAt(id);
      if (!u || u.acted || u.retreated) continue;
      S.dispatchUi({ type: 'tapTile', coord: { x: u.x, y: u.y } });
      let ui = S.uiState;
      if (ui.kind !== 'selected') { S.dispatchUi({ type: 'cancel' }); continue; }
      if (ui.attackable.length) {
        const tg = unitAt(ui.attackable[0]);
        S.dispatchUi({ type: 'tapTile', coord: { x: tg.x, y: tg.y } });
        return { found: true, via: 'selected', unit: id, target: tg.id, kind: S.uiState.kind, turn: S.committedState.turn, trace };
      }
      const es = enemies();
      const dist = (c) => Math.min(...es.map(e => Math.abs(e.x - c.x) + Math.abs(e.y - c.y)));
      const best = ui.movable.slice().sort((a, b) => dist(a) - dist(b))[0];
      if (!best || dist(best) >= dist(u)) { S.dispatchUi({ type: 'cancel' }); continue; }
      S.dispatchUi({ type: 'tapTile', coord: best });
      await noWalk();
      ui = S.uiState;
      if (ui.kind !== 'postMoveMenu') { trace.push([id, 'no postMoveMenu', ui.kind]); S.dispatchUi({ type: 'cancel' }); continue; }
      if (ui.attackable.length) {
        S.dispatchUi({ type: 'menuAttack' });
        const tg = unitAt(ui.attackable[0]);
        S.dispatchUi({ type: 'tapTile', coord: { x: tg.x, y: tg.y } });
        return { found: true, via: 'postMoveMenu', unit: id, target: tg.id, kind: S.uiState.kind, turn: S.committedState.turn, trace };
      }
      S.dispatchUi({ type: 'menuWait' });
      await idle();
    }
    await idle();
    trace.push(['turn', S.committedState.turn, 'ended']);
    if (S.committedState.units.some(u => u.side === 'player' && !u.retreated && !u.acted)) {
      S.dispatchUi({ type: 'endTurnPressed' });
      S.dispatchUi({ type: 'endTurnConfirm' });
    }
    await idle();
  }
  return { found: false, reason: 'no reachable target in ${maxTurns} turns', trace };
})()`;

async function main() {
  await launchChrome(`${ORIGIN}/stages`);
  let target = null;
  for (let i = 0; i < 60 && !target; i++) { target = (await pages()).find((p) => p.url.startsWith(ORIGIN)); if (!target) await sleep(250); }
  if (!target) throw new Error("game tab not found");
  const t = await Tab.open(target);
  if (!(await t.waitFor(`location.origin === ${JSON.stringify(ORIGIN)} && document.readyState === 'complete' && !!document.querySelector('h1')`))) throw new Error("/stages did not load");
  // fresh save: no sortie → default 05-sishuiguan (has failConditions), no suspend
  await t.eval(`localStorage.clear(); sessionStorage.clear(); location.href = '/battle'; 'ok'`);

  // ── 1. entry + objective chip ─────────────────────────────────────────────
  const ready = await waitBattleReady(t);
  check("battle: objective chip shows 주의: (fail condition)", ready, await t.eval(`${HUD_LEFT}.slice(0, 120)`));
  await fastForward(t);

  // ── 2. HUD non-overlap after selecting a unit ────────────────────────────
  const selKind = await t.eval(`(() => { const S = window.__tkBattle; const u = S.committedState.units.find(x => x.side === 'player' && !x.retreated && !x.acted); S.dispatchUi({ type: 'tapTile', coord: { x: u.x, y: u.y } }); return S.uiState.kind; })()`);
  check("select: player unit → selected", selKind === "selected", selKind);
  await sleep(300); // layout settle
  for (const sel of ["#hudLeft", "#hudRight"]) {
    const r = await t.eval(overlapExpr(sel));
    check(`hud: ${sel} children do not overlap`, r.n >= 1 && r.hits.length === 0, r);
  }
  await t.eval(`window.__tkBattle.dispatchUi({ type: 'cancel' }); 0`);

  // ── 3. beginner confirm ───────────────────────────────────────────────────
  await t.eval(`window.__tkBattle.setConfirmAttacks(true); 0`);
  const hunt = await t.eval(huntExpr(8));
  check("beginner: found an attack target within 8 turns", hunt.found, hunt);
  if (hunt.found) {
    check("beginner: target tap → confirmAttack", hunt.kind === "confirmAttack", hunt.kind);
    const priorKind = await t.eval(`window.__tkBattle.uiState.prior?.kind`);
    await t.waitFor(`!!document.querySelector('[data-testid=attack-confirm]')`, 20, 100);
    check("beginner: confirm card rendered", await t.eval(`!!document.querySelector('[data-testid=attack-confirm]')`));
    await t.eval(click("[data-testid=attack-confirm-cancel]"));
    const afterCancel = await t.eval(`window.__tkBattle.uiState.kind`);
    check("beginner: [취소] → prior state", afterCancel === priorKind, { afterCancel, priorKind });
    const reTap = await t.eval(tapUnit(hunt.target));
    check("beginner: re-tap target → confirmAttack", reTap === "confirmAttack", reTap);
    const logBefore = await t.eval(`window.__tkBattle.actionLog.length`);
    await t.waitFor(`!!document.querySelector('[data-testid=attack-confirm-ok]')`, 20, 100);
    await t.eval(click("[data-testid=attack-confirm-ok]"));
    const afterOk = await t.eval(`window.__tkBattle.uiState.kind`);
    check("beginner: [공격] → animating", afterOk === "animating", afterOk);
    await t.eval(`window.__tkBattle.whenIdle()`);
    const logAfter = await t.eval(`window.__tkBattle.actionLog.length`);
    check("beginner: actionLog grew after attack", logAfter > logBefore, { logBefore, logAfter });
  }

  // ── 4. suspend → /stages → resume ─────────────────────────────────────────
  await t.eval(`window.__tkBattle.whenIdle()`);
  const st = await t.eval(`(() => { const S = window.__tkBattle; return { kind: S.uiState.kind, phase: S.committedState.phase, status: S.committedState.status, log: S.actionLog.length, turn: S.committedState.turn }; })()`);
  check("suspend: player idle before saving", st.kind === "idle" && st.phase === "player" && st.status === "ongoing", st);
  await t.eval(`window.__e2ePrev = window.__tkBattle; 0`);
  await t.eval(`(() => { const b = document.querySelector('#hudRight button[aria-label="메뉴 열기"]'); b.click(); return 'ok'; })()`);
  const canSave = await t.waitFor(`(() => { const b = document.querySelector('[data-testid=pause-suspend]'); return !!b && !b.disabled; })()`, 20, 100);
  check("suspend: pause menu → 저장하고 나가기 enabled", canSave);
  await t.eval(click("[data-testid=pause-suspend]"));
  check("suspend: navigated to /stages", await t.waitFor(`location.pathname === '/stages'`, 40, 250));
  const saved = await t.eval(`JSON.parse(localStorage.getItem('tk.battle.suspend.v1') ?? 'null')`);
  check("suspend: tk.battle.suspend.v1 matches live state", !!saved && saved.log.length === st.log && saved.turn === st.turn, saved && { stageId: saved.stageId, turn: saved.turn, log: saved.log.length, live: st });
  const resumeOk = await t.waitFor(`(document.querySelector('[data-testid=resume-battle]')?.textContent ?? '').includes('턴')`, 40, 250);
  check("resume: 이어하기 banner shows turn", resumeOk, await t.eval(`document.querySelector('[data-testid=resume-battle]')?.textContent`));
  await t.eval(click("[data-testid=resume-battle]"));
  check("resume: URL has resume=1", await t.waitFor(`location.pathname === '/battle' && location.search.includes('resume=1')`, 40, 250));
  const resumedReady = await waitBattleReady(t, "window.__e2ePrev");
  check("resume: objective chip visible (intro gate not stuck)", resumedReady, await t.eval(`${HUD_LEFT}.slice(0, 120)`));
  await t.eval(`window.__tkBattle.whenIdle()`);
  const rs = await t.eval(`(() => { const S = window.__tkBattle; return { kind: S.uiState.kind, log: S.actionLog.length, turn: S.committedState.turn }; })()`);
  check("resume: actionLog/turn equal saved", !!saved && rs.log === saved.log.length && rs.turn === saved.turn, { rs, saved: saved && { log: saved.log.length, turn: saved.turn } });
  check("resume: ui idle", rs.kind === "idle", rs.kind);
  await sleep(1500); // director settle — replayed dialogue must not re-fire
  check("resume: no dialogue box", await t.eval(`!(${DLG})`));
  await fastForward(t);

  // ── 5. classic regression ─────────────────────────────────────────────────
  await t.eval(`window.__tkBattle.setConfirmAttacks(false); 0`);
  const classic = await t.eval(huntExpr(3));
  if (classic.found) {
    check("classic: target tap → animating (no confirm)", classic.kind === "animating", classic);
    await t.eval(`window.__tkBattle.whenIdle()`);
  } else {
    check("classic: skipped — no reachable target", true, classic.reason);
  }

  t.close();
  finish({ origin: ORIGIN, ms: Date.now() - t0 });
}

main().catch((e) => { console.error(e); check("script error", false, String(e?.stack ?? e)); finish({ origin: ORIGIN, ms: Date.now() - t0 }); });
