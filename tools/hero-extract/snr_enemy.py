# -*- coding: utf-8 -*-
"""SNR*D 지령 22(적군 배치) 파서 — xycq 문서 기반
지령 22 00 + 최대 30조 x 13B: SA SA(인물코드 u16, FFFF=무효) SB(x) SC(y) SD SE SF SG(복병) SH(AI) SI SI SJ(병종) SK(레벨)
"""
import sys, os, struct
sys.stdout.reconfigure(encoding='utf-8')
IN = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'

data_bak = open(r'C:\HERO\BAKDATA.R3', 'rb').read()
def gen_name(idx):
    if idx >= 384:
        return f'?{idx}'
    off = 0x1100 + idx * 21
    return data_bak[off:off+6].split(b'\x00')[0].decode('cp949', errors='replace')

CLASSES = ['단병','장병','전차','궁병','연노병','발석차','경기병','중기병','친위대','산적',
           '흉적','의적','군악대','맹수부대','무도가대','주술사','이민족','백성','수송대']

def parse_block(d, pos):
    """pos에서 13B 레코드 연속 파싱. 유효 레코드 수 반환"""
    recs = []
    p = pos
    while p + 13 <= len(d) and len(recs) < 30:
        sa = d[p] | (d[p+1] << 8)
        if sa == 0xFFFF:
            p += 13
            recs.append(None)
            continue
        x, y = d[p+2], d[p+3]
        amb, ai = d[p+8], d[p+9]
        cls, lvl = d[p+11], d[p+12]
        if sa >= 384 or cls >= 19 or lvl == 0 or lvl > 70 or x > 60 or y > 60:
            break
        recs.append((sa, x, y, d[p+8], ai, cls, lvl))
        p += 13
    return recs

for fn in sorted(os.listdir(IN)):
    if not fn.startswith('SNR') or '_R3' not in fn:
        continue
    d = open(os.path.join(IN, fn), 'rb').read()
    # '22 00' 패턴 위치마다 파싱 시도
    found = []
    i = 0
    while True:
        i = d.find(b'\x22\x00', i)
        if i < 0:
            break
        recs = parse_block(d, i + 2)
        real = [r for r in recs if r]
        if len(real) >= 4:
            found.append((i, real))
            i += 2 + 13 * len(recs)
        else:
            i += 1
    if not found:
        continue
    print(f'=== {fn} ===')
    for off, real in found:
        xs = [r[1] for r in real]
        ys = [r[2] for r in real]
        print(f' @0x{off:X}: {len(real)} units, x:{min(xs)}-{max(xs)} y:{min(ys)}-{max(ys)}')
        for sa, x, y, amb, ai, cls, lvl in real[:10]:
            print(f'   {gen_name(sa):<6s}({sa:3d}) pos=({x:2d},{y:2d}) 복병={amb} AI={ai} {CLASSES[cls]:<4s} Lv{lvl}')
        if len(real) > 10:
            print(f'   ... +{len(real)-10}')
