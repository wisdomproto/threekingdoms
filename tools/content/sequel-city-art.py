"""Build explicit masonry/paving reference guides for enclosed city paintings."""
import json, runpy
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'packages/data/json'
build=runpy.run_path(str(Path(__file__).with_name('sequel-cities.py')))['build_city']
entries=json.loads(Path(__file__).with_name('sequel-scenes.json').read_text(encoding='utf-8'))
colors={'.':'#d9cf9d','g':'#a8c686','P':'#b7afa0','#':'#505564','G':'#c57842','F':'#c1a681','V':'#ccad7c','~':'#6a9ec9','b':'#b08a5a','m':'#8c7a5e','f':'#4a6e46'}
jobs=[]
for e in entries:
    if e['terrain'] not in ('siege','riverfort'): continue
    slug=e['slug']; sid=f'{e["number"]:02}-{slug}'
    stage=json.loads((DATA/f'stages/{sid}.json').read_text(encoding='utf-8'))
    data=json.loads((DATA/f'maps/{slug}.json').read_text(encoding='utf-8'))
    grid=[list(row) for row in data['tiles']]
    bounds=build(grid,stage['units'],slug)
    data['tiles']=[''.join(row) for row in grid]
    data['tileLegend'].update({'P':'plain','G':'gate','V':'village'})
    for path,value in ((DATA/f'maps/{slug}.json',data),(DATA/f'stages/{sid}.json',stage)):
        path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    im=Image.new('RGB',(1120,800)); draw=ImageDraw.Draw(im)
    for y,row in enumerate(grid):
        for x,ch in enumerate(row): draw.rectangle((x*40,y*40,x*40+39,y*40+39),fill=colors[ch])
    ref=ROOT/f'docs/art/sequel-v1/city-layout-{slug}.png'; im.save(ref)
    prompt=f'''Paint a FINISHED enclosed walled Chinese city battle map for {e['name']}, Three Kingdoms period, 7:5 landscape. First reference is exact 28-column 20-row layout. Second is only painted art style. The city rectangle runs x={bounds['left']}..{bounds['right']}, y={bounds['top']}..{bounds['bottom']} inclusive, zero-indexed. Dark slate regions are continuous thick stone ramparts, MUST form an enclosed four-sided rectangle interrupted only at orange GATE openings (west rows9,10; south columns21,22). Show crenellations, corner watchtowers and red timber gate architecture, viewed from a steep overhead tactical RPG angle. Within slate building footprints near northeast place roofed Han administrative buildings; do not expand onto adjacent walkable cells. Grey-beige city interior MUST be paved flagstones, weathered grey stone road slabs, compacted ochre courtyards, tidy urban streets, NO grass lawn inside the walls. Tan F tile is a walkable stone command courtyard, no roof covering it. Village tan tiles are open residential courtyards, low buildings can only sit on nearby dark blocked footprints. Outside city is natural ochre earth and short grass, noticeably distinct from urban stone paving. Blue water remains water, brown bridges have flat visible traversable deck precisely matching guide. Keep every gate and walkable road unobstructed. Fine details, warm readable sunlight, polished illustrated SD strategy RPG art, no characters, labels, UI, grid. All walls/buildings must fit exactly in blocked dark cells; do not paint roofs over the pathways. The walls must look like a real fortified CITY, not detached stone strips. Native maximum detail.'''
    # Geometry is rendered by ObjectLayer. Paint only its ground substrate so
    # visible walls cannot disagree with movement or block the open entrances.
    prompt=f'''Create the GROUND LAYER ONLY for an original illustrated Three Kingdoms tactical RPG city battlefield, {e['name']}, landscape 7:5. Reference 1 is a 28 by 20 tile placement guide, reference 2 gives painterly ground style only. A huge OPEN paved stone city plaza covers rectangle x={bounds['left']}..{bounds['right']}, y={bounds['top']}..{bounds['bottom']}, zero-based. Replace ALL grey AND slate guide cells with subtly weathered grey-beige flat flagstone paving. Absolutely NO walls, buildings, roofs, trees, pillars, gatehouses or raised objects: the game renders those separately over this ground. At the western entrance rows8..11 and southern entrance columns17..20 extend broad flat stone approach paths into surrounding tan packed-earth field. At least 85 percent of the city interior should be usable empty grey paving, small irregular stone slabs with quiet texture, NO lawn inside. Blue guide cells are water with soft shorelines at the EXACT guide positions, brown bridge guide cells are water underneath because a separate traversable bridge object will be placed there. Green outside regions only flat moss/grass, no trees. Steep overhead orthographic game map, same scale everywhere, warm daylight, subtle wear and stone seams, clear contrast between city flagstones and exterior ochre dirt, no labels, grids, text or UI. This is the flat background beneath all architecture and characters. Native high resolution.'''
    jobs.append({'id':'city-ground-'+slug,'kind':'city','name':slug,'prompt':prompt,'references':[str(ref),str(ROOT/'apps/web/public/assets/maps/zhuojun.webp')]})
(ROOT/'docs/art/sequel-v1/city-jobs.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Prepared {len(jobs)} closed cities with stone-paved interiors.')
