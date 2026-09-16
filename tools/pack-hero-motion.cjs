// Pack generated 4x4 pose sheets into fixed-size, foot-aligned game frames.
// This is asset preparation only; all artwork comes from the saved image-generation source.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.TK_SHARP_PATH || 'sharp');
const [source, id, view, output = '.studio/hero-motion-v1/packed'] = process.argv.slice(2);
if (!source || !id || !['front', 'back', 'both'].includes(view)) throw new Error('Usage: node pack-hero-motion.cjs source id front|back|both [output]');
const slots = ['move_0','move_1','move_2','move_3','attack_0','attack_1','attack_2','attack_3','attack_4','attack_5','hit_0','hit_1','idle_0','idle_1','guard_0','guard_1'];

// Remove edge-connected neutral background, preserving enclosed white armor/horse.
function clean(data,w,h) {
  const chroma = process.env.TK_SPRITE_CHROMA === 'magenta';
  if (chroma) for (let p=0;p<data.length;p+=4) {
    const magenta = Math.min(data[p],data[p+2]);
    if(magenta>20&&magenta-data[p+1]>20&&data[p+1]<magenta*.7)data[p+3]=0;
  }
  let clearPixels = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 16) clearPixels++;
  const hasTransparency = clearPixels > w * h * 0.1;
  const seen = new Uint8Array(w*h), queue = new Int32Array(w*h); let head=0, tail=0;
  const background = i => {
    const p=i*4, lo=Math.min(data[p],data[p+1],data[p+2]), hi=Math.max(data[p],data[p+1],data[p+2]);
    return data[p+3] < 16 || (!hasTransparency && ((lo > 155 && hi-lo < 38) || (lo > 65 && hi-lo < 22)));
  };
  const add=i=>{if(!seen[i]&&background(i)){seen[i]=1;queue[tail++]=i;}};
  for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
  for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
  while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);data[i*4+3]=0;if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w);}
  // Drop disconnected border fragments from a neighbouring cell or background speckles.
  const visited=new Uint8Array(w*h);const groups=[];
  for(let start=0;start<w*h;start++){
    if(visited[start]||data[start*4+3]<16)continue;
    head=0;tail=0;queue[tail++]=start;visited[start]=1;const members=[];
    while(head<tail){const i=queue[head++];members.push(i);const x=i%w,y=Math.floor(i/w);
      for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!visited[j]&&data[j*4+3]>=16){visited[j]=1;queue[tail++]=j;}}
    groups.push(members);
  }
  const largest=Math.max(...groups.map(g=>g.length));
  for(const g of groups)if(g.length<largest*.003)for(const i of g)data[i*4+3]=0;
  let left=w,top=h,right=0,bottom=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(left>=right||top>=bottom)throw new Error('Empty frame');
  return {box:{left,top,width:right-left+1,height:bottom-top+1},groups:groups.filter(g=>g.length>=largest*.003)};
}
(async()=>{
  const meta=await sharp(source).metadata();const frames=[];
  const raw=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {groups}=clean(raw.data,raw.info.width,raw.info.height);
  const rows = view === 'both' ? 8 : 4;
  const cells=Array.from({length:4 * rows},()=>[]);
  for(const group of groups){
    const cx=group.reduce((sum,i)=>sum+i%raw.info.width,0)/group.length;
    const cy=group.reduce((sum,i)=>sum+Math.floor(i/raw.info.width),0)/group.length;
    const cell=Math.min(rows - 1,Math.floor(cy*rows/raw.info.height))*4+Math.min(3,Math.floor(cx*4/raw.info.width));
    for (const pixel of group) cells[cell].push(pixel);
  }
  for(const pixels of cells){
    if(pixels.length<1000)throw new Error(`Missing or merged sprite: inspect source sheet; cell sizes ${cells.map(c=>c.length).join(',')}`);
    let left=raw.info.width,top=raw.info.height,right=0,bottom=0;
    for(const i of pixels){const x=i%raw.info.width,y=Math.floor(i/raw.info.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    const width=right-left+1,height=bottom-top+1,data=Buffer.alloc(width*height*4);
    for(const i of pixels){const x=i%raw.info.width-left,y=Math.floor(i/raw.info.width)-top;raw.data.copy(data,(y*width+x)*4,i*4,i*4+4);}
    frames.push({data,info:{width,height,channels:4},box:{left:0,top:0,width,height}});
  }
  const scale=Math.min(232/Math.max(...frames.map(f=>f.box.width)),232/Math.max(...frames.map(f=>f.box.height)));
  const dir=path.join(output,id);fs.mkdirSync(dir,{recursive:true});const report=[];
  for(let i=0;i<frames.length;i++){
    const f=frames[i],width=Math.round(f.box.width*scale),height=Math.round(f.box.height*scale);
    const cut=await sharp(f.data,{raw:f.info}).extract(f.box).resize(width,height).png().toBuffer();
    const frameView = view === 'both' ? (i < 16 ? 'front' : 'back') : view;
    const name=`${frameView}_${slots[i % 16]}`;
    await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:cut,left:Math.round((256-width)/2),top:246-height}]).webp({quality:88,alphaQuality:100}).toFile(path.join(dir,`${name}.webp`));
    report.push({name,sourceBox:f.box,width,height});
  }
  fs.writeFileSync(path.join(dir,`${view}-packing.json`),JSON.stringify({source,scale,frames:report},null,2));
  console.log(`${id} ${view}: ${frames.length} frames packed; input ${meta.width}x${meta.height}, alpha=${meta.hasAlpha}`);
})().catch(e=>{console.error(e);process.exitCode=1;});
