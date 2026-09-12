// tools/editor/e2e/battle-mobile.mjs — mobile battle HUD e2e (spec 2026-09-12 §6): CDP device emulation 390×844,
// bottom panel replaces the floating ActionMenu/InspectPopup/turn-end, touch targets ≥52px, ☰-only top-right,
// detail sheet, attack-confirm card inside the panel, then a desktop reload regression (no panel, old layout).
// Drives the dev store handle `window.__tkBattle`. Needs `next dev` on E2E_GAME_ORIGIN (default :3000).
import { launchChrome, Tab, pages, check, finish, sleep } from "./cdp.mjs";

const ORIGIN = process.env.E2E_GAME_ORIGIN || "http://localhost:3000";
const t0 = Date.now();
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const DESKTOP = { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false };
/** DialogueOverlay root (no test id): zIndex 8 + cursor pointer */
const DLG = `Array.from(document.querySelectorAll('div')).find(d => d.style.zIndex === '8' && d.style.cursor === 'pointer')`;
const HUD_LEFT = `(document.querySelector('#hudLeft')?.textContent ?? '')`;
const INSET = `getComputedStyle(document.documentElement).getPropertyValue('--tk-bottom-inset').trim()`;
const click = (sel) => `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return 'no'; b.click(); return 'ok'; })()`;
const clickBtn = (scope, text) => `(() => { const b = Array.from(document.querySelectorAll(${JSON.stringify(scope + " button")})).find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!b) return 'no'; b.click(); return 'ok'; })()`;
const rect = (sel) => `(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; })()`;
const actionBtns = `Array.from(document.querySelectorAll('[data-testid=bottom-action]')).map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height), b.disabled])`;
const KIND = `window.__tkBattle.uiState.kind`;
/** Tap the first unacted player unit; returns its id/name and the resulting ui kind. */
const selectUnit = `(() => { const S = window.__tkBattle; const u = S.committedState.units.find(x => x.side === 'player' && !x.retreated && !x.acted); S.dispatchUi({ type: 'tapTile', coord: { x: u.x, y: u.y } }); return { id: u.id, name: S.getSnapshot().vm.units.find(v => v.id === u.id)?.name, kind: S.uiState.kind }; })()`;
/** From `selected`: step onto the movable tile nearest an enemy, wait out the preview walk. */
const moveToward = `(async () => { const S = window.__tkBattle; const ui = S.uiState; if (ui.kind !== 'selected') return ui.kind;
  const es = S.committedState.units.filter(u => u.side === 'enemy' && !u.retreated);
  const dist = (c) => Math.min(...es.map(e => Math.abs(e.x - c.x) + Math.abs(e.y - c.y)));
  const best = ui.movable.slice().sort((a, b) => dist(a) - dist(b))[0] ?? ui.movable[0];
  S.dispatchUi({ type: 'tapTile', coord: best });
  for (let i = 0; i < 150 && S.previewWalking; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 300));
  return S.uiState.kind; })()`;
const cancelToIdle = `(() => { const S = window.__tkBattle; for (let i = 0; i < 6 && S.uiState.kind !== 'idle'; i++) S.dispatchUi({ type: 'cancel' }); return S.uiState.kind; })()`;

/** Same hunt as battle-ux.mjs: find a player unit that can attack (from place or after a step); leaves store right after the target tap. */
const huntExpr = (maxTurns) => `(async () => {
  const S = window.__tkBattle;
  const idle = () => S.whenIdle();
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const noWalk = async () => { for (let i = 0; i < 150 && S.previewWalking; i++) await wait(100); };
  const unitAt = (id) => S.committedState.units.find(u => u.id === id);
  const enemies = () => S.committedState.units.filter(u => u.side === 'enemy' && !u.retreated);
  for (let turn = 0; turn < ${maxTurns}; turn++) {
    await idle();
    if (S.uiState.kind !== 'idle') return { found: false, reason: 'not idle: ' + S.uiState.kind };
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
        return { found: true, via: 'selected', unit: id, target: tg.id, kind: S.uiState.kind, turn: S.committedState.turn };
      }
      const es = enemies();
      const dist = (c) => Math.min(...es.map(e => Math.abs(e.x - c.x) + Math.abs(e.y - c.y)));
      const best = ui.movable.slice().sort((a, b) => dist(a) - dist(b))[0];
      if (!best || dist(best) >= dist(u)) { S.dispatchUi({ type: 'cancel' }); continue; }
      S.dispatchUi({ type: 'tapTile', coord: best });
      await noWalk();
      ui = S.uiState;
      if (ui.kind !== 'postMoveMenu') { S.dispatchUi({ type: 'cancel' }); continue; }
      if (ui.attackable.length) {
        S.dispatchUi({ type: 'menuAttack' });
        const tg = unitAt(ui.attackable[0]);
        S.dispatchUi({ type: 'tapTile', coord: { x: tg.x, y: tg.y } });
        return { found: true, via: 'postMoveMenu', unit: id, target: tg.id, kind: S.uiState.kind, turn: S.committedState.turn };
      }
      S.dispatchUi({ type: 'menuWait' });
      await idle();
    }
    await idle();
    if (S.committedState.units.some(u => u.side === 'player' && !u.retreated && !u.acted)) {
      S.dispatchUi({ type: 'endTurnPressed' });
      S.dispatchUi({ type: 'endTurnConfirm' });
    }
    await idle();
  }
  return { found: false, reason: 'no reachable target in ${maxTurns} turns' };
})()`;

