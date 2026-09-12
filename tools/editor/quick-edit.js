// tools/editor/quick-edit.js — 빠른 편집 탭 (DOM 만). spec 2026-09-12-creator-ux-p2-design §5
// renderQuick(el, { stage, commanders, classes, sides, onChange(), onPick(u), onPlaytest() })
// 배치 유닛(stage.units) 표 — 증원 유닛 제외. 변형은 제자리 대입 후 onChange().

const nameOf = (list, id) => (list.find((c) => c.id === id) || {}).name || id || "?";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 주 목표 한 줄 — 첫 필수 목표(없으면 첫 목표, 없으면 legacy victory). */
export function primaryObjectiveText(stage, commanders) {
  const objs = stage.objectives || [];
  const o = objs.find((x) => !x.optional) || objs[0] || stage.victory;
  if (!o) return "(목표 없음)";
  switch (o.kind) {
    case "defeatAll": return "적 전멸";
    case "defeatUnit": return `${nameOf(commanders, o.unitId)} 격파`;
    case "reachTile": return `(${o.x},${o.y}) 도달`;
    case "surviveTurns": return `${o.turns}턴 생존`;
    case "captureTile": return `(${o.x},${o.y}) 점령`;
    default: return String(o.kind);
  }
}

export function renderQuick(el, { stage, commanders, classes, sides, onChange, onPick, onPlaytest }) {
  el.innerHTML = "";
  const tbl = document.createElement("table"); tbl.className = "quick";
  tbl.innerHTML = "<thead><tr><th></th><th>이름</th><th>병종</th><th>Lv</th><th>병력</th><th>위치</th></tr></thead>";
  const tb = document.createElement("tbody");
  for (const u of stage.units) {
    const tr = document.createElement("tr");
    tr.dataset.commanderId = u.commanderId;
    const s = sides[u.side] || sides.enemy;
    const td = () => tr.appendChild(document.createElement("td"));
    { const dot = document.createElement("span"); dot.className = "dot"; dot.style.background = s.raw; dot.title = s.label; td().appendChild(dot); }
    td().textContent = nameOf(commanders, u.commanderId);
    td().textContent = nameOf(classes, u.classId);
    // Lv [−][n][+]
    const lv = td(); lv.className = "lv";
    const minus = document.createElement("button"); minus.className = "btn"; minus.textContent = "−"; minus.title = "레벨 −1";
    const num = document.createElement("span"); num.className = "n"; num.textContent = u.level;
    const plus = document.createElement("button"); plus.className = "btn"; plus.textContent = "+"; plus.title = "레벨 +1";
    const step = (d) => { u.level = clamp((u.level | 0) + d, 1, 99); num.textContent = u.level; onChange(); };
    minus.onclick = () => step(-1); plus.onclick = () => step(1);
    lv.appendChild(minus); lv.appendChild(num); lv.appendChild(plus);
    // 병력
    const tp = document.createElement("input"); tp.type = "number"; tp.min = 1; tp.step = 1; tp.value = u.troops;
    tp.oninput = () => { u.troops = tp.value === "" ? null : Number(tp.value); onChange(); };
    td().appendChild(tp);
    // (x,y) 📍
    const pb = document.createElement("button"); pb.className = "btn pickbtn"; pb.textContent = `(${u.x},${u.y}) 📍`; pb.title = "격자에서 위치 집기";
    pb.onclick = () => onPick(u);
    td().appendChild(pb);
    tb.appendChild(tr);
  }
  tbl.appendChild(tb); el.appendChild(tbl);
  if (!stage.units.length) { const e = document.createElement("div"); e.style.cssText = "color:var(--dim);padding:8px 2px"; e.textContent = "배치된 유닛이 없습니다 — 좌측 유닛 모드에서 칸을 클릭해 배치."; el.appendChild(e); }

  const goal = document.createElement("div"); goal.className = "field";
  goal.innerHTML = `<label>주 목표</label><div class="quick-goal"></div><div class="hint">자세한 조건은 전투 › 목표·패배</div>`;
  goal.querySelector(".quick-goal").textContent = primaryObjectiveText(stage, commanders);
  el.appendChild(goal);

  const tl = document.createElement("div"); tl.className = "field";
  const l = document.createElement("label"); l.textContent = "제한 턴"; tl.appendChild(l);
  const ti = document.createElement("input"); ti.type = "number"; ti.min = 1; ti.step = 1; ti.value = stage.turnLimit ?? "";
  ti.oninput = () => { stage.turnLimit = ti.value === "" ? null : Number(ti.value); onChange(); };
  tl.appendChild(ti); el.appendChild(tl);

  const pt = document.createElement("button"); pt.className = "btn go"; pt.style.width = "100%"; pt.textContent = "▶ 전투 테스트";
  pt.onclick = onPlaytest;
  el.appendChild(pt);
}
