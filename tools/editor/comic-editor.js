// tools/editor/comic-editor.js — 만화 파트(ComicScene) 순수 헬퍼 (DOM 무관). spec 2026-09-12-story-editor-v2-comic-design §4
// 데이터 모양 = packages/data/src/schemas.ts ComicSceneSchema. 아래 DOM 부(renderComicPart)는 story-editor.js 헬퍼 재사용(순환 import — 양쪽 다 top-level 에서 호출하지 않으므로 안전).
import { h, btn, moveBtns, datalist, setOrDel, renderLines } from "./story-editor.js";
import { newSceneLine } from "./story-model.js";

const MIN = 0.01;                                   // 칸 최소 변(정규화) — 클릭만 한 드래그도 스키마 유효(w,h>0)
const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/** [x,y,w,h] 를 0..1 안으로, w/h ≥ MIN, x+w·y+h ≤ 1 로 정리(소수 3자리). */
export function clampRect(r) {
  // 먼저 반올림, 그 다음 반올림된 변 기준으로 클램프 — 반올림을 뒤에 하면 3자리 타이(0.9895→0.99)에서 x+w 가 1을 넘는다
  let [x, y, w, h] = [r?.[0], r?.[1], r?.[2], r?.[3]].map((v) => r3(clamp01(v)));
  w = Math.max(MIN, w); h = Math.max(MIN, h);
  x = Math.min(x, r3(1 - w)); y = Math.min(y, r3(1 - h));
  return [x, y, w, h];
}

/**
 * 썸네일 위 드래그 → 정규화 rect. p0/p1 = 클라이언트 px {x,y}, box = 썸네일 getBoundingClientRect {left,top,width,height}.
 * 방향 무관(어느 모서리에서 시작해도 됨), 박스 밖은 클램프.
 */
export function rectFromDrag(p0, p1, box) {
  const nx = (px) => clamp01((px - box.left) / box.width);
  const ny = (py) => clamp01((py - box.top) / box.height);
  const x0 = nx(p0.x), x1 = nx(p1.x), y0 = ny(p0.y), y1 = ny(p1.y);
  return clampRect([Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)]);
}

/** 새 페이지 — 빈 image(validate 오류로 Publish/미리보기 차단) + 전체 지면 칸 1개. */
export function newPage() {
  return { image: "", panels: [{ rect: [0, 0, 1, 1] }] };
}

/** 새 만화 파트 — 페이지 1장. */
export function newComicPart() {
  return { kind: "comic", pages: [newPage()] };
}

/* ───────────────────────── DOM 부 (Chunk 3) ─────────────────────────
 * renderComicPart(el, part, ctx) — 페이지 카드(image·bgm) + 썸네일 위 칸 사각형 드래그 + 칸 목록 + 칸 인스펙터.
 * 모든 변형은 제자리 + ctx.commit(). 드래그(신규/이동/리사이즈)는 move 중 로컬 렌더만, commit 은 pointerup 에서만.
 * 선택 칸은 WeakMap(page → panel 객체) — 데이터에 키를 남기지 않는다(strict 스키마).
 */
// apps/web/src/audio/sfx.ts `SFX` 의 22키 — 런타임 isSfxKey 가드와 같은 집합(키 추가 시 양쪽 동기)
const SFX_KEYS = ["click", "confirm", "cancel", "slash", "pierce", "hit", "crit", "ultimate", "defeat", "step", "spell", "flank", "combo", "duel", "reinforce", "phase", "star", "chest", "coin", "levelup", "victory", "lose"];
// apps/web/src/audio/bgm.ts TRACKS
const BGM_KEYS = ["title", "menu", "battle", "battleBoss", "scene"];
const FX_KEYS = [["shake", "흔들림"], ["flash", "섬광"]];
const HANDLES = ["nw", "ne", "sw", "se"];
const THUMB_W = 300, DRAG_MIN = 3;   // 회색 박스 3:4 · 클릭(3px 미만)은 칸을 만들지 않고 선택 해제
const selected = new WeakMap();

let comicFiles = null;   // GET /list-dir?path=assets/comics → 확장자 뗀 이름들. 디렉터리 없음·serve.py 아님 → []
const loadComicFiles = () => (comicFiles ??= fetch("/list-dir?path=assets/comics").then((r) => r.json())
  .then((j) => (j?.files ?? []).map((f) => f.replace(/\.webp$/i, ""))).catch(() => []));

