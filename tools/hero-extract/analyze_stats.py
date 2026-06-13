# -*- coding: utf-8 -*-
"""장수 능력치 5바이트 순서 식별 + chunk 2/3/4 병종표 구조 분석."""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import extract, gpath

outs = extract(gpath('DATA.E5'))
g = outs[0]

def name(off):
    r = g[off:off+13]; e = r.find(b'\x00')
    try: return (r if e<0 else r[:e]).decode('cp949')
    except: return '?'

print('===== 장수 능력치 5바이트(18-22) + 주변 — 원형 비교 =====')
print('idx  이름      b18 b19 b20 b21 b22 | b23 b25 b26(직)')
# 무관(무력↑)·문관(지력↑) 원형 인덱스
picks = list(range(0, 24))
for i in picks:
    off = i*32; r = g[off:off+32]
    nm = name(off)
    print(f'{i:3d} {nm:8s}  {r[18]:3d} {r[19]:3d} {r[20]:3d} {r[21]:3d} {r[22]:3d} | {r[23]:3d} {r[25]:3d} {r[26]:3d}')

print('\n전수 통계: 각 열의 min/max/평균 (5개 열 중 무력·지력 후보 판별)')
import statistics
cols = {18:[],19:[],20:[],21:[],22:[],23:[]}
nrec = 0
for off in range(0, len(g), 32):
    r = g[off:off+32]
    if g[off:off+2] == b'\x00\x00': continue
    if not name(off) or name(off)=='?': continue
    for c in cols: cols[c].append(r[c])
    nrec += 1
print(f'유효 장수 {nrec}명')
for c in sorted(cols):
    v = cols[c]
    print(f'  byte{c}: min={min(v)} max={max(v)} mean={statistics.mean(v):.1f} median={statistics.median(v)}')

# chunk 2/3/4 구조
for ci in (2, 3, 4):
    b = outs[ci]
    print(f'\n===== chunk{ci} ({len(b)}B) =====')
    for stride in ([24] if ci==2 else [18,20,30] if ci==4 else [21,23,27,53]):
        if len(b) % stride == 0:
            print(f'  stride {stride}: {len(b)//stride}레코드 (정확히 나눔)')
    # 앞 6레코드를 가장 그럴듯한 stride로
    st = 24 if ci==2 else (20 if ci==4 else 21)
    print(f'  -- stride {st} 가정, 앞 8레코드 --')
    for r in range(8):
        row = b[r*st:(r+1)*st]
        if not row: break
        print(f'   [{r}] ' + ' '.join(f'{x:3d}' for x in row))
