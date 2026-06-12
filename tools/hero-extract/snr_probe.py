# -*- coding: utf-8 -*-
"""SNR*D 청크에 전투맵(타일 2D 영역)이 내장됐는지: 폭 30~48 렌더로 육안 확인"""
import sys, os
from PIL import Image, ImageDraw
import colorsys
sys.stdout.reconfigure(encoding='utf-8')
IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\maps'

def color(v):
    if v == 0: return (25, 25, 25)
    if v == 0xFF: return (255, 255, 255)
    h = (v * 0.61803) % 1.0
    r, g, b = colorsys.hsv_to_rgb(h, 0.8, 0.4 + 0.55 * (((v >> 3) % 4) / 3))
    return (int(r*255), int(g*255), int(b*255))
PAL = [color(v) for v in range(256)]

jobs = []
for fn in ['SNR0D_R3.000.bin', 'SNR1D_R3.000.bin', 'SNR2D_R3.003.bin']:
    d = open(os.path.join(IN, fn), 'rb').read()
    for w in (30, 36, 40, 44, 48):
        h = len(d) // w
        img = Image.new('RGB', (w, h))
        px = img.load()
        for y in range(h):
            for x in range(w):
                px[x, y] = PAL[d[y*w+x]]
        sc = 3
        jobs.append((f'{fn[:9]} w{w}', img.resize((w*sc, h*sc), Image.NEAREST)))

total_w = sum(im.width + 12 for _, im in jobs)
maxh = max(im.height for _, im in jobs) + 18
sheet = Image.new('RGB', (total_w, maxh), (10, 10, 20))
dr = ImageDraw.Draw(sheet)
x = 0
for label, im in jobs:
    sheet.paste(im, (x, 16))
    dr.text((x, 2), label, fill=(255, 255, 0))
    x += im.width + 12
sheet.save(os.path.join(OUT, 'snr_2d_probe.png'))
print('saved', sheet.size)