const CSS = `
.cpage{border:1px solid var(--line,#333);border-radius:6px;padding:6px;margin-bottom:6px;background:var(--bg,#14161c)}
.crow{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}
.cthumb{position:relative;width:${THUMB_W}px;max-width:100%;background:#4a4f5a;user-select:none;touch-action:none;outline:none;border:1px solid var(--line,#333);cursor:crosshair}
.cthumb:focus{outline:2px solid var(--acc,#d4a843)}
.cthumb img{display:block;width:100%}
.cpanel{position:absolute;border:2px solid rgba(212,168,67,.9);background:rgba(212,168,67,.12);color:#fff;font-size:11px;font-weight:bold;cursor:move;outline:none}
.cpanel.sel{border-color:#fff;background:rgba(255,255,255,.18);z-index:1}
.cpanel:focus{outline:1px dashed #fff;outline-offset:-4px}
.cpanel .n{position:absolute;left:0;top:0;padding:0 4px;background:rgba(0,0,0,.6);pointer-events:none}
.chandle{position:absolute;width:10px;height:10px;background:#fff;border:1px solid #000;margin:-5px}
.chandle.nw{left:0;top:0;cursor:nwse-resize}.chandle.se{right:0;bottom:0;cursor:nwse-resize}
.chandle.ne{right:0;top:0;cursor:nesw-resize}.chandle.sw{left:0;bottom:0;cursor:nesw-resize}
.cplist{flex:1;min-width:160px}
.cplist .pn{display:flex;gap:5px;align-items:center;padding:3px 5px;border-radius:4px;cursor:pointer;font-size:11.5px}
.cplist .pn.sel{background:var(--panel2,#242936);color:var(--acc,#d4a843)}
.cinsp{margin-top:6px;padding-top:6px;border-top:1px dashed var(--line,#333)}
.cinsp label.fx{display:flex;gap:3px;align-items:center;font-size:11.5px;color:var(--dim,#9aa1b0)}
`;
function ensureStyle() {
  if (document.getElementById("tk-comic-css")) return;
  const st = h("style"); st.id = "tk-comic-css"; st.textContent = CSS; document.head.appendChild(st);
}

/** 모서리 핸들 리사이즈 — 반대 모서리 고정, 뒤집기 허용(min/abs), clampRect 로 정리. dx/dy = 정규화 이동량. */
function resizeRect(r0, handle, dx, dy) {
  let [x0, y0] = r0, x1 = r0[0] + r0[2], y1 = r0[1] + r0[3];
  if (handle.includes("w")) x0 += dx; else x1 += dx;
  if (handle.includes("n")) y0 += dy; else y1 += dy;
  return clampRect([Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)]);
}

/** ctx = { commit, assetBase? }. el 은 파트 카드 안 전용 컨테이너 — 페이지 구조 변형 시 스스로 재렌더. */
export function renderComicPart(el, part, ctx) {
  const { commit } = ctx;
  ensureStyle();
  el.innerHTML = "";
  datalist(el, "tk-sfx", SFX_KEYS); datalist(el, "tk-bgm", BGM_KEYS);
  const dl = datalist(el, "tk-comics", []);
  loadComicFiles().then((files) => { if (dl.isConnected) for (const f of files) { const o = h("option"); o.value = f; dl.appendChild(o); } });
  const pages = (part.pages ??= []);   // 스키마 필수 키 — 빈 배열은 validate 가 "페이지가 없습니다"
  const again = () => { commit(); renderComicPart(el, part, ctx); };
  pages.forEach((page, gi) => el.appendChild(pageCard(page, gi, pages, again, ctx)));
  const add = h("button", "addbtn", "+ 페이지 추가");
  add.onclick = () => { pages.push(newPage()); again(); };
  el.appendChild(add);
}

