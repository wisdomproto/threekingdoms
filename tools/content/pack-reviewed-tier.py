"""Extract reviewed 16-pose alpha atlases; never color-key character pixels."""
import argparse, json, shutil
from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
def main():
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('sprite');p.add_argument('--columns',type=int,choices=[4,8],default=4);p.add_argument('--rear-right',action='store_true',help='Rear atlas poses natively face screen-right');args=p.parse_args()
 source=Path(args.source);im=Image.open(source).convert('RGBA');pixels=np.array(im)
 assert (pixels[:,:,3]==0).mean()>.1,'Expected real transparent alpha'
 labels,n=ndimage.label(pixels[:,:,3]>32);sizes=np.bincount(labels.ravel());sizes[0]=0
 ids=[k for k in range(1,n+1) if sizes[k]>500]
 assert len(ids)==16,f'Expected exactly 16 separate sprites, found {len(ids)}; inspect overlap or extra poses'
 boxes=ndimage.find_objects(labels)
 ids.sort(key=lambda k:(boxes[k-1][0].start+boxes[k-1][0].stop)/2)
 ordered=[]
 for row in range(16//args.columns):ordered+=sorted(ids[row*args.columns:(row+1)*args.columns],key=lambda k:boxes[k-1][1].start)
 cuts=[]
 for k in ordered:
  sy,sx=boxes[k-1];mask=ndimage.binary_dilation(labels==k,iterations=2)
  part=pixels[sy,sx].copy();part[:,:,3]=np.where(mask[sy,sx],part[:,:,3],0)
  cuts.append(Image.fromarray(part))
 scale=min(232/max(c.width for c in cuts),232/max(c.height for c in cuts))
 frames=[]
 for cut in cuts:
  cut=cut.resize((round(cut.width*scale),round(cut.height*scale)),Image.Resampling.LANCZOS)
  frame=Image.new('RGBA',(256,256));frame.paste(cut,((256-cut.width)//2,246-cut.height));frames.append(frame)
 out=ROOT/'apps/web/public/assets/sprites'/args.sprite
 backup=ROOT/'.studio/tier-repair-20260916/originals'/args.sprite
 if out.exists() and not backup.exists():shutil.copytree(out,backup)
 out.mkdir(parents=True,exist_ok=True)
 seq={'idle':[0,0],'move':[1,0,2,0],'attack':[3,3,4,4,5,0],'guard':[6,6],'hit':[7,0],'weak':[7,7]}
 names=[]
 for vi,view in enumerate(['front','back']):
  for pose,indices in seq.items():
   for i,k in enumerate(indices):
    name=f'{view}_{pose}_{i}';frames[vi*8+k].save(out/f'{name}.webp',lossless=True);names.append(name)
   if pose in ['idle','move','attack']:
    name=f'{view}_{pose}';shutil.copy2(out/f'{name}_0.webp',out/f'{name}.webp');names.append(name)
 manifest=ROOT/'apps/web/public/assets/sprites/manifest.json';m=json.loads(manifest.read_text(encoding='utf-8'))
 m[args.sprite]={'poses':names,'source':source.name,'method':'reviewed-alpha-tier-v2','rightFacingPoses':[name for name in names if args.rear_right and name.startswith('back_')]}
 manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 # Only the explicitly regenerated variant leaves quarantine.
 rejected=ROOT/'apps/web/src/pixi/rejectedSpriteVariants.json';bad=json.loads(rejected.read_text(encoding='utf-8'))
 rejected.write_text(json.dumps([x for x in bad if x!=args.sprite],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'sprite':args.sprite,'frames':len(names),'source':source.name,'scale':scale},ensure_ascii=True))
if __name__=='__main__':main()
