# -*- coding: utf-8 -*-
"""SNR1D 청크0 (계교/북해 등 초반 전투) 구조 정찰 + HEXZMAP.R3 구조 확인"""
import sys, struct
sys.stdout.reconfigure(encoding='utf-8')

p = r'C:\project\threekingdoms\tools\hero-extract\out\ls11\SNR1D_R3.000.bin'
d = open(p, 'rb').read()
print(f'SNR1D.000: {len(d)}b')
for i in range(0, 0x200, 16):
    row = d[i:i+16]
    print(f'{i:04X}: {row.hex(" ")}')

# 장수 번호(0~383) + 좌표처럼 보이는 패턴 탐색: 연속 레코드 후보 크기 추정
# 0x00~0x17F 의 u8 값 분포
from collections import Counter
c = Counter(d[:0x400])
print('byte freq top:', c.most_common(10))

print()
z = open(r'C:\HERO\HEXZMAP.R3', 'rb').read()
print(f'HEXZMAP.R3: {len(z)}b (73600 = 4600x16? 1150x64? 230x320?)')
for i in range(0, 0x80, 16):
    print(f'{i:04X}: {z[i:i+16].hex(" ")}')
# 230B = HEXBMAP 청크 크기와 동일한 단위가 있는지: 73600/230=320, /460=160, /920=80
print('divisors check: 73600/230 =', 73600/230, ' 73600/460 =', 73600/460, ' 73600/4600 =', 73600/4600)
