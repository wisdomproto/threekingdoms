# -*- coding: utf-8 -*-
"""chunk4 성장표 구조 실증: 주기·레코드수·클래스 대응."""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import extract, gpath
from extract_sosoden_data import JOBS

b = extract(gpath('DATA.E5'))[4]
print(f'len={len(b)}  인수분해 후보 stride: ' +
      ', '.join(f'{d}({len(b)//d}rec)' for d in (20,27,30,54,60) if len(b)%d==0))

# 1) 60B 주기로 27레코드 — big(0-29)/small(30-59) 분리 확인
print('\n===== stride 60, 27레코드: [big 0-29 평균] [small 30-59] =====')
for r in range(len(b)//60):
    rec = b[r*60:(r+1)*60]
    big = rec[:30]; small = rec[30:]
    bavg = sum(big)/30
    nff = small.count(255)
    print(f'[{r:2d}] big평균={bavg:4.1f} min={min(big)} max={max(big)} | small(ff={nff}): ' +
          ' '.join(f'{x:3d}' for x in small[:18]))

# 2) 30B 주기로 54레코드 — 클래스 대응 가설
print('\n===== stride 30, 54레코드: 짝수/홀수 레코드 성격 =====')
for r in range(len(b)//30):
    rec = b[r*30:(r+1)*30]
    avg = sum(rec)/30; nff = rec.count(255)
    kind = 'BIG ~10' if avg > 6 and nff == 0 else 'small+ff'
    cls = JOBS.get(r, f'#{r}') if r < 53 else '-'
    print(f'[{r:2d}] {kind:9s} avg={avg:4.1f} ff={nff:2d}  (클래스{r}={cls})')
