# -*- coding: utf-8 -*-
"""BAKDATA.R3 구조 분석: 헤더 / 아이템 영역(0x0~) / 장수 21바이트 레코드(0x1100~)"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

data = open(r'C:\HERO\BAKDATA.R3', 'rb').read()
print(f'size={len(data)} (0x{len(data):X})')

def dump(start, end, width=16):
    for i in range(start, min(end, len(data)), width):
        row = data[i:i+width]
        hx = ' '.join(f'{b:02X}' for b in row)
        try:
            txt = row.decode('cp949', errors='replace')
        except Exception:
            txt = ''
        print(f'{i:06X}: {hx:<48s} {txt}')

print('--- header 0x000-0x080 ---')
dump(0, 0x80)
print('--- 0x0C0-0x140 ---')
dump(0xC0, 0x140)
print('--- before item names: 0xC80-0xD40 ---')
dump(0xC80, 0xD40)
print('--- item name table end: 0xEE0-0xF40 ---')
dump(0xEE0, 0xF40)
print('--- 0xF40-0x1100 (between items and generals) ---')
dump(0xF40, 0x1100)
print('--- generals 21-byte records from 0x1100 (first 30) ---')
for n in range(30):
    off = 0x1100 + n*21
    rec = data[off:off+21]
    name = rec.split(b'\x00')[0]
    try:
        nm = name.decode('cp949')
    except UnicodeDecodeError:
        nm = repr(name)
    rest = rec[len(name):].hex(' ')
    print(f'{n:3d} @0x{off:04X}: {nm:<8s} | {rest}')
print('--- how far do records go? scan for last valid ---')
n = 0
while True:
    off = 0x1100 + n*21
    if off + 21 > len(data):
        break
    n += 1
print(f'max records to EOF from 0x1100: {n}, leftover={len(data)-(0x1100+n*21)}')
print('--- tail of file ---')
dump(len(data)-0x60, len(data))
