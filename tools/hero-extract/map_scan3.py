# -*- coding: utf-8 -*-
"""(1) SMAP/SMAPBGPL LS11 해제 (2) SNR1D.000 / SMAP 청크를 여러 stride로 2D 렌더"""
import sys, os
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r'C:\project\threekingdoms\tools\hero-extract')
from ls11_extract import ls11_extract

IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\maps'
os.makedirs(OUT, exist_ok=True)

for fn in ['SMAP.R3', 'SMAPBGPL.R3']:
    outs = ls11_extract(r'C:\HERO\\' + fn)
    base = fn.replace('.', '_')
    for i, blob in enumerate(outs):
        open(os.path.join(IN, f'{base}.{i:03d}.bin'), 'wb').write(blob)
    print(f'{fn}: {len(outs)} chunks, sizes={[len(b) for b in outs]}')

# 값→색: 0=검정, 255=흰색, 나머지 해시 색
import colorsys
def color(v):
    if v == 0: return (0, 0, 0)
    if v == 255: return (255, 255, 255)
    h = (v * 0.61803) % 1.0
    r, g, b = colorsys.hsv_to_rgb(h, 0.8, 0.45 + 0.5 * ((v % 4) / 3))
    return (int(r*255), int(g*255), int(b*255))
PAL = [color(v) for v in range(256)]

def render2d(data, stride, label):
    h = len(data) // stride
    img = Image.new('RGB', (stride, h))
    px = img.load()
    for y in range(h):
        for x in range(stride):
            px[x, y] = PAL[data[y * stride + x]]
    sc = max(1, min(6, 600 // stride))
    return label, img.resize((stride * sc, h * sc), Image.NEAREST)

jobs = []
d = open(os.path.join(IN, 'SNR1D_R3.000.bin'), 'rb').read()
for s in (13, 18, 26, 39, 52):
    jobs.append(render2d(d, s, f'SNR1D.000 s{s}'))
for fn in os.listdir(IN):
    if fn.startswith('SMAP_R3') or fn.startswith('SMAPBGPL'):
        d2 = open(os.path.join(IN, fn), 'rb').read()
        for s in (32, 40, 48, 64, 80):
            if len(d2) // s > 8:
                jobs.append(render2d(d2, s, f'{fn} s{s}'))

x_off = 0
maxh = max(im.height for _, im in jobs) + 20
total_w = sum(im.width + 16 for _, im in jobs)
sheet = Image.new('RGB', (total_w, maxh), (15, 15, 30))
dr = ImageDraw.Draw(sheet)
for label, im in jobs:
    sheet.paste(im, (x_off, 16))
    dr.text((x_off, 2), label, fill=(255, 255, 0))
    x_off += im.width + 16
sheet.save(os.path.join(OUT, 'snr_smap_probe.png'))
print('saved snr_smap_probe.png', sheet.size)
