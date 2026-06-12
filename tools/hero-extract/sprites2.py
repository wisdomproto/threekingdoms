# -*- coding: utf-8 -*-
"""스프라이트 추출 v2: 청크 = 플레인-메이저 ([p0 of all][p1 of all]...)"""
import os, sys
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\sprites'
os.makedirs(OUT, exist_ok=True)

EGA = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),
       (85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]

def decode_chunk(data, w, h):
    """플레인-메이저: [s0p0 s1p0 ... sNp0][s0p1 ...] ... 반환: N개의 16색 이미지"""
    cell = (w // 8) * h
    total = len(data) // cell          # 전체 1bpp 셀 수
    n = total // 4                     # 스프라이트 수
    if n == 0:
        return []
    out = []
    for si in range(n):
        img = Image.new('RGB', (w, h))
        px = img.load()
        for y in range(h):
            for x in range(w):
                bi = y * (w // 8) + x // 8
                bit = 7 - (x % 8)
                v = 0
                for p in range(4):
                    idx = (p * n + si) * cell + bi
                    if idx < len(data):
                        v |= ((data[idx] >> bit) & 1) << p
                px[x, y] = EGA[v]
        out.append(img)
    return out

def extract_series(prefix, n_chunks, w, h, label):
    sprites = []
    for ci in range(n_chunks):
        p = os.path.join(IN, f'{prefix}.{ci:03d}.bin')
        if not os.path.exists(p):
            break
        data = open(p, 'rb').read()
        for si, img in enumerate(decode_chunk(data, w, h)):
            sprites.append((ci, si, img))
    if not sprites:
        print(f'{label}: none')
        return
    cols = 16
    rows = (len(sprites) + cols - 1) // cols
    cell_w, cell_h = w + 4, h + 14
    sheet = Image.new('RGB', (cols * cell_w, rows * cell_h), (30, 30, 50))
    dr = ImageDraw.Draw(sheet)
    for i, (ci, si, img) in enumerate(sprites):
        ox, oy = (i % cols) * cell_w + 2, (i // cols) * cell_h + 12
        sheet.paste(img, (ox, oy))
        dr.text(((i % cols) * cell_w + 2, (i // cols) * cell_h), f'{ci}.{si}', fill=(255, 255, 0))
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    sheet.save(os.path.join(OUT, f'{label}.png'))
    print(f'{label}: {len(sprites)} sprites')

extract_series('SSCCHR2_R3', 29, 32, 32, 'event_chars_v2')
extract_series('HEXBCHR_R3', 181, 32, 32, 'battle_units_v2')
extract_series('HEXZCHR_R3', 47, 32, 32, 'field_units_v2')
extract_series('HEXICHR_R3', 78, 48, 48, 'large_chars_v2')
