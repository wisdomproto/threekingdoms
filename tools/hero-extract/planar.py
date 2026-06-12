# -*- coding: utf-8 -*-
"""4-플레인 시퀀셜 EGA 렌더링"""
import os, sys
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\png_test'

EGA = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),
       (85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]

def planar_seq(data, w, h, planes=4):
    img = Image.new('RGB', (w, h))
    px = img.load()
    psize = (w // 8) * h
    for y in range(h):
        for x in range(w):
            bi = y * (w // 8) + x // 8
            bit = 7 - (x % 8)
            v = 0
            for p in range(planes):
                idx = p * psize + bi
                if idx < len(data):
                    v |= ((data[idx] >> bit) & 1) << p
            px[x, y] = EGA[v]
    return img

jobs = [
    ('MMAPBGPL_R3.000.bin', 256, 255),
    ('HEXBCHP_R3.000.bin', 256, 224),
    ('HEXBCHR_R3.040.bin', 64, 64),
    ('HEXBCHR_R3.000.bin', 64, 64),
    ('HEXBCHR_R3.040.bin', 32, 128),
    ('HEXZCHR_R3.005.bin', 32, 64),     # 1024 = 4x256 = 32px(4B)x64
    ('HEXICHR_R3.010.bin', 96, 96),     # 4608 = 4x1152 = 96px(12B)x96
    ('SSCCHR2_R3.000.bin', 64, 80),     # 2560 = 4x640 = 64px(8B)x80
    ('HEXZCHP_R3.001.bin', 256, 174),   # 22272 = 4x5568 ≈ 256px x174
    ('HEXGRP_R3.000.bin', 128, 228),    # 14592 = 4x3648 = 128px(16B)x228
    ('MARK_R3.000.bin', 88, 331),       # 14584? 비정형 — 추정 88px(11B)x331x4=14564 근사
    ('MMAP_R3.000.bin', 192, 99),       # 9504 = 4x2376 = 192px(24B)x99
    ('PMAP_R3.000.bin', 56, 46),        # 1297? -> 추정
]
for fn, w, h in jobs:
    p = os.path.join(IN, fn)
    if not os.path.exists(p):
        continue
    data = open(p, 'rb').read()
    img = planar_seq(data, w, h)
    sc = 2 if w > 128 else 3
    img.resize((w*sc, h*sc), Image.NEAREST).save(os.path.join(OUT, f'pl_{fn}.{w}x{h}.png'))
    print(f'{fn} -> {w}x{h}')
