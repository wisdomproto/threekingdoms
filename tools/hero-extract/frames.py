# -*- coding: utf-8 -*-
"""블롭을 1bpp 폭 W 스택으로 렌더 → 프레임/플레인 경계 육안 판정"""
import os, sys
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\png_test'

def stack(fn, w):
    data = open(os.path.join(IN, fn), 'rb').read()
    rb = w // 8
    h = len(data) // rb
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            b = data[y * rb + x // 8]
            on = (b >> (7 - x % 8)) & 1
            px[x, y] = (255, 255, 255) if on else (0, 0, 0)
    # 32행마다 빨간 눈금
    dr = ImageDraw.Draw(img)
    for y in range(0, h, 32):
        dr.line([(0, y), (3, y)], fill=(255, 0, 0))
    sc = 3
    img.resize((w*sc, h*sc), Image.NEAREST).save(os.path.join(OUT, f'stack_{fn}.w{w}.png'))
    print(fn, w, h)

stack('SSCCHR2_R3.000.bin', 32)
stack('HEXBCHR_R3.040.bin', 32)
stack('HEXZCHR_R3.005.bin', 32)
stack('HEXICHR_R3.010.bin', 48)
