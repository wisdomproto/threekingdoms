# -*- coding: utf-8 -*-
"""FACEDAT.R3 인덱스 파싱 + 얼굴 블롭 0/1 구조 분석, MUSIC.R3 트랙 인덱스 확인"""
import struct, sys
sys.stdout.reconfigure(encoding='utf-8')

d = open(r'C:\HERO\FACEDAT.R3', 'rb').read()
print(f'FACEDAT.R3: {len(d)} bytes')

# 인덱스: (u32 offset, u16 size) 반복. 데이터 시작점을 추정해 엔트리 수 계산
entries = []
pos = 0
while True:
    off, size = struct.unpack_from('<IH', d, pos)
    if entries and (off != entries[-1][0] + entries[-1][1]):
        break
    entries.append((off, size))
    pos += 6
    if pos >= len(d):
        break
print(f'index entries: {len(entries)}, index bytes: {pos}')
data_start = pos
last_off, last_size = entries[-1]
print(f'data_start=0x{data_start:X}, last end=0x{data_start + last_off + last_size:X} (file end 0x{len(d):X})')

# 얼굴 0 (유비?) 블롭 앞부분
blob = d[data_start + entries[0][0]: data_start + entries[0][0] + entries[0][1]]
print(f'--- face[0] blob ({len(blob)}b) head ---')
for i in range(0, 0x40, 16):
    print(f'{i:04X}: {blob[i:i+16].hex(" ")}')

# 바이트 값 분포 (압축 여부 힌트)
from collections import Counter
c = Counter(blob)
print('top bytes:', c.most_common(8))

print()
m = open(r'C:\HERO\MUSIC.R3', 'rb').read()
cnt = struct.unpack_from('<H', m, 0)[0]
print(f'MUSIC.R3 track count: {cnt}')
pos = 2
tracks = []
for i in range(cnt):
    off, size = struct.unpack_from('<IH', m, pos)
    tracks.append((off, size))
    pos += 6
data_start = pos
print('tracks:', tracks)
print(f'data_start=0x{data_start:X}, computed end=0x{data_start + tracks[-1][0] + tracks[-1][1]:X}, file={len(m):X}')
t0 = m[data_start + tracks[0][0]: data_start + tracks[0][0] + tracks[0][1]]
print(f'--- track[0] head ({len(t0)}b) ---')
for i in range(0, 0x40, 16):
    print(f'{i:04X}: {t0[i:i+16].hex(" ")}')
