# -*- coding: utf-8 -*-
"""(1) SMAP/SMAPBGPL 헤더 확인 (2) SNR*D 해제 청크에서 맵(2D 타일) 구조 탐지"""
import sys, os, struct
from collections import Counter
sys.stdout.reconfigure(encoding='utf-8')

for fn in ['SMAP.R3', 'SMAPBGPL.R3', 'IPPAN0M.R3']:
    d = open(r'C:\HERO\\' + fn, 'rb').read()
    print(f'=== {fn} ({len(d)}b) magic={d[:4]} ===')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'

def autocorr(data, lo=10, hi=120):
    best = []
    n = len(data)
    for s in range(lo, min(hi, n // 3)):
        same = sum(1 for i in range(0, n - s, 3) if data[i] == data[i + s])
        cnt = len(range(0, n - s, 3))
        best.append((same / cnt, s))
    best.sort(reverse=True)
    return best[:6]

for fn in sorted(os.listdir(IN)):
    if not fn.startswith('SNR') :
        continue
    d = open(os.path.join(IN, fn), 'rb').read()
    c = Counter(d)
    top = c.most_common(4)
    ac = autocorr(d)
    print(f'{fn}: {len(d)}b distinct={len(c)} top={top}')
    print(f'   stride: {[(round(p,3), s) for p, s in ac]}')
