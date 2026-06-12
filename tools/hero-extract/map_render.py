# -*- coding: utf-8 -*-
"""MMAP/PMAP/SMAP/HEXBMAP 후보 폭 렌더링 — 타일맵 시각 확인"""
import sys, os
from PIL import Image, ImageDraw
import colorsys
sys.stdout.reconfigure(encoding='utf-8')
IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\maps'

def color(v):
    h = (v * 0.61803) % 1.0
    s = 0.65 if v < 0x80 else 0.95
    val = 0.35 + 0.6 * (((v >> 2) % 4) / 3)
    r, g, b = colorsys.hsv_to_rgb(h, s, val)
    return (int(r*255), int(g*255), int(b*255))
PAL = [color(v) for v in range(256)]

def autocorr_best(data, lo=16, hi=160):
    best = (0, lo)
    for s in range(lo, min(hi, len(data)//3)):
        same = sum(1 for i in range(0, len(data)-s, 3) if data[i] == data[i+s])
        cnt = len(range(0, len(data)-s, 3))
        if same/cnt > best[0]:
            best = (same/cnt, s)
    return best

jobs = []
for fn, widths in [
    ('MMAP_R3.000.bin', None), ('MMAP_R3.001.bin', None), ('MMAP_R3.002.bin', None), ('MMAP_R3.003.bin', None),
    ('PMAP_R3.000.bin', [32, 36, 38]), ('SMAP_R3.000.bin', [32, 36, 38]),
    ('HEXBMAP_R3.000.bin', [10, 23]), ('HEXBMAP_R3.005.bin', [16, 22, 24, 33]),
]:
    d = open(os.path.join(IN, fn), 'rb').read()
    if widths is None:
        sc, s = autocorr_best(d)
        widths = [s]
        print(f'{fn}: best stride {s} (score {sc:.3f})')
    for w in widths:
        h = len(d) // w
        img = Image.new('RGB', (w, h))
        px = img.load()
        for y in range(h):
            for x in range(w):
                px[x, y] = PAL[d[y*w+x]]
        scale = max(2, min(8, 320 // w))
        jobs.append((f'{fn} w{w}', img.resize((w*scale, h*scale), Image.NEAREST)))

total_w = sum(im.width + 14 for _, im in jobs)
maxh = max(im.height for _, im in jobs) + 18
sheet = Image.new('RGB', (total_w, maxh), (12, 12, 24))
dr = ImageDraw.Draw(sheet)
x = 0
for label, im in jobs:
    sheet.paste(im, (x, 16))
    dr.text((x, 2), label, fill=(255, 255, 0))
    x += im.width + 14
sheet.save(os.path.join(OUT, 'map_candidates.png'))
print('saved map_candidates.png', sheet.size)
