// tools/editor/stage-io.js — 스테이지/맵 에디터 I/O 코어 (DOM 무관, 브라우저 <script type="module"> · vitest 전용)
// 규칙의 근거: docs/superpowers/specs/2026-09-11-editor-roundtrip-design.md §4
//  - 로드: 소유 키만 모델로 (중첩 객체는 얕은 복사), 원본은 ORIG(WeakMap)에 보관. 기본값 주입 금지.
//  - 저장: { ...원본, ...소유키 } — 미지 키·미지 필드는 손대지 않고 통과. 키 순서 = 원본 순서.
//  - null/undefined 소유 값 → 키 삭제(중첩 1단계 포함). 빈 배열은 원본에 있었을 때만(최상위), 필수 배열은 항상.

export const TERRAINS = [
  ['.', 'plain',    [217,207,157]],
  ['g', 'grass',    [168,198,134]],
  ['f', 'forest',   [74,110,70]],
  ['m', 'mountain', [140,122,94]],
  ['w', 'waste',    [199,181,143]],
  ['r', 'river',    [106,158,201]],
  ['b', 'bridge',   [176,138,90]],
  ['#', 'wall',     [110,110,118]],
  ['c', 'cliff',    [90,80,72]],
  ['F', 'fort',     [158,142,122]],
  ['G', 'gate',     [122,106,82]],
  ['v', 'village',  [224,184,122]],
  ['B', 'barracks', [207,158,106]],
  ['d', 'depot',    [201,168,110]],
];

const ORIG = new WeakMap();
const own = (model, orig) => { if (orig && typeof orig === "object") ORIG.set(model, orig); return model; };
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * 소유 키만 복사한 모델. 격리 범위: 스칼라 값 그대로, 중첩 객체(trigger/outcome/camera/reward)는
 * { ...v }로 얕은 복사하고 그 안의 배열 필드도 1단계 복제([...arr]) — UI가 필드나 그 배열의 원소를
 * push/splice해도 원본이 오염되지 않는다. 그보다 깊은 구조(배열 안의 객체, 객체 안의 객체)는 여전히
 * 원본과 참조를 공유한다(격리 미보장).
 */
function pickShallow(src, keys) {
  const m = {};
  for (const k of keys) {
    if (src[k] === undefined) continue;
    if (isObj(src[k])) {
      const v = { ...src[k] };
      for (const f of Object.keys(v)) if (Array.isArray(v[f])) v[f] = [...v[f]];
      m[k] = v;
    } else {
      m[k] = src[k];
    }
  }
  return m;
}

/**
 * 중첩 소유 객체의 1단계 null/undefined 필드 제거 (UI가 만드는 camera.focus=null 대응, spec §4-5).
 * ⚠ 이 필드가 UI 소유가 아니라 미지 필드였어도 null이면 함께 지워진다 — spec §4-5가 받아들인 한계
 * (실데이터엔 중첩 null이 없어 영향 없음). 미지 필드 보존이 문제되면 소유 필드 화이트리스트로 좁힐 것.
 */
