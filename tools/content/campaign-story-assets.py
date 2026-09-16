"""Slice generated story atlases into alpha WebP assets; preserve source files."""
import json
from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path('C:/Users/101024/.codex/generated_images/01a09d5e-5c60-7bc3-a7f2-c46d9930ab0f')
MAPS={
 'scene-council-hall':('서주 · 관청','exec-7b2e65cc-cf30-4d29-8636-8fb1a61aab79.png'),
 'scene-refugee-road':('산길 · 피난 행렬','exec-9fd3899d-49a6-425f-9a7e-62ff6a7b9938.png'),
 'scene-ruined-city':('낙양 · 잿더미','exec-30c03be3-d045-47f9-ad1d-3959768e517c.png'),
 'scene-river-landing':('장강 · 나루','exec-dddad1f4-e23e-4ab4-b7cd-a87b1abb980a.png'),
 'scene-command-deck':('수군 · 함상','exec-8127a960-4850-4493-80ba-5764d2e87028.png'),
 'scene-changban-bridge':('장판교','exec-51df392f-b41e-4323-afac-9a193807181a.png'),
}
ATLASES=[
 ('exec-f1e7a80d-1315-419a-a442-f958c2afe9fc.png',[('liubei-official','유비'),('guanyu-official','관우'),('zhangfei-official','장비')]),
 ('exec-d0e09735-823a-4bc3-ba79-519c337171b2.png',[('liubei-leader','유비'),('guanyu-leader','관우'),('zhangfei-leader','장비')]),
 ('exec-836a4ecb-2efb-483f-a926-3006a7972f47.png',[('zhugeliang-robes','제갈량'),('zhouyu-robes','주유'),('xushu-robes','서서')]),
 ('exec-655ba99a-7889-43cb-a189-8bfdabde499d.png',[('chendeng-robes','진등'),('mifang-robes','미방'),('taoqian-robes','도겸'),('huanggai-robes','황개')]),
 ('exec-178dbfdf-cfa9-443d-bcad-7a97421c88eb.png',[('zhaoyun-rescue','조운'),('zhangfei-bridge','장비')]),
]

def main():
 for id,(name,file) in MAPS.items():
  Image.open(SOURCE/file).convert('RGB').save(ROOT/f'apps/web/public/assets/maps/{id}.webp',quality=93)
  rows=['############']*3+['#..........#']*4+['############']
  if id=='scene-changban-bridge':rows=['############']*3+['............']*2+['############']*3
  m=dict(id=id,name=name,width=12,height=8,tileLegend={'.':'plain','#':'wall'},tiles=rows)
  (ROOT/f'packages/data/json/maps/{id}.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 p=ROOT/'apps/web/public/assets/scene-motions/library.json';lib=json.loads(p.read_text(encoding='utf-8'))
 for file,actors in ATLASES:
  im=Image.open(SOURCE/file).convert('RGBA');alpha=np.array(im.getchannel('A'))
  assert alpha.min()==0,'Source must have transparent alpha'
  labels,n=ndimage.label(alpha>128);sizes=np.bincount(labels.ravel());slices=ndimage.find_objects(labels)
  boxes=[slices[k-1] for k in sorted(range(1,n+1),key=lambda k:sizes[k],reverse=True)[:6*len(actors)]]
  boxes.sort(key=lambda b:(b[0].start+b[0].stop)/2)
  # The advisor rows touch at robe/hat tips; segment each atlas cell first.
  if file=='exec-836a4ecb-2efb-483f-a926-3006a7972f47.png':
   boxes=[]
   for top,bottom in [(0,354),(354,688),(688,1024)]:
    for col in range(6):
     left=col*256; region=alpha[top:bottom,left:left+256]>128
     lab,num=ndimage.label(region);size=np.bincount(lab.ravel());size[0]=0
     sy,sx=ndimage.find_objects(lab)[int(size.argmax())-1]
     boxes.append((slice(top+sy.start,top+sy.stop),slice(left+sx.start,left+sx.stop)))
  for row,(actor,name) in enumerate(actors):
   group=sorted(boxes[row*6:row*6+6],key=lambda b:b[1].start)
   out=ROOT/f'apps/web/public/assets/scene-motions/{actor}-v1';out.mkdir(exist_ok=True)
   scale=300/max(s[0].stop-s[0].start for s in group[:5]);frames=[]
   for col,s in enumerate(group):
    cut=im.crop((max(0,s[1].start-2),max(0,s[0].start-2),min(im.width,s[1].stop+2),min(im.height,s[0].stop+2)))
    if actor in ['zhaoyun-rescue','zhangfei-bridge']:
     # A neighboring spear crosses the bounding rectangle; extract only this sprite.
     pixels=np.array(cut);parts,_=ndimage.label(pixels[:,:,3]>128);areas=np.bincount(parts.ravel());areas[0]=0
     keep=ndimage.binary_dilation(parts==areas.argmax(),iterations=2)
     pixels[:,:,3]=np.where(keep,pixels[:,:,3],0);cut=Image.fromarray(pixels)
    cut=cut.resize((round(cut.width*scale),round(cut.height*scale)),Image.Resampling.LANCZOS)
    assert cut.width<=300,(actor,col,'Sprite exceeds canvas')
    canvas=Image.new('RGBA',(300,330));canvas.paste(cut,((300-cut.width)//2,318-cut.height));canvas.save(out/f'{col}.webp','WEBP',lossless=True)
    frames.append(dict(image=f'/assets/scene-motions/{actor}-v1/{col}.webp',col=0,row=0,columns=1,rows=1,ms=160))
   clips={'left.idle':dict(loop=True,frames=[dict(frames[0],ms=800)]),'left.move':dict(loop=True,frames=[frames[1],frames[0],frames[2],frames[0]])}
   specials=actor in ['zhaoyun-rescue','zhangfei-bridge']
   for pose,c in ([('talk',3),('emphasize',4),('salute',5)] if specials else [('talk',3),('salute',4),('rest',5)]):
    if actor=='zhangfei-bridge' and pose=='emphasize':c=3
    clips['left.'+pose]=dict(loop=False,frames=[dict(frames[c],ms=800)])
   lib['actors'][actor]=dict(name=name,clips=clips)
   if actor=='zhaoyun-rescue':lib['actors'][actor]['displayScale']=1.55
 p.write_text(json.dumps(lib,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('Registered six maps and fifteen story appearances.')

if __name__=='__main__':main()
