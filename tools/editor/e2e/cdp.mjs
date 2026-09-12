// tools/editor/e2e/cdp.mjs — minimal Chrome DevTools Protocol harness (Node 22 built-in WebSocket/fetch, zero deps).
// Launches its own Chrome (CDP :9334) and, unless E2E_TOOLS_ORIGIN is set, its own serve.py (:8095). Both are killed on exit.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PORT = Number(process.env.CDP_PORT || 9334);
export const TOOLS_PORT = Number(process.env.E2E_TOOLS_PORT || 8095);
export const TOOLS_ORIGIN = process.env.E2E_TOOLS_ORIGIN || `http://localhost:${TOOLS_PORT}`;
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const targets = async () => (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
export const pages = async () => (await targets()).filter((t) => t.type === "page");

export class Tab {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && this.pending.has(d.id)) { this.pending.get(d.id)(d); this.pending.delete(d.id); } }; }
  static async open(target) { const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); const t = new Tab(ws); await t.send("Runtime.enable"); return t; }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => this.pending.set(id, r)); }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.error) throw new Error(r.error.message);
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  }
  async clickText(prefix) { return this.eval(`(() => { const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith(${JSON.stringify(prefix)})); if (!b) return 'no:' + ${JSON.stringify(prefix)}; b.click(); return 'ok'; })()`); }
  /** Poll `expr` until truthy. Errors (e.g. context lost during reload) count as falsy. */
  async waitFor(expr, tries = 60, ms = 500) { for (let i = 0; i < tries; i++) { if (await this.eval(expr).catch(() => false)) return true; await sleep(ms); } return false; }
  close() { this.ws.close(); }
}

const children = [];
function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGKILL");
}
export function cleanup() { while (children.length) killTree(children.pop()); }
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(130));

async function pollUntil(fn, tries, ms, what) {
  for (let i = 0; i < tries; i++) { try { if (await fn()) return; } catch {} await sleep(ms); }
  throw new Error(`${what} did not come up`);
}

export async function launchChrome(url) {
  const candidates = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].filter(Boolean);
  const exe = candidates.find((p) => existsSync(p));
  if (!exe) throw new Error("chrome.exe not found — set CHROME=<path>");
  const dir = path.join(process.env.TEMP || "/tmp", `tk-e2e-profile-${PORT}`);
  const child = spawn(exe, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, "--no-first-run", "--no-default-browser-check", "--disable-popup-blocking", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--window-size=1400,900", url || "about:blank"], { stdio: "ignore" });
  children.push(child);
  await pollUntil(async () => (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok, 60, 250, `CDP :${PORT}`);
  return child;
}

/** Start serve.py on TOOLS_PORT unless E2E_TOOLS_ORIGIN points at an already running one. */
export async function startTools() {
  if (process.env.E2E_TOOLS_ORIGIN) return null;
  const child = spawn(process.env.PYTHON || "python", ["tools/serve.py", String(TOOLS_PORT)], { cwd: REPO, stdio: "ignore" });
  children.push(child);
  await pollUntil(async () => (await fetch(`${TOOLS_ORIGIN}/tools/stage-editor.html`)).ok, 60, 250, `serve.py :${TOOLS_PORT}`);
  return child;
}

/** Open the editor in a fresh Chrome and wait for the default stage auto-load. Returns the Tab. */
export async function openEditor() {
  await startTools();
  const url = `${TOOLS_ORIGIN}/tools/stage-editor.html`;
  await launchChrome(url);
  let target = null;
  await pollUntil(async () => (target = (await pages()).find((t) => t.url.includes("stage-editor.html"))), 40, 250, "editor tab");
  const t = await Tab.open(target);
  if (!(await t.waitFor(EDITOR_READY))) throw new Error("editor did not auto-load 05-sishuiguan");
  return t;
}
export const EDITOR_READY = "!!(window.__stageEditor && window.__stageEditor.getStage().id === '05-sishuiguan')";

export const results = { checks: [] };
export function check(name, ok, detail) {
  results.checks.push({ name, ok: !!ok, ...(detail !== undefined ? { detail } : {}) });
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!ok) process.exitCode = 1;
}
/** Print the JSON result, PASS/FAIL, and exit (cleanup runs on exit). */
export function finish(extra = {}) {
  const failed = results.checks.filter((c) => !c.ok).length;
  console.log(JSON.stringify({ ...extra, passed: results.checks.length - failed, failed, checks: results.checks }, null, 2));
  console.log(failed ? "FAIL" : "PASS");
  process.exit(failed ? 1 : 0);
}
