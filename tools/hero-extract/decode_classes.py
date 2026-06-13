# -*- coding: utf-8 -*-
"""chunk3 = 53병종 × 27B 병종표 디코드 + chunk4/2 구조 재확인."""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import extract, gpath
from extract_sosoden_data import JOBS

outs = extract(gpath('DATA.E5'))

print('===== chunk3: 53병종 × 27B (JOB.TXT 대응) =====')
b = outs[3]; st = 27
print('  #  병종명         ' + ' '.join(f'c{i:02d}' for i in range(27)))
for r in range(len(b)//st):
    row = b[r*st:(r+1)*st]
    nm = JOBS.get(r, f'#{r}')
    print(f'{r:3d} {nm:10s} ' + ' '.join(f'{x:3d}' for x in row))

print('\n  열별 분산(변별력 있는 열 = 의미 있는 필드):')
import statistics
for c in range(27):
    col = [b[r*st+c] for r in range(len(b)//st)]
    if len(set(col)) > 1:
        print(f'   c{c:02d}: min={min(col)} max={max(col)} 고유값{len(set(col))} 예={col[:8]}')

print('\n\n===== chunk4 구조 (1620B) — 반복 주기 탐색 =====')
b4 = outs[4]
# "큰값(8~12) 30개 + 작은값/ff 블록" 패턴 주기 확인
print('  앞 120바이트:')
for i in range(0, 120, 30):
    print(f'   {i:4d}: ' + ' '.join(f'{x:3d}' for x in b4[i:i+30]))

print('\n===== chunk2 구조 (2088B) — 0xff 제외 의미값 위치 =====')
b2 = outs[2]
runs = []
i = 0
while i < len(b2):
    if b2[i] != 0xff:
        j = i
        while j < len(b2) and b2[j] != 0xff: j += 1
        if j - i >= 2: runs.append((i, list(b2[i:j])))
        i = j
    else: i += 1
print(f'  비-0xff 런 {len(runs)}개 (앞 12개):')
for off, vals in runs[:12]:
    print(f'   @{off:4d}: {vals}')
