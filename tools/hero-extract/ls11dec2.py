# -*- coding: utf-8 -*-
"""LS11 변형 전수 탐색 v2 — 코드 순서/바이어스/감마 정의 전부 탐색, 다중 청크 교차 검증"""
import struct, sys
sys.stdout.reconfigure(encoding='utf-8')

class Bits:
    __slots__ = ('d', 'pos')
    def __init__(self, data):
        self.d = data
        self.pos = 0
    def get(self):
        byte = self.d[self.pos >> 3]
        bit = (byte >> (7 - (self.pos & 7))) & 1
        self.pos += 1
        return bit
    def getn(self, n):
        v = 0
        for _ in range(n):
            v = (v << 1) | self.get()
        return v

def make_gamma(lead_one, val_minus):
    target = 1 if lead_one else 0
    def gamma(bits):
        c = 0
        while bits.get() == target:
            c += 1
            if c > 24:
                raise ValueError('overflow')
        v = (1 << c) | bits.getn(c)
        return v - 1 if val_minus else v
    return gamma

def decomp(comp, orig_size, dic, gamma, order, len_bias, off_bias, lit_max=256):
    bits = Bits(comp)
    out = bytearray()
    while len(out) < orig_size:
        code = gamma(bits)
        if code < lit_max:
            out.append(dic[code & 0xFF])
        else:
            second = gamma(bits)
            if order == 'len_off':
                length = code - lit_max + len_bias
                offset = second + off_bias
            else:
                offset = code - lit_max + off_bias
                length = second + len_bias
            if offset <= 0 or offset > len(out):
                raise ValueError('bad offset')
            for _ in range(length):
                out.append(out[-offset])
    return bytes(out), (bits.pos + 7) // 8

def load_ls11(path):
    d = open(path, 'rb').read()
    dic = d[0x10:0x110]
    chunks = []
    pos = 0x110
    while True:
        comp, orig, off = struct.unpack_from('>III', d, pos)
        if comp == 0:
            break
        chunks.append((comp, orig, off))
        pos += 12
    return d, dic, chunks

tests = []
for path, ci in [(r'C:\HERO\SNR0D.R3', 0), (r'C:\HERO\HEXBCHR.R3', 0), (r'C:\HERO\HEXBMAP.R3', 0)]:
    d, dic, chunks = load_ls11(path)
    cs, os_, off = chunks[ci]
    tests.append((path.split('\\')[-1], d[off:off+cs], cs, os_, dic))

results = []
for lead_one in (True, False):
    for val_minus in (True, False):
        g = make_gamma(lead_one, val_minus)
        for order in ('len_off', 'off_len'):
            for len_bias in (1, 2, 3, 4):
                for off_bias in (0, 1, 2):
                    ok_all = True
                    for nm, comp, cs, os_, dic in tests:
                        try:
                            out, used = decomp(comp, os_, dic, g, order, len_bias, off_bias)
                            if abs(used - cs) > 1:
                                ok_all = False
                                break
                        except Exception:
                            ok_all = False
                            break
                    if ok_all:
                        results.append((lead_one, val_minus, order, len_bias, off_bias))
                        print(f'EXACT MATCH: lead_one={lead_one} val_minus={val_minus} order={order} len_bias={len_bias} off_bias={off_bias}')

if not results:
    print('no exact match — relaxing: report near misses on SNR0D only')
    nm, comp, cs, os_, dic = tests[0]
    rows = []
    for lead_one in (True, False):
        for val_minus in (True, False):
            g = make_gamma(lead_one, val_minus)
            for order in ('len_off', 'off_len'):
                for len_bias in (1, 2, 3, 4):
                    for off_bias in (0, 1, 2):
                        try:
                            out, used = decomp(comp, os_, dic, g, order, len_bias, off_bias)
                            rows.append((abs(used-cs), lead_one, val_minus, order, len_bias, off_bias, used))
                        except Exception:
                            pass
    rows.sort()
    for r in rows[:10]:
        print(r)
else:
    # 검증된 변형으로 SNR0D 전체 해제 후 출력
    lead_one, val_minus, order, len_bias, off_bias = results[0]
    g = make_gamma(lead_one, val_minus)
    nm, comp, cs, os_, dic = tests[0]
    out, used = decomp(comp, os_, dic, g, order, len_bias, off_bias)
    print(f'--- SNR0D chunk0 decompressed ({len(out)}b) ---')
    for i in range(0, 0x140, 16):
        row = out[i:i+16]
        txt = row.decode('cp949', errors='replace')
        print(f'{i:04X}: {row.hex(" "):<48s} {txt}')
