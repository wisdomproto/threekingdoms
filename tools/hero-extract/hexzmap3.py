# -*- coding: utf-8 -*-
"""HEXZMAP 비트 분리 렌더: 40x40 세그먼트의 (v>>4)/(v&15)/(v&0x3F)/(v>>6) 플레인"""
import sys, os
from PIL import Image, ImageDraw
import colorsys
sys.stdout.reconfigure(encoding='utf-8')
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\maps'
d = open(r'C:\HERO\HEXZMAP.R3', 'rb').read()

def pal(n):
    cols = []
    for v in range(n):
        h = (v * 0.61803) % 1.0
        r, g, b = colorsys.hsv_to_rgb(h, 0.85, 0.5 + 0.5 * ((v % 2)))
        cols.append((int(r*255), int(g*255), int(b*255)))
    return cols
P16 = pal(16)
P64 = pal(64)
P4 = [(0,0,0), (255,80,80), (80,255,80), (80,80,255)]

jobs = []
for seg in (1, 2, 5):
    base = seg * 1600
    for label, fn_, p in [('hi-nib', lambda v: v >> 4, P16), ('lo-nib', lambda v: v & 15, P16),
                          ('lo6', lambda v: v & 0x3F, P64), ('hi2', lambda v: v >> 6, P4)]:
        img = Image.new('RGB', (40, 40))
        px = img.load()
        for y in range(40):
            for x in range(40):
                px[x, y] = p[fn_(d[base + y*40 + x])]
        jobs.append((f's{seg} {label}', img.resize((120, 120), Image.NEAREST)))

cols = 4
cw, ch = 132, 150
rows = (len(jobs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cw, rows * ch), (12, 12, 24))
dr = ImageDraw.Draw(sheet)
for i, (label, im) in enumerate(jobs):
    ox, oy = (i % cols) * cw, (i // cols) * ch + 14
    sheet.paste(im, (ox, oy))
    dr.text((ox, oy - 12), label, fill=(255, 255, 0))
sheet.save(os.path.join(OUT, 'hexzmap_bits.png'))
print('saved', sheet.size)
