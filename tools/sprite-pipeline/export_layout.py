# -*- coding: utf-8 -*-
"""스테이지 지형 격자(JSON) → 색깔 블록 레이아웃 PNG.
Gemini img2img 컨트롤 이미지로 사용: "이 배치 그대로 수묵 톱다운 전장으로 칠해줘".
지형 데이터가 진실의 원천 → 그림은 이걸 따라 그려져 격자와 정합한다.

출력: docs/art/layout_{stage}.png  (+ 범례 텍스트)
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding='utf-8')

REPO = Path(__file__).resolve().parent.parent.parent
MAPS = REPO / 'packages' / 'data' / 'json' / 'maps'
OUT = REPO / 'docs' / 'art'
CELL = 22  # 칸당 px — 56×32 → 1232×704 (Gemini 적정)

# 지형 → 레이아웃 색 (앱 TERRAIN_COLORS와 톤 맞춤, 단 블록은 또렷하게)
COLOR = {
    'plain':    (217, 207, 157), 'grass':  (168, 198, 134), 'forest': (74, 110, 70),
    'mountain': (140, 122, 94),  'waste':  (199, 181, 143), 'river':  (106, 158, 201),
    'bridge':   (176, 138, 90),  'wall':   (110, 110, 118), 'cliff':  (90, 80, 72),
    'fort':     (158, 142, 122), 'gate':   (122, 106, 82),  'village':(224, 184, 122),
    'barracks': (207, 158, 106), 'depot':  (201, 168, 110),
}

def export(stage):
    d = json.load(open(MAPS / f'{stage}.json', encoding='utf-8'))
    leg = d['tileLegend']
    W, H = d['width'], d['height']
    img = Image.new('RGB', (W * CELL, H * CELL), (0, 0, 0))
    dr = ImageDraw.Draw(img)
    used = {}
    for gy, row in enumerate(d['tiles']):
        for gx, ch in enumerate(row):
            tid = leg.get(ch, 'plain')
            col = COLOR.get(tid, (255, 0, 255))
            used[tid] = col
            dr.rectangle([gx*CELL, gy*CELL, gx*CELL+CELL-1, gy*CELL+CELL-1], fill=col)
    out = OUT / f'layout_{stage}.png'
    img.save(out)
    print(f'{stage}: {W}x{H} -> {out.name} ({img.width}x{img.height})')
    print('  범례 (이 색=이 지형):')
    for tid, col in sorted(used.items()):
        print(f'    {tid:<10} rgb{col}')

if __name__ == '__main__':
    stages = sys.argv[1:] or ['sishuiguan']
    for s in stages:
        export(s)
