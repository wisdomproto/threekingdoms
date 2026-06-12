# -*- coding: utf-8 -*-
"""C:\HERO 데이터 파일 1차 스캔 — 아이템 테이블 덤프 + 장수 이름 위치 탐색"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

HERO = r'C:\HERO'

# 1) ITEMDAT.DAT : 16바이트 고정폭 추정
data = open(HERO + r'\ITEMDAT.DAT', 'rb').read()
print(f'--- ITEMDAT.DAT ({len(data)} bytes, {len(data)//16} records of 16) ---')
for i in range(0, len(data), 16):
    rec = data[i:i+16]
    name = rec.split(b'\x00')[0]
    try:
        s = name.decode('cp949')
    except UnicodeDecodeError:
        s = repr(name)
    tail = rec[len(name):].hex()
    print(f'{i//16:3d}: {s:<12s} | tail={tail}')
