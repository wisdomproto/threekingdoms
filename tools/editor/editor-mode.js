// Display preferences only. Never rewrite the editor model when switching modes.
export function installEditorMode({ getTab, switchTab, getStage, linked = false }) {
  let mode = new URLSearchParams(location.search).get('mode');
  if (!['basic', 'advanced'].includes(mode)) {
    try { mode = localStorage.getItem('tk.editor.mode'); } catch {}
  }
  if (!['basic', 'advanced'].includes(mode)) mode = 'basic';
  const style = document.createElement('style');
  style.textContent = `
    .editor-mode {margin-left:auto;display:flex;align-items:center;gap:8px;font-size:13px}
    .advanced-notice[hidden]{display:none!important}
    body[data-editor-mode=basic] .advanced-field{display:none!important}
    body[data-editor-mode=advanced] .basic-only{display:none!important}
    body[data-workspace=story] #hint{display:none}
    .editor-mode select{background:var(--panel2);color:var(--txt);padding:7px;border:1px solid var(--line);border-radius:6px}
    body.studio-battle [data-sub=adv]{display:none}
    body[data-editor-mode=basic] #gearBtn{display:none}
    body[data-workspace=story] #left,body[data-workspace=story] #stage{display:none}
    body[data-workspace=story] #right{flex:1;width:auto;min-width:0}
    body[data-workspace=story] #tabbody{width:100%;max-width:960px;margin:0 auto;padding:20px;min-width:0}
    body[data-workspace=story] .part,body[data-workspace=story] .line{min-width:0;max-width:100%}
    body[data-workspace=story] .lrow{flex-wrap:wrap}body[data-workspace=story] .lrow input{min-width:80px}
    #right .tab{font-size:13px;white-space:nowrap;flex-shrink:0}
    #tabhead,#subtabs{overflow-x:auto;min-height:42px;flex-shrink:0;position:relative;top:auto}
    #right{overflow:hidden;min-height:0}
    #tabbody{overflow:auto;flex:1;min-height:0}
    #valbanner,.advanced-notice{flex-shrink:0}
    body.studio-linked .editor-mode{display:none!important}
    #right input,#right select,#right textarea{font-size:14px;min-height:32px}
    #right input[type=checkbox]{min-height:0;width:16px;height:16px}
    body.studio-linked header h1,body.studio-linked #draftBadge,body.studio-linked #valbanner.ok{display:none!important}
    #right textarea{line-height:1.6} #right .field>label{font-size:13px}
    #right .hint{font-size:12px} .tab:focus-visible{outline:2px solid var(--acc);outline-offset:-3px}
    .advanced-notice{display:block;padding:8px 12px;font-size:12px;color:var(--acc)}
    body.studio-linked #rail,body.studio-linked #gearBtn,body.studio-linked #publishOpen{display:none!important}
    body.studio-battle [data-tab^="story-"],body.studio-battle #playtestMenuBtn,body.studio-battle #playtestMenu{display:none!important}
    body.studio-scene [data-tab]:not([data-tab=story-intro]),body.studio-scene #playtestMenuBtn{display:none!important}
    @media(max-width:800px){#rail{display:none}#left{width:145px}#right{width:320px}header h1{white-space:normal}main{overflow:auto}#stage{min-width:280px}body[data-workspace=story] #right{min-width:0}body[data-workspace=story] #tabbody{padding:10px}.editor-mode{margin-left:0}}
    @media(max-width:800px){
      body[data-workspace=battle] main{display:block;overflow:auto}
      body[data-workspace=battle] #left{width:100%;overflow:visible}
      body[data-workspace=battle] #left h2,body[data-workspace=battle] #stats{display:none}
      body[data-workspace=battle] #terrlist{display:flex;overflow-x:auto;gap:4px}
      body[data-workspace=battle] .terr{flex-shrink:0}
      body[data-workspace=battle] #stage{width:100%;min-width:0;height:280px;overflow:auto}
      body[data-workspace=battle] #right{width:100%;overflow:visible}
      body.studio-linked #hint{display:none}
    }
  `;
  document.head.append(style);
  if (!linked) document.getElementById('publishOpen').textContent = '게임에 반영…';
  const label = document.createElement('label'); label.className = 'editor-mode'; label.textContent = '편집 모드';
  const select = document.createElement('select'); select.setAttribute('aria-label', '편집 모드');
  for (const [value, text] of [['basic', '기본 모드'], ['advanced', '고급 모드']]) { const o = document.createElement('option'); o.value = value; o.textContent = text; select.append(o); }
  select.value = mode; label.append(select); document.querySelector('header').append(label);
  const notice = document.createElement('button'); notice.className = 'btn advanced-notice'; notice.textContent = '고급 설정 적용 중 · 설정 보기';
  document.getElementById('right').prepend(notice);
  const refresh = () => {
    document.body.dataset.editorMode = mode;
    document.body.dataset.workspace = document.body.classList.contains('studio-battle') ? 'battle' : /^(story|dialogue)/.test(getTab()) ? 'story' : 'battle';
    const stage = getStage();
    const advancedStory = value => Array.isArray(value) ? value.some(advancedStory) : value && typeof value === 'object' ? value.kind === 'map' || (value.portraitId && value.portraitId !== value.speaker) || Object.values(value).some(advancedStory) : false;
    notice.hidden = mode === 'advanced' || !(stage.camera || stage.reinforcements?.length || stage.strategyConditions?.length || advancedStory(stage.scenario));
    document.querySelectorAll('.tab[data-tab],.tab[data-sub]').forEach(tab => {
      tab.setAttribute('role', 'button'); tab.tabIndex = 0;
      tab.setAttribute('aria-pressed', String(tab.classList.contains('on')));
      tab.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tab.click(); } };
    });
  };
  const change = (value, notify = true) => {
    mode = value; select.value = mode;
    try { localStorage.setItem('tk.editor.mode', mode); } catch {}
    refresh();
    if (linked && notify) parent.postMessage({ type: 'tk-studio:mode', mode }, location.origin);
  };
  select.onchange = () => change(select.value);
  notice.onclick = () => { change('advanced'); if (!document.body.classList.contains('studio-scene')) switchTab(getStage().reinforcements?.length || getStage().strategyConditions?.length ? 'battle:adv' : 'battle:meta'); };
  if (linked) window.addEventListener('message', event => {
    if (event.source === parent && event.origin === location.origin && event.data?.type === 'tk-studio:set-mode' && ['basic', 'advanced'].includes(event.data.mode)) change(event.data.mode, false);
  });
  change(mode);
  return { refresh };
}
