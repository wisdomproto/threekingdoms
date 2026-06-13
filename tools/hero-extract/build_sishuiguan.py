# -*- coding: utf-8 -*-
"""원작 영걸전 사수관 HEXZMAP → 우리 맵 JSON (지형 분류 + 사수관 관문 배치).
원작의 개활/숲/산 레이아웃을 따르고, 관문 돌파전 구조(게이트 chokepoint + 적 진영)를 얹는다."""
import sys, json
from collections import Counter
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11\HEXZMAP_R3.000.bin'
d = open(IN, 'rb').read()
W, H = d[0], d[1]
raw = d[2:2 + W * H]

# 타일 인덱스 → 지형 분류 (육안 판독 기반)
#  0 개활(연두)=plain, 172/171 진녹=forest, 54~57 군집=mountain, 8/15 = grass,
#  197/199/212 별도 군집 = waste(거친 땅), 나머지(전환타일) = plain
def classify(t):
    if t == 0: return '.'
    if t in (172, 171): return 'f'
    if t in (54, 55, 56, 57, 58): return 'm'
    if t in (8, 15): return 'g'
    if t in (197, 199, 212): return 'w'
    return '.'

grid = [[classify(raw[y * W + x]) for x in range(W)] for y in range(H)]

# 사수관 관문(돌파 chokepoint): 세로 성벽 + 가운데 문. 적(좌)·아군(우) 구도.
# 숲/개활을 피해 col 18~20 에 성벽, rows 11~20 구간, 문은 rows 14~16.
GCOL = 19
for y in range(9, 23):
    for x in (GCOL - 1, GCOL, GCOL + 1):
        if 0 <= x < W:
            grid[y][x] = '#'
for y in (14, 15, 16):                 # 문 (통로)
    grid[y][GCOL] = 'G'
    grid[y][GCOL - 1] = 'G'
    grid[y][GCOL + 1] = 'G'

# 적 진영(관문 좌측) 막사 + 보급
for y in range(13, 18):
    for x in range(9, 13):
        grid[y][x] = 'B'
grid[20][7] = 'd'   # 보급/보물

# 통계
flat = [c for row in grid for c in row]
total = W * H
print(f'{W}x{H}')
LEG = {'.':'plain','g':'grass','b':'bridge','w':'waste','v':'village','B':'barracks',
       'd':'depot','f':'forest','m':'mountain','F':'fort','G':'gate','r':'river','#':'wall','c':'cliff'}
for ch, n in Counter(flat).most_common():
    print(f'  {LEG[ch]:<10} {n:4d} ({n/total*100:4.1f}%)')

out = {'id': 'sishuiguan', 'name': '사수관', 'width': W, 'height': H,
       'tileLegend': LEG, 'tiles': [''.join(r) for r in grid]}
P = r'C:\project\threekingdoms\packages\data\json\maps\sishuiguan.json'
json.dump(out, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('saved', P)

# 블록아웃 + 프리뷰 렌더
COL = {'.':(217,207,157),'g':(168,198,134),'f':(74,110,70),'m':(140,122,94),
       'w':(199,181,143),'r':(106,158,201),'b':(176,138,90),'#':(110,110,118),
       'c':(90,80,72),'F':(158,142,122),'G':(122,106,82),'v':(224,184,122),
       'B':(207,158,106),'d':(201,168,110)}
C = 22
img = Image.new('RGB', (W * C, H * C))
px = img.load()
for y in range(H):
    for x in range(W):
        c = COL[grid[y][x]]
        for dy in range(C):
            for dx in range(C):
                px[x*C+dx, y*C+dy] = c
img.save(r'C:\project\threekingdoms\docs\art\layout_sishuiguan.png')
print('saved blockout docs/art/layout_sishuiguan.png')
