# -*- coding: utf-8 -*-
"""단일 스프라이트 배치 변형 비교: SSCCHR2 chunk0"""
import os, sys
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\png_test'
data = open(os.path.join(IN, 'SSCCHR2_R3.000.bin'), 'rb').read()  # 2560B = 5 sprites?

EGA = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),
       (85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]

W = H = 32
RB = W // 8      # 4 bytes/row
CELL = RB * H    # 128

def compose(plane_offsets_fn, label, si):
    img = Image.new('RGB', (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            bit = 7 - (x % 8)
            v = 0
            for p in range(4):
                idx = plane_offsets_fn(si, p, y) + (x // 8)
                if idx < len(data):
                    v |= ((data[idx] >> bit) & 1) << p
            px[x, y] = EGA[v]
    return label, img

variants = []
si = 4
# A) sprite-major: 스프라이트당 4플레인 연속
variants.append(compose(lambda s, p, y: (s * 4 + p) * CELL + y * RB, 'A spr-major', si))
# B) plane-major: n=5
n = 5
variants.append(compose(lambda s, p, y: (p * n + s) * CELL + y * RB, 'B plane-major', si))
# C) row-interleave within sprite: [r0p0 r0p1 r0p2 r0p3 r1p0 ...]
variants.append(compose(lambda s, p, y: s * CELL * 4 + (y * 4 + p) * RB, 'C row-int', si))
# D) row-interleave 16bytes? word-int: [r0p0(2B)... ] skip
# E) 2-row interleave: [r0p0 r1p0 r0p1 r1p1 ...]?
variants.append(compose(lambda s, p, y: s * CELL * 4 + ((y // 2) * 8 + p * 2 + (y % 2)) * RB, 'E 2row-int', si))
# F) plane-major but n=4? (마지막 512B는 별개)
n2 = 4
variants.append(compose(lambda s, p, y: (p * n2 + s) * CELL + y * RB, 'F pm n=4', si))

sc = 6
pad = 16
sheet = Image.new('RGB', (len(variants) * (W * sc + pad), H * sc + 24), (30, 30, 50))
dr = ImageDraw.Draw(sheet)
for i, (label, img) in enumerate(variants):
    sheet.paste(img.resize((W * sc, H * sc), Image.NEAREST), (i * (W * sc + pad), 20))
    dr.text((i * (W * sc + pad), 2), label, fill=(255, 255, 0))
sheet.save(os.path.join(OUT, 'probe_ssc0_s4.png'))

# 그리고 si=0..4 를 변형 C 로
rows = []
for s2 in range(5):
    rows.append(compose(lambda s, p, y: s * CELL * 4 + (y * 4 + p) * RB, f'C s{s2}', s2))
sheet2 = Image.new('RGB', (len(rows) * (W * sc + pad), H * sc + 24), (30, 30, 50))
dr = ImageDraw.Draw(sheet2)
for i, (label, img) in enumerate(rows):
    sheet2.paste(img.resize((W * sc, H * sc), Image.NEAREST), (i * (W * sc + pad), 20))
    dr.text((i * (W * sc + pad), 2), label, fill=(255, 255, 0))
sheet2.save(os.path.join(OUT, 'probe_ssc0_rowC.png'))
print('saved')
