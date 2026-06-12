# -*- coding: utf-8 -*-
"""스프라이트 픽셀 포맷 규명: 다양한 해석을 한 장의 시트로"""
import os, sys
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\png_test'

EGA = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),
       (85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]
GRAY2 = [(0,0,0),(85,85,85),(170,170,170),(255,255,255)]

data = open(os.path.join(IN, 'HEXBCHR_R3.040.bin'), 'rb').read()  # 2048B

variants = []

# 1) 2bpp packed (4px/byte): 2048B = 8192px → 64x128 or 128x64 or 32x256
def r_2bpp(w, h):
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            i = y * (w // 4) + x // 4
            if i >= len(data):
                continue
            sh = 6 - 2 * (x % 4)
            v = (data[i] >> sh) & 3
            px[x, y] = GRAY2[v]
    return img
for w, h in [(64, 128), (128, 64), (32, 256)]:
    variants.append((f'2bpp {w}x{h}', r_2bpp(w, h)))

# 2) 4bpp packed, 다른 폭
def r_4bpp(w, h):
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            i = y * (w // 2) + x // 2
            if i >= len(data):
                continue
            b = data[i]
            v = (b >> 4) if x % 2 == 0 else (b & 0xF)
            px[x, y] = EGA[v]
    return img
for w, h in [(32, 128), (16, 256), (128, 32), (48, 85)]:
    variants.append((f'4bpp {w}x{h}', r_4bpp(w, h)))

# 3) 16x16 4bpp packed 타일 × 16개 → 4x4 배열
def r_tiles(tw, th, cols, bpp=4):
    tile_bytes = tw * th * bpp // 8
    n = len(data) // tile_bytes
    rows = (n + cols - 1) // cols
    img = Image.new('RGB', (tw * cols, th * rows))
    px = img.load()
    for t in range(n):
        base = t * tile_bytes
        ox, oy = (t % cols) * tw, (t // cols) * th
        for y in range(th):
            for x in range(tw):
                if bpp == 4:
                    i = base + y * (tw // 2) + x // 2
                    b = data[i]
                    v = (b >> 4) if x % 2 == 0 else (b & 0xF)
                    px[ox + x, oy + y] = EGA[v]
    return img
variants.append(('tile16x16 4bpp', r_tiles(16, 16, 4)))
variants.append(('tile32x32 4bpp', r_tiles(32, 32, 2)))
variants.append(('tile16x32 4bpp', r_tiles(16, 32, 4)))

# 4) plane-interleaved by byte (EGA: B0p0 B0p1 B0p2 B0p3 B1p0...)
def r_byteint(w, h):
    img = Image.new('RGB', (w, h))
    px = img.load()
    row_groups = w // 8
    for y in range(h):
        for x in range(w):
            grp = x // 8
            bit = 7 - (x % 8)
            base = (y * row_groups + grp) * 4
            v = 0
            for p in range(4):
                if base + p < len(data):
                    v |= ((data[base + p] >> bit) & 1) << p
            px[x, y] = EGA[v]
    return img
for w, h in [(64, 64), (32, 128)]:
    variants.append((f'byteint {w}x{h}', r_byteint(w, h)))

# 시트 합성
scale = 2
pad = 24
W = max(v[1].width for v in variants) * scale + 200
total_h = sum(v[1].height * scale + pad for v in variants)
sheet = Image.new('RGB', (W, total_h), (20, 20, 40))
from PIL import ImageDraw
dr = ImageDraw.Draw(sheet)
y = 0
for name, img in variants:
    sheet.paste(img.resize((img.width * scale, img.height * scale), Image.NEAREST), (180, y))
    dr.text((4, y + 4), name, fill=(255, 255, 0))
    y += img.height * scale + pad
sheet.save(os.path.join(OUT, 'sheet_HEXBCHR40.png'))
print('saved sheet')
