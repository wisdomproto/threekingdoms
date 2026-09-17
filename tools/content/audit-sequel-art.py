"""Check sequel asset coverage and sprite alpha after packing."""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
ASSETS=ROOT/'apps/web/public/assets'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
library=read(ASSETS/'scene-motions/library.json')['actors']
manifest=read(ASSETS/'sprites/manifest.json')
entries=read(ROOT/'tools/content/sequel-scenes.json')
jobs=read(ROOT/'docs/art/sequel-v1/jobs.json')
names={j['name'] for j in jobs if j['kind']=='character'}|{'황충'}
issues=[];frames=0;parts=0;lines=0
for n in sorted(names):
    actor='sequel-'+n.encode('utf-8').hex()
    if actor not in library:issues.append(f'Missing actor: {n}');continue
    for clip in library[actor]['clips'].values():
        for frame in clip['frames']:
            if not (ROOT/'apps/web/public'/frame['image'].lstrip('/')).exists():issues.append(f'Missing frame: {frame["image"]}')
    for p in (ASSETS/'scene-motions/sequel-v1').glob(actor+'-*.webp'):
        im=Image.open(p).convert('RGBA');a=im.getchannel('A');hist=a.histogram()
        if sum(hist[:16])<im.width*im.height*.15:issues.append(f'Opaque background: {p.name}')
        frames+=1
    if not (ASSETS/'ui/portraits'/f'{n}.webp').exists():issues.append(f'Missing portrait: {n}')
    if n not in manifest:issues.append(f'Missing battle character: {n}')
for e in entries:
    if not (ASSETS/'maps'/f'{e["slug"]}.webp').exists():issues.append('Missing battle map: '+e['slug'])
    stage=read(ROOT/f'packages/data/json/stages/{e["number"]:02}-{e["slug"]}.json')
    for slot in ('intro','outro'):
        scenes=stage['scenario'][slot]
        if not isinstance(scenes,list):scenes=[scenes]
        for scene in scenes:
            parts+=1;lines+=len(scene.get('lines',[]))
            key=scene.get('map',scene.get('bg'))
            folder='maps' if 'map' in scene else 'scenes'
            if key and not (ASSETS/folder/f'{key}.webp').exists():issues.append(f'Missing setting: {key}')
            for unit in scene.get('units',[]):
                if unit['sprite'] not in library:issues.append(f'Missing story sprite: {unit["sprite"]}')
report={'battleMaps':len(entries),'civilianActors':len(names),'civilianFrames':frames,'storyParts':parts,'storyLines':lines,'issues':issues}
out=ROOT/'docs/art/sequel-v1/coverage.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
if issues:raise SystemExit(1)
