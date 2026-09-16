/** Local image replacement. Existing assets are backed up by the server. */
export function assetImageEditor(parent,{kind,id,onSaved}) {
  const box=document.createElement('section');box.style.cssText='padding:12px;margin:12px 0;border:1px solid #45504f;border-radius:8px';parent.appendChild(box);
  const title=document.createElement('h3');title.textContent=kind==='maps'?'맵 이미지':kind==='items'?'아이템 이미지':kind==='objects'?'지형지물 이미지':'효과 이미지';box.appendChild(title);
  const path=`/api/local-assets/${kind==='items'?'ui/items':kind}/${id.split('/').map(encodeURIComponent).join('/')}.${kind==='fx'?'png':'webp'}`;
  const image=document.createElement('img');image.alt=title.textContent;image.style.cssText='display:block;max-width:100%;max-height:220px;object-fit:contain;background:#b9b8aa;margin-bottom:8px';image.src=path;box.appendChild(image);
  const status=document.createElement('p');status.setAttribute('role','status');image.onerror=()=>{image.hidden=true;status.textContent='등록된 이미지가 없습니다.';};box.appendChild(status);
  const input=document.createElement('input');input.type='file';input.accept='image/png,image/webp,image/jpeg';input.hidden=true;box.appendChild(input);
  const choose=document.createElement('button');choose.type='button';choose.textContent='이미지 파일 선택';choose.className='btn';choose.onclick=()=>input.click();box.appendChild(choose);
  const save=document.createElement('button');save.type='button';save.className='btn';save.textContent='이미지 적용';save.disabled=true;box.appendChild(save);
  let pending=null;
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;input.value='';if(file.size>20000000){status.textContent='20MB 이하의 이미지를 선택하세요.';return;}
    const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});if(img.width*img.height>40000000)throw new Error('이미지가 너무 큽니다.');const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d').drawImage(img,0,0);pending=await new Promise(resolve=>canvas.toBlob(resolve,kind==='fx'?'image/png':'image/webp',.95));if(!pending)throw new Error('변환 실패');image.src=canvas.toDataURL(kind==='fx'?'image/png':'image/webp',.95);image.hidden=false;save.disabled=false;status.textContent=`${img.width} × ${img.height} · 미리보기입니다. 적용하면 같은 이미지를 사용하는 모든 전투에 반영됩니다.`;}catch(e){status.textContent=String(e);}finally{URL.revokeObjectURL(url);}};
  save.onclick=async()=>{if(!pending)return;save.disabled=true;choose.disabled=true;try{const response=await fetch('/api/studio/asset-image?'+new URLSearchParams({kind,id}),{method:'POST',body:pending});const data=await response.json();if(!response.ok)throw new Error(data.error);pending=null;image.src=data.url+'?v='+Date.now();image.hidden=false;status.textContent='적용했습니다. 기존 이미지는 백업했습니다.';onSaved?.();}catch(e){status.textContent=String(e);save.disabled=false;}finally{choose.disabled=false;}};
  const note=document.createElement('p');note.textContent=kind==='maps'?'그림만 교체합니다. 지형 판정과 장수 배치는 유지됩니다.':kind==='fx'?'기존 효과 시트와 같은 칸 배치·크기로 넣어주세요.':'로컬 게임 에셋에 적용됩니다.';box.appendChild(note);
}
export async function effectImageEditors(parent){
  const select=document.createElement('select');select.setAttribute('aria-label','효과 이미지 선택');parent.appendChild(select);const body=document.createElement('div');parent.appendChild(body);
  try{const response=await fetch('/api/studio/effect-images');if(!response.ok)throw new Error('효과 목록을 읽지 못했습니다.');const files=await response.json();for(const file of files){const option=document.createElement('option');option.value=file.id;option.textContent=({slash:'참격',thrust:'찌르기',arrow:'화살',flash:'섬광',sparkle:'반짝임',coin:'동전'})[file.id]||file.id;select.appendChild(option);}select.onchange=()=>{body.replaceChildren();if(select.value)assetImageEditor(body,{kind:'fx',id:select.value});};select.onchange();}catch(e){body.textContent=String(e);}
}
export async function assetGallery(parent,{kind,onSaved}) {
  const search=document.createElement('input');search.type='search';search.placeholder='이름으로 검색';search.setAttribute('aria-label',kind==='objects'?'지형지물 검색':'이펙트 검색');parent.appendChild(search);
  const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:280px;overflow:auto;margin:10px 0';parent.appendChild(grid);
  const editor=document.createElement('div');parent.appendChild(editor);
  const labels={tree:'나무',rock:'바위',bush:'덤불',wall:'성벽',bridge:'다리',gate:'성문',camp:'야영지',tent:'천막',house:'집',village:'마을',fence:'울타리',banner:'깃발',brazier:'화로',depot:'군량고',debris:'잔해',slash:'참격',thrust:'찌르기',arrow:'화살',flash:'섬광',sparkle:'반짝임',coin:'동전',fire:'불',water:'물',fort:'요새'};
  Object.assign(labels,{abatis:'녹각',bamboo:'대나무',command:'지휘',campfire:'모닥불',cart:'수레',pile:'더미',siege:'공성병기',weapons:'무기',store:'창고',gatehouse:'문루',tower:'탑',closed:'닫힘',destroyed:'파괴',open:'열림',log:'통나무',fallen:'쓰러짐',natural:'자연형',v1:'',corner:'모서리',se:'우하',sw:'좌하',horizontal:'가로',vertical:'세로',h:'가로',v:'세로',tiled:'기와',boulder:'큰 바위',rocks:'바위',cluster:'무리',broad:'큰',small:'작은',sparse:'성긴',palisade:'목책',straight:'직선',pennants:'작은 깃발',reeds:'갈대',cliff:'절벽',sandbags:'모래주머니',shrub:'관목',signal:'신호',flag:'깃발',supply:'보급',dead:'고사목',leafy:'잎이 무성한',hut:'초가',hut2:'초가 2',battlement:'흉벽',breached:'무너짐',cross:'십자',end:'끝',single:'단독',tee:'갈림길'});
  Object.assign(labels,{hero:'삼형제',dual:'쌍검',crescent:'언월도',spear:'장팔사모',impact:'타격',critical:'치명타',ultimate:'필살기',special:'특수'});
  const label=id=>id.split(/[_/\-]/).map(p=>labels[p]??p).filter(Boolean).join(' ');
  try {
    const response=await fetch(kind==='objects'?'/api/studio/object-images':'/api/studio/effect-images');if(!response.ok)throw new Error('이미지 목록을 읽지 못했습니다.');
    const files=await response.json();let selected='';
    const render=()=>{grid.replaceChildren();const query=search.value.trim().toLowerCase();for(const file of files.filter(f=>(f.id+' '+label(f.id)).toLowerCase().includes(query))){
      const button=document.createElement('button');button.type='button';button.className='btn';button.title=file.id;button.setAttribute('aria-pressed',String(selected===file.id));button.style.cssText='padding:5px;white-space:normal;overflow-wrap:anywhere;'+(selected===file.id?'border-color:#d9b75d;background:#45452f':'');
      const image=document.createElement('img');image.loading='lazy';image.alt='';image.src=`/api/local-assets/${kind}/${file.id.split('/').map(encodeURIComponent).join('/')}.${kind==='fx'?'png':'webp'}`;image.style.cssText='display:block;width:100%;height:65px;object-fit:contain;background:#737b68';button.appendChild(image);
      const name=document.createElement('span');name.textContent=label(file.id);button.appendChild(name);button.onclick=()=>{selected=file.id;render();editor.replaceChildren();assetImageEditor(editor,{kind,id:file.id,onSaved});};grid.appendChild(button);
    }if(!grid.childElementCount)grid.textContent='검색 결과가 없습니다.';};search.oninput=render;render();
    const note=document.createElement('p');note.textContent='이미지를 선택하면 크게 보고 파일을 교체할 수 있습니다.';editor.appendChild(note);
  }catch(error){editor.textContent=String(error);}
}
