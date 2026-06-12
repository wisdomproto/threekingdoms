# -*- coding: utf-8 -*-
"""HEXZMAP(전투 맵 58개) 렌더링: 타일 인덱스 → 결정적 색 해시. 샘플 4맵 + 전체 시트"""
import sys, os
import colorsys
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')
IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\maps'
os.makedirs(OUT, exist_ok=True)

NAMES = ['사수관','호로관','광천','신도','거록','청하','계교','북해','서주','소패','태산','하구','팽성','하비',
         '신도1','광릉','연주','고성','영천','여남','강하','남양','박망파','신야1','양양','장판파1','장판파2',
         '강릉','공안','계양','무릉','영릉','장사','부','성도','와구관1','와구관2','가맹관1','가맹관2','정군산',
         '천탕산','한수','양평관','서릉','이릉','맥','남사','신야2','완1','완2','허창1','허창2','진창','장안',
         '낙양','업1','업2','업3']

def tile_color(t):
    if t == 0:
        return (50, 110, 50)
    h = (t * 0.6180339887) % 1.0
    s = 0.5 + 0.4 * ((t >> 4) % 2)
    v = 0.45 + 0.45 * ((t >> 2) % 2)
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (int(r*255), int(g*255), int(b*255))
PAL = [tile_color(t) for t in range(256)]

def render_map(i, scale=6):
    d = open(os.path.join(IN, f'HEXZMAP_R3.{i:03d}.bin'), 'rb').read()
    w, h = d[0], d[1]
    tiles = d[2:2+w*h]
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = PAL[tiles[y*w+x]]
    return img.resize((w*scale, h*scale), Image.NEAREST), w, h

for i in (0, 1, 22, 25):
    img, w, h = render_map(i)
    img.save(os.path.join(OUT, f'zmap{i:02d}_{NAMES[i]}.png'))
    print(f'{i} {NAMES[i]} {w}x{h}')

cols = 8
cell = 86
rows = (58 + cols - 1) // cols
sheet = Image.new('RGB', (cols*cell, rows*(cell+14)), (15, 15, 25))
dr = ImageDraw.Draw(sheet)
for i in range(58):
    img, w, h = render_map(i, scale=1)
    f = min((cell-4)/w, (cell-4)/h)
    img = img.resize((max(1, int(w*f)), max(1, int(h*f))), Image.NEAREST)
    ox, oy = (i % cols) * cell, (i // cols) * (cell + 14)
    sheet.paste(img, (ox, oy + 12))
    dr.text((ox, oy), f'{i} {NAMES[i]}', fill=(255, 255, 0))
sheet.save(os.path.join(OUT, 'all_battle_maps.png'))
print('sheet saved')
