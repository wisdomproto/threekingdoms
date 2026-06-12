# -*- coding: utf-8 -*-
"""맵 후보 청크들: 헤더 내 (W,H) 탐색 — header_len h, W=data[i], H=data[j] 가정 전수검사"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'

files = sorted([f for f in os.listdir(IN) if f.startswith(('PMAP', 'SMAP_R3', 'MMAP_R3', 'HEXBMAP'))])
for fn in files:
    d = open(os.path.join(IN, fn), 'rb').read()
    n = len(d)
    hits = []
    # 헤더 길이 0~16 가정, W/H는 헤더 안 어딘가의 u8 또는 u16
    for hl in range(0, 17):
        body = n - hl
        for i in range(0, hl):
            for j in range(0, hl):
                if i == j: continue
                W, H = d[i], d[j]
                if 8 <= W <= 80 and 8 <= H <= 80 and W * H == body:
                    hits.append((hl, i, j, W, H))
    # 헤더 없이 정사각/직사각 인수분해
    facs = [(w, n // w) for w in range(8, 81) if n % w == 0 and 8 <= n // w <= 90]
    print(f'{fn} ({n}b) head={d[:12].hex(" ")}')
    if hits:
        print(f'   header hits: {hits[:6]}')
    if facs:
        print(f'   plain factorizations: {facs}')
