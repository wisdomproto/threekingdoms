# -*- coding: utf-8 -*-
"""해제된 LS11 그래픽 → PNG 변환 (레이아웃 후보 비교용)
2048B: 64x64 4bpp / 4608B: 96x96 4bpp? 96x76? / 1024B: 32x64 4bpp / 2560B: 64x80 4bpp
각 블롭을 packed(2px/byte)와 planar(4plane) 두 방식으로 렌더링해 비교.
"""
import os, sys
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\png_test'
os.makedirs(OUT, exist_ok=True)

EGA = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),
       (85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]

def render_packed(data, w, h):
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            i = y * (w // 2) + x // 2
            if i >= len(data):
                return img
            b = data[i]
            v = (b >> 4) if x % 2 == 0 else (b & 0xF)
            px[x, y] = EGA[v]
    return img

def render_planar(data, w, h):
    img = Image.new('RGB', (w, h))
    px = img.load()
    plane_size = w * h // 8
    for y in range(h):
        for x in range(w):
            byte_i = y * (w // 8) + x // 8
            bit = 7 - (x % 8)
            v = 0
            for p in range(4):
                idx = p * plane_size + byte_i
                if idx < len(data):
                    v |= ((data[idx] >> bit) & 1) << p
            px[x, y] = EGA[v]
    return img

def render_planar_rows(data, w, h):
    """행 단위 플레인 인터리브 (EGA 일반적 방식): 각 행마다 4plane 연속"""
    img = Image.new('RGB', (w, h))
    px = img.load()
    row_bytes = w // 8
    for y in range(h):
        base = y * row_bytes * 4
        for x in range(w):
            byte_i = x // 8
            bit = 7 - (x % 8)
            v = 0
            for p in range(4):
                idx = base + p * row_bytes + byte_i
                if idx < len(data):
                    v |= ((data[idx] >> bit) & 1) << p
            px[x, y] = EGA[v]
    return img

jobs = [
    ('HEXBCHR_R3.000.bin', 2048, [(64, 64), (32, 128)]),
    ('HEXBCHR_R3.040.bin', 2048, [(64, 64)]),
    ('HEXICHR_R3.000.bin', 4608, [(96, 96), (48, 192), (64, 144)]),
    ('HEXZCHR_R3.000.bin', 1024, [(32, 64), (64, 32), (16, 128)]),
    ('SSCCHR2_R3.000.bin', 2560, [(64, 80), (80, 64)]),
    ('SSCCHR2_R3.010.bin', 2560, [(64, 80)]),
    ('MARK_R3.000.bin', 14584, [(168, 173)]),
]
for fn, size, dims in jobs:
    p = os.path.join(IN, fn)
    if not os.path.exists(p):
        print('missing', fn)
        continue
    data = open(p, 'rb').read()
    for (w, h) in dims:
        for mode, fnc in [('packed', render_packed), ('planar', render_planar), ('rowpl', render_planar_rows)]:
            img = fnc(data, w, h)
            out = os.path.join(OUT, f'{fn}.{w}x{h}.{mode}.png')
            img.resize((w*3, h*3), Image.NEAREST).save(out)
print('done ->', OUT)
