# -*- coding: utf-8 -*-
"""LS11 일괄 해제기 (LSReader 알고리즘 기반, 검증된 포맷)
출처: https://github.com/yinchuan/LSReader (조조전 Ls11 리버싱)
"""
import struct, sys, os
sys.stdout.reconfigure(encoding='utf-8')

HERO = r'C:\HERO'
OUT = r'C:\project\threekingdoms\tools\hero-extract\out\ls11'
os.makedirs(OUT, exist_ok=True)

class BitReader:
    __slots__ = ('d', 'byte_pos', 'bit_queue', 'bit_len')
    def __init__(self, data, start):
        self.d = data
        self.byte_pos = start
        self.bit_queue = 0
        self.bit_len = 0
    def get_bits(self, n):
        ret = 0
        for _ in range(n):
            if self.bit_len == 0:
                self.bit_queue = self.d[self.byte_pos]
                self.byte_pos += 1
                self.bit_len = 8
            ret = (ret << 1) | ((self.bit_queue & 0x80) >> 7)
            self.bit_queue = (self.bit_queue << 1) & 0xFF
            self.bit_len -= 1
        return ret
    def get_code(self):
        code1 = 0
        n = 0
        while True:
            bit = self.get_bits(1)
            code1 = (code1 << 1) | bit
            n += 1
            if bit == 0:
                break
        code2 = self.get_bits(n)
        return code1 + code2

def ls11_decompress_chunk(data, offset, orig_size, dic):
    br = BitReader(data, offset)
    out = bytearray()
    while len(out) < orig_size:
        code = br.get_code()
        if code < 0x100:
            out.append(dic[code])
        else:
            move_back = code - 0x100
            copies = br.get_code() + 3
            for _ in range(copies):
                out.append(out[-move_back])
    return bytes(out)

def ls11_extract(path):
    d = open(path, 'rb').read()
    assert d[:4] in (b'LS11', b'Ls11'), d[:4]
    dic = d[0x10:0x110]
    chunks = []
    pos = 0x110
    while True:
        comp, orig, off = struct.unpack_from('>III', d, pos)
        if comp == 0:
            break
        chunks.append((comp, orig, off))
        pos += 12
    outs = []
    for comp, orig, off in chunks:
        if comp == orig:
            outs.append(d[off:off+orig])
        else:
            outs.append(ls11_decompress_chunk(d, off, orig, dic))
    return outs

if __name__ == '__main__':
    targets = ['SNR0D.R3', 'SNR1D.R3', 'SNR2D.R3', 'SNR3D.R3', 'SNR4D.R3',
               'HEXBCHR.R3', 'HEXBCHP.R3', 'HEXICHR.R3', 'HEXZCHR.R3', 'HEXZCHP.R3',
               'SSCCHR1.R3', 'SSCCHR2.R3', 'HEXGRP.R3', 'MARK.R3', 'MMAP.R3',
               'HEXBMAP.R3', 'PMAP.R3', 'MMAPBGPL.R3', 'IPPAN0M.R3', 'SNR0M.R3']
    for fn in targets:
        p = os.path.join(HERO, fn)
        if not os.path.exists(p):
            continue
        try:
            head = open(p, 'rb').read(4)
            if head not in (b'LS11', b'Ls11'):
                print(f'{fn}: not LS11, skip')
                continue
            outs = ls11_extract(p)
            base = fn.replace('.', '_')
            for i, blob in enumerate(outs):
                open(os.path.join(OUT, f'{base}.{i:03d}.bin'), 'wb').write(blob)
            print(f'{fn}: {len(outs)} chunks OK, sizes={[len(b) for b in outs][:12]}{"..." if len(outs)>12 else ""}')
        except Exception as e:
            print(f'{fn}: FAILED {e}')
