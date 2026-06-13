# -*- coding: utf-8 -*-
"""원작 영걸전 사수관 HEXZMAP(56×32) → 지형 분류 렌더 + 우리 포맷 변환 시드.
포맷: [W u8][H u8][tiles W*H][attr W*H/4, 2bit/tile].
타일 인덱스를 직접 라벨링할 표는 없으니, (1) 타일 인덱스 군집 (2) 통행속성 2bit 을
같이 보고 지형을 추론한다. 두 이미지를 저장해 육안 판독."""
import sys
from collections import Counter
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11\HEXZMAP_R3.000.bin'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\maps'
d = open(IN, 'rb').read()
W, H = d[0], d[1]
tiles = d[2:2 + W * H]
attr_bytes = d[2 + W * H:2 + W * H + (W * H + 3) // 4]
print(f'{W}x{H}, tiles={len(tiles)}, attr={len(attr_bytes)}')

# 2bit 속성 풀기
attr = []
for i in range(W * H):
    b = attr_bytes[i >> 2]
    attr.append((b >> ((i & 3) * 2)) & 3)

print('타일 인덱스 상위:', Counter(tiles).most_common(20))
print('속성 분포 (2bit):', Counter(attr))

# 타일 인덱스 → 색 (군집 보기)
import colorsys
def tcol(t):
    if t == 0: return (60, 120, 60)
    h = (t * 0.618) % 1.0
    r, g, bb = colorsys.hsv_to_rgb(h, 0.55, 0.85)
    return (int(r*255), int(g*255), int(bb*255))

S = 14
img = Image.new('RGB', (W*S, H*S))
px = img.load()
for y in range(H):
    for x in range(W):
        c = tcol(tiles[y*W+x])
        for dy in range(S):
            for dx in range(S):
                px[x*S+dx, y*S+dy] = c
img.save(OUT + r'\orig_sishuiguan_tiles.png')

# 속성 맵 (0~3 → 4색): 통행/지형 카테고리 추정
ATTRCOL = {0:(210,200,150), 1:(90,140,90), 2:(120,110,95), 3:(80,90,140)}
img2 = Image.new('RGB', (W*S, H*S))
px2 = img2.load()
for y in range(H):
    for x in range(W):
        c = ATTRCOL[attr[y*W+x]]
        for dy in range(S):
            for dx in range(S):
                px2[x*S+dx, y*S+dy] = c
img2.save(OUT + r'\orig_sishuiguan_attr.png')
print('saved orig_sishuiguan_tiles.png / orig_sishuiguan_attr.png')
