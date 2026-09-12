// tools/editor/story-editor.js — Story Editor v1 (DOM 만). spec 2026-09-12-creator-ux-p2-design §5
// renderSceneSlot(el, ctx) — VN 파트 카드(배경+줄) · MapScene 고급(JSON) 카드 · 파트 ↑↓✕ · + VN 장면 추가
// renderDialogueList(el, ctx) — 전투 중 대사 카드(WHEN 빌더 + 줄 + Advanced id)
// renderLines(el, lines, opts) — 공용 줄 편집기. 모든 변형은 제자리 + commit()(= refreshValidation). 텍스트는 oninput(히스토리 병합).
// 빈 문자열 필드(speaker/portraitId/bg/side)는 키 삭제 — 파일에 무의미한 "" 를 남기지 않는다.
import { newSceneLine, newVnPart, newDialogueId, slotParts, isMapScene, isComicScene, describeTrigger } from "./story-model.js";
import { renderComicPart, newComicPart } from "./comic-editor.js";   // 순환 import — comic-editor 가 h/btn/moveBtns/renderLines 를 되가져간다(top-level 호출 없음)

const SIDE_OPTS = [["", "(자동)"], ["player", "아군"], ["ally", "우군"], ["enemy", "적군"]];
const KINDS = [["battleStart", "전투가 시작되면"], ["turn", "N턴이 시작되면"], ["unitRetreated", "유닛이 퇴각하면"], ["duelOccurred", "일기토가 일어나면"], ["battleEnd", "전투가 끝나면"]];
const SLOT_LABEL = { intro: "전투 전 이야기", outro: "전투 후 이야기", outroDefeat: "패배 후 이야기" };

export const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
export const btn = (text, title, onclick) => { const b = h("button", "btn", text); if (title) b.title = title; b.onclick = onclick; return b; };
export const setOrDel = (obj, key, v) => { if (v === "" || v == null) delete obj[key]; else obj[key] = v; };
export function datalist(el, id, values) {
  document.getElementById(id)?.remove();   // 같은 id 중복 방지(outro+outroDefeat 두 번 호출)
  const d = h("datalist"); d.id = id;
  for (const v of values) { const o = h("option"); o.value = v; d.appendChild(o); }
  el.appendChild(d);
  return d;
}
function sel(opts, val, onchange) {
  const s = h("select");
  for (const [v, l] of opts) { const o = h("option", null, l); o.value = v; s.appendChild(o); }
  s.value = val ?? ""; s.onchange = () => onchange(s.value);
  return s;
}
export function moveBtns(arr, i, after) {   // ↑ ↓ ✕ — 구조 변형은 after() 가 재렌더
  const w = h("span", "lbtns");
  const up = btn("↑", "위로", () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; after(); }); up.disabled = i === 0;
  const dn = btn("↓", "아래로", () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; after(); }); dn.disabled = i === arr.length - 1;
  const del = btn("✕", "삭제", () => { arr.splice(i, 1); after(); });
  w.append(up, dn, del);
  return w;
}
function autoGrow(ta) { ta.style.height = "auto"; ta.style.height = Math.max(34, ta.scrollHeight + 2) + "px"; }

/**
 * 줄 편집기. narration=true(씬): 내레이션 체크·초상·줄 bg(withBg) / false(전투 대사): 화자 필수·bg 없음.
 * 화자 입력 시 portraitId 가 비어 있거나 이전 화자와 같았으면 화자로 동기(씬만).
 * datalist(tk-speakers/tk-bgs)는 상위 renderSceneSlot/renderDialogueList 가 만든다.
 */
