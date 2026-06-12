# -*- coding: utf-8 -*-
"""(1) 372 이후 레코드 계속 파싱 (2) Heditv30/MAIN.EXE 문자열 스캔으로 병종/필드 라벨 찾기"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

data = open(r'C:\HERO\BAKDATA.R3', 'rb').read()

def ok_char(c):
    return ('가' <= c <= '힣') or c in '？ㆍ·'

print('--- records 372+ ---')
n = 372
while True:
    off = 0x1100 + n * 21
    if off + 21 > len(data):
        break
    rec = data[off:off+21]
    raw = rec[0:6].split(b'\x00')[0]
    try:
        nm = raw.decode('cp949')
    except UnicodeDecodeError:
        print(f'[stop] {n} @0x{off:X}: {rec.hex(" ")}')
        break
    if not nm or not all(ok_char(c) for c in nm):
        print(f'[stop] {n} @0x{off:X}: "{nm}" bytes={rec.hex(" ")}')
        break
    idx16 = rec[14] | (rec[15] << 8)
    print(f'{n:3d} {nm:<6s} idx={idx16:3d} b16={rec[16]:3d} 통={rec[17]:3d} 무={rec[18]:3d} 지={rec[19]:3d} look=0x{rec[20]:02X}')
    n += 1

# 그 뒤 영역 hexdump
end = 0x1100 + n * 21
print(f'--- after @0x{end:X} (next 0x180) ---')
for i in range(end, min(end + 0x180, len(data)), 16):
    row = data[i:i+16]
    txt = row.decode('cp949', errors='replace')
    print(f'{i:06X}: {row.hex(" "):<48s} {txt}')

# FF 패턴 시작점 찾기
import re
m = re.search(b'\xff{16}', data)
print(f'first 16xFF at: 0x{m.start():X}' if m else 'no FF block')

# 문자열 스캔 함수: cp949 한글 시퀀스 추출
def strings(path, minlen=2):
    d = open(path, 'rb').read()
    out = []
    i = 0
    cur = bytearray()
    start = 0
    while i < len(d) - 1:
        b1, b2 = d[i], d[i+1]
        if 0xB0 <= b1 <= 0xC8 and 0xA1 <= b2 <= 0xFE:
            if not cur:
                start = i
            cur += d[i:i+2]
            i += 2
        else:
            if len(cur) >= minlen * 2:
                try:
                    out.append((start, cur.decode('cp949')))
                except UnicodeDecodeError:
                    pass
            cur = bytearray()
            i += 1
    return out

print('--- MAIN.EXE 한글 strings (병종/시스템 용어 후보) ---')
seen = set()
for off, s in strings(r'C:\HERO\MAIN.EXE'):
    if s not in seen:
        seen.add(s)
        print(f'0x{off:06X}: {s}')
