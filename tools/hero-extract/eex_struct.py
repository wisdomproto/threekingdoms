# -*- coding: utf-8 -*-
"""EEX 헤더 정밀 파싱 — 섹션 포인터 식별 (파일크기·텍스트시작 상관)."""
import sys, os, struct, glob
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import GAME

def first_text_off(b):
    for i in range(len(b)-1):
        if (0xB0 <= b[i] <= 0xC8 and 0xA1 <= b[i+1] <= 0xFE) or \
           (0x81 <= b[i] <= 0x9F and 0x40 <= b[i+1] <= 0xFC):
            # 2바이트 이상 연속이면 텍스트로
            if i+3 < len(b) and (0x81 <= b[i+2] <= 0xFE or 0xB0 <= b[i+2] <= 0xC8):
                return i
    return -1

def words(b, lo, hi):
    return [struct.unpack_from('<H', b, o)[0] for o in range(lo, hi, 2)]

print('파일        크기   txt@   | 헤더 워드[off4..34]')
rows = []
for p in sorted(glob.glob(os.path.join(GAME, '*.EEX'))):
    fn = os.path.basename(p); b = open(p,'rb').read()
    t = first_text_off(b)
    w = words(b, 4, 36)
    rows.append((fn, len(b), t, w, b))
    if fn[:3] in ('S_0','R_0') and fn[3] in '0123':
        print(f'{fn:11s} {len(b):6d} {t:6d} | ' + ' '.join(f'{x:5d}' for x in w))

# 어느 워드가 텍스트 시작과 일치/근접하는가?
print('\n=== 헤더 워드 vs txt@ 상관 (워드값이 txt시작에 가장 근접한 위치) ===')
from collections import Counter
best = Counter()
for fn, sz, t, w, b in rows:
    if t < 0: continue
    diffs = [(abs(w[i]-t), i) for i in range(len(w))]
    diffs.sort()
    best[diffs[0][1]] += 1   # 워드 인덱스(0=off4)
print('  txt@에 가장 근접한 워드 인덱스 빈도(0=offset4):', best.most_common())

# 어느 워드가 파일크기와 일치/근접?
bestsz = Counter()
for fn, sz, t, w, b in rows:
    diffs = sorted((abs(w[i]-sz), i) for i in range(len(w)))
    bestsz[diffs[0][1]] += 1
print('  파일크기에 가장 근접한 워드 인덱스 빈도:', bestsz.most_common())