export function renderLines(el, lines, opts) {
  const { narration, commit, withBg } = opts;
  el.innerHTML = "";
  const again = () => { commit(); renderLines(el, lines, opts); };
  lines.forEach((line, i) => {
    const card = h("div", "line");
    const top = h("div", "lrow");
    let isNarr = narration && !("speaker" in line);
    const who = h("div", "lrow who");
    const spk = h("input"); spk.type = "text"; spk.setAttribute("list", "tk-speakers"); spk.placeholder = "화자"; spk.value = line.speaker ?? "";
    const side = sel(SIDE_OPTS, line.side, (v) => { setOrDel(line, "side", v); commit(); }); side.title = "좌/우 (진영)";
    who.append(spk, side);
    let por = null;
    if (narration) {
      por = h("input"); por.type = "text"; por.setAttribute("list", "tk-speakers"); por.placeholder = "초상 (기본=화자)"; por.value = line.portraitId ?? ""; por.title = "portraitId — 비우면 미기록";
      por.oninput = () => { setOrDel(line, "portraitId", por.value.trim()); commit(); };
      who.appendChild(por);
    }
    spk.oninput = () => {
      const prev = line.speaker ?? "", v = spk.value.trim();
      if (narration && (!line.portraitId || line.portraitId === prev)) { setOrDel(line, "portraitId", v); if (por) por.value = v; }
      setOrDel(line, "speaker", v);
      commit();
    };
    if (narration) {
      const lab = h("label", "narr");
      const cb = h("input"); cb.type = "checkbox"; cb.checked = isNarr;
      cb.onchange = () => {
        isNarr = cb.checked;
        who.style.display = isNarr ? "none" : "";
        if (isNarr) { delete line.speaker; delete line.portraitId; spk.value = ""; if (por) por.value = ""; commit(); }
        else spk.focus();   // 화자는 입력받되 빈 문자열이면 키를 쓰지 않는다
      };
      lab.append(cb, document.createTextNode("내레이션"));
      top.appendChild(lab);
      who.style.display = isNarr ? "none" : "";
    }
    top.appendChild(moveBtns(lines, i, again));
    card.append(top, who);
    const ta = h("textarea"); ta.value = line.text ?? ""; ta.placeholder = "본문"; ta.rows = 1; ta.spellcheck = false;
    ta.oninput = () => { line.text = ta.value; autoGrow(ta); commit(); };
    card.appendChild(ta);
    requestAnimationFrame(() => autoGrow(ta));
    if (withBg) {
      const bg = h("input"); bg.type = "text"; bg.setAttribute("list", "tk-bgs"); bg.placeholder = "이 줄부터 배경 (선택)"; bg.value = line.bg ?? ""; bg.title = "줄 배경 전환 — 비우면 없음";
      bg.oninput = () => { setOrDel(line, "bg", bg.value.trim()); commit(); };
      const br = h("div", "lrow"); br.appendChild(bg); card.appendChild(br);
    }
    el.appendChild(card);
  });
  const add = h("button", "addbtn", "+ 줄 추가");
  add.onclick = () => { lines.push(narration ? newSceneLine() : { speaker: "", text: "" }); again(); };
  el.appendChild(add);
}

/**
 * 씬 슬롯(intro|outro|outroDefeat). 단일 VN 은 그대로(무손실), 파트 배열은 카드 나열.
 * 0 파트 → delete stage.scenario[key]; scenario 비면 delete stage.scenario.
 */
export function renderSceneSlot(el, ctx) {
  const { stage, key, label = SLOT_LABEL[key] ?? key, bgOptions = [], assetBase = "", speakers = [], commit } = ctx;
  el.innerHTML = "";
  datalist(el, "tk-speakers", speakers); datalist(el, "tk-bgs", bgOptions);
  const again = () => { commit(); renderSceneSlot(el, ctx); };
  const slot = stage.scenario?.[key];
  const parts = slotParts(slot);
  const arr = Array.isArray(slot) ? slot : null;
  const setSlot = (v) => {
    if (v !== undefined) { (stage.scenario ??= {})[key] = v; return; }
    if (!stage.scenario) return;
    delete stage.scenario[key];
    if (Object.keys(stage.scenario).length === 0) delete stage.scenario;
  };
  if (parts.length === 0) {
    const c = h("div", "card empty");
    c.appendChild(h("div", null, `아직 ${label}가 없습니다`));
    c.appendChild(btn("첫 장면 만들기", null, () => { setSlot(newVnPart()); again(); }));
    el.appendChild(c);
    return;
  }
  const afterParts = () => { if (arr.length === 0) setSlot(undefined); again(); };
  parts.forEach((part, i) => {
    const card = h("div", "card part");
    const head = h("div", "lrow head");
    head.appendChild(h("h3", null, isMapScene(part) ? `맵 씬 (고급) — ${part.label ?? part.map}` : isComicScene(part) ? `만화 장면 ${i + 1}` : `장면 ${i + 1}`));
    head.appendChild(arr ? moveBtns(arr, i, afterParts) : btn("✕", "이 장면 삭제", () => { setSlot(undefined); again(); }));
    card.appendChild(head);
    if (isMapScene(part)) {   // 고급 JSON 카드 — 적용 = JSON.parse 성공 시 파트 교체 (MapScene 은 배열 안에만 존재)
      const det = h("details"); det.appendChild(h("summary", null, "JSON 편집 ▾"));
      const ta = h("textarea", "json"); ta.value = JSON.stringify(part, null, 2); ta.spellcheck = false;
      const err = h("div", "msg");
      const ap = btn("적용", "JSON 을 파싱해 이 파트를 교체", () => {
        try { const obj = JSON.parse(ta.value); if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("객체가 아닙니다"); arr[i] = obj; again(); }
        catch (e) { err.textContent = "JSON 오류: " + e.message; err.style.display = "block"; }
      });
      det.append(ta, err, ap); card.appendChild(det);
    } else if (isComicScene(part)) {   // 만화 파트 — VN 폴백 앞(VN 카드의 `lines ??= []` 는 strict 스키마를 깨뜨린다)
      const body = h("div", "comic"); card.appendChild(body);
      renderComicPart(body, part, { commit, assetBase });
    } else {
      const br = h("div", "lrow bgrow");
      const bg = h("input"); bg.type = "text"; bg.setAttribute("list", "tk-bgs"); bg.placeholder = "배경 키 (예: 05-sishuiguan-intro)"; bg.value = part.bg ?? "";
      const th = h("span", "thumb"); const img = h("img"); const none = h("span", "nogen", "미생성");
      img.onerror = () => { img.style.display = "none"; none.style.display = ""; };
      const setThumb = (v) => { img.style.display = v ? "" : "none"; none.style.display = "none"; if (v) img.src = `${assetBase}/assets/scenes/${encodeURIComponent(v)}.webp`; };
      th.append(img, none); setThumb(part.bg);
      bg.oninput = () => { setOrDel(part, "bg", bg.value.trim()); setThumb(part.bg); commit(); };
      br.append(bg, th); card.appendChild(br);
      const ln = h("div", "lines"); card.appendChild(ln);
      renderLines(ln, (part.lines ??= []), { narration: true, withBg: true, commit });
    }
    el.appendChild(card);
  });
  const addPart = (mk) => () => { if (arr) arr.push(mk()); else setSlot([slot, mk()]); again(); };   // 단일 VN → 배열 승격
  const add = h("button", "addbtn", "+ VN 장면 추가"); add.onclick = addPart(newVnPart);
  const addComic = h("button", "addbtn", "+ 만화 장면 추가"); addComic.onclick = addPart(newComicPart); addComic.style.marginTop = "4px";
  el.append(add, addComic);
}

