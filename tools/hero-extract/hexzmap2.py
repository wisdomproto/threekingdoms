# -*- coding: utf-8 -*-
"""HEXZMAP.R3: u16 셀(타일+속성) 가설 — 짝/홀 바이트 분리 렌더 + 비트플레인 해석"""
import sys, os
from PIL import Image, ImageDraw
import colorsys
sys.stdout.reconfigure(encoding='utf-8')
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\maps'
d = open(r'C:\HERO\HEXZMAP.R3', 'rb').read()

def color(v):
    h = (v * 0.61803) % 1.0
    r, g, b = colorsys.hsv_to_rgb(h, 0.85, 0.4 + 0.55 * ((v % 4) / 3))
    return (int(r*255), int(g*255), int(b*255))
PAL = [color(v) for v in range(256)]

jobs = []
# 가설1: 3200B = 40x40 u16 → 짝/홀 분리
for seg in range(2):
    base = seg * 3200
    for part, off in [('lo', 0), ('hi', 1)]:
        img = Image.new('RGB', (40, 40))
        px = img.load()
        for y in range(40):
            for x in range(40):
                px[x, y] = PAL[d[base + (y*40+x)*2 + off]]
        jobs.append((f'u16 seg{seg} {part}', img.resize((160, 160), Image.NEAREST)))
# 가설2: 1bpp 그래픽 (8px/byte) 폭 16바이트(128px)
img = Image.new('L', (128, 200))
px = img.load()
for y in range(200):
    for x in range(128):
        b = d[y*16 + x//8]
        px[x, y] = 255 if (b >> (7 - x%8)) & 1 else 0
jobs.append(('1bpp w128', img.convert('RGB').resize((256, 400), Image.NEAREST)))
# 가설3: 4bpp packed 폭 40px(20B)
img = Image.new('RGB', (40, 200))
px = img.load()
EGA = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),
       (85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]
for y in range(200):
    for x in range(40):
        b = d[y*20 + x//2]
        v = (b >> 4) if x % 2 == 0 else (b & 0xF)
        px[x, y] = EGA[v]
jobs.append(('4bpp w40', img.resize((120, 600), Image.NEAREST)))

total_w = sum(im.width + 12 for _, im in jobs)
maxh = max(im.height for _, im in jobs) + 18
sheet = Image.new('RGB', (total_w, maxh), (10, 10, 20))
dr = ImageDraw.Draw(sheet)
x = 0
for label, im in jobs:
    sheet.paste(im, (x, 16))
    dr.text((x, 2), label, fill=(255, 255, 0))
    x += im.width + 12
sheet.save(os.path.join(OUT, 'hexzmap_probe2.png'))
print('saved', sheet.size)