/** Wait for the store handle, then click through the opening dialogue until the objective chip shows. */
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
/** Click away any dialogue box (turn beats etc.) so DOM taps are not covered. */
async function dismissDialogue(t) {
  for (let i = 0; i < 20 && (await t.eval(`!!(${DLG})`)); i++) { await t.eval(`(${DLG})?.click(); 0`); await sleep(200); }
}

async function main() {
  await launchChrome(`${ORIGIN}/stages`);
  let target = null;
  for (let i = 0; i < 60 && !target; i++) { target = (await pages()).find((p) => p.url.startsWith(ORIGIN)); if (!target) await sleep(250); }
  if (!target) throw new Error("game tab not found");
  const t = await Tab.open(target);
  if (!(await t.waitFor(`location.origin === ${JSON.stringify(ORIGIN)} && document.readyState === 'complete' && !!document.querySelector('h1')`))) throw new Error("/stages did not load");
  // Phone metrics BEFORE navigating to /battle — BattleScreen's ResizeObserver reads the emulated width on mount.
  await t.send("Emulation.setDeviceMetricsOverride", MOBILE);
  await t.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await t.eval(`localStorage.clear(); sessionStorage.clear(); location.href = '/battle'; 'ok'`);

  // ── 1. mobile entry: minimal top bar, collapsed bottom panel ──────────────
  const ready = await waitBattleReady(t);
  check("mobile: objective chip shows 주의:", ready, await t.eval(`${HUD_LEFT}.slice(0, 80)`));
  check("mobile: viewport is 390 wide", (await t.eval(`innerWidth`)) === 390, await t.eval(`innerWidth`));
  await sleep(300);
  const bottom = await t.eval(rect("#hudBottom"));
  check("mobile: #hudBottom present, collapsed ≤ 64px", !!bottom && bottom.h <= 64, bottom);
  const endTurn = await t.eval(rect("[data-testid=bottom-end-turn]"));
  check("mobile: bottom 턴 종료 ≥ 52px tall", !!endTurn && endTurn.h >= 52, endTurn);
  const rightBtns = await t.eval(`Array.from(document.querySelectorAll('#hudRight button')).map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)])`);
  check("mobile: #hudRight = one ☰ button, 48×48", rightBtns.length === 1 && rightBtns[0][0] === "☰" && rightBtns[0][1] >= 48 && rightBtns[0][2] >= 48, rightBtns);
  check("mobile: #hudLeft has no UnitPanel tabs", !(await t.eval(`Array.from(document.querySelectorAll('#hudLeft button')).some(b => b.textContent.trim() === '능력')`)));
  check("mobile: no floating ActionMenu", !(await t.eval(`!!document.querySelector('[data-testid=action-menu]')`)));
  const inset0 = await t.eval(INSET);
  check("mobile: --tk-bottom-inset set to panel height", inset0 === `${bottom?.h}px`, { inset: inset0, panel: bottom });

  // ── 2. ☰ → PauseMenu 전투 제어 row (speed ×3 for a short enemy phase) ────
  await t.eval(click("[data-testid=mobile-menu]"));
  const ctrl = await t.waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('배속'))`, 20, 100);
  check("mobile: ☰ opens pause menu with 전투 제어 row", ctrl);
  const ctrlBtns = await t.eval(`Array.from(document.querySelectorAll('button')).filter(b => /기본 줌|배속|자동전투/.test(b.textContent)).map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)])`);
  check("mobile: 전투 제어 buttons ≥ 48px", ctrlBtns.length === 3 && ctrlBtns.every((b) => b[1] >= 48), ctrlBtns);
  for (let i = 0; i < 2; i++) await t.eval(clickBtn("", "» 배속 ×" + (i + 1)));
  check("mobile: 배속 cycles to ×3", (await t.eval(`window.__tkBattle.speed`)) === 3, await t.eval(`window.__tkBattle.speed`));
  await t.eval(clickBtn("", "계속하기"));
  await sleep(200);

  // ── 3. select → expanded (unit row, no buttons) → move → postMoveMenu (8 × ≥52px) ──
  const sel = await t.eval(selectUnit);
  check("mobile: tap unit → selected", sel.kind === "selected", sel);
  await sleep(300);
  const expanded = await t.eval(`({ text: document.querySelector('#hudBottom')?.textContent ?? '', n: document.querySelectorAll('[data-testid=bottom-action]').length, h: Math.round(document.querySelector('#hudBottom')?.getBoundingClientRect().height ?? 0) })`);
  check("mobile: expanded shows unit name + hint, no action buttons", expanded.text.includes(sel.name) && expanded.text.includes("이동할 칸") && expanded.n === 0 && expanded.h > 64, expanded);
  const moved = await t.eval(moveToward);
  check("mobile: tap tile → postMoveMenu", moved === "postMoveMenu", moved);
  await t.waitFor(`document.querySelectorAll('[data-testid=bottom-action]').length > 0`, 20, 100);
  const btns = await t.eval(actionBtns);
  check("mobile: 8 action buttons in order", btns.map((b) => b[0]).join(" ") === "공격 책략 도구 교환 협공 필살 대기 취소", btns.map((b) => b[0]));
  check("mobile: every action button ≥ 52px", btns.length > 0 && btns.every((b) => b[1] >= 52), btns.map((b) => b[1]));
  check("mobile: still no floating ActionMenu", !(await t.eval(`!!document.querySelector('[data-testid=action-menu]')`)));
  const insetExp = await t.eval(INSET);
  check("mobile: inset grows with expanded panel", parseInt(insetExp) > 64, insetExp);

  // ── 4. 대기 → idle → collapsed → 턴 종료 → confirm → enemy phase ─────────
  await t.eval(clickBtn("#hudBottom", "대기"));
  await t.eval(`window.__tkBattle.whenIdle()`);
  await sleep(300);
  const afterWait = await t.eval(`({ kind: ${KIND}, h: Math.round(document.querySelector('#hudBottom')?.getBoundingClientRect().height ?? 0), acted: window.__tkBattle.committedState.units.find(u => u.id === ${JSON.stringify(sel.id)})?.acted })`);
  check("mobile: 대기 → idle, unit acted, panel collapsed", afterWait.kind === "idle" && afterWait.acted === true && afterWait.h <= 64, afterWait);
  await dismissDialogue(t);
  await t.eval(click("[data-testid=bottom-end-turn]"));
  check("mobile: 턴 종료 → confirmEndTurn", (await t.eval(KIND)) === "confirmEndTurn", await t.eval(KIND));
  await t.eval(clickBtn("", "예"));
  const turnBefore = await t.eval(`window.__tkBattle.committedState.turn`);
  await t.eval(`window.__tkBattle.whenIdle()`);
  await dismissDialogue(t);
  await t.eval(`window.__tkBattle.whenIdle()`);
  const afterTurn = await t.eval(`({ kind: ${KIND}, phase: window.__tkBattle.committedState.phase, turn: window.__tkBattle.committedState.turn, h: Math.round(document.querySelector('#hudBottom')?.getBoundingClientRect().height ?? 0) })`);
  check("mobile: enemy phase done → player idle, next turn, collapsed", afterTurn.kind === "idle" && afterTurn.phase === "player" && afterTurn.turn === turnBefore + 1 && afterTurn.h <= 64, { turnBefore, afterTurn });

  // ── 5. 상세 → #hudSheet with UnitPanel tabs → 닫기 ────────────────────────
  const sel2 = await t.eval(selectUnit);
  check("mobile: turn 2 tap unit → selected", sel2.kind === "selected", sel2);
  await t.waitFor(`!!document.querySelector('[data-testid=bottom-detail]')`, 20, 100);
  await t.eval(click("[data-testid=bottom-detail]"));
  const sheetTabs = await t.eval(`Array.from(document.querySelectorAll('#hudSheet button')).map(b => b.textContent.trim())`);
  check("mobile: 상세 → #hudSheet with 4 UnitPanel tabs + 닫기", ["능력", "장비", "책략", "특성"].every((x) => sheetTabs.includes(x)) && sheetTabs.includes("닫기"), sheetTabs);
  await t.eval(click("[data-testid=sheet-close]"));
  check("mobile: 닫기 → sheet gone", !(await t.eval(`!!document.querySelector('#hudSheet')`)));
  check("mobile: cancel → idle", (await t.eval(cancelToIdle)) === "idle");

  // ── 6. beginner confirm: VS card renders inside #hudBottom ───────────────
  await t.eval(`window.__tkBattle.setConfirmAttacks(true); 0`);
  const hunt = await t.eval(huntExpr(6));
  check("mobile: found an attack target within 6 turns", hunt.found, hunt);
  if (hunt.found) {
    check("mobile: target tap → confirmAttack", hunt.kind === "confirmAttack", hunt.kind);
    const inPanel = await t.waitFor(`!!document.querySelector('#hudBottom [data-testid=attack-confirm]')`, 20, 100);
    check("mobile: VS card inside #hudBottom", inPanel);
    const cardBtns = await t.eval(`['attack-confirm-ok', 'attack-confirm-cancel'].map(id => Math.round(document.querySelector('#hudBottom [data-testid=' + id + ']')?.getBoundingClientRect().height ?? 0))`);
    check("mobile: VS card buttons rendered", cardBtns.every((h) => h > 0), cardBtns);
    await t.eval(click("[data-testid=attack-confirm-cancel]"));
    check("mobile: [취소] leaves confirmAttack", (await t.eval(KIND)) !== "confirmAttack", await t.eval(KIND));
  }
  await t.eval(cancelToIdle);
  await t.eval(`window.__tkBattle.whenIdle()`);

  // ── 7. desktop regression: reload at 1280×800 ─────────────────────────────
  await t.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await t.send("Emulation.setDeviceMetricsOverride", DESKTOP);
  await t.eval(`window.__e2ePrev = window.__tkBattle; sessionStorage.clear(); location.reload(); 0`);
  const readyD = await waitBattleReady(t, "window.__e2ePrev");
  check("desktop: battle ready after reload", readyD);
  check("desktop: viewport 1280", (await t.eval(`innerWidth`)) === 1280, await t.eval(`innerWidth`));
  await sleep(300);
  check("desktop: no #hudBottom", !(await t.eval(`!!document.querySelector('#hudBottom')`)));
  const insetD = await t.eval(INSET);
  check("desktop: --tk-bottom-inset cleared", insetD === "", insetD);
  const rightD = await t.eval(`Array.from(document.querySelectorAll('#hudRight button')).map(b => b.textContent.trim())`);
  check("desktop: #hudRight has 배속 (full BattleControls)", rightD.some((x) => x.includes("배속")) && rightD.length >= 4, rightD);
  check("desktop: no ☰-only mobile button", !(await t.eval(`!!document.querySelector('[data-testid=mobile-menu]')`)));
  const selD = await t.eval(selectUnit);
  check("desktop: tap unit → selected", selD.kind === "selected", selD);
  const movedD = await t.eval(moveToward);
  check("desktop: tap tile → postMoveMenu", movedD === "postMoveMenu", movedD);
  const menuD = await t.waitFor(`!!document.querySelector('[data-testid=action-menu]')`, 20, 100);
  check("desktop: floating ActionMenu present in postMoveMenu", menuD);
  await t.eval(`window.__tkBattle.dispatchUi({ type: 'menuCancel' }); 0`);
  check("desktop: menuCancel → idle", (await t.eval(cancelToIdle)) === "idle");
  check("desktop: absolute 턴 종료 button exists (TurnBanner)", await t.waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('턴 종료') && !b.closest('#hudBottom'))`, 20, 100));

  t.close();
  finish({ origin: ORIGIN, ms: Date.now() - t0 });
}

main().catch((e) => { console.error(e); check("script error", false, String(e?.stack ?? e)); finish({ origin: ORIGIN, ms: Date.now() - t0 }); });
