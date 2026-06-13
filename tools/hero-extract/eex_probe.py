# -*- coding: utf-8 -*-
"""EEX 이벤트 스크립트 컨테이너 구조 조사."""
import sys, os, struct, glob
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import GAME, gpath

def hexdump(b, n, base=0):
    for i in range(0, min(len(b), n), 16):
        row = b[i:i+16]
        h = row.hex(' ')
        t = ''.join(chr(c) if 32 <= c < 127 else '.' for c in row)
        print(f'{base+i:06X}: {h:<47}  {t}')

def try_decode(b):
    for enc in ('cp949','shift_jis','euc-kr'):
        try:
            t = b.decode(enc)
            printable = sum(1 for c in t if c.isprintable() or c in '\n\r')
            if printable/max(1,len(t)) > 0.8: return enc, t
        except: pass
    return None, None

for fn in ('S_00.EEX','R_00.EEX','S_04.EEX'):
    p = gpath(fn); b = open(p,'rb').read()
    print(f'\n========== {fn} ({len(b)}B) ==========')
    hexdump(b, 64)
    # 헤더 워드 해석 (LE)
    print('  LE words[0:12]:', [struct.unpack_from('<H', b, i)[0] for i in range(4, 28, 2)])
    print('  LE dwords[0:7]:', [struct.unpack_from('<I', b, i)[0] for i in range(4, 32, 4)])
    # 한글/일본어 텍스트 영역 스캔
    print('  --- 텍스트 후보 (cp949 2바이트 시퀀스) ---')
    i = 0; found = 0
    while i < len(b)-1 and found < 8:
        if 0xB0 <= b[i] <= 0xC8 and 0xA1 <= b[i+1] <= 0xFE:
            j = i; s = bytearray()
            while j < len(b)-1 and 0xB0 <= b[j] <= 0xC8 and 0xA1 <= b[j+1] <= 0xFE:
                s += b[j:j+2]; j += 2
            if len(s) >= 4:
                try:
                    print(f'    @{i:5d}: "{bytes(s).decode("cp949")}"'); found += 1
                except: pass
            i = j
        else: i += 1

# 스테이지 파일 분포
print('\n\n========== EEX 파일 분포 ==========')
for pre in ('S_','R_'):
    fs = sorted(glob.glob(os.path.join(GAME, pre+'*.EEX')))
    print(f'{pre}*: {len(fs)}개, 크기 {min(os.path.getsize(f) for f in fs)}~{max(os.path.getsize(f) for f in fs)}B')
