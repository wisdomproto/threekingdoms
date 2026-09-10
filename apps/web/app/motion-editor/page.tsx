"use client";
import { useEffect, useRef, useState } from "react";
import { DIRECTIONS, MOTION_URL, clipFor, frameAt, loadMotionFrame, validateLibrary, type Direction, type MotionLibrary, type MotionFrame } from "../../src/scene/motions";
import "./style.css";

const labels: Record<string,string> = {sit:"앉기","sit-talk":"앉아서 건배",idle:"대기",move:"걷기",talk:"말하기",salute:"인사",kneel:"무릎 꿇기",left:"왼쪽",right:"오른쪽",up:"위 · 뒷모습",down:"아래 · 정면"};
export default function MotionEditor() {
  const [library,setLibrary] = useState<MotionLibrary>();
  const [id,setId] = useState("liubei-foot"), [direction,setDirection] = useState<Direction>("left");
  const [pose,setPose] = useState("idle"), [selected,setSelected] = useState(0);
  const [playing,setPlaying] = useState(true), [dirty,setDirty] = useState(false), [status,setStatus] = useState("동작을 불러오는 중…");
  const [frameIndex,setFrameIndex] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null), input = useRef<HTMLInputElement>(null);
  const actor = library?.actors[id], key = `${direction === "right" ? "left" : direction}.${pose}`;
  const exact = actor?.clips[key], clip = actor ? clipFor(actor,pose,direction) : undefined;
  useEffect(() => { void fetch(MOTION_URL,{cache:"no-store"}).then(r=>r.json()).then(v=>{
    if(!validateLibrary(v)) throw new Error("동작 파일 형식 오류");
    setLibrary(v); const requested = new URLSearchParams(location.search).get("character");
    if(requested && v.actors[requested])setId(requested);
    setStatus("캐릭터와 동작을 골라 재생해 보세요.");
  }).catch(e=>setStatus(String(e))); },[]);
  useEffect(()=>{ const handler=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue="";}}; window.addEventListener("beforeunload",handler);return()=>window.removeEventListener("beforeunload",handler);},[dirty]);
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
  },[clip,direction,playing,selected]);
  const edit=(fn:(draft:MotionLibrary)=>void)=>{if(!library)return;const draft=structuredClone(library);fn(draft);setLibrary(draft);setDirty(true);};
  const save=async()=>{
    if(!library || !validateLibrary(library)){setStatus("숫자와 프레임을 확인하세요. 프레임 시간은 40~10000ms입니다.");return;}
    try{const r=await fetch("/api/scene-motions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(library)});if(!r.ok)throw new Error(await r.text());setDirty(false);setStatus("저장했습니다. 시나리오를 새로 열면 적용됩니다.");}catch(e){setStatus(`저장 실패: ${e}. 개발 서버에서 실행하거나 JSON을 내보내세요.`);}
  };
  const exportJson=()=>{if(!library)return;const url=URL.createObjectURL(new Blob([JSON.stringify(library,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="library.json";a.click();URL.revokeObjectURL(url);};
  const poses = [...new Set(["idle","move","talk","salute","kneel",...Object.keys(actor?.clips??{}).map(k=>k.split(".")[1]!)])];
  const f=exact?.frames[Math.min(selected,(exact?.frames.length??1)-1)];
  return <main className="motion-editor">
    <header><div><small>삼국지 · 캐릭터 저작도구</small><h1>동작 작업실</h1></div><nav><a href="/scene?stage=01-zhuojun&type=intro" target="_blank">도원결의 시나리오 ↗</a><button onClick={exportJson}>JSON 내보내기</button><button className="primary" onClick={()=>void save()} disabled={!library}>게임에 저장{dirty?" •":""}</button></nav></header>
    <section className="motion-layout"><aside><h2>출연 인물</h2>{Object.entries(library?.actors??{}).map(([k,a])=><button className={id===k?"active":""} key={k} onClick={()=>{setId(k);setSelected(0);}}>{a.name}<small>도보 · 시나리오</small></button>)}<h2>동작</h2>{poses.map(p=><button key={p} className={pose===p?"active":""} onClick={()=>{setPose(p);setSelected(0);}}>{labels[p]??p}</button>)}<button onClick={()=>{const name=prompt("새 동작 ID (영문 소문자, 예: cheer)");if(name&&/^[a-z][a-z0-9_-]*$/.test(name)&&actor&&!actor.clips[`${direction==="right"?"left":direction}.${name}`]){edit(d=>{d.actors[id]!.clips[`${direction==="right"?"left":direction}.${name}`]=structuredClone(clip!);});setPose(name);setSelected(0);}}}>＋ 동작 추가</button></aside>
    <div className="motion-stage"><div className="direction-tabs">{DIRECTIONS.map(d=><button className={direction===d?"active":""} key={d} onClick={()=>{setDirection(d);setSelected(0);}}>{labels[d]}</button>)}</div><canvas ref={canvas} width={640} height={420}/><div className="playbar"><button onClick={()=>setPlaying(!playing)}>{playing?"Ⅱ 일시정지":"▶ 재생"}</button><span>{actor?.name} · {labels[pose]??pose} · {frameIndex+1}/{clip?.frames.length??0}</span></div><p>{direction==="right"?"오른쪽은 왼쪽 동작을 반전해서 사용합니다.":""}{!exact?" 이 방향의 동작은 아직 없습니다. 현재는 대기 자세를 보여줍니다.":""}</p><div className="frames">{exact?.frames.map((fr,i)=><button key={i} className={selected===i?"active":""} onClick={()=>{setSelected(i);setPlaying(false);}}>{i+1}<small>{fr.ms}ms</small></button>)}</div></div>
    <aside className="motion-properties"><h2>프레임 편집</h2>{!exact?<button onClick={()=>{if(clip)edit(d=>{d.actors[id]!.clips[key]=structuredClone(clip);});}}>이 방향의 동작 만들기</button>:<><label className="check"><input type="checkbox" checked={exact.loop} onChange={e=>edit(d=>{d.actors[id]!.clips[key]!.loop=e.target.checked;})}/> 반복 재생</label>{f&&<>{([['ms','재생 시간 (ms)'],['columns','시트 가로 칸 수'],['rows','시트 세로 칸 수'],['col','가로 위치 (0부터)'],['row','세로 위치 (0부터)']] as const).map(([prop,title])=><label key={prop}>{title}<input type="number" min={prop==='ms'?40:prop==='columns'||prop==='rows'?1:0} max={prop==='ms'?10000:32} value={f[prop]} onChange={e=>edit(d=>{d.actors[id]!.clips[key]!.frames[selected]![prop]=Number(e.target.value);})}/></label>)}<button onClick={()=>input.current?.click()}>이 프레임에 이미지 넣기</button><input ref={input} type="file" accept="image/png,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>4_000_000){setStatus("이미지는 4MB 이하로 넣어주세요.");return;}const reader=new FileReader();reader.onload=()=>edit(d=>{d.actors[id]!.clips[key]!.frames[selected]={image:String(reader.result),col:0,row:0,columns:1,rows:1,ms:f.ms};});reader.readAsDataURL(file);e.target.value="";}}/><button onClick={()=>edit(d=>{d.actors[id]!.clips[key]!.frames.splice(selected+1,0,structuredClone(f));})}>＋ 프레임 복제</button><button disabled={selected===0} onClick={()=>{edit(d=>{const a=d.actors[id]!.clips[key]!.frames;[a[selected-1],a[selected]]=[a[selected]!,a[selected-1]!];});setSelected(selected-1);}}>앞으로 이동</button><button disabled={exact.frames.length<=1} onClick={()=>{edit(d=>{d.actors[id]!.clips[key]!.frames.splice(selected,1);});setSelected(Math.max(0,selected-1));}}>프레임 삭제</button></>}</>}<p>정지 그림도 여러 장을 순서대로 넣으면 동작이 됩니다. 인사·맹세는 반복을 끄면 마지막 자세를 유지합니다.</p></aside></section><footer role="status">{status}{dirty?" · 저장하지 않은 변경이 있습니다.":""}</footer>
  </main>;
}
