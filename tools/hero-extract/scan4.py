# -*- coding: utf-8 -*-
"""BAKDATA.R3 전체 테이블 덤프: 장수(21B 레코드) + 아이템(16B) + 미상 8바이트 필드 johab 검증"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

data = open(r'C:\HERO\BAKDATA.R3', 'rb').read()

# johab 가설 검증: 이름을 johab으로 인코딩해 8바이트 필드와 비교
print('--- johab test ---')
for off, nm in [(0x1100, '유비'), (0x1115, '관우'), (0x112A, '장비')]:
    field = data[off+6:off+14]
    jo = nm.encode('johab')
    print(f'{nm}: field={field.hex(" ")} johab={jo.hex(" ")}')

# 장수 테이블: 이름이 유효한 cp949로 디코딩되는 동안 계속
print('--- generals ---')
n = 0
generals = []
while True:
    off = 0x1100 + n * 21
    if off + 21 > len(data):
        break
    rec = data[off:off+21]
    raw_name = rec[0:6].split(b'\x00')[0]
    try:
        nm = raw_name.decode('cp949')
    except UnicodeDecodeError:
        print(f'[stop] record {n} @0x{off:X}: name bytes {raw_name.hex(" ")} not cp949')
        break
    if not nm or not all('가' <= c <= '힣' for c in nm):
        print(f'[stop] record {n} @0x{off:X}: name "{nm}" not hangul, bytes={rec.hex(" ")}')
        break
    idx16 = rec[14] | (rec[15] << 8)
    face = rec[16]
    lead, war, intel = rec[17], rec[18], rec[19]
    look = rec[20]
    generals.append((n, nm, idx16, face, lead, war, intel, look))
    n += 1

print(f'count={len(generals)}')
print(f'{"no":>3} {"이름":<6} {"idx":>5} {"face":>4} {"통솔":>4} {"무력":>4} {"지력":>4} {"look":>4}')
for g in generals:
    print(f'{g[0]:3d} {g[1]:<6s} {g[2]:5d} {g[3]:4d} {g[4]:4d} {g[5]:4d} {g[6]:4d} 0x{g[7]:02X}')

# 장수 테이블 이후 영역
end = 0x1100 + len(generals) * 21
print(f'--- after generals table @0x{end:X} ---')
for i in range(end, min(end + 0x100, len(data)), 16):
    row = data[i:i+16]
    print(f'{i:06X}: {row.hex(" ")}')

# 아이템 테이블 (16B × 63 @0xD00): 이름 + 숨김 3바이트
print('--- items with hidden bytes ---')
for k in range(63):
    off = 0xD00 + k * 16
    rec = data[off:off+16]
    nm = rec[0:13].split(b'\x00')[0].decode('cp949', errors='replace')
    b13, b14, b15 = rec[13], rec[14], rec[15]
    print(f'{k:3d} {nm:<14s} b13={b13:3d}(0x{b13:02X}) b14={b14:3d} b15={b15:3d}')
