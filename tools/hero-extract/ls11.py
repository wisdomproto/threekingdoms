# -*- coding: utf-8 -*-
"""KOEI LS11 압축 해제기 — 변형(variant) 자동 탐색 포함
구조 가설: [16B magic "LS11"][256B dict][12B chunk entries (u32 comp, u32 orig, u32 off) x N, 종료=comp==0][data]
비트스트림: MSB-first, elias-gamma 변형
"""
import struct, sys
sys.stdout.reconfigure(encoding='utf-8')

def dump_chunk_table(path):
    d = open(path, 'rb').read()
    print(f'=== {path} ({len(d)}b) chunk table @0x110 ===')
    for le in (False, True):
        fmt = '<III' if le else '>III'
        pos = 0x110
        rows = []
        while pos + 12 <= len(d):
            a, b, c = struct.unpack_from(fmt, d, pos)
            if a == 0:
                break
            rows.append((a, b, c))
            pos += 12
            if len(rows) > 40:
                break
        print(f'  {"LE" if le else "BE"}: {len(rows)} entries: {rows[:8]}')

for p in [r'C:\HERO\HEXBMAP.R3', r'C:\HERO\SNR0D.R3', r'C:\HERO\MMAP.R3', r'C:\HERO\HEXBCHR.R3']:
    dump_chunk_table(p)
