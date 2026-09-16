import { editorAssetUrl } from "./asset-library.js";
import { h, btn, moveBtns, setOrDel } from './story-editor.js';
import { ACTIONS, newMapPart, setAction, removeActor, sceneLayout } from './map-scene-model.js';
export { newMapPart };
const labels = { exit: '퇴장', move: '이동', enter: '등장', face: '방향', pose: '자세' };
const dirs = [['left','왼쪽'],['right','오른쪽'],['up','뒤쪽'],['down','정면']];
const poses = [['idle','대기'],['talk','말하기'],['emphasize','팔 들어 강조하기'],['salute','인사'],['kneel','무릎 꿇기'],['sit','앉기'],['rest','바닥에 앉아 쉬기'],['rest-talk','앉아서 말하기'],['rest-emphasize','앉아서 강조하기'],['toast','건배']];
const frameCache = new Map();
// Match the game's edge-connected motion-sheet matte cleanup; source art is untouched.
function previewFrame(frame, assetBase) {
  const key=JSON.stringify([assetBase,frame.image,frame.col,frame.row,frame.columns,frame.rows]);
  if(frameCache.has(key))return frameCache.get(key);
  const task=new Promise((resolve,reject)=>{
    const img=new Image();img.crossOrigin='anonymous';img.onerror=reject;
    img.onload=()=>{try{
      const x=Math.round(frame.col*img.width/frame.columns),y=Math.round(frame.row*img.height/frame.rows);
      const w=Math.round((frame.col+1)*img.width/frame.columns)-x,hh=Math.round((frame.row+1)*img.height/frame.rows)-y;
      const c=document.createElement('canvas');c.width=w;c.height=hh;const ctx=c.getContext('2d');ctx.drawImage(img,x,y,w,hh,0,0,w,hh);
      const data=ctx.getImageData(0,0,w,hh),p=data.data,seen=new Uint8Array(w*hh),queue=[];
      const push=i=>{if(seen[i])return;seen[i]=1;const k=i*4,r=p[k],g=p[k+1],b=p[k+2];if(p[k+3]<12||(Math.min(r,g,b)>175&&Math.max(r,g,b)-Math.min(r,g,b)<24)||(r>180&&b>180&&g<100))queue.push(i);};
      for(let xx=0;xx<w;xx++){push(xx);push((hh-1)*w+xx);}for(let yy=0;yy<hh;yy++){push(yy*w);push(yy*w+w-1);}
      for(let q=0;q<queue.length;q++){const i=queue[q];p[i*4+3]=0;if(i%w)push(i-1);if(i%w<w-1)push(i+1);if(i>=w)push(i-w);if(i<w*(hh-1))push(i+w);}
      ctx.putImageData(data,0,0);resolve(c.toDataURL());
    }catch(e){reject(e);}};img.src=frame.image.startsWith('data:')?frame.image:editorAssetUrl(`${assetBase}${frame.image}`);
  });frameCache.set(key,task);task.catch(()=>frameCache.delete(key));return task;
}
function select(options, value, change) {
  const el = h('select');
  for (const [v, label] of options) { const o = h('option', null, label); o.value = v; el.append(o); }
  if (!options.some(([v]) => v === value) && value) { const o = h('option', null, value); o.value = value; el.append(o); }
  el.value = value ?? ''; el.onchange = () => change(el.value); return el;
}
function field(parent, label, value, change, type = 'text') {
  const wrap = h('label', 'mse-field', label), input = h(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') input.type = type;
  input.value = value ?? ''; input.onchange = () => change(type === 'number' ? Math.max(0, Math.floor(Number(input.value) || 0)) : input.value);
  wrap.append(input); parent.append(wrap); return input;
}
function styles() {
  if (document.getElementById('map-scene-style')) return;
  const s = h('style'); s.id = 'map-scene-style';
  s.textContent = `.mse{border:1px solid #53614d;border-radius:8px;padding:12px;margin:10px 0;background:#171e1b}.mse button,.mse select{min-height:36px}.mse input,.mse textarea,.mse select{background:#242c29;color:#eceddf;border:1px solid #596252;border-radius:4px;padding:6px}.mse-coords{flex-wrap:wrap}.mse-coords>span{min-width:30px}.mse-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.mse-grid{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:12px}.mse-board{position:relative;background:#676b46;overflow:hidden;touch-action:none;min-height:200px}.mse-bg{width:100%;height:100%;position:absolute;inset:0;object-fit:fill;pointer-events:none}.mse-actor{position:absolute!important;transform:translate(-50%,-85%);padding:0!important;border:2px solid transparent!important;background:transparent!important;width:8%;height:17%;min-height:32px;overflow:visible!important;color:white!important;text-shadow:0 1px 3px black;cursor:grab}.mse-actor.selected{border-color:#e2bf6c!important;background:#d6b46733!important}.mse-actor img{width:100%;height:100%;object-fit:contain;pointer-events:none}.mse-actor span{display:block;position:absolute;top:90%;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:12px}.mse-field{display:flex;flex-direction:column;gap:4px;margin-bottom:8px;font-size:12px}.mse-field input,.mse-field textarea{width:100%;box-sizing:border-box}.mse-side{max-height:470px;overflow:auto}.mse-timeline{display:flex;gap:6px;overflow:auto;padding:8px 0}.mse-timeline button{flex-shrink:0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mse .active{background:#d8bb78!important;color:#241e12!important}.mse-note{font-size:12px;color:#b7bfb1;margin:8px 0}.mse-action{border-top:1px solid #435044;padding:8px 0}.mse-action .lbtns{float:right}.mse-message{min-height:40px;padding:10px;background:#0e1511;border-radius:6px;margin-top:8px}.mse-pick{outline:3px solid #e2bf6c;cursor:crosshair}.mse-coords{display:flex;gap:5px}.mse-coords input{width:60px!important}.mse details{margin:8px 0}.mse details textarea{width:100%;min-height:110px}@media(max-width:750px){.mse-grid{grid-template-columns:1fr}.mse-side{max-height:none}}`;
  document.head.append(s);
}

export function renderMapPart(el, part, { commit, assetBase = '', loadMaps, onPreview } = {}) {
  styles();
  let index = -1, selected = part.units[0]?.id, picker = null, maps = {}, library = {}, sprites = {}, timer = null, closeView = false;
  const root = h('section','mse'); el.append(root);
  const actorName = id => { const u = part.units.find(u => u.id === id); return library[u?.sprite]?.name ?? id; };
  const changed = () => { stop(); commit(); draw(); };
  function stop() { if (timer) clearTimeout(timer); timer = null; }
  function pick(callback) { picker = callback; draw(); }
  function coords(parent, label, value, change) {
    const row = h('div','mse-coords'); row.append(h('span',null,label));
    for (let n = 0; n < 2; n++) { const i = h('input'); i.type='number'; i.min='0'; i.value=value[n]; i.setAttribute('aria-label',`${label} ${n ? 'Y':'X'}`); i.onchange=()=>{ const v=[...value]; v[n]=Math.max(0,Math.floor(Number(i.value)||0)); change(v); }; row.append(i); }
    row.append(btn('맵에서 선택',null,()=>pick(change))); parent.append(row);
  }
  function draw() {
    root.replaceChildren();
    index = Math.min(index, part.lines.length - 1);
    const bar = h('div','mse-bar');
    bar.append(select(Object.values(maps).map(m=>[m.id,m.name ?? m.id]),part.map,v=>{part.map=v;changed();}));
    field(bar,'장면 이름',part.label,v=>{setOrDel(part,'label',v);changed();});
    bar.append(btn('처음 배치',null,()=>{stop();index=-1;picker=null;draw();}));
    bar.append(btn(closeView?'전체 배치 보기':'대화용 확대 보기',null,()=>{closeView=!closeView;picker=null;draw();}));
    bar.append(btn(timer ? '■ 정지' : '▶ 배치 순서 재생',null,()=>{ if(timer){stop();draw();}else{ if(index>=part.lines.length-1)index=-1; tick(); } }));
    if(onPreview)bar.append(btn('▶ 게임 장면 미리보기',null,onPreview));
    root.append(bar);
    const note = h('p','mse-note',picker ? '맵에서 목적지를 클릭하세요. Esc로 취소합니다.' : index<0 ? '처음 배치 · 캐릭터를 드래그해 시작 위치를 정하세요.' : `${index+1}번째 대사·행동 · 캐릭터를 드래그하면 이 줄에 이동이 추가됩니다.`);
    root.append(note);
    const grid=h('div','mse-grid'), left=h('div'), side=h('div','mse-side'); grid.append(left,side);root.append(grid);
    const map=maps[part.map]; const w=map?.width ?? 15, hh=map?.height ?? 10;
    const viewport=h('div');Object.assign(viewport.style,{overflow:'hidden',position:'relative',aspectRatio:`${w}/${hh}`});
    const board=h('div','mse-board'); board.style.aspectRatio=`${w}/${hh}`; if(picker)board.classList.add('mse-pick'); board.tabIndex=0;
    const bg=h('img','mse-bg');bg.src=editorAssetUrl(`${assetBase}/assets/maps/${encodeURIComponent(part.map)}.webp`);bg.alt='장면 배경';bg.onerror=()=>{if(bg.src.endsWith('.webp'))bg.src=`${assetBase}/assets/maps/${encodeURIComponent(part.map)}.png`;else bg.hidden=true;};board.append(bg);
    const gridOverlay=h('div');Object.assign(gridOverlay.style,{position:'absolute',inset:'0',pointerEvents:'none',backgroundImage:'linear-gradient(#ffffff22 1px,transparent 1px),linear-gradient(90deg,#ffffff22 1px,transparent 1px)',backgroundSize:`${100/w}% ${100/hh}%`});board.append(gridOverlay);
    const cell=e=>{const b=board.getBoundingClientRect();return [Math.max(0,Math.min(w-1,Math.floor((e.clientX-b.left)/b.width*w))),Math.max(0,Math.min(hh-1,Math.floor((e.clientY-b.top)/b.height*hh)))];};
    board.onclick=e=>{if(picker){const cb=picker;picker=null;cb(cell(e));}};
    board.onkeydown=e=>{if(e.key==='Escape'){picker=null;draw();}};
    const states=sceneLayout(part,index);
    if(closeView){const zoom=part.camera?.zoom??1.5;const focus=part.camera?.focus??states.get(selected)?.cell??[w/2,hh/2];board.style.transformOrigin=`${(focus[0]+.5)/w*100}% ${(focus[1]+.5)/hh*100}%`;board.style.transform=`scale(${zoom})`;}
    for(const u of part.units){
      const state=states.get(u.id);if(!state)continue;
      const actor=btn('',null,()=>{});actor.className=`mse-actor${selected===u.id?' selected':''}`;actor.title=actorName(u.id);actor.setAttribute('aria-label',`캐릭터 ${actorName(u.id)}`);
      actor.style.left=`${(state.cell[0]+.5)/w*100}%`;actor.style.top=`${(state.cell[1]+.8)/hh*100}%`;actor.style.opacity=state.hidden?'.35':'1';
      actor.style.width=`${100/w}%`;actor.style.height=`${100/hh}%`;actor.style.minHeight='0';
      const direction=state.facing==='right'?'left':state.facing??'left';
      const clips=library[u.sprite]?.clips; const frame=(clips?.[`${direction}.${state.pose}`]??clips?.[`${direction}.idle`])?.frames?.[0];
      if(frame){const sprite=h('img');sprite.alt='';sprite.style.transform=state.facing==='right'?'scaleX(-1)':'';actor.append(sprite);previewFrame(frame,assetBase).then(src=>{sprite.src=src;}).catch(()=>{sprite.hidden=true;});}
      else {const img=h('img');img.src=editorAssetUrl(`${assetBase}/assets/sprites/${encodeURIComponent(u.sprite)}/front_idle.webp`);img.alt='';img.style.transform=state.facing==='right'?'scaleX(-1)':'';img.onerror=()=>{img.hidden=true;};actor.append(img);}
      actor.append(h('span',null,`${actorName(u.id)}${state.hidden?' (숨김)':''}`));
      actor.onclick=e=>{if(picker)return;e.stopPropagation();selected=u.id;draw();};
      actor.onpointerdown=e=>{if(picker||timer)return;e.stopPropagation();actor.setPointerCapture(e.pointerId);const start=[e.clientX,e.clientY];let moved=false;
        actor.onpointermove=ev=>{if(Math.hypot(ev.clientX-start[0],ev.clientY-start[1])<4)return;moved=true;const c=cell(ev);actor.style.left=`${(c[0]+.5)/w*100}%`;actor.style.top=`${(c[1]+.8)/hh*100}%`;};
        actor.onpointerup=ev=>{actor.onpointermove=null;actor.onpointerup=null;if(!moved)return;ev.stopPropagation();selected=u.id;const to=cell(ev);if(index<0)u.cell=to;else setAction(part.lines[index],'move',u.id,{to});changed();};
        actor.onpointercancel=()=>{actor.onpointermove=null;actor.onpointerup=null;draw();};
      };board.append(actor);
    }
    viewport.append(board);left.append(viewport);
    left.append(h('p','mse-note','배치 미리보기: 지정 좌표와 대표 자세를 표시합니다. 실제 보행·대사·선택지는 게임 장면 미리보기에서 확인하세요.'));
    if(!map)left.append(h('p','mse-note','맵 정보를 불러오지 못했습니다. 불러오기가 끝날 때까지 위치 편집을 기다려 주세요.'));
    if(!map)board.style.pointerEvents='none';
    const line=part.lines[index];
    if(line)left.append(h('div','mse-message',`${line.speaker ? line.speaker+' : ' : ''}${line.text ?? '동작만 실행'}${line.choice?' · 선택지 있음':''}`));
    const timeline=h('div','mse-timeline');
    part.lines.forEach((l,i)=>{const b=btn(`${i+1}. ${l.speaker?l.speaker+': ':''}${l.text??ACTIONS.filter(k=>l[k]?.length).map(k=>labels[k]).join(' · ')}`,null,()=>{stop();index=i;picker=null;draw();});b.classList.toggle('active',index===i);timeline.append(b);});
    left.append(timeline,btn('+ 대사·행동 추가',null,()=>{part.lines.push({text:''});index=part.lines.length-1;changed();}));
    side.append(h('strong',null,'등장 캐릭터'));
    const camera=h('details');camera.append(h('summary',null,'게임 카메라 설정'));
    camera.append(select([['','인물 크기에 맞춤'],['1','전체 맵'],['1.5','1.5배'],['2','2배'],['2.5','2.5배'],['3','3배']],String(part.camera?.zoom??''),v=>{part.camera??={};if(v)part.camera.zoom=Number(v);else delete part.camera.zoom;changed();}));
    camera.append(btn('화면 중심 찍기',null,()=>pick(v=>{(part.camera??={}).focus=v;changed();})),btn('인물 자동 따라가기',null,()=>{if(part.camera)delete part.camera.focus;changed();}));
    if(part.camera?.focus)camera.append(h('p','mse-note',`고정 중심: ${part.camera.focus.join(', ')}`));side.append(camera);
    side.append(select(part.units.map(u=>[u.id,actorName(u.id)]),selected,v=>{selected=v;draw();}));
    const add=h('details');add.append(h('summary',null,'+ 캐릭터 추가'));
    const search=field(add,'캐릭터 검색','',()=>{});const list=h('div');
    function results(){list.replaceChildren();const catalog={...Object.fromEntries(Object.keys(sprites).map(id=>[id,{name:id}])),...library};const entries=Object.entries(catalog).filter(([id,a])=>`${id} ${a.name}`.toLowerCase().includes(search.value.toLowerCase()));for(const [sprite,a] of entries){const exists=part.units.some(u=>u.sprite===sprite);const b=btn(a.name+' · '+sprite+(exists?' (배치됨)':''),null,()=>{let n=1;while(part.units.some(u=>u.id===`actor-${n}`))n++;selected=`actor-${n}`;part.units.push({id:selected,sprite,cell:[Math.floor(w/2),Math.floor(hh/2)],facing:'left'});index=-1;changed();});b.disabled=exists;list.append(b);}if(!entries.length)list.append(h('p',null,'검색 결과가 없습니다.'));}search.oninput=results;results();add.append(list);side.append(add);
    const unit=part.units.find(u=>u.id===selected);
    if(unit){
      if(index<0){coords(side,'시작',unit.cell,v=>{unit.cell=v;changed();});side.append(select(dirs,unit.facing??'left',v=>{unit.facing=v;changed();}));const lab=h('label');const cb=h('input');cb.type='checkbox';cb.checked=!!unit.hidden;cb.onchange=()=>{unit.hidden=cb.checked;changed();};lab.append(cb,document.createTextNode('등장 전까지 숨김'));side.append(lab);}
      const del=btn('캐릭터 삭제',null,()=>{if(!confirm('이 캐릭터와 연결된 이동·등장·자세 명령을 삭제할까요? 대사는 유지됩니다.'))return;removeActor(part,unit.id);selected=part.units[0]?.id;changed();});del.disabled=part.units.length<=1;side.append(del);
    }
    if(line){
      side.append(h('hr'),h('strong',null,`${index+1}번째 대사·행동`));
      side.append(moveBtns(part.lines,index,()=>{index=Math.min(index,part.lines.length-1);changed();}));
      field(side,'화자 (비우면 내레이션)',line.speaker,v=>{const old=line.speaker;setOrDel(line,'speaker',v);if(!line.portraitId||line.portraitId===old)setOrDel(line,'portraitId',v);changed();});
      field(side,'대사',line.text,v=>{setOrDel(line,'text',v);changed();},'textarea');
      for(const key of ACTIONS){
        for(const [i,a] of (line[key]??[]).entries()){
          const row=h('div','mse-action');row.append(h('strong',null,`${labels[key]} · ${actorName(a.id)}`));row.append(moveBtns(line[key],i,()=>{if(!line[key].length)delete line[key];changed();}));
          row.append(select(part.units.map(u=>[u.id,actorName(u.id)]),a.id,v=>{a.id=v;changed();}));
          if(a.from)coords(row,'출발',a.from,v=>{a.from=v;changed();});if(a.to)coords(row,'도착',a.to,v=>{a.to=v;changed();});
          if(key==='face')row.append(select(dirs,a.dir,v=>{a.dir=v;changed();}));
          if(key==='pose'){const u=part.units.find(u=>u.id===a.id);const available=[...new Set(Object.keys(library[u?.sprite]?.clips??{}).map(k=>k.split('.')[1]))];row.append(select(available.length?available.map(p=>[p,poses.find(([id])=>id===p)?.[1]??p]):poses,a.pose,v=>{a.pose=v;changed();}));}
          side.append(row);
        }
      }
      if(unit){const actions=h('div','mse-bar');for(const key of ACTIONS)actions.append(btn('+ '+labels[key],null,()=>{const current=sceneLayout(part,index-1).get(unit.id)?.cell??unit.cell;if(key==='face')setAction(line,key,unit.id,{dir:'right'});else if(key==='pose')setAction(line,key,unit.id,{pose:'salute'});else{setAction(line,key,unit.id,key==='enter'?{from:[...unit.cell],to:[...current]}:{to:[...current]});}changed();}));side.append(actions);}
      const bubble=h('details');bubble.append(h('summary',null,'말풍선 · 선택지'));
      bubble.append(select([['','말풍선 없음'],['...','…'],['!','!'],['?','?']],line.bubble?.mark??'',v=>{if(v&&selected)line.bubble={id:selected,mark:v};else delete line.bubble;changed();}));
      if(line.choice){field(bubble,'선택 질문',line.choice.prompt,v=>{setOrDel(line.choice,'prompt',v);changed();});for(const o of line.choice.options){field(bubble,'선택지',o.label,v=>{o.label=v;changed();});for(const r of o.react??[]){field(bubble,'반응 화자',r.speaker,v=>{setOrDel(r,'speaker',v);changed();});field(bubble,'반응 대사',r.text,v=>{setOrDel(r,'text',v);changed();},'textarea');}bubble.append(btn('+ 반응',null,()=>{(o.react??=[]).push({text:''});changed();}));}bubble.append(btn('선택지 삭제',null,()=>{if(confirm('이 줄의 선택지와 반응을 삭제할까요?')){delete line.choice;changed();}}));}
      else bubble.append(btn('+ 선택지',null,()=>{line.choice={prompt:'어떻게 답할까요?',options:[{label:'첫 번째 답변',react:[]},{label:'두 번째 답변',react:[]}]};changed();}));side.append(bubble);
    }
  }
  function tick(){ if(!root.isConnected){stop();return;} index++; if(index>=part.lines.length){index=part.lines.length-1;stop();draw();return;}timer=setTimeout(tick,1800);draw(); }
  draw();
  Promise.allSettled([loadMaps?.(),fetch(`${assetBase}/assets/scene-motions/library.json`).then(r=>{if(!r.ok)throw new Error('motions');return r.json();}),fetch(`${assetBase}/assets/sprites/manifest.json`).then(r=>{if(!r.ok)throw new Error('sprites');return r.json();})]).then(([m,l,s])=>{
    if(m.status==='fulfilled'&&m.value)maps=m.value;
    if(l.status==='fulfilled')library=l.value.actors??{};
    if(s.status==='fulfilled')sprites=s.value;
    if(root.isConnected)draw();
  });
}