function pageCard(page, gi, pages, again, ctx) {
  const { commit, assetBase = "" } = ctx;
  const panels = (page.panels ??= []);
  const card = h("div", "cpage");
  const head = h("div", "lrow head");
  head.append(h("h3", null, `페이지 ${gi + 1}`), moveBtns(pages, gi, again));
  card.appendChild(head);
  const row = h("div", "lrow");
  const img = h("input"); img.type = "text"; img.setAttribute("list", "tk-comics"); img.placeholder = "지면 이미지 키 (assets/comics/{키}.webp)"; img.value = page.image ?? "";
  const bgm = h("input"); bgm.type = "text"; bgm.setAttribute("list", "tk-bgm"); bgm.placeholder = "BGM (선택)"; bgm.title = "페이지 진입 BGM 트랙 키 — 비우면 유지"; bgm.value = page.bgm ?? "";
  bgm.oninput = () => { setOrDel(page, "bgm", bgm.value.trim()); commit(); };
  row.append(img, bgm); card.appendChild(row);

  const body = h("div", "crow");
  const thumb = h("div", "cthumb"); thumb.tabIndex = 0; thumb.title = "빈 곳 드래그 = 새 칸 · 칸 드래그 = 이동 · 모서리 = 크기 · Delete = 삭제";
  const pic = h("img"); pic.draggable = false; thumb.appendChild(pic);
  const noPic = () => { pic.style.display = "none"; thumb.style.aspectRatio = "3 / 4"; };   // 300×400 회색 박스(좁은 레일에선 폭에 맞춰 3:4 유지)
  const setPic = (v) => { if (!v) return noPic(); pic.style.display = ""; thumb.style.aspectRatio = ""; pic.src = `${assetBase}/assets/comics/${encodeURIComponent(v)}.webp`; };
  pic.onerror = noPic; setPic(page.image);
  img.oninput = () => { page.image = img.value.trim(); setPic(page.image); commit(); };   // image 는 필수 키 — "" 도 남긴다(validate 가 막음)
  const list = h("div", "cplist"), insp = h("div", "cinsp");
  body.append(thumb, list); card.append(body, insp);

  const select = (p) => { if (p) selected.set(page, p); else selected.delete(page); paint(); };
  const sel = () => { const p = selected.get(page); if (p && !panels.includes(p)) selected.delete(page); return selected.get(page); };
  const afterPanels = () => { commit(); paint(); };
  function paint() { drawPanels(); drawList(); drawInspector(); }

  function drawPanels() {
    thumb.querySelectorAll(".cpanel").forEach((n) => n.remove());
    const cur = sel();
    panels.forEach((p, i) => {
      const [x, y, w, hh] = Array.isArray(p.rect) ? p.rect : [0, 0, 0, 0];
      const d = h("div", "cpanel" + (p === cur ? " sel" : "")); d.dataset.i = i; d.tabIndex = 0;
      d.style.cssText = `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${hh * 100}%`;
      d.appendChild(h("span", "n", String(i + 1)));
      if (p === cur) for (const k of HANDLES) { const hd = h("div", "chandle " + k); hd.dataset.h = k; d.appendChild(hd); }
      thumb.appendChild(d);
    });
  }
  function drawList() {
    list.innerHTML = "";
    const cur = sel();
    if (!panels.length) list.appendChild(h("div", "dim", "썸네일 위를 드래그해 칸을 그리세요"));
    panels.forEach((p, i) => {
      const r = h("div", "pn" + (p === cur ? " sel" : ""));
      const [x, y, w, hh] = Array.isArray(p.rect) ? p.rect : [];
      r.appendChild(h("span", null, `칸 ${i + 1} · ${x},${y} ${w}×${hh}` + (p.lines?.length ? ` · ${p.lines.length}줄` : "")));
      r.appendChild(moveBtns(panels, i, afterPanels));
      r.onclick = (e) => { if (!e.target.closest(".btn")) select(p); };
      list.appendChild(r);
    });
  }
  function drawInspector() {
    insp.innerHTML = "";
    const p = sel();
    insp.style.display = p ? "" : "none";
    if (!p) return;
    const hd = h("div", "lrow head"); hd.appendChild(h("h3", null, `칸 ${panels.indexOf(p) + 1}`)); insp.appendChild(hd);
    const r = h("div", "lrow");
    for (const [k, label] of FX_KEYS) {
      const lab = h("label", "fx"); const cb = h("input"); cb.type = "checkbox"; cb.checked = !!p.fx?.includes(k);
      cb.onchange = () => { const fx = FX_KEYS.map(([f]) => f).filter((f) => (f === k ? cb.checked : p.fx?.includes(f))); if (fx.length) p.fx = fx; else delete p.fx; commit(); };
      lab.append(cb, document.createTextNode(label)); r.appendChild(lab);
    }
    const hold = h("input"); hold.type = "number"; hold.min = 1; hold.step = 1; hold.placeholder = "ms"; hold.title = "자동 진행(hold, ms ≥1) — 비우면 탭 대기"; hold.value = p.hold ?? "";
    hold.oninput = () => { const n = Math.trunc(Number(hold.value)); if (hold.value === "" || !Number.isFinite(n)) delete p.hold; else p.hold = Math.max(1, n); commit(); };
    const sfx = h("input"); sfx.type = "text"; sfx.setAttribute("list", "tk-sfx"); sfx.placeholder = "효과음 키 (선택)"; sfx.title = "칸 진입 효과음 — 비우면 없음"; sfx.value = p.sfx ?? "";
    sfx.oninput = () => { setOrDel(p, "sfx", sfx.value.trim()); commit(); };
    r.append(h("span", "dim", "hold"), hold, sfx); insp.appendChild(r);
    const ln = h("div", "lines"); insp.appendChild(ln); drawLines(ln, p);
  }
  function drawLines(ln, p) {
    ln.innerHTML = "";
    if (!p.lines) {   // 무대사 칸 — 첫 줄을 추가할 때만 lines 키를 만든다
      const add = h("button", "addbtn", "+ 줄 추가");
      add.onclick = () => { p.lines = [newSceneLine()]; commit(); drawLines(ln, p); };
      ln.appendChild(add); return;
    }
    const inner = h("div"); ln.appendChild(inner);   // renderLines 의 자체 재렌더는 inner 로 — 비면 inner 를 떼고 add 버튼으로 교체
    renderLines(inner, p.lines, { narration: true, withBg: false, commit: () => { if (p.lines?.length === 0) { delete p.lines; commit(); drawLines(ln, p); } else commit(); } });
  }

  // ── 드래그: 빈 곳 = 새 칸 / 칸 = 이동 / 핸들 = 리사이즈. move 중엔 drawPanels 만, commit 은 pointerup ──
  let drag = null;
  const pt = (e) => ({ x: e.clientX, y: e.clientY });
  thumb.onpointerdown = (e) => {
    if (e.button !== 0) return;
    const hd = e.target.closest?.(".chandle"), pd = e.target.closest?.(".cpanel");
    const panel = pd ? panels[Number(pd.dataset.i)] : null;
    drag = { p0: pt(e), box: thumb.getBoundingClientRect(), moved: false, panel, r0: panel ? clampRect(panel.rect) : null, handle: hd?.dataset.h, mode: hd ? "resize" : panel ? "move" : "new" };
    select(panel);
    (thumb.querySelector(".cpanel.sel") ?? thumb).focus();   // preventDefault 가 마우스 포커스를 막으므로 직접 — Delete 스코프
    try { thumb.setPointerCapture(e.pointerId); } catch { /* 합성 PointerEvent(E2E) — pointerId 없음 */ }
    e.preventDefault();
  };
  thumb.onpointermove = (e) => {
    if (!drag) return;
    const p = pt(e);
    if (!drag.moved && Math.hypot(p.x - drag.p0.x, p.y - drag.p0.y) < DRAG_MIN) return;
    const { box } = drag, dx = (p.x - drag.p0.x) / box.width, dy = (p.y - drag.p0.y) / box.height;
    if (drag.mode === "new") {
      if (!drag.panel) { drag.panel = { rect: [0, 0, 0.01, 0.01] }; panels.push(drag.panel); selected.set(page, drag.panel); }
      drag.panel.rect = rectFromDrag(drag.p0, p, box);
    } else if (drag.mode === "move") {
      drag.panel.rect = clampRect([drag.r0[0] + dx, drag.r0[1] + dy, drag.r0[2], drag.r0[3]]);
    } else drag.panel.rect = resizeRect(drag.r0, drag.handle, dx, dy);
    drag.moved = true;
    drawPanels();
  };
  thumb.onpointerup = thumb.onpointercancel = () => {
    if (!drag) return;
    const moved = drag.moved; drag = null;
    if (moved) afterPanels();
  };
  thumb.onkeydown = (e) => {   // 오버레이 스코프(tabindex) — 인스펙터 입력의 Backspace 와 무관
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    const p = sel(); if (!p) return;
    e.preventDefault(); panels.splice(panels.indexOf(p), 1); selected.delete(page); afterPanels();
  };
  paint();
  return card;
}
