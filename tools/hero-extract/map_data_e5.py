# -*- coding: utf-8 -*-
"""DATA.E5 각 청크의 레코드 구조 역산: CP949 한글 문자열 위치로 stride 추정."""
import sys, os, re
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import extract, gpath

def find_kr_strings(b):
    """CP949 완성형 한글 시퀀스의 (offset, 디코드문자열) 추출."""
    res = []
    i = 0; n = len(b)
    while i < n - 1:
        hi = b[i]
        if 0xB0 <= hi <= 0xC8 and i + 1 < n and 0xA1 <= b[i+1] <= 0xFE:
            j = i; s = bytearray()
            while j < n - 1 and 0xB0 <= b[j] <= 0xC8 and 0xA1 <= b[j+1] <= 0xFE:
                s += b[j:j+2]; j += 2
            try:
                txt = bytes(s).decode('cp949')
                if len(txt) >= 1:
                    res.append((i, txt))
            except: pass
            i = j
        else:
            i += 1
    return res

outs = extract(gpath('DATA.E5'))
for ci, b in enumerate(outs):
    print(f'\n========== chunk {ci} ({len(b)}B) ==========')
    strs = find_kr_strings(b)
    print(f'한글 문자열 {len(strs)}개')
    if not strs:
        print('  (없음 — 순수 수치 테이블)')
        continue
    # 첫 20개 + 인접 offset 간격(stride 추정)
    for k in range(min(24, len(strs))):
        off, txt = strs[k]
        diff = off - strs[k-1][0] if k > 0 else 0
        print(f'  {off:5d} (+{diff:3d})  "{txt}"')
    # stride 빈도
    diffs = [strs[k][0]-strs[k-1][0] for k in range(1, len(strs))]
    from collections import Counter
    print('  stride 빈도:', Counter(diffs).most_common(6))