function stripNulls(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

const KEYS = {
  stage: ["id", "name", "mapId", "turnLimit", "camera", "reward", "levelCap", "units", "objectives", "failConditions", "reinforcements", "strategyConditions", "victory", "defeat", "events"],
  unit: ["commanderId", "classId", "level", "troops", "items", "side", "x", "y"],
  event: ["id", "type", "trigger", "outcome", "once"],
  reinf: ["id", "side", "trigger", "units", "once"],
  strat: ["id", "description", "trigger", "reward"],
};
// 스키마 필수(또는 파일 관행) 배열 — 원본 유무와 무관하게 항상 기록 (spec §4-5)
const ALWAYS = { stage: new Set(["units", "events"]), reinf: new Set(["units"]), unit: new Set(["items"]) };

/**
 * 원본 위에 소유 키를 덮어쓴다.
 * @param model  ORIG 가 붙은(또는 새) 모델 객체
 * @param keys   소유 키(순서 = 새 객체의 키 순서)
 * @param always 항상 기록할 배열 키
 * @param sub    배열 원소 직렬화기 { key: fn }
 */
function merge(model, keys, always, sub = {}) {
  const orig = ORIG.get(model) ?? {};
  const out = { ...orig };
  for (const k of keys) {
    let v = model[k];
    if (v === null || v === undefined) { delete out[k]; continue; }
    if (Array.isArray(v)) {
      if (v.length === 0 && !(k in orig) && !always.has(k)) continue;
      v = sub[k] ? v.map(sub[k]) : v;
    } else if (isObj(v)) {
      v = stripNulls(v);
    }
    out[k] = v;
  }
  for (const k of always) if (out[k] === undefined) out[k] = [];
  return out;
}

const loadUnit = (u) => own({ ...pickShallow(u, KEYS.unit), items: [...(u.items ?? [])] }, u);
const serializeUnit = (u) => merge(u, KEYS.unit, ALWAYS.unit);
const serializeEvent = (e) => merge(e, KEYS.event, new Set());
const serializeReinf = (r) => merge(r, KEYS.reinf, ALWAYS.reinf, { units: serializeUnit });
const serializeStrat = (s) => merge(s, KEYS.strat, new Set());

/** 스테이지 JSON → 편집 모델. 미지 키는 모델에 없고 ORIG 에만 있다. */
export function loadStage(obj) {
  const m = pickShallow(obj, KEYS.stage);
  m.units = (obj.units ?? []).map(loadUnit);
  m.events = (obj.events ?? []).map((e) => own(pickShallow(e, KEYS.event), e));
  m.reinforcements = (obj.reinforcements ?? []).map((r) => own({ ...pickShallow(r, KEYS.reinf), units: (r.units ?? []).map(loadUnit) }, r));
  m.strategyConditions = (obj.strategyConditions ?? []).map((s) => own(pickShallow(s, KEYS.strat), s));
  m.objectives = (obj.objectives ?? []).map((o) => ({ ...o }));       // 그대로 통과(kind 별 재조립 금지)
  m.failConditions = (obj.failConditions ?? []).map((f) => ({ ...f }));
  return own(m, obj);
}

/** 편집 모델 → 스테이지 JSON 객체 (문자열화는 호출측: JSON.stringify(x, null, 2) + "\n") */
export function serializeStage(model) {
  return merge(model, KEYS.stage, ALWAYS.stage, {
    units: serializeUnit, events: serializeEvent, reinforcements: serializeReinf, strategyConditions: serializeStrat,
  });
}

/** Undo 스냅샷용 깊은 복제 + ORIG 재부착 (UI 의 pushUndo 가 JSON 복제 대신 이것을 쓴다) */
export function cloneUnits(units) {
  return units.map((u) => own(JSON.parse(JSON.stringify(u)), ORIG.get(u)));
}

/** 맵 JSON → { id, name, width, height, tileLegend, tiles: string[][] }. 맵은 ORIG 를 쓰지 않는다(spec §4-1). */
export function loadMap(m) {
  const W = m.width, H = m.height;
  const tiles = (m.tiles ?? []).map((row) => { const a = String(row).split(""); while (a.length < W) a.push("."); return a.slice(0, W); });
  while (tiles.length < H) tiles.push(Array(W).fill("."));
  return { id: m.id, name: m.name, width: W, height: H, tileLegend: isObj(m.tileLegend) ? { ...m.tileLegend } : null, tiles };
}

/** 맵 모델 → 맵 JSON 객체. 로드한 legend(키 순서·미사용 키)를 기반으로, 새로 쓰인 char 만 TERRAINS 에서 보충. */
export function serializeMap({ id, name, width, height, tileLegend, tiles }) {
  const used = new Set(); tiles.forEach((r) => r.forEach((ch) => used.add(ch)));
  let legend;
  if (tileLegend) {
    legend = { ...tileLegend };
    TERRAINS.forEach(([ch, tid]) => { if (used.has(ch) && !(ch in legend)) legend[ch] = tid; });
  } else {
    legend = {}; TERRAINS.forEach(([ch, tid]) => { if (used.has(ch)) legend[ch] = tid; });
  }
  return { id, name, width, height, tileLegend: legend, tiles: tiles.map((r) => r.join("")) };
}
