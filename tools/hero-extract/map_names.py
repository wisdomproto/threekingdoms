# -*- coding: utf-8 -*-
"""HEXZMAP 청크58 = 맵 이름 테이블 디코딩 + 맵 크기 매칭 테이블 생성"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'

d = open(os.path.join(IN, 'HEXZMAP_R3.058.bin'), 'rb').read()
print('raw:', d[:60].hex(' '))
# 구분자 추정: 0x0A or 0x00
for sep in (b'\x0a', b'\x00'):
    parts = d.split(sep)
    try:
        names = [p.decode('cp949') for p in parts if p]
        print(f'sep={sep.hex()}: {len(names)} entries')
        print(names)
        break
    except UnicodeDecodeError as e:
        print(f'sep={sep.hex()} failed: {e}')

# 크기 테이블과 결합
dims = []
for i in range(58):
    p = os.path.join(IN, f'HEXZMAP_R3.{i:03d}.bin')
    b = open(p, 'rb').read()
    w, h = b[0], b[1]
    ok = (w * h * 5 // 4 + 2 == len(b))
    dims.append((i, w, h, ok))
print()
print('| # | 맵 이름 | 크기(칸) | 1.25룰 |')
print('|---|---|---|---|')
for i, w, h, ok in dims:
    nm = names[i] if i < len(names) else '?'
    print(f'| {i} | {nm} | {w}×{h} | {"✓" if ok else "✗"} |')
