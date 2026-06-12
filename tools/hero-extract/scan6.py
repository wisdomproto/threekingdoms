# -*- coding: utf-8 -*-
"""그래픽/음악 파일 헤더 분석: FACEDAT.R3, HEX*CHR, MUSIC.R3 등"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

HERO = r'C:\HERO'
files = ['FACEDAT.R3', 'HEXBCHR.R3', 'HEXBCHP.R3', 'HEXICHR.R3', 'HEXZCHR.R3', 'HEXZCHP.R3',
         'SSCCHR1.R3', 'SSCCHR2.R3', 'MUSIC.R3', 'OPMUSIC.R3', 'EDMUSIC.R3', 'PACKGRP.R3',
         'HEXGRP.R3', 'MARK.R3', 'IPPAN.DMP', 'IPPAN0.DMP', 'MMAP.R3', 'HEXBMAP.R3', 'PMAP.R3']

for fn in files:
    d = open(HERO + '\\' + fn, 'rb').read()
    print(f'=== {fn} ({len(d)} bytes) ===')
    for i in range(0, min(0x60, len(d)), 16):
        row = d[i:i+16]
        txt = ''.join(chr(b) if 32 <= b < 127 else '.' for b in row)
        print(f'{i:06X}: {row.hex(" "):<48s} {txt}')
    # u16/u32 LE 후보 헤더 값
    if len(d) >= 8:
        import struct
        u16s = struct.unpack_from('<4H', d, 0)
        u32s = struct.unpack_from('<2I', d, 0)
        print(f'  u16: {u16s}  u32: {u32s}')
    print()
