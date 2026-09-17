"""Install authored city grounds and story sets; register the scene maps."""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'.studio/sequel-art/sources'
ASSETS=ROOT/'apps/web/public/assets'
DATA=ROOT/'packages/data/json'
names={'palace':'성도 · 궁정','sickroom':'백제성 · 등불 아래','south-camp':'남중 · 회담','wuzhang':'오장원 · 군막'}
for name,label in names.items():
    key='scene-sequel-'+name
    im=Image.open(SRC/f'{key}.png').convert('RGB')
    for folder in ('maps','scenes'):
        (ASSETS/folder).mkdir(exist_ok=True)
        im.save(ASSETS/folder/f'{key}.webp','WEBP',quality=94,method=6)
    data={'id':key,'name':label,'width':12,'height':8,'tileLegend':{'.':'plain','#':'wall'},'tiles':['############']*3+['#..........#']*4+['############']}
    (DATA/f'maps/{key}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for p in SRC.glob('city-ground-*.png'):
    Image.open(p).convert('RGB').save(ASSETS/'maps'/f'{p.stem[12:]}.webp','WEBP',quality=94,method=6)
# VN narration-only parts use the same art under the scenes directory.
for p in (ASSETS/'maps').glob('scene-*.webp'):
    target=ASSETS/'scenes'/p.name
    if not target.exists(): target.write_bytes(p.read_bytes())
ts=ROOT/'packages/data/src/sequel.ts'
text=ts.read_text(encoding='utf-8')
for i,name in enumerate(names):
    declaration=f'import sceneSequel{i} from "../json/maps/scene-sequel-{name}.json";'
    if declaration not in text:
        text=declaration+'\n'+text
        text=text.replace('export const sequelMaps = [',f'export const sequelMaps = [sceneSequel{i}, ')
ts.write_text(text,encoding='utf-8')
print('Installed city grounds and four story sets.')
