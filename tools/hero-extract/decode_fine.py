# -*- coding: utf-8 -*-
"""정밀 라벨: chunk2 범위마스크(58×36) + 책략 70B 데미지/속성 필드."""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import extract, gpath

outs = extract(gpath('DATA.E5'))

# ===== chunk2: 58 × 36B 추정 =====
b2 = outs[2]
print(f'chunk2 len={b2.length if hasattr(b2,"length") else len(b2)}  36으로 나눔? {len(b2)%36==0} ({len(b2)//36}레코드)')
print('===== chunk2 레코드별 비-0xff 값 (앞 16개) =====')
for r in range(min(16, len(b2)//36)):
    rec = b2[r*36:(r+1)*36]
    vals = [(i, rec[i]) for i in range(36) if rec[i] != 0xff]
    nonff = [v for _, v in vals]
    print(f'[{r:2d}] {nonff}')

# ===== 책략 70B 전체 덤프 (대표 책략) =====
s = outs[5]
def kname(r):
    e = r.find(b'\x00');
    try: return (r if e<0 else r[:e]).decode('cp949')
    except: return '?'
print('\n===== 책략 70B 필드 매핑 (속성별 대표) =====')
# 초열(화1)/업화(화2)/화룡(화4)/탁류(수)/낙석(지)/유혹(정신)/둔병(보조)
picks = [0,1,3,5,15,20,23]
for idx in picks:
    r = s[idx*70:(idx+1)*70]
    nm = kname(r[:13])
    print(f'\n[{idx}] {nm}')
    print('  앞 18B:', ' '.join(f'{x:3d}' for x in r[:18]))
    # 비-0 위치만
    nz = [(i, r[i]) for i in range(13, 70) if r[i] != 0]
    print('  비-0(13~):', nz)

# 책략 열별 분산 — 변별 필드 찾기
print('\n===== 책략 73종 열별 분산 =====')
import statistics
for c in range(70):
    col = [s[r*70+c] for r in range(len(s)//70)]
    u = len(set(col))
    if 1 < u <= 40:
        print(f'  c{c:02d}: 고유{u} min={min(col)} max={max(col)} 예={col[:10]}')
