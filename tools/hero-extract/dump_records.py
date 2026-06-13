# -*- coding: utf-8 -*-
"""앵커 레코드 전체 바이트 덤프 → 필드 매핑용."""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import extract, gpath

outs = extract(gpath('DATA.E5'))

def rec_dump(b, base, stride, count, label):
    print(f'\n===== {label}: stride={stride} =====')
    for r in range(count):
        off = base + r*stride
        rec = b[off:off+stride]
        name = ''
        # 앞쪽 한글 이름 디코드
        for L in range(min(16, stride), 0, -2):
            try:
                t = rec[:L].rstrip(b'\x00').decode('cp949')
                if t and all(ord(c) > 0x80 or c.isascii() for c in t):
                    name = t; break
            except: pass
        vals = ' '.join(f'{x:02x}' for x in rec)
        dec = ' '.join(f'{x:3d}' for x in rec)
        print(f'[{r}] "{name}"')
        print(f'    hex: {vals}')
        print(f'    dec: {dec}')

# 장수 (chunk 0): 조조/하후돈/관우
rec_dump(outs[0], 0, 32, 4, 'chunk0 장수')
# 무기 (chunk 1): 단검/대검 + 의천검(record 23)
rec_dump(outs[1], 0, 25, 3, 'chunk1 무기 앞')
rec_dump(outs[1], 23*25, 25, 2, 'chunk1 무기 의천검부근')
# 책략 (chunk 5): 초열/업화
rec_dump(outs[5], 0, 70, 2, 'chunk5 책략')
# 순수 수치 chunk 2,3,4 — stride 후보 탐색용 앞부분
for ci in (2, 3, 4):
    b = outs[ci]
    print(f'\n===== chunk{ci} ({len(b)}B) 앞 96바이트 =====')
    for i in range(0, 96, 16):
        row = b[i:i+16]
        print(f'  {i:04x}: ' + ' '.join(f'{x:02x}' for x in row) + '   ' + ' '.join(f'{x:3d}' for x in row))
    # 약수로 stride 추정
    print(f'  len={len(b)} 약수후보:', [d for d in (16,18,20,22,24,26,28,30,32,40,48) if len(b)%d==0])
