// Inline battle event fields. Mutate only the selected author-owned data.
const expandedEvents = new WeakSet();
const actions = {fire:'지속 화재',message:'대사·알림',effect:'범위 연출',damage:'피해',heal:'회복',status:'상태이상',weather:'날씨 변경',reinforcement:'원군 호출'};
const triggers = {turn:'턴 도달',enterArea:'구역 진입',unitRetreated:'장수 퇴각',hpBelow:'체력 이하',eventFired:'다른 사건 발동 후'};
const area = () => ({x:0,y:0,width:3,height:3});
const defaults = kind => ({fire:{area:area(),duration:3,damagePercent:10,spread:false,extinguishInRain:true,flammableOnly:true},message:{text:''},effect:{effect:'fire',area:area()},damage:{target:{side:'enemy'},amount:30,percent:true,nonlethal:true},heal:{target:{side:'player'},amount:30,percent:true},status:{target:{side:'enemy'},status:'stun',turns:2},weather:{weather:'rain'},reinforcement:{reinforcementId:''}}[kind]);
export function renderScriptEvent(root, event, ctx) {
  const {commit,refresh,stage}=ctx;
  const button=(parent,text,fn)=>{const e=document.createElement('button');e.className='btn';e.textContent=text;e.onclick=()=>{fn();commit();refresh();};parent.appendChild(e);return e;};
  const field=(parent,obj,key,label,options)=>{
    const wrap=document.createElement('label');wrap.className='field';wrap.style.display='block';wrap.append(document.createTextNode(label));
    const el=document.createElement(options?'select':['enabled','area','percent','nonlethal','spread','extinguishInRain','flammableOnly'].includes(key)&&typeof obj[key]!=='number'?'input':key==='text'?'textarea':'input');
    if(options) {for(const [value,text] of Object.entries(options)){const o=document.createElement('option');o.value=value;o.textContent=text;el.appendChild(o);}if(obj[key]&&!Object.hasOwn(options,obj[key])){const o=document.createElement('option');o.value=obj[key];o.textContent=obj[key];el.appendChild(o);}}
    else if(['enabled','area','percent','nonlethal','spread','extinguishInRain','flammableOnly'].includes(key)&&typeof obj[key]!=='number')el.type='checkbox';else if(typeof obj[key]==='number'){el.type='number';el.step='1';}
    if(el.type!=='checkbox') el.style.cssText='display:block;width:100%;box-sizing:border-box;background:var(--panel2);color:var(--txt)';
    el.value=obj[key]??'';if(el.type==='checkbox')el.checked=obj[key];
    el.onchange=()=>{obj[key]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;commit();};if(!options&&el.type!=='checkbox')el.oninput=()=>el.onchange();wrap.appendChild(el);parent.appendChild(wrap);return el;
  };
  const areaFields=(parent,value)=>{for(const [k,label] of Object.entries({x:'X (0부터)',y:'Y (0부터)',width:'가로 칸 수',height:'세로 칸 수'}))field(parent,value,k,label);};
  const fireFields=(parent,action)=>{
    button(parent,'맵에서 화재 구역 선택',()=>ctx.pickArea?.(value=>{action.area=value;commit();refresh();}));
    const summary=document.createElement('p');summary.textContent=`선택 구역: (${action.area.x+1}, ${action.area.y+1})부터 ${action.area.width} × ${action.area.height}칸`;parent.appendChild(summary);
    field(parent,action,'duration','지속 턴 (1~20)').min='1';
    field(parent,action,'damagePercent','매 턴 피해 (최대 체력 %)').max='100';
    field(parent,action,'spread','주변으로 번짐');
    const note=document.createElement('p');note.textContent='다음 턴부터 매 턴 한 번 피해를 줍니다. 아군도 피해를 받습니다. 확산은 상하좌우 한 칸씩입니다.';parent.appendChild(note);
    const detail=document.createElement('details');const title=document.createElement('summary');title.textContent='세부 설정';detail.appendChild(title);parent.appendChild(detail);
    field(detail,action,'extinguishInRain','비가 오면 꺼짐');field(detail,action,'flammableOnly','숲·풀·마을·다리 등 가연성 지형으로만 확산');areaFields(detail,action.area);
  };
  const targetFields=(parent,value,requiredArea=false)=>{
    const side=field(parent,value,'side','대상 진영',{'':'전체',player:'아군',ally:'우군',enemy:'적군'});side.onchange=()=>{if(side.value)value.side=side.value;else delete value.side;commit();};
    const ids={ids:value.unitIds?.join(',')??''};const input=field(parent,ids,'ids','장수 ID (쉼표 구분, 비우면 진영 전체)');input.onchange=()=>{const values=input.value.split(',').map(s=>s.trim()).filter(Boolean);if(values.length)value.unitIds=values;else delete value.unitIds;commit();};
    const toggle={area:!!value.area};const check=field(parent,toggle,'area','구역 안의 대상만');check.disabled=requiredArea;check.onchange=()=>{if(check.checked)value.area=area();else delete value.area;commit();refresh();};if(value.area)areaFields(parent,value.area);
  };
  if(!event||!triggers[event.trigger?.kind]||!Array.isArray(event.actions)){root.textContent='지원하지 않는 사건 형식입니다. 원본은 유지됩니다.';return;}
  field(root,event,'name','사건 이름');
  const enabled={enabled:event.enabled!==false};const check=field(root,enabled,'enabled','사용');check.onchange=()=>{event.enabled=check.checked;commit();};
  const simple=event.actions.length===1&&['fire','message'].includes(event.actions[0]?.kind)&&event.trigger.kind==='turn'&&event.trigger.phase==='player';
  if(simple&&event.editingMode!=='complex'&&!expandedEvents.has(event)) {
    const label=document.createElement('h4');label.textContent='간단 이벤트';root.appendChild(label);
    field(root,event.trigger,'turn','발동 턴').min='1';
    if(event.actions[0].kind==='fire')fireFields(root,event.actions[0]);else field(root,event.actions[0],'text','대사·알림');
    button(root,'복합 이벤트로 펼치기',()=>{event.editingMode='complex';expandedEvents.add(event);});button(root,'사건 삭제',ctx.remove);return;
  }
  if(simple)button(root,'간단 설정으로 접기',()=>{event.editingMode='simple';expandedEvents.delete(event);});
  const select=field(root,event.trigger,'kind','발동 조건',triggers);
  select.onchange=()=>{const kind=select.value;event.trigger={kind,...({turn:{turn:4,phase:'player'},enterArea:{target:{side:'player',area:area()}},unitRetreated:{unitId:''},hpBelow:{unitId:'',percent:50},eventFired:{eventId:''}}[kind])};commit();refresh();};
  const t=event.trigger;
  if(t.kind==='turn'){field(root,t,'turn','턴');field(root,t,'phase','진영 차례',{player:'아군',ally:'우군',enemy:'적군'});}
  if(t.kind==='enterArea') targetFields(root,t.target,true);
  if(t.kind==='unitRetreated'||t.kind==='hpBelow')field(root,t,'unitId','장수 ID');
  if(t.kind==='hpBelow')field(root,t,'percent','체력 % 이하');
  if(t.kind==='eventFired')field(root,t,'eventId','선행 사건',Object.fromEntries([['','선택'],...(stage.scriptEvents??[]).filter(e=>e.id!==event.id).map(e=>[e.id,e.name||e.id])]));
  event.actions.forEach((action,index)=>{
    const card=document.createElement('div');card.className='card';root.appendChild(card);
    const kind=field(card,action,'kind',`실행 ${index+1}`,actions);kind.onchange=()=>{event.actions[index]={kind:kind.value,...defaults(kind.value)};commit();refresh();};
    if(action.kind==='fire')fireFields(card,action);
    if(action.kind==='message')field(card,action,'text','표시할 대사·알림');
    if(action.kind==='effect'){field(card,action,'effect','연출',{fire:'불꽃',water:'물',rock:'낙석',special:'섬광'});areaFields(card,action.area);}
    if(action.target)targetFields(card,action.target);
    if(action.kind==='damage'||action.kind==='heal'){field(card,action,'amount','수치');field(card,action,'percent','최대 체력의 %');if(action.kind==='damage')field(card,action,'nonlethal','체력 1은 남기기');}
    if(action.kind==='status'){field(card,action,'status','상태',{stun:'기절',poison:'중독',seal:'책략 금지',immobilize:'이동 금지'});field(card,action,'turns','지속 차례');}
    if(action.kind==='weather')field(card,action,'weather','날씨',{clear:'맑음',rain:'비',cloudy:'흐림'});
    if(action.kind==='reinforcement')field(card,action,'reinforcementId','증원 그룹',Object.fromEntries([['','선택'],...(stage.reinforcements??[]).map(r=>[r.id,r.id])]));
    button(card,'위로',()=>{[event.actions[index-1],event.actions[index]]=[event.actions[index],event.actions[index-1]];}).disabled=index===0;
    button(card,'아래로',()=>{[event.actions[index+1],event.actions[index]]=[event.actions[index],event.actions[index+1]];}).disabled=index===event.actions.length-1;
    button(card,'실행 삭제',()=>event.actions.splice(index,1));
  });
  button(root,'＋ 실행 추가',()=>event.actions.push({kind:'message',text:''}));
  button(root,'사건 삭제',ctx.remove);
}
