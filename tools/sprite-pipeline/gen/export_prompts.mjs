// 보드(docs/art/asset-board.html)를 헤드리스로 평가해 생성용 프롬프트 카탈로그(prompts.json)를 뽑는다.
//
// 보드가 프롬프트 SSOT다. 이 익스포터는 그 <script>를 DOM 스텁과 함께 vm 컨텍스트에서 eval해
// SECTIONS + buildPrompt 를 캡처하고, 생성 가능한 섹션(N 씬 · I 초상 · S SD)을 GenJob 목록으로 굽는다.
// 출력: tools/sprite-pipeline/gen/prompts.json  (gen_assets.py 가 소비)
//
// 실행:  node tools/sprite-pipeline/gen/export_prompts.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const BOARD = resolve(ROOT, "docs", "art", "asset-board.html");
const OUT = resolve(HERE, "prompts.json");

const html = readFileSync(BOARD, "utf8");
// 보드의 모든 <script> 블록을 이어붙인다(보드는 단일 블록이지만 안전하게).
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
// const SECTIONS 는 vm 전역에 안 붙으므로(렉시컬), 같은 스코프 끝에서 globalThis로 캡처.
const capture = `\n;globalThis.__cap = {
  SECTIONS: (typeof SECTIONS!=='undefined') ? SECTIONS : null,
  buildPrompt: (typeof buildPrompt!=='undefined') ? buildPrompt : null,
  varState: (typeof varState!=='undefined') ? varState : null,
};`;
const code = scripts.join("\n;\n") + capture;

// --- DOM/브라우저 스텁: 보드 끝의 render()·이벤트 바인딩이 throw하지 않게 최소 구현 ---
const noop = () => {};
const elStub = new Proxy(
  { style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, appendChild: noop, insertAdjacentHTML: noop, querySelectorAll: () => [],
    querySelector: () => null, setAttribute: noop, getAttribute: () => null, click: noop, focus: noop,
    remove: noop, scrollIntoView: noop, innerHTML: "", textContent: "", value: "" },
  { get: (t, k) => (k in t ? t[k] : noop) },
);
const docStub = {
  getElementById: () => elStub, querySelector: () => elStub, querySelectorAll: () => [],
  createElement: () => elStub, addEventListener: noop, body: elStub,
};
const sandbox = {
  document: docStub, window: {}, navigator: { clipboard: { writeText: async () => {} } },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  indexedDB: { open: () => ({}) }, CSS: { escape: (x) => x },
  console, setTimeout: noop, clearTimeout: noop, fetch: async () => ({ ok: false }),
  URL: { createObjectURL: () => "", revokeObjectURL: noop }, location: { href: "", reload: noop },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
try {
  vm.runInContext(code, sandbox, { filename: "asset-board.html" });
} catch (e) {
  // 끝부분 DOM 코드에서 throw 나도 SECTIONS/buildPrompt 는 이미 정의됐을 수 있다 — 캡처 시도.
  console.error("[warn] board eval threw (likely DOM tail):", e.message);
}

const cap = sandbox.__cap || {};
const SECTIONS = cap.SECTIONS;
const buildPrompt = cap.buildPrompt;
sandbox.varState = cap.varState || {};
if (!Array.isArray(SECTIONS) || typeof buildPrompt !== "function") {
  console.error("SECTIONS/buildPrompt 캡처 실패 — 스텁 보강 필요");
  process.exit(1);
}
const findSec = (id) => SECTIONS.find((s) => s.id === id);

const jobs = [];

// --- N. 씬 배경 (텍스트→이미지, 자족적) ---
const N = findSec("N");
if (N) for (const it of N.items) {
  jobs.push({
    kind: "scene", id: it.id, savePath: `assets/scenes/${it.saveName}`,
    prompt: buildPrompt(it), sheet: false, ref: false,
  });
}

// --- I. 초상 그룹 시트 (텍스트→이미지, 그리드 → 멤버 슬라이스) ---
const I = findSec("I");
if (I) for (const it of I.items) {
  if (!it.portraitSheet) continue;
  const members = (it.members || []).map((m) => m[0]); // [id, desc] → id
  const cols = members.length <= 4 ? members.length : Math.ceil(members.length / 2);
  jobs.push({
    kind: "portrait", id: it.id, group: it.portraitGroup,
    savePath: `assets/ui/portraits/_sheet_${it.portraitGroup}.png`,
    prompt: buildPrompt(it), sheet: true, ref: false,
    grid: { cols, rows: Math.ceil(members.length / cols) },
    members, // 행우선(좌→우, 위→아래) 순서 = 슬라이스 순서 → ui/portraits/{member}.webp
  });
}

// --- S. SD 포즈시트 (레퍼런스 기반 img2img — ref 필요, 파일럿 후) ---
const S = findSec("S");
if (S) for (const it of S.items) {
  if (!it.poseSheet || !it.roster) continue;
  it.roster.forEach((r, i) => {
    // 캐릭터 드롭다운 인덱스를 바꿔 per-character 프롬프트 추출(현재는 ref 기반이라 본문은 거의 동일).
    sandbox.varState && (sandbox.varState[it.id] = { ...(sandbox.varState[it.id] || {}), 캐릭터: i });
    jobs.push({
      kind: "sd", id: `${it.id}:${r.s}`, spriteId: r.s, name: r.n,
      savePath: `assets/sprites/${r.s}/_posesheet.png`,
      prompt: buildPrompt(it), sheet: true, ref: true, // ref: 캐릭터 레퍼런스 시트 필요
    });
  });
}

const summary = {
  generatedFrom: "docs/art/asset-board.html",
  counts: {
    scene: jobs.filter((j) => j.kind === "scene").length,
    portrait: jobs.filter((j) => j.kind === "portrait").length,
    sd: jobs.filter((j) => j.kind === "sd").length,
  },
  jobs,
};
writeFileSync(OUT, JSON.stringify(summary, null, 2), "utf8");
console.log(`prompts.json 생성: ${OUT}`);
console.log(`  씬 ${summary.counts.scene} · 초상그룹 ${summary.counts.portrait} · SD ${summary.counts.sd}`);
