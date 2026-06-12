# -*- coding: utf-8 -*-
"""HEXBMAP 9청크 렌더 (10x23 / 22x24, 16x33 후보 포함)"""
import sys, os
from PIL import Image, ImageDraw
import colorsys
sys.stdout.reconfigure(encoding='utf-8')
IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\maps'

def color(v):
    h = (v * 0.61803) % 1.0
    r, g, b = colorsys.hsv_to_rgb(h, 0.85, 0.45 + 0.5 * ((v % 3) / 2))
    return (int(r*255), int(g*255), int(b*255))
PAL = [color(v) for v in range(256)]

jobs = []
for i in range(9):
    d = open(os.path.join(IN, f'HEXBMAP_R3.{i:03d}.bin'), 'rb').read()
    widths = [10, 23] if len(d) == 230 else [16, 22, 24, 33]
    for w in widths:
        h = len(d) // w
        img = Image.new('RGB', (w, h))
        px = img.load()
        for y in range(h):
            for x in range(w):
                px[x, y] = PAL[d[y*w+x]]
        sc = 8
        jobs.append((f'#{i} w{w}', img.resize((w*sc, h*sc), Image.NEAREST)))

total_w = sum(im.width + 12 for _, im in jobs)
maxh = max(im.height for _, im in jobs) + 18
sheet = Image.new('RGB', (total_w, maxh), (10, 10, 20))
dr = ImageDraw.Draw(sheet)
x = 0
for label, im in jobs:
    sheet.paste(im, (x, 16))
    dr.text((x, 2), label, fill=(255, 255, 0))
    x += im.width + 12
sheet.save(os.path.join(OUT, 'hexbmap_probe.png'))
print('saved', sheet.size)
