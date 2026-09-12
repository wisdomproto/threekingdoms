// tools/editor/rail.js — Chapter rail (DOM 만). spec 2026-09-12-creator-ux-p2-design §4
// renderRail(el, { groups:[{chapter,title,stages:[{id,name,scenes}]}], currentId, collapsed, onPick(id), onToggle() })
// 접힘 = 44px 장 번호만. 항목 .rail-item[data-stage-id], 현재 .on, 부제 "컷신 N · 전투".

export function renderRail(el, { groups, currentId, collapsed, onPick, onToggle }) {
  el.innerHTML = "";
  el.classList.toggle("collapsed", !!collapsed);
  for (const g of groups) {
    const h = document.createElement("div");
    h.className = "rail-ch";
    h.textContent = collapsed ? String(g.chapter) : `제${g.chapter}장 ${g.title}`;
    h.title = `제${g.chapter}장 ${g.title}`;
    el.appendChild(h);
    if (collapsed) continue;
    for (const st of g.stages) {
      const d = document.createElement("div");
      d.className = "rail-item" + (st.id === currentId ? " on" : "");
      d.dataset.stageId = st.id;
      const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = `${st.id.slice(0, 2)} ${st.name}`;
      const sub = document.createElement("div"); sub.className = "sub"; sub.textContent = `컷신 ${st.scenes} · 전투`;
      d.appendChild(nm); d.appendChild(sub);
      d.onclick = () => onPick(st.id);
      el.appendChild(d);
    }
  }
  const t = document.createElement("button");
  t.className = "btn rail-toggle";
  t.textContent = collapsed ? "▸" : "◂ 접기";
  t.title = collapsed ? "장 목록 펼치기" : "장 목록 접기";
  t.onclick = onToggle;
  el.appendChild(t);
}
