# -*- coding: utf-8 -*-
"""전 맵 갤러리: PMAP 23 + SMAP 12 (+MMAP 4) — 청크별 최적 폭 자동 검출 렌더"""
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

def best_stride(data, lo, hi):
    best = (0, lo)
    for s in range(lo, hi + 1):
        same = sum(1 for i in range(0, len(data)-s, 2) if data[i] == data[i+s])
        cnt = len(range(0, len(data)-s, 2))
        if same/cnt > best[0]:
            best = (same/cnt, s)
    return best[1]

def render(d, w):
    h = len(d) // w
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = PAL[d[y*w+x]]
    return img

cells = []
for series, count, lo, hi in [('PMAP_R3', 23, 26, 44), ('SMAP_R3', 12, 26, 44), ('MMAP_R3', 4, 60, 130)]:
    for i in range(count):
        p = os.path.join(IN, f'{series}.{i:03d}.bin')
        if not os.path.exists(p):
            continue
        d = open(p, 'rb').read()
        w = best_stride(d, lo, hi)
        cells.append((f'{series[0]}{i} w{w}', render(d, w)))
        print(f'{series}.{i}: {len(d)}b -> w={w} h={len(d)//w}')

sc = 4
cols = 8
cw = max(im.width for _, im in cells) * sc + 10
ch = max(im.height for _, im in cells) * sc + 18
rows = (len(cells) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cw, rows * ch), (12, 12, 24))
dr = ImageDraw.Draw(sheet)
for i, (label, im) in enumerate(cells):
    ox, oy = (i % cols) * cw, (i // cols) * ch
    sheet.paste(im.resize((im.width * sc, im.height * sc), Image.NEAREST), (ox, oy + 16))
    dr.text((ox, oy + 2), label, fill=(255, 255, 0))
sheet.save(os.path.join(OUT, 'all_maps_gallery.png'))
print('saved all_maps_gallery.png', sheet.size)
