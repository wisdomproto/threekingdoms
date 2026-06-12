# -*- coding: utf-8 -*-
"""FACEDAT 얼굴 블롭 압축 방식 추정: LS11 비트스트림 변형들을 시도 (목표 2560B = 64x80 4bpp)"""
import struct, sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r'C:\project\threekingdoms\tools\hero-extract')
from ls11_extract import BitReader

d = open(r'C:\HERO\FACEDAT.R3', 'rb').read()
entries = []
pos = 0
while True:
    off, size = struct.unpack_from('<IH', d, pos)
    if entries and (off != entries[-1][0] + entries[-1][1]):
        break
    entries.append((off, size))
    pos += 6
data_start = pos

def get_blob(i):
    off, size = entries[i]
    return d[data_start+off : data_start+off+size]

TARGETS = [2560, 2592, 5120, 1280]  # 64x80/2, +pal, 64x80(8bpp), 64x40

def try_decode(blob, dic, start, target):
    br = BitReader(blob, start)
    out = bytearray()
    try:
        while len(out) < target:
            code = br.get_code()
            if code < 0x100:
                out.append(dic[code])
            else:
                mb = code - 0x100
                if mb == 0 or mb > len(out):
                    return None
                copies = br.get_code() + 3
                for _ in range(copies):
                    out.append(out[-mb])
        used = br.byte_pos
        return out, used
    except IndexError:
        return None

ident = bytes(range(256))
blob = get_blob(0)
print(f'blob0 size={len(blob)}')
results = []
for target in TARGETS:
    # a) identity dict, stream@0
    r = try_decode(blob, ident, 0, target)
    if r:
        results.append(('ident@0', target, r[1], len(blob)))
    # b) dict=blob[:256], stream@256
    if len(blob) > 256:
        r = try_decode(blob, blob[:256], 256, target)
        if r:
            results.append(('dict256@256', target, r[1], len(blob)))
    # c) dict=blob[:16] 확장? skip — 대신 stream@16, identity
    r = try_decode(blob, ident, 16, target)
    if r:
        results.append(('ident@16', target, r[1], len(blob)))
for r in results:
    mode, target, used, total = r
    print(f'{mode} target={target}: consumed {used}/{total}')
