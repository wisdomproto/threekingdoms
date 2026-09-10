// Reproducible first-pass motion definitions. Images remain separate authored sources.
const fs = require('node:fs');
const base = 'apps/web/public/assets/scene-motions/';
const actors = {};
['liubei','guanyu','zhangfei'].forEach((id,row)=>{
  const f=(image,col,ms=220)=>({image:`/assets/scene-motions/brothers-${image}.png`,col,row,columns:6,rows:3,ms});
  const clips={};
  for(const [dir,offset] of [['down',0],['up',3]]) {
    clips[`${dir}.idle`]={loop:true,frames:[f('directions',offset,800)]};
    clips[`${dir}.move`]={loop:true,frames:[f('directions',offset+1,130),f('directions',offset,80),f('directions',offset+2,130),f('directions',offset,80)]};
  }
  clips['left.idle']={loop:true,frames:[f('gestures',0,800)]};
  clips['left.move']={loop:true,frames:[f('gestures',1,140),f('gestures',0,110),f('gestures',2,140),f('gestures',0,110)]};
  clips['left.talk']={loop:true,frames:[f('gestures',0,400),f('gestures',3,900),f('gestures',0,600)]};
  clips['left.salute']={loop:false,frames:[f('gestures',0,180),f('gestures',4,900)]};
  clips['left.kneel']={loop:false,frames:[f('gestures',4,300),f('gestures',5,1200)]};
  actors[`${id}-foot`]={name:['유비','관우','장비'][row],clips};
});
if(fs.existsSync(base+'library.json'))throw new Error('기존 동작 파일이 있습니다. 편집기를 사용하세요.');
fs.writeFileSync(base+'library.json',JSON.stringify({version:1,actors},null,2)+'\n');
