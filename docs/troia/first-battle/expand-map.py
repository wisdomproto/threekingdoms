"""Reproducible Troy battlefield layout; artwork is generated from its chunk references."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FILE = ROOT / 'packages/data/json/troia/first-battle.json'
data = json.loads(FILE.read_text(encoding='utf-8-sig'))
grid = [['.' for _ in range(40)] for _ in range(24)]
for y in range(24):
    coast = 6 + (1 if y < 5 or y > 18 else 0)
    for x in range(coast):
        grid[y][x] = 'r'
    for x in range(15, 40):
        grid[y][x] = 'g'

def ellipse(cx, cy, rx, ry, tile):
    for y in range(24):
        for x in range(40):
            if ((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1 and grid[y][x] != 'r':
                grid[y][x] = tile

# Shore headlands and inland ground relief frame two broad traversable routes.
ellipse(12, 2, 5, 3, 'm')
ellipse(12, 1, 3, 1.8, '#')
ellipse(12, 22, 5, 3, 'm')
ellipse(12, 23, 3, 1.8, '#')
ellipse(23, 5, 4, 3, 'f')
ellipse(23, 20, 5, 2.7, 'f')
ellipse(34, 3, 5, 2, 'm')
ellipse(38, 3, 2, 2, '#')
ellipse(33, 17, 3.5, 2.5, 'm')
ellipse(39, 21, 3, 3, '#')
# A generous eastbound road bends north onto the beacon clearing.
for x in range(9, 40):
    center = 12 if x < 26 else max(8, 12-(x-26)//2)
    for y in range(center-2, center+3):
        grid[y][x] = '.'
ellipse(34, 8, 3.5, 3, '.')

data['map'].update(width=40, height=24, tileLegend={
    'r':'river', '.':'plain', 'g':'grass', 'f':'forest', 'm':'mountain', '#':'cliff',
}, tiles=[''.join(row) for row in grid])
stage = data['stage']
stage['turnLimit'] = 20
stage['camera'] = {'zoom':1.6, 'focus':[12,12]}
positions = {
    'achilles':(10,12), 'patroclus':(9,13), 'greek-spear':(9,11), 'greek-archer':(8,14),
    'trojan-spear-1':(17,11), 'trojan-spear-2':(18,14), 'trojan-archer-1':(23,12),
    'diores':(30,9), 'trojan-spear-3':(32,7), 'trojan-archer-2':(34,10),
}
for unit in stage['units']:
    unit['x'],unit['y'] = positions[unit['commanderId']]
    if unit['commanderId'] in ('trojan-spear-1', 'trojan-spear-2'):
        unit['troops'] = 70
stage['objectives'][0].update(x=34,y=8)
stage['decorations'] = [
    {'cell':[7,11],'kind':'supply_cart'},
    {'cell':[8,16],'kind':'campfire'},
    {'cell':[34,8],'kind':'campfire','scale':1.8},
    {'cell':[35,7],'kind':'signal_flag'},
    {'cell':[38,8],'kind':'supply_cart'},
]
for dialogue in stage['dialogue']:
    if dialogue['id']=='last-turn': dialogue['trigger']['n']=20
    if dialogue['id']=='troia-start':
        dialogue['lines'][0]['text']='동쪽 해안길을 따라 봉화대(34, 8)로 향하자. 화면을 끌어 전장을 살펴봐. 나란히 붙어 협공하고, 다친 동료는 책략과 붕대로 돌봐 줘.'
    if dialogue['id']=='civilians': dialogue['trigger']['n']=4
data['tactics'].update(fallback=[32,8],exit=[39,8])
FILE.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Troy: 40x24, 20 turns, landing (10,12), beacon (34,8), camera 1.6')