/** 전투 중 대사 목록. placed=[{id,name}] duels=[{id,label}]. 카드 전부 삭제 → stage.dialogue = undefined(키 삭제). */
export function renderDialogueList(el, ctx) {
  const { stage, placed = [], duels = [], speakers = [], commit } = ctx;
  el.innerHTML = "";
  datalist(el, "tk-speakers", speakers);
  const again = () => { commit(); renderDialogueList(el, ctx); };
  const nameOf = (id) => placed.find((p) => p.id === id)?.name ?? id;
  const duelLabel = (id) => duels.find((d) => d.id === id)?.label ?? id;
  const list = stage.dialogue ?? [];
  const add = () => { (stage.dialogue ??= []).push({ id: newDialogueId(list.map((d) => d.id)), trigger: { kind: "battleStart" }, lines: [{ speaker: "", text: "" }] }); again(); };
  if (list.length === 0) {
    const c = h("div", "card empty");
    c.appendChild(h("div", null, "아직 전투 중 대사가 없습니다"));
    c.appendChild(btn("첫 대사 만들기", null, add));
    el.appendChild(c);
    return;
  }
  list.forEach((d, i) => {
    const card = h("div", "card dlg");
    const head = h("div", "lrow head");
    const title = h("h3", null, describeTrigger(d.trigger, nameOf, duelLabel));
    const refreshHead = () => { title.textContent = describeTrigger(d.trigger, nameOf, duelLabel); };
    head.append(title, btn("✕", "이 대사 삭제", () => { list.splice(i, 1); if (list.length === 0) stage.dialogue = undefined; again(); }));
    card.appendChild(head);
    // WHEN 빌더 (design-guide §5 Event builder)
    const when = h("div", "field when"); when.appendChild(h("label", null, "WHEN"));
    const t = d.trigger;
    const row = h("div", "lrow");
    row.appendChild(sel(KINDS, t.kind, (k) => {
      d.trigger = k === "turn" ? { kind: k, n: 1 } : k === "unitRetreated" ? { kind: k, unitId: placed[0]?.id ?? "" } : k === "duelOccurred" ? { kind: k, duelId: duels[0]?.id ?? "" } : { kind: k };
      again();
    }));
    if (t.kind === "turn") { const n = h("input"); n.type = "number"; n.min = 1; n.step = 1; n.value = t.n ?? ""; n.oninput = () => { t.n = n.value === "" ? 0 : Number(n.value); refreshHead(); commit(); }; row.append(n, h("span", "dim", "턴")); }
    else if (t.kind === "unitRetreated") row.appendChild(sel(placed.map((p) => [p.id, p.name === p.id ? p.id : `${p.name} (${p.id})`]), t.unitId, (v) => { t.unitId = v; refreshHead(); commit(); }));
    else if (t.kind === "duelOccurred") row.appendChild(sel(duels.length ? duels.map((x) => [x.id, x.label]) : [["", "(정의된 일기토 없음)"]], t.duelId, (v) => { t.duelId = v; refreshHead(); commit(); }));
    else if (t.kind === "battleEnd") row.appendChild(sel([["", "모두"], ["victory", "승리"], ["defeat", "패배"]], t.result, (v) => { setOrDel(t, "result", v); refreshHead(); commit(); }));
    when.appendChild(row); card.appendChild(when);
    const ln = h("div", "lines"); card.appendChild(ln);
    renderLines(ln, (d.lines ??= []), { narration: false, withBg: false, commit });
    const det = h("details", "adv"); det.appendChild(h("summary", null, "Advanced ▾"));
    const idw = h("div", "field"); idw.appendChild(h("label", null, "id"));
    const idi = h("input"); idi.type = "text"; idi.value = d.id ?? ""; idi.oninput = () => { d.id = idi.value.trim(); commit(); };
    idw.appendChild(idi); det.appendChild(idw); card.appendChild(det);
    el.appendChild(card);
  });
  const ab = h("button", "addbtn", "+ 대사 추가"); ab.onclick = add; el.appendChild(ab);
}
