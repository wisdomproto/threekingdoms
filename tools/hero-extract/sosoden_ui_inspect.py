# -*- coding: utf-8 -*-
"""조조전 UI 그래픽 구조 점검: U_SELECT / IMSG / FACE / 팔레트 청크 크기 + 팔레트 파싱."""
import struct, os, sys
sys.stdout.reconfigure(encoding='utf-8')

GAME = os.path.expanduser(r'~\Downloads\삼국지 조조전')

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

def decompress_chunk(data, offset, orig_size, dic):
    br = BitReader(data, offset); out = bytearray()
    while len(out) < orig_size:
        code = br.get_code()
        if code < 0x100:
            out.append(dic[code])
        else:
            move_back = code - 0x100; copies = br.get_code() + 3
            for _ in range(copies): out.append(out[-move_back])
    return bytes(out)

def load_chunks(path):
    d = open(path, 'rb').read()
    dic = d[0x10:0x110]
    pos = 0x110; meta = []
    while pos + 12 <= len(d):
        comp, orig, off = struct.unpack_from('>III', d, pos)
        if comp == 0: break
        meta.append((comp, orig, off)); pos += 12
    chunks = []
    for comp, orig, off in meta:
        if comp == orig:
            chunks.append(d[off:off+orig])
        else:
            chunks.append(decompress_chunk(d, off, orig, dic))
    return chunks

def report(name):
    path = os.path.join(GAME, name)
    chunks = load_chunks(path)
    sizes = [len(c) for c in chunks]
    from collections import Counter
    cnt = Counter(sizes)
    print(f'\n== {name}: {len(chunks)} chunks ==')
    print(f'  size histogram (size:count, top10): ', dict(sorted(cnt.items(), key=lambda kv:-kv[1])[:10]))
    print(f'  first 8 sizes: {sizes[:8]}')
    return chunks

if __name__ == '__main__':
    for n in ['U_SELECT.E5', 'IMSG.E5', 'FACE.E5']:
        report(n)
    # palette inspect
    for pal in ['SPALET.E5', 'PMPALET.E5']:
        ch = load_chunks(os.path.join(GAME, pal))
        print(f'\n== {pal}: {len(ch)} chunks, sizes {[len(c) for c in ch[:4]]} ==')
        c0 = ch[0]
        print(f'  chunk0 len={len(c0)}  first 24 bytes: {c0[:24].hex()}')
        # 768 = 256*3 (8bit), 48=16*3(EGA). guess VGA 6bit if max<64
        if len(c0) >= 768:
            seg = c0[:768]
            mx = max(seg)
            print(f'  if 256x3: max channel val = {mx} ({"6bit VGA<<2" if mx<64 else "8bit"})')
