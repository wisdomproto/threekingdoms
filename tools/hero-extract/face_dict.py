# -*- coding: utf-8 -*-
"""(1) MAIN.EXE에서 256바이트 순열(사전) 탐색 → 얼굴 디코딩 시도
(2) 발견된 사전 후보들로 face blob0 디코딩 (목표 1920/2560)"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r'C:\project\threekingdoms\tools\hero-extract')
from ls11_extract import BitReader
import struct

exe = open(r'C:\HERO\MAIN.EXE', 'rb').read()

# 256바이트 순열 윈도우 탐색
cands = []
i = 0
while i < len(exe) - 256:
    window = exe[i:i+256]
    if len(set(window)) == 256:
        cands.append(i)
        i += 256
    else:
        # 중복 바이트 위치로 점프 최적화: 단순 증가
        i += 1
print(f'permutation windows in MAIN.EXE: {[hex(c) for c in cands]}')

d = open(r'C:\HERO\FACEDAT.R3', 'rb').read()
entries = []
pos = 0
while True:
    off, size = struct.unpack_from('<IH', d, pos)
    if entries and (off != entries[-1][0] + entries[-1][1]):
        break
    entries.append((off, size))
    pos += 6
data_start = pos

def get_blob(i):
    off, size = entries[i]
    return d[data_start+off : data_start+off+size]

def try_decode(blob, dic, start, target):
    br = BitReader(blob, start)
    out = bytearray()
    try:
        while len(out) < target:
            code = br.get_code()
            if code < 0x100:
                out.append(dic[code])
            else:
                mb = code - 0x100
                if mb == 0 or mb > len(out):
                    return None
                copies = br.get_code() + 3
                for _ in range(copies):
                    out.append(out[-mb])
        return out, br.byte_pos
    except IndexError:
        return None

blob = get_blob(0)
for c in cands:
    dic = exe[c:c+256]
    for target in (1920, 2560, 5120):
        for start in (0, 2, 4):
            r = try_decode(blob, dic, start, target)
            if r and abs(r[1] - len(blob)) <= 2:
                print(f'MATCH dict@0x{c:X} target={target} start={start} consumed={r[1]}/{len(blob)}')
