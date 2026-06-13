# -*- coding: utf-8 -*-
"""데이터 보유 후보 파일 내부 구조 조사: ITEM.E5, DATA.E5 청크 + 비-E5 바이너리."""
import sys, os, glob
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import extract, gpath, GAME

def hexdump(b, n=256, base=0):
    for i in range(0, min(len(b), n), 16):
        row = b[i:i+16]
        h = row.hex(' ')
        t = ''.join(chr(c) if 32 <= c < 127 else '.' for c in row)
        try: k = row.decode('cp949', errors='replace')
        except: k = ''
        print(f'{base+i:06X}: {h:<47}  {t}')

for fn in ('ITEM.E5', 'DATA.E5'):
    print(f'\n========== {fn} ==========')
    outs = extract(gpath(fn))
    print(f'{len(outs)} chunks, sizes={[len(b) for b in outs]}')
    for i, b in enumerate(outs[:4]):
        print(f'\n--- chunk {i} ({len(b)}B) ---')
        hexdump(b, 160)

print('\n\n========== 비-E5 바이너리 후보 ==========')
for fn in ('RMKOEI.BIN', 'SETUP.DAT', 'GEMT.CFG', 'ANKFONT.DAT'):
    p = gpath(fn)
    if not os.path.exists(p): continue
    b = open(p, 'rb').read()
    print(f'\n--- {fn} ({len(b)}B) ---')
    hexdump(b, 96)

print('\n\n========== 전체 파일 크기 (데이터 후보 탐색) ==========')
for p in sorted(glob.glob(os.path.join(GAME, '*'))):
    if os.path.isfile(p):
        sz = os.path.getsize(p)
        ext = os.path.splitext(p)[1].upper()
        if ext in ('.BIN', '.DAT', '.CFG', '.EXE', '.DLL') and sz < 200000:
            print(f'{os.path.basename(p):16s} {sz:8d}')
