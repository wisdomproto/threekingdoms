# -*- coding: utf-8 -*-
"""조조전 UI 그래픽 정본 렌더 (포맷 해독 완료: 둘 다 8bpp).
  FACE.E5     = 64x80  8bpp 초상 228장
  U_SELECT.E5 = 폭400  8bpp 5청크: 50x50 커서x3 / 400x296 청동문양 장식패널 / 400x128 배경틴트
색은 전용 팔레트 미확정 → SPALET[0](맵 팔레트) 차용 + 구조 확인용 autocontrast 그레이 동시 출력."""
import os, sys
from PIL import Image, ImageOps
sys.stdout.reconfigure(encoding='utf-8')
exec(open(os.path.join(os.path.dirname(__file__), 'sosoden_ui_inspect.py'), encoding='utf-8').read().split("if __name__")[0])

GAME = os.path.expanduser(r'~\Downloads\삼국지 조조전')
OUT = os.path.join(os.path.dirname(__file__), 'out', 'sosoden_ui')
os.makedirs(OUT, exist_ok=True)

def pal(c): return [(c[i*3], c[i*3+1], c[i*3+2]) for i in range(256)]

def render8(data, w, h, p):
    img = Image.new('RGB', (w, h)); px = img.load()
    for y in range(h):
        for x in range(w):
            i = y*w + x; px[x, y] = p[data[i]] if i < len(data) else (0, 0, 0)
    return img

def gray_norm(data, w, h):
    g = Image.new('L', (w, h)); px = g.load()
    for y in range(h):
        for x in range(w):
            i = y*w + x; px[x, y] = data[i] if i < len(data) else 0
    return ImageOps.autocontrast(g, cutoff=1)

if __name__ == '__main__':
    sp = pal(load_chunks(os.path.join(GAME, 'SPALET.E5'))[0])
    # FACE: 첫 24장 몽타주 (8x3, 64x80)
    faces = load_chunks(os.path.join(GAME, 'FACE.E5'))
    grid = Image.new('RGB', (64*8, 80*3), (40, 40, 40))
    for idx in range(24):
        grid.paste(render8(faces[idx], 64, 80, sp), ((idx % 8)*64, (idx//8)*80))
    grid.save(os.path.join(OUT, 'FACE_montage.png'))
    # U_SELECT: 폭400 8bpp
    us = load_chunks(os.path.join(GAME, 'U_SELECT.E5'))
    dims = {3: (400, 296), 4: (400, 128)}
    for k in range(3):
        render8(us[k], 50, 50, sp).save(os.path.join(OUT, f'cursor{k}_50x50.png'))
    for idx, (w, h) in dims.items():
        render8(us[idx], w, h, sp).save(os.path.join(OUT, f'US{idx}_{w}x{h}_spal.png'))
        gray_norm(us[idx], w, h).save(os.path.join(OUT, f'US{idx}_{w}x{h}_norm.png'))
    print('rendered ->', OUT)
