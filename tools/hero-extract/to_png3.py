# -*- coding: utf-8 -*-
"""1bpp 해석 스위프: 폭 8~128px, HEXBCHR/HEXZCHR/SSCCHR2 샘플"""
import os, sys
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\png_test'

def r_1bpp(data, w):
    row_bytes = w // 8
    h = min(len(data) // row_bytes, 400)
    img = Image.new('L', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            b = data[y * row_bytes + x // 8]
            px[x, y] = 255 if (b >> (7 - x % 8)) & 1 else 0
    return img

for src in ['HEXBCHR_R3.040.bin', 'HEXZCHR_R3.005.bin', 'SSCCHR2_R3.000.bin', 'HEXICHR_R3.010.bin']:
    data = open(os.path.join(IN, src), 'rb').read()
    variants = []
    for w in [8, 16, 24, 32, 40, 48, 64, 80, 96, 128]:
        variants.append((f'{w}px', r_1bpp(data, w)))
    scale = 2
    pad = 20
    W = max(v[1].width for v in variants) * scale + 120
    H = sum(v[1].height * scale + pad for v in variants)
    sheet = Image.new('RGB', (W, H), (20, 20, 60))
    dr = ImageDraw.Draw(sheet)
    y = 0
    for name, img in variants:
        sheet.paste(img.convert('RGB').resize((img.width*scale, img.height*scale), Image.NEAREST), (100, y))
        dr.text((4, y+4), name, fill=(255, 255, 0))
        y += img.height * scale + pad
    sheet.save(os.path.join(OUT, f'bpp1_{src}.png'))
    print('saved', src)
