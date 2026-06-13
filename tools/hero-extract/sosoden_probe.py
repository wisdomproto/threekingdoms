# -*- coding: utf-8 -*-
"""조조전 Ls12 (.E5) 포맷이 기존 LS11 추출기로 풀리는지 검증."""
import struct, sys, os, glob
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
    return bytes(out), (br.byte_pos - offset)

def probe(path):
    d = open(path, 'rb').read()
    magic = d[:4]
    dic = d[0x10:0x110]
    pos = 0x110; chunks = []
    while pos + 12 <= len(d):
        comp, orig, off = struct.unpack_from('>III', d, pos)
        if comp == 0: break
        chunks.append((comp, orig, off)); pos += 12
    name = os.path.basename(path)
    if not chunks:
        return f'{name:14s} magic={magic} chunks=0 (다른 레이아웃?)'
    ok = 0; total_out = 0; err = None
    for comp, orig, off in chunks:
        try:
            if comp == orig:
                ok += 1; total_out += orig; continue
            out, used = decompress_chunk(d, off, orig, dic)
            if len(out) == orig and abs(used - comp) <= 2:
                ok += 1; total_out += orig
            else:
                err = f'size mismatch out={len(out)}/{orig} used={used}/{comp}'; break
        except Exception as e:
            err = f'{type(e).__name__}: {e}'; break
    status = 'OK' if ok == len(chunks) else f'FAIL@{ok}/{len(chunks)} ({err})'
    return f'{name:14s} magic={magic} chunks={len(chunks):4d} out={total_out:8d}B  {status}'

if __name__ == '__main__':
    files = sorted(glob.glob(os.path.join(GAME, '*.E5')))
    print(f'== {len(files)} E5 파일 검증 ==')
    okc = 0
    for f in files:
        r = probe(f)
        print(r)
        if r.strip().endswith('OK'): okc += 1
    print(f'\n결과: {okc}/{len(files)} E5 파일 완전 해제 성공')
