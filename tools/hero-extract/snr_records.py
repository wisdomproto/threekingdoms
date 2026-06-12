# -*- coding: utf-8 -*-
"""SNR1D.000 (1장 시나리오) 선두 헥스덤프 + 장수ID/좌표 패턴 탐색"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
d = open(os.path.join(IN, 'SNR1D_R3.000.bin'), 'rb').read()
print(f'size={len(d)}')
for i in range(0, 0x230, 16):
    row = d[i:i+16]
    print(f'{i:04X}: {row.hex(" ")}')

# 장수 번호(BAKDATA 인덱스) 후보: 동탁군 1장 등장진 = 동탁3 여포4 화웅5 이유6 이숙20 호진21 이각46 곽사47 서영48
# 이 값들이 u8로 모여있는 영역 찾기
targets = {3, 4, 5, 6, 20, 21, 46, 47, 48}
best = []
for i in range(len(d) - 64):
    win = d[i:i+64]
    hit = sum(1 for b in win if b in targets)
    best.append((hit, i))
best.sort(reverse=True)
print('dense windows of Dong Zhuo gen-ids:', best[:5])
i = best[0][1]
for j in range(i, min(i + 0xA0, len(d)), 16):
    row = d[j:j+16]
    print(f'{j:04X}: {row.hex(" ")}')
