# -*- coding: utf-8 -*-
"""SNR*D.R3 (시나리오 데이터) 구조 분석 + MUSIC 트랙 개별 추출"""
import struct, sys, os
sys.stdout.reconfigure(encoding='utf-8')
HERO = r'C:\HERO'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out'

# SNR 데이터 파일 헤더 확인
for fn in ['SNR0D.R3', 'SNR1D.R3', 'SNR2D.R3', 'SNR3D.R3', 'SNR4D.R3', 'IPPAN0.R3', 'BBKSDAT1.R3', 'MSAVE.R3', 'DECO.DAT']:
    d = open(os.path.join(HERO, fn), 'rb').read()
    print(f'=== {fn} ({len(d)}b) ===')
    for i in range(0, min(0x50, len(d)), 16):
        row = d[i:i+16]
        txt = row.decode('cp949', errors='replace')
        print(f'{i:04X}: {row.hex(" "):<48s} {txt}')
    print()

# MUSIC 트랙 추출 (3개 파일 모두)
names_music = ['이벤트','프롤로그','마을안','무장사망','행군이동','전투패배','개인이동','동료가입','전투승리','에필로그',
               '조조군','조비','적습','출진','성내','여포군','범용','결투','도적','미상']
for fn, prefix in [('MUSIC.R3','music'), ('OPMUSIC.R3','opmusic'), ('EDMUSIC.R3','edmusic')]:
    m = open(os.path.join(HERO, fn), 'rb').read()
    cnt = struct.unpack_from('<H', m, 0)[0]
    pos = 2
    tracks = []
    for i in range(cnt):
        off, size = struct.unpack_from('<IH', m, pos)
        tracks.append((off, size))
        pos += 6
    base = pos
    for i, (off, size) in enumerate(tracks):
        blob = m[base+off:base+off+size]
        nm = names_music[i] if fn == 'MUSIC.R3' and i < len(names_music) else str(i)
        path = os.path.join(OUT, f'{prefix}_{i:02d}_{nm}.bin')
        open(path, 'wb').write(blob)
    print(f'{fn}: {cnt} tracks extracted')
