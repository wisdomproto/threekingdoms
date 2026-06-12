# -*- coding: utf-8 -*-
"""LS11 비트스트림 디코더 — 변형 자동 탐색으로 올바른 알고리즘 확정"""
import struct, sys
sys.stdout.reconfigure(encoding='utf-8')

class Bits:
    def __init__(self, data):
        self.d = data
        self.pos = 0   # bit position
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

def gamma(bits, lead_one):
    """lead_one=True: 1비트 연속 개수 세고 0에서 멈춤. False: 반대."""
    c = 0
    while bits.get() == (1 if lead_one else 0):
        c += 1
        if c > 24:
            raise ValueError('gamma overflow')
    return ((1 << c) | bits.getn(c)) - 1

def decompress_chunk(comp, orig_size, dic, lead_one, len_bias, off_bias):
    bits = Bits(comp)
    out = bytearray()
    while len(out) < orig_size:
        code = gamma(bits, lead_one)
        if code < 256:
            out.append(dic[code])
        else:
            length = code - 256 + len_bias
            offset = gamma(bits, lead_one) + off_bias
            if offset > len(out):
                raise ValueError(f'bad offset {offset} > {len(out)}')
            for _ in range(length):
                out.append(out[-offset])
    return bytes(out), (bits.pos + 7) // 8

def load_ls11(path):
    d = open(path, 'rb').read()
    assert d[:4] == b'LS11'
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

# 변형 탐색: SNR0D.R3 단일 청크로 테스트
d, dic, chunks = load_ls11(r'C:\HERO\SNR0D.R3')
comp_size, orig_size, off = chunks[0]
comp = d[off:off+comp_size+16]  # 약간 여유
best = None
for lead_one in (True, False):
    for len_bias in (2, 3, 4):
        for off_bias in (0, 1, 2):
            try:
                out, used = decompress_chunk(comp, orig_size, dic, lead_one, len_bias, off_bias)
                score = abs(used - comp_size)
                print(f'lead_one={lead_one} len_bias={len_bias} off_bias={off_bias}: OK used={used}/{comp_size} score={score}')
                if best is None or score < best[0]:
                    best = (score, lead_one, len_bias, off_bias, out)
            except Exception as e:
                pass
if best:
    score, lead_one, len_bias, off_bias, out = best
    print(f'\nBEST: lead_one={lead_one} len_bias={len_bias} off_bias={off_bias} score={score}')
    print('--- decompressed SNR0D chunk0 head ---')
    for i in range(0, 0x100, 16):
        row = out[i:i+16]
        txt = row.decode('cp949', errors='replace')
        print(f'{i:04X}: {row.hex(" "):<48s} {txt}')
else:
    print('all variants failed')
