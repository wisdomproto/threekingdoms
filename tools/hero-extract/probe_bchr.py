# -*- coding: utf-8 -*-
"""HEXBCHR 청크 2개를 크게 렌더 (plane-major n=4, 32x32) + 16x16 타일 가설"""
import os, sys
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')
IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\png_test'
EGA = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),
       (85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]

def render(data, si, n, W, H):
    RB = W // 8
    CELL = RB * H
    img = Image.new('RGB', (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            bit = 7 - (x % 8)
            v = 0
            for p in range(4):
                idx = (p * n + si) * CELL + y * RB + x // 8
                if idx < len(data):
                    v |= ((data[idx] >> bit) & 1) << p
            px[x, y] = EGA[v]
    return img

sc = 5
variants = []
for ci in (40, 90):
    data = open(os.path.join(IN, f'HEXBCHR_R3.{ci:03d}.bin'), 'rb').read()
    for (n, W, H) in [(4, 32, 32), (2, 32, 64), (1, 32, 128), (8, 16, 32), (1, 64, 64), (2, 64, 32)]:
        for si in range(min(n, 4)):
            variants.append((f'c{ci} n{n} {W}x{H} s{si}', render(data, si, n, W, H)))

maxw = max(im.width for _, im in variants) * sc
maxh = max(im.height for _, im in variants) * sc
cols = 8
rows = (len(variants) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (maxw + 8), rows * (maxh + 20)), (30, 30, 50))
dr = ImageDraw.Draw(sheet)
for i, (label, im) in enumerate(variants):
    ox = (i % cols) * (maxw + 8)
    oy = (i // cols) * (maxh + 20)
    sheet.paste(im.resize((im.width * sc, im.height * sc), Image.NEAREST), (ox, oy + 16))
    dr.text((ox, oy + 2), label, fill=(255, 255, 0))
sheet.save(os.path.join(OUT, 'probe_bchr.png'))
print('saved', sheet.size)
