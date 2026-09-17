"""Prepare generated atlases without repainting artwork; keep existing approved art."""
import json
import numpy as np
from scipy import ndimage
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'apps/web/public/assets'
WORK = ROOT / '.studio/sequel-art'
PACK_VERSION = 2

def sprite_bounds(cell):
    # A few atlases overflow boots from the previous row. Select the body's
    # connected bounding rectangle, retaining nearby weapon/ribbon components.
    mask=np.asarray(cell.getchannel('A'))>24
    labels,count=ndimage.label(mask)
    if not count:return None
    sizes=np.bincount(labels.ravel());sizes[0]=0
    main=int(sizes.argmax()); parts=ndimage.find_objects(labels)
    sy,sx=parts[main-1]
    left,top,right,bottom=sx.start,sy.start,sx.stop,sy.stop
    for index,part in enumerate(parts,1):
        if part is None or sizes[index]<sizes[main]*0.002:continue
        y,x=part
        # Disconnected scraps above/below the silhouette belong to another cell.
        if y.stop<top or y.start>bottom:continue
        if x.stop<left-12 or x.start>right+12:continue
        left=min(left,x.start);right=max(right,x.stop)
    return (max(0,left-2),max(0,top-2),min(cell.width,right+2),min(cell.height,bottom+2))

def read(p):
    return json.loads(p.read_text(encoding='utf-8'))

def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def save(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, 'WEBP', quality=94, method=4, exact=True)

def main():
    manifest_path = ASSETS/'sprites/manifest.json'
    library_path = ASSETS/'scene-motions/library.json'
    manifest, library = read(manifest_path), read(library_path)
    state_path = WORK/'installed.json'
    state = read(state_path) if state_path.exists() else {}
    jobs = read(ROOT/'docs/art/sequel-v1/jobs.json')
    jobs += [{'id':'map-nanjun','kind':'map','name':'nanjun'}, {'id':'character-황충','kind':'character','name':'황충'}]
    errors=[]
    for job in jobs:
        source=WORK/'sources'/f'{job["id"]}.png'
        prior=state.get(job['id'],{})
        if not source.exists() or (prior.get('mtime')==source.stat().st_mtime_ns and (job['kind']=='map' or prior.get('packVersion')==PACK_VERSION)):
            continue
        im=Image.open(source).convert('RGBA')
        if job['kind']=='map':
            target=ASSETS/'maps'/f'{job["name"]}.webp'
            save(im.convert('RGB'), target)
            state[job['id']]={'mtime':source.stat().st_mtime_ns,'output':str(target.relative_to(ROOT))}
            continue
        alpha=im.getchannel('A')
        clear=sum(alpha.histogram()[:16])/(im.width*im.height)
        if clear<0.15:
            errors.append({'id':job['id'],'reason':'Missing genuine alpha; regenerate rather than erase costume colors'})
            continue
        cells=[]
        for i in range(16):
            x,y=i%4,i//4
            cell=im.crop((round(x*im.width/4),round(y*im.height/4),round((x+1)*im.width/4),round((y+1)*im.height/4)))
            box=sprite_bounds(cell)
            if box is None:
                errors.append({'id':job['id'],'reason':f'Empty cell {i}'})
                break
            cells.append(cell.crop(box))
        if len(cells)!=16: continue
        # Common scale within each costume, never stretch bodies independently.
        def frames(indices):
            scale=min(218/max(cells[i].height for i in indices),238/max(cells[i].width for i in indices))
            out={}
            for i in indices:
                c=cells[i].resize((max(1,round(cells[i].width*scale)),max(1,round(cells[i].height*scale))),Image.Resampling.LANCZOS)
                canvas=Image.new('RGBA',(256,256))
                canvas.alpha_composite(c,((256-c.width)//2,242-c.height))
                out[i]=canvas
            return out
        name=job['name']
        # Stable ASCII identity works with the motion-library schema and URLs.
        actor_id='sequel-'+name.encode('utf-8').hex()
        civilian=frames(list(range(8,16)))
        for i,frame in civilian.items():
            save(frame, ASSETS/'scene-motions/sequel-v1'/f'{actor_id}-{i}.webp')
        def clip(indices,loop=True,ms=220):
            return {'loop':loop,'frames':[{'image':f'/assets/scene-motions/sequel-v1/{actor_id}-{i}.webp','col':0,'row':0,'columns':1,'rows':1,'ms':ms} for i in indices]}
        clips={}
        for direction in ('left','down','up'):
            back=direction=='up'
            for pose,indices in {'idle':[9 if back else 8], 'move':[9] if back else [10,8,11,8], 'talk':[9] if back else [8,12,12,8], 'salute':[13], 'sit':[14], 'kneel':[15]}.items():
                clips[f'{direction}.{pose}']=clip(indices,pose in ('idle','move','talk'))
        library['actors'][actor_id]={'name':name,'clips':clips}
        portrait=ASSETS/'ui/portraits'/f'{name}.webp'
        if not portrait.exists():
            canvas=Image.new('RGBA',(384,384))
            p=cells[0].copy(); p.thumbnail((376,376),Image.Resampling.LANCZOS)
            canvas.alpha_composite(p,((384-p.width)//2,384-p.height))
            save(canvas,portrait)
        if name not in manifest or manifest[name].get('method')=='sequel-atlas-v1':
            battle=frames(list(range(1,8)))
            poses={'front_idle':1,'back_idle':2,'front_attack':3,'back_attack':4,'front_hit':5,'front_move':6,'back_move':7}
            for pose,i in poses.items(): save(battle[i],ASSETS/'sprites'/name/f'{pose}.webp')
            # Slow two-pose idle and quicker stepping use the authored stance/step.
            for view,stand,step in [('front',1,6),('back',2,7)]:
                for pose,indices in [('idle',[stand,step]),('move',[stand,step,stand,step])]:
                    for index,cell in enumerate(indices):
                        key=f'{view}_{pose}_{index}'
                        save(battle[cell],ASSETS/'sprites'/name/f'{key}.webp');poses[key]=cell
            manifest[name]={'poses':list(poses),'source':'','method':'sequel-atlas-v1'}
        state[job['id']]={'mtime':source.stat().st_mtime_ns,'actor':actor_id,'clearFraction':round(clear,3),'packVersion':PACK_VERSION}
    write(manifest_path,manifest); write(library_path,library); write(state_path,state)
    write(WORK/'packing-errors.json',errors)
    print(json.dumps({'installed':len(state),'errors':errors},ensure_ascii=False))

if __name__=='__main__': main()
