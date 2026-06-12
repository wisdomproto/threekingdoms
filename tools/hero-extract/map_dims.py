# -*- coding: utf-8 -*-
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
for i in range(59):
    p = os.path.join(IN, f'HEXZMAP_R3.{i:03d}.bin')
    d = open(p, 'rb').read()
    w, h = d[0], d[1]
    ok = (w * h + 2 == len(d))
    w2 = d[0] | (d[1] << 8)
    h2 = d[2] | (d[3] << 8)
    ok2 = (w2 * h2 + 4 == len(d))
    mark = 'OK ' if ok else ('OK2' if ok2 else '-- ')
    print(f'{i:2d}: {len(d):5d}B  u8({w:3d}x{h:3d}){mark}  u16({w2}x{h2})  head={d[:8].hex(" ")}')
