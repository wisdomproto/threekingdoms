# -*- coding: utf-8 -*-
"""사수관 맵 산(mountain) 과잉 정리 — 상단 산괴 + 관문 주변만 남기고 내부는 평지로.
산→평지는 통행성을 늘리므로 유닛 스폰/패스에 안전. 리뷰 P0 처방."""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

P = r'C:\project\threekingdoms\packages\data\json\maps\sishuiguan.json'
d = json.load(open(P, encoding='utf-8'))
tiles = [list(row) for row in d['tiles']]
H = len(tiles)
W = len(tiles[0])

def near_structure(gx, gy):
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            ny, nx = gy + dy, gx + dx
            if 0 <= ny < H and 0 <= nx < W and tiles[ny][nx] in ('#', 'G'):
                return True
    return False

before = sum(row.count('m') for row in tiles)
for gy in range(H):
    for gx in range(W):
        if tiles[gy][gx] != 'm':
            continue
        # 상단 산괴(북쪽 고개) 3행 + 관문 주변만 산 유지, 나머지는 평지
        keep = gy <= 2 or near_structure(gx, gy)
        if not keep:
            tiles[gy][gx] = '.'

after = sum(row.count('m') for row in tiles)
total = H * W
d['tiles'] = [''.join(row) for row in tiles]
json.dump(d, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

print(f'mountain: {before} ({before/total*100:.1f}%) -> {after} ({after/total*100:.1f}%)')
# 지형 분포 출력
from collections import Counter
c = Counter(ch for row in tiles for ch in row)
leg = d['tileLegend']
for ch, n in c.most_common():
    print(f'  {leg.get(ch,ch):<10} {n:4d} ({n/total*100:4.1f}%)')
