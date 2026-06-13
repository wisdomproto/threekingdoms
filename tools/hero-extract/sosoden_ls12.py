# -*- coding: utf-8 -*-
"""조조전 Ls12 컨테이너 디코더 (재사용 모듈). ls11_extract.py 알고리즘과 동일, 매직만 Ls12."""
import struct, os

class BitReader:
    __slots__ = ('d', 'byte_pos', 'bit_queue', 'bit_len')
    def __init__(self, data, start):
        self.d = data; self.byte_pos = start; self.bit_queue = 0; self.bit_len = 0
    def get_bits(self, n):
        ret = 0
        for _ in range(n):
            if self.bit_len == 0:
                self.bit_queue = self.d[self.byte_pos]; self.byte_pos += 1; self.bit_len = 8
            ret = (ret << 1) | ((self.bit_queue & 0x80) >> 7)
            self.bit_queue = (self.bit_queue << 1) & 0xFF; self.bit_len -= 1
        return ret
    def get_code(self):
        code1 = 0; n = 0
        while True:
            bit = self.get_bits(1); code1 = (code1 << 1) | bit; n += 1
            if bit == 0: break
        return code1 + self.get_bits(n)

def _decompress(data, offset, orig_size, dic):
    br = BitReader(data, offset); out = bytearray()
    while len(out) < orig_size:
        code = br.get_code()
        if code < 0x100:
            out.append(dic[code])
        else:
            move_back = code - 0x100; copies = br.get_code() + 3
            for _ in range(copies): out.append(out[-move_back])
    return bytes(out)

def extract(path):
    """Ls12 파일 → 청크 블롭 리스트. 비-Ls12면 ValueError."""
    d = open(path, 'rb').read()
    if d[:4] != b'Ls12':
        raise ValueError(f'not Ls12: {d[:4]!r}')
    dic = d[0x10:0x110]
    chunks = []; pos = 0x110
    while pos + 12 <= len(d):
        comp, orig, off = struct.unpack_from('>III', d, pos)
        if comp == 0: break
        chunks.append((comp, orig, off)); pos += 12
    outs = []
    for comp, orig, off in chunks:
        outs.append(d[off:off+orig] if comp == orig else _decompress(d, off, orig, dic))
    return outs

GAME = os.path.expanduser(r'~\Downloads\삼국지 조조전')
def gpath(name): return os.path.join(GAME, name)
