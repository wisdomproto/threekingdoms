import { createDraftSaver } from './draft-store.js';
import { createHistory } from './history.js';

export function catalogContext(kind) {
  const file = kind === 'characters' ? 'character-editor.html' : 'item-editor.html';
  if (location.pathname !== `/api/studio/legacy/${file}`) return null;
  const project = new URLSearchParams(location.search).get('project');
  if (!project) throw new Error('Studio 프로젝트 주소가 필요합니다.');
  return { project, kind, api: `/api/studio/projects/${encodeURIComponent(project)}/catalogs/${kind}` };
}
export async function connectCatalog(context, { read, load, setDirty, hide }) {
  let ready = false;
  const failedClose = event => { if(!ready && event.source === parent && event.origin === location.origin && event.data?.type === 'tk-studio:request-close') parent.postMessage({type:'tk-studio:close'},location.origin); };
  window.addEventListener('message', failedClose);
  const response = await fetch(context.api, {cache:'no-store'}), record = await response.json();
  if (!response.ok) throw new Error(record.error);
  load(record.data);
  const empty = document.getElementById('noselect');
  if (empty) empty.textContent = '목록에서 편집할 장수를 선택하세요. 변경 내용은 현재 Studio 프로젝트에 저장됩니다.';
  const history = createHistory({limit:60});
  const snapshot = () => JSON.stringify(read());
  history.reset(snapshot());
  let revision = record.revision, sent = null, closing = false;
  const recoveryKey = `tk.studio.catalog.${context.project}.${context.kind}`;
  const toolbar = document.createElement('div'); toolbar.className = 'catalog-toolbar';
  const status = document.createElement('span'); status.setAttribute('role','status');
  const button = (text, action) => { const b=document.createElement('button'); b.textContent=text; b.onclick=action; toolbar.append(b); return b; };
  const exit = () => parent === window ? location.assign(`/studio?project=${context.project}`) : parent.postMessage({type:'tk-studio:close'},location.origin);
  function preserve() {
    try { if(history.isDirty()) localStorage.setItem(recoveryKey,JSON.stringify({revision,snapshot:history.current()})); else localStorage.removeItem(recoveryKey); }
    catch { status.textContent='브라우저 복구본 저장 실패 · JSON 보관을 이용하세요'; }
  }
  const saver = createDraftSaver({
    post: async ({baseRevision}) => {
      sent=snapshot();
      const r=await fetch(context.api,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseRevision,data:JSON.parse(sent)})});
      const value=await r.json();
      return r.ok ? {ok:true,revision:value.revision} : {ok:false,conflict:r.status===409,error:value.error};
    },
    onSaved: result => { revision=result.revision; if(snapshot()===sent) {history.markSaved();setDirty(false);} preserve(); if(closing&&!history.isDirty())exit(); },
    onState: state => { status.textContent=state.conflict?'저장 충돌 · 편집본을 보관하세요':state.lastError?'저장 실패 · 다시 저장하세요':state.saving?'프로젝트 저장 중…':state.dirty?'수정됨 · 자동저장 대기':'프로젝트에 저장됨'; },
  });
  saver.reset({revision});
  const touch = () => { history.push(snapshot(),{coalesce:true}); setDirty(history.isDirty()); preserve(); saver.touch(); updateButtons(); };
  const travel = direction => { const value=direction<0?history.undo():history.redo(); if(value===null)return; load(JSON.parse(value)); setDirty(history.isDirty());preserve();saver.touch();updateButtons(); };
  const undo=button('↶ 실행 취소',()=>travel(-1)), redo=button('↷ 다시 실행',()=>travel(1));
  function updateButtons(){undo.disabled=!history.canUndo();redo.disabled=!history.canRedo();}
  button('프로젝트 저장',()=>saver.flush());
  const backupButton=button('편집본 JSON 보관',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([snapshot()],{type:'application/json'}));a.download=`${context.kind}-recovery.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
  const finish=()=>{
    if(saver.state().conflict){if(confirm('최신 저장본으로 돌아갈까요? 수정 내용은 브라우저 복구본에 남습니다.'))exit();return;}
    closing=true;if(history.isDirty()||saver.state().saving){saver.touch();saver.flush();}else exit();
  };
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='tk-studio:request-close')finish();});
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saver.flush();}});
  for(const id of hide){const e=document.getElementById(id);if(e)e.hidden=true;}
  toolbar.append(status);document.querySelector('header').after(toolbar);
  const style=document.createElement('style');style.textContent='.catalog-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;border-bottom:1px solid #454b59}.catalog-toolbar button{padding:8px;background:#303b36;color:#fff;border:1px solid #687568;border-radius:6px}.catalog-toolbar button:disabled{opacity:.4}[hidden]{display:none!important}input,select,textarea{font-size:14px!important}';document.head.append(style);
  updateButtons();
  const modeLabel = document.createElement('label'); modeLabel.textContent = '편집 모드 ';
  const mode = document.createElement('select'); mode.setAttribute('aria-label','편집 모드');
  mode.innerHTML = '<option value="basic">기본 모드</option><option value="advanced">고급 모드</option>';
  mode.value = new URLSearchParams(location.search).get('mode') === 'advanced' ? 'advanced' : 'basic';
  const setMode = (notify=true) => { document.body.dataset.catalogMode=mode.value; try{localStorage.setItem('tk.editor.mode',mode.value);}catch{} if(notify)parent.postMessage({type:'tk-studio:mode',mode:mode.value},location.origin); };
  mode.onchange=()=>setMode(); modeLabel.append(mode); toolbar.append(modeLabel);
  style.textContent += 'body[data-catalog-mode=basic] .field[data-key=id],body[data-catalog-mode=basic] .field[data-key=effects]{display:none} .catalog-toolbar select{padding:7px} @media(max-width:800px){main{overflow:auto!important}header{flex-wrap:wrap!important}}';
  style.textContent += 'body[data-catalog-mode=basic] .field[data-key=faceId],body[data-catalog-mode=basic] .field[data-key=skill],body[data-catalog-mode=basic] #motionEditor,body[data-catalog-mode=basic] table th:first-child,body[data-catalog-mode=basic] table td:first-child{display:none}';
  if(parent!==window) {
    modeLabel.hidden=true;
    window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='tk-studio:set-mode'&&['basic','advanced'].includes(e.data.mode)){mode.value=e.data.mode;setMode(false);}});
    const menu=document.createElement('details');menu.className='catalog-more';
    const summary=document.createElement('summary');summary.textContent='더보기';menu.appendChild(summary);
    const actions=document.createElement('div');actions.className='catalog-more-actions';menu.appendChild(actions);
    const header=document.querySelector('header');
    for(const action of header.querySelectorAll('button'))if(!action.hidden)actions.appendChild(action);
    actions.appendChild(backupButton);toolbar.appendChild(menu);header.hidden=true;
    actions.addEventListener('click',e=>{if(e.target.closest('button'))menu.open=false;});
    document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.open=false;});
    menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;summary.focus();}});
    style.textContent+='.catalog-more{position:relative;margin-left:auto}.catalog-more summary{cursor:pointer;padding:8px 14px;border:1px solid #687568;border-radius:6px;list-style:none}.catalog-more-actions{position:absolute;right:0;top:100%;z-index:30;background:#1d212b;border:1px solid #454b59;padding:8px;min-width:220px;box-shadow:0 8px 24px #0008}.catalog-more-actions button{display:block;width:100%;margin:4px 0;text-align:left}.catalog-toolbar [role=status]{margin-left:12px;color:#a4bc9d}';
  }
  setMode(false);
  try {
    const cached=JSON.parse(localStorage.getItem(recoveryKey)||'null');
    if(cached?.snapshot&&cached.snapshot!==snapshot()) {
      const restore=button('남은 복구본 복원',()=>{load(JSON.parse(cached.snapshot));revision=cached.revision;saver.reset({revision});history.push(snapshot());setDirty(true);preserve();saver.touch();restore.remove();discard.remove();updateButtons();});
      const discard=button('저장본 사용',()=>{localStorage.removeItem(recoveryKey);restore.remove();discard.remove();});
    }
  }catch{status.textContent='복구본을 읽지 못했습니다';}
  ready = true; window.removeEventListener('message', failedClose);
  return {touch,save:()=>saver.flush()};
}
