"use client";
import { useEffect, useRef, useState } from "react";
import { DIRECTIONS, MOTION_URL, clipFor, frameAt, loadMotionFrame, validateLibrary, type Direction, type MotionLibrary, type MotionFrame } from "../../src/scene/motions";
import "./style.css";
import BattleSprites from "./BattleSprites";

const labels: Record<string,string> = {rest:"바닥에 앉아 쉬기","rest-talk":"앉아서 말하기","rest-emphasize":"앉아서 강조하기",sit:"앉기","sit-talk":"앉아서 건배",idle:"대기",move:"걷기",talk:"말하기",emphasize:"팔 들어 강조하기",salute:"인사",kneel:"무릎 꿇기",left:"왼쪽",right:"오른쪽",up:"위 · 뒷모습",down:"아래 · 정면"};
export default function MotionEditor() {
  const [embedded,setEmbedded]=useState(false);
  const [imageDirty,setImageDirty]=useState(false);
  const [workspace,setWorkspace]=useState<'battle'|'story'>('battle');
  const [search,setSearch]=useState('');
  const [rosters,setRosters]=useState<Record<string,{classId:string}>>({});
  const [catalog,setCatalog]=useState<Record<string,{name:string;defaultClassId?:string}>>({});
  const [returnUrl,setReturnUrl]=useState('/studio');
  const [preview,setPreview]=useState<string>();
  const [leaving,setLeaving]=useState<'back'|'close'>();
  const [library,setLibrary] = useState<MotionLibrary>();
  const [id,setId] = useState("liubei-foot"), [direction,setDirection] = useState<Direction>("left");
  const [pose,setPose] = useState("idle"), [selected,setSelected] = useState(0);
  const [playing,setPlaying] = useState(true), [dirty,setDirty] = useState(false), [status,setStatus] = useState("동작을 불러오는 중…");
  const [frameIndex,setFrameIndex] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null), input = useRef<HTMLInputElement>(null);
  const actor = library?.actors[id], key = `${direction === "right" ? "left" : direction}.${pose}`;
  const exact = actor?.clips[key], clip = actor ? clipFor(actor,pose,direction) : undefined;
  useEffect(()=>{
    const q=new URLSearchParams(location.search),project=q.get('project');setEmbedded(q.get('embedded')==='1');if(q.get('workspace')==='story')setWorkspace('story');
    if(project)setReturnUrl('/studio?project='+encodeURIComponent(project));
    const url='/api/studio/legacy/data/commanders.json'+(project?'?project='+encodeURIComponent(project):'');
    void fetch('/api/studio/legacy/data/rosters.json'+(project?'?project='+encodeURIComponent(project):'')).then(r=>r.json()).then(setRosters).catch(()=>{});
    void fetch(url).then(r=>{if(!r.ok)throw new Error('캐릭터 목록 로드 실패');return r.json();}).then(setCatalog).catch(e=>setStatus(String(e)));
  },[]);
  useEffect(() => { void fetch(MOTION_URL,{cache:"no-store"}).then(r=>r.json()).then(v=>{
    if(!validateLibrary(v)) throw new Error("동작 파일 형식 오류");
    setLibrary(v); const requested = new URLSearchParams(location.search).get("character");
    const commander=new URLSearchParams(location.search).get('commander');
    if(commander)setId(Object.keys(v.actors).find(k=>v.actors[k]?.name===commander)||'commander-'+Array.from(commander).map(c=>c.codePointAt(0)!.toString(16)).join('-'));
    else if(requested && v.actors[requested])setId(requested);
    setStatus("캐릭터와 동작을 골라 재생해 보세요.");
  }).catch(e=>setStatus(String(e))); },[]);
  useEffect(()=>{ const handler=(e:BeforeUnloadEvent)=>{if(dirty||imageDirty){e.preventDefault();e.returnValue="";}}; window.addEventListener("beforeunload",handler);return()=>window.removeEventListener("beforeunload",handler);},[dirty,imageDirty]);
  useEffect(()=>{
    if(!clip)return; let alive=true, raf=0; const images=new Map<MotionFrame,HTMLCanvasElement>();
    void Promise.all(clip.frames.map(async f=>images.set(f,await loadMotionFrame(f)))).then(()=>{
      if(!alive)return;const start=performance.now();
      const draw=(now:number)=>{
        if(!alive)return; const cv=canvas.current;if(!cv)return;const c=cv.getContext("2d")!;
        c.clearRect(0,0,cv.width,cv.height);
        c.fillStyle="#192b2d"; c.fillRect(0,0,cv.width,cv.height);
        c.strokeStyle="#ffffff10";for(let x=0;x<cv.width;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,cv.height);c.stroke();}for(let y=0;y<cv.height;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(cv.width,y);c.stroke();}
        const f=playing?frameAt(clip,now-start):clip.frames[Math.min(selected,clip.frames.length-1)]!;
        const im=images.get(f);if(im){const h=310,w=im.width/im.height*h;c.save();c.translate(cv.width/2,365);c.scale(direction==="right"?-1:1,1);c.drawImage(im,-w/2,-h,w,h);c.restore();}
        setFrameIndex(clip.frames.indexOf(f));raf=requestAnimationFrame(draw);
      };raf=requestAnimationFrame(draw);
    }).catch(e=>setStatus(String(e)));
    return()=>{alive=false;cancelAnimationFrame(raf);};
  },[clip,direction,playing,selected,workspace]);
  const edit=(fn:(draft:MotionLibrary)=>void)=>{if(!library)return;const draft=structuredClone(library);fn(draft);setLibrary(draft);setDirty(true);};
  const save=async():Promise<boolean>=>{
    if(!library || !validateLibrary(library)){setStatus("숫자와 프레임을 확인하세요. 프레임 시간은 40~10000ms입니다.");return false;}
    try{const r=await fetch("/api/scene-motions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(library)});if(!r.ok)throw new Error(await r.text());setDirty(false);setStatus("저장했습니다. 시나리오를 새로 열면 적용됩니다.");return true;}catch(e){setStatus(`저장 실패: ${e}. 개발 서버에서 실행하거나 JSON을 내보내세요.`);return false;}
  };
  const exportJson=()=>{if(!library)return;const url=URL.createObjectURL(new Blob([JSON.stringify(library,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="library.json";a.click();URL.revokeObjectURL(url);};
  const entries=[...Object.entries(library?.actors??{}).map(([key,a])=>({key,name:a.name,registered:true,commander:Object.keys(catalog).find(k=>catalog[k]?.name===a.name)||a.name})),...Object.entries(catalog).filter(([,c])=>!Object.values(library?.actors??{}).some(a=>a.name===c.name)).map(([key,c])=>({key:'commander-'+Array.from(key).map(c=>c.codePointAt(0)!.toString(16)).join('-'),name:c.name,registered:false,commander:key}))];
  const current=entries.find(e=>e.key===id);
  useEffect(()=>{
    setPreview(undefined);if(actor||!current)return;let alive=true;
    void fetch('/api/studio/legacy/sprite-preview?'+new URLSearchParams({commander:current.commander,class:'footman',side:'player'})).then(r=>r.json()).then(async (urls:string[])=>{
      for(const url of urls){try{await new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve();img.onerror=reject;img.src=url;});if(alive)setPreview(url);break;}catch{}}
    }).catch(()=>{});return()=>{alive=false;};
  },[id,actor,current?.commander]);
  const register=async()=>{
    if(!preview||!current)return;
    try{const img=new Image();img.crossOrigin='anonymous';await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=reject;img.src=preview;});const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d')!.drawImage(img,0,0);const image=c.toDataURL('image/png');edit(d=>{d.actors[id]={name:current.name,clips:{'left.idle':{loop:true,frames:[{image,col:0,row:0,columns:1,rows:1,ms:800}]}}};});setPose('idle');setDirection('left');}catch{setStatus('이미지를 가져오지 못했습니다.');}
  };
  const leave=(target:'back'|'close')=>{if(window.opener){window.opener.focus();window.close();return;}location.assign(returnUrl);};
  const requestLeave=(target:'back'|'close')=>{if(imageDirty){setStatus('먼저 전투 이미지에 적용하거나 다른 이미지를 선택해 미리보기를 취소해 주세요.');return;}if(dirty)setLeaving(target);else leave(target);};
  useEffect(()=>{
    if(!embedded||!library)return;
    const handler=(e:MessageEvent)=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='tk-character:select'||imageDirty)return;
      const commander=String(e.data.commander);setId(Object.keys(library.actors).find(k=>library.actors[k]?.name===commander)||'commander-'+Array.from(commander).map(c=>c.codePointAt(0)!.toString(16)).join('-'));setWorkspace(e.data.workspace==='story'?'story':'battle');setSelected(0);setPose('idle');
    };window.addEventListener('message',handler);parent.postMessage({type:'tk-character:ready'},location.origin);return()=>window.removeEventListener('message',handler);
  },[embedded,!!library,imageDirty]);
  useEffect(()=>{if(embedded)parent.postMessage({type:'tk-character:dirty',dirty,imageDirty},location.origin);},[embedded,dirty,imageDirty]);
  const poses = [...new Set(["idle","move","talk","salute","kneel",...Object.keys(actor?.clips??{}).map(k=>k.split(".")[1]!)])];
  const f=exact?.frames[Math.min(selected,(exact?.frames.length??1)-1)];
  return <main className={`motion-editor ${embedded?"embedded":""}`}>
    {leaving&&<div className="leave-dialog" role="dialog" aria-modal="true" aria-label="수정 내용 저장"><p>수정한 동작을 저장하고 나갈까요?</p><button onClick={()=>void save().then(ok=>{if(ok)leave(leaving);})}>저장하고 나가기</button><button onClick={()=>{setDirty(false);setLeaving(undefined);setTimeout(()=>leave(leaving),0);}}>저장하지 않고 나가기</button><button onClick={()=>setLeaving(undefined)}>계속 편집</button></div>}
    <header><div hidden={embedded}><small>삼국지 · 캐릭터 저작도구</small><h1>동작 작업실</h1><div className="direction-tabs"><button className={workspace==='battle'?'active':''} onClick={()=>setWorkspace('battle')}>전투 캐릭터</button><button className={workspace==='story'?'active':''} onClick={()=>{if(imageDirty){setStatus('먼저 전투 이미지에 적용하거나 미리보기를 취소해 주세요.');return;}setWorkspace('story');}}>시나리오 캐릭터</button></div></div><nav><button hidden={embedded} onClick={()=>requestLeave("back")}>← 캐릭터 편집으로</button><button hidden={embedded} onClick={()=>requestLeave("close")}>창 닫기</button><a hidden={embedded} href="/scene?stage=01-zhuojun&type=intro" target="_blank">도원결의 시나리오 ↗</a><button hidden={workspace==='battle'} onClick={exportJson}>JSON 내보내기</button><button hidden={workspace==='battle'} className="primary" onClick={()=>void save()} disabled={!library}>게임에 저장{dirty?" •":""}</button></nav></header>
    <section className="motion-layout"><aside><div hidden={embedded}><h2>캐릭터 ({entries.length})</h2><input className="character-search" aria-label="캐릭터 검색" placeholder="이름 검색" value={search} onChange={e=>setSearch(e.target.value)}/><div className="character-list">{entries.filter(a=>a.name.includes(search)||a.commander.includes(search)).map(a=><button className={id===a.key?'active':''} key={a.key} onClick={()=>{if(imageDirty&&!confirm('적용하지 않은 이미지 미리보기를 버릴까요?'))return;setImageDirty(false);setId(a.key);setSelected(0);setPose('idle');}}>{a.name}<small>{workspace==='battle'?'전투 이미지':a.registered?'동작 편집 가능':'동작 미등록'}</small></button>)}</div></div>{workspace==='story'&&<><h2>동작</h2>{poses.map(p=><button key={p} className={pose===p?"active":""} onClick={()=>{setPose(p);setSelected(0);}}>{labels[p]??p}</button>)}<button onClick={()=>{const name=prompt("새 동작 ID (영문 소문자, 예: cheer)");if(name&&/^[a-z][a-z0-9_-]*$/.test(name)&&actor&&!actor.clips[`${direction==="right"?"left":direction}.${name}`]){edit(d=>{d.actors[id]!.clips[`${direction==="right"?"left":direction}.${name}`]=structuredClone(clip!);});setPose(name);setSelected(0);}}}>＋ 동작 추가</button></>}</aside>
    <div className="motion-stage">{workspace==='battle'?<BattleSprites key={id} commander={current?.commander||actor?.name||'유비'} onDirty={setImageDirty} classId={rosters[current?.commander||'']?.classId||catalog[current?.commander||'']?.defaultClassId||'footman'}/>:<><div className="direction-tabs">{DIRECTIONS.map(d=><button className={direction===d?"active":""} key={d} onClick={()=>{setDirection(d);setSelected(0);}}>{labels[d]}</button>)}</div>{actor?<canvas ref={canvas} width={640} height={420}/>:<div className="unregistered"><h2>{current?.name}</h2>{preview?<img src={preview} alt={`${current?.name} 캐릭터`}/>:<p>등록된 캐릭터 이미지를 찾는 중입니다.</p>}<p>이 캐릭터는 시나리오 동작이 아직 없습니다.</p><button disabled={!preview} onClick={()=>void register()}>이 이미지로 동작 등록</button></div>}<div className="playbar"><button onClick={()=>setPlaying(!playing)}>{playing?"Ⅱ 일시정지":"▶ 재생"}</button><span>{actor?.name} · {labels[pose]??pose} · {frameIndex+1}/{clip?.frames.length??0}</span></div><p>{direction==="right"?"오른쪽은 왼쪽 동작을 반전해서 사용합니다.":""}{!exact?" 이 방향의 동작은 아직 없습니다. 현재는 대기 자세를 보여줍니다.":""}</p><div className="frames">{exact?.frames.map((fr,i)=><button key={i} className={selected===i?"active":""} onClick={()=>{setSelected(i);setPlaying(false);}}>{i+1}<small>{fr.ms}ms</small></button>)}</div></>}</div>
    <aside className="motion-properties" hidden={workspace==='battle'}><h2>프레임 편집</h2>{!exact?<button onClick={()=>{if(clip)edit(d=>{d.actors[id]!.clips[key]=structuredClone(clip);});}}>이 방향의 동작 만들기</button>:<><label className="check"><input type="checkbox" checked={exact.loop} onChange={e=>edit(d=>{d.actors[id]!.clips[key]!.loop=e.target.checked;})}/> 반복 재생</label>{f&&<>{([['ms','재생 시간 (ms)'],['columns','시트 가로 칸 수'],['rows','시트 세로 칸 수'],['col','가로 위치 (0부터)'],['row','세로 위치 (0부터)']] as const).map(([prop,title])=><label key={prop}>{title}<input type="number" min={prop==='ms'?40:prop==='columns'||prop==='rows'?1:0} max={prop==='ms'?10000:32} value={f[prop]} onChange={e=>edit(d=>{d.actors[id]!.clips[key]!.frames[selected]![prop]=Number(e.target.value);})}/></label>)}<button onClick={()=>input.current?.click()}>이 프레임에 이미지 넣기</button><input ref={input} type="file" accept="image/png,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>4_000_000){setStatus("이미지는 4MB 이하로 넣어주세요.");return;}const reader=new FileReader();reader.onload=()=>edit(d=>{d.actors[id]!.clips[key]!.frames[selected]={image:String(reader.result),col:0,row:0,columns:1,rows:1,ms:f.ms};});reader.readAsDataURL(file);e.target.value="";}}/><button onClick={()=>edit(d=>{d.actors[id]!.clips[key]!.frames.splice(selected+1,0,structuredClone(f));})}>＋ 프레임 복제</button><button disabled={selected===0} onClick={()=>{edit(d=>{const a=d.actors[id]!.clips[key]!.frames;[a[selected-1],a[selected]]=[a[selected]!,a[selected-1]!];});setSelected(selected-1);}}>앞으로 이동</button><button disabled={exact.frames.length<=1} onClick={()=>{edit(d=>{d.actors[id]!.clips[key]!.frames.splice(selected,1);});setSelected(Math.max(0,selected-1));}}>프레임 삭제</button></>}</>}<p>정지 그림도 여러 장을 순서대로 넣으면 동작이 됩니다. 인사·맹세는 반복을 끄면 마지막 자세를 유지합니다.</p></aside></section><footer role="status">{status}{dirty?" · 저장하지 않은 변경이 있습니다.":""}</footer>
  </main>;
}
