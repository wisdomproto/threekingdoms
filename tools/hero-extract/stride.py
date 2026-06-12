# -*- coding: utf-8 -*-
"""행 스트라이드 자동 검출(자기상관) → 검출된 폭으로 4bpp packed 렌더링"""
import os, sys
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\png_test'

EGA = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),
       (85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]

def best_strides(data, lo=8, hi=512, top=5):
    n = min(len(data), 16384)
    scores = []
    for s in range(lo, min(hi, n // 2)):
        same = 0
        cnt = 0
        for i in range(0, n - s, 7):  # 샘플링
            if data[i] == data[i + s]:
                same += 1
            cnt += 1
        scores.append((same / cnt, s))
    scores.sort(reverse=True)
    # 배수 정리: 최고점과 그 약수/배수 관계 보기 위해 상위 N 반환
    return scores[:top]

def render4(data, w, name):
    h = min(len(data) * 2 // w, 600)
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            i = y * (w // 2) + x // 2
            if i >= len(data):
                break
            b = data[i]
            v = (b >> 4) if x % 2 == 0 else (b & 0xF)
            px[x, y] = EGA[v]
    img.resize((w * 2, h * 2), Image.NEAREST).save(os.path.join(OUT, name))

targets = ['MMAPBGPL_R3.000.bin', 'HEXBCHP_R3.000.bin', 'HEXZCHP_R3.001.bin', 'HEXGRP_R3.000.bin',
           'MARK_R3.000.bin', 'MMAP_R3.000.bin', 'SSCCHR1_R3.000.bin', 'HEXBCHR_R3.040.bin',
           'SSCCHR2_R3.000.bin', 'HEXICHR_R3.010.bin', 'HEXZCHR_R3.005.bin', 'PMAP_R3.000.bin']
for fn in targets:
    p = os.path.join(IN, fn)
    if not os.path.exists(p):
        continue
    data = open(p, 'rb').read()
    tops = best_strides(data)
    print(f'{fn} ({len(data)}b): strides {[(round(sc,3), s) for sc, s in tops]}')
    s = tops[0][1]
    render4(data, s * 2, f'auto_{fn}.w{s*2}.png')
print('done')
