# -*- coding: utf-8 -*-
"""맵 데이터 후보 분석: HEXZMAP.R3 (비압축 73600B = 40x40x46?) 바이트 분포 + 렌더링"""
import sys, os
from collections import Counter
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')

d = open(r'C:\HERO\HEXZMAP.R3', 'rb').read()
print(f'HEXZMAP.R3: {len(d)} bytes')
print(f'73600 = 46 x 1600 (40x40): {73600 == 46*1600}')
print(f'     = 23 x 3200 (40x80 or 64x50): {73600 == 23*3200}')

c = Counter(d)
print(f'distinct byte values: {len(c)}')
print('top 20:', c.most_common(20))
print('value range:', min(c), '-', max(c))

# 1600B 단위로 잘라 각 조각의 분포 확인 (첫 3조각)
for k in range(3):
    seg = d[k*1600:(k+1)*1600]
    cc = Counter(seg)
    print(f'seg{k}: distinct={len(cc)} top={cc.most_common(6)}')

# 40x40으로 렌더 (값→색 자동 매핑) 46장 시트
vals = sorted(c.keys())
import colorsys
PAL = {}
for i, v in enumerate(vals):
    h = (i * 0.61803) % 1.0
    r, g, b = colorsys.hsv_to_rgb(h, 0.75, 0.55 + 0.45 * ((i % 3) / 2))
    PAL[v] = (int(r*255), int(g*255), int(b*255))

OUT = r'C:\project\threekingdoms\tools\hero-extract\out\maps'
os.makedirs(OUT, exist_ok=True)
n = len(d) // 1600
cols = 7
rows = (n + cols - 1) // cols
cell = 40 * 4 + 8
sheet = Image.new('RGB', (cols * cell, rows * (cell + 12)), (15, 15, 25))
from PIL import ImageDraw
dr = ImageDraw.Draw(sheet)
for k in range(n):
    img = Image.new('RGB', (40, 40))
    px = img.load()
    seg = d[k*1600:(k+1)*1600]
    for y in range(40):
        for x in range(40):
            px[x, y] = PAL[seg[y*40+x]]
    ox = (k % cols) * cell
    oy = (k // cols) * (cell + 12)
    sheet.paste(img.resize((160, 160), Image.NEAREST), (ox, oy + 12))
    dr.text((ox, oy), f'map {k}', fill=(255, 255, 0))
sheet.save(os.path.join(OUT, 'hexzmap_sheet_40x40.png'))
print(f'rendered {n} maps -> hexzmap_sheet_40x40.png')
