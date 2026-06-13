# -*- coding: utf-8 -*-
"""EEX → 이벤트 블록 구조 추출: 헤더 dword 테이블로 블록 분절, 제목+대사+원시명령.
opcode 의미는 미해독 — 명령부는 hex로 보존. opcode 빈도 조사 동봉."""
import sys, os, struct, glob, json
from collections import Counter
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import GAME

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..',
                                   'packages', 'data', 'json', 'sosoden', 'events'))
os.makedirs(OUT, exist_ok=True)

def block_table(b):
    """offset 10부터 증가하는 dword 오프셋 테이블."""
    offs = []
    p = 10
    while p + 4 <= len(b):
        v = struct.unpack_from('<I', b, p)[0]
        if offs and (v <= offs[-1] or v >= len(b)): break
        if v < 4 or v >= len(b):
            if not offs: p += 4; continue
            break
        offs.append(v); p += 4
    return offs

def text_runs(b, lo, hi):
    out = []; i = lo
    while i < hi - 1:
        c, d = b[i], b[i+1]
        if (0xB0 <= c <= 0xC8 and 0xA1 <= d <= 0xFE) or (0x81 <= c <= 0x9F and 0x40 <= d <= 0xFC):
            j = i; s = bytearray()
            while j < hi-1:
                cc, dd = b[j], b[j+1]
                if (0xB0<=cc<=0xC8 and 0xA1<=dd<=0xFE) or (0x81<=cc<=0x9F and 0x40<=dd<=0xFC):
                    s += b[j:j+2]; j += 2
                elif 0x20 <= cc < 0x7f: s.append(cc); j += 1
                else: break
            for enc in ('cp949','shift_jis'):
                try:
                    t = bytes(s).decode(enc)
                    if sum(1 for ch in t if not ch.isascii()) >= 1:
                        out.append(t.strip()); break
                except: pass
            i = max(j, i+1)
        else: i += 1
    return out

op_freq = Counter()
index = []
for p in sorted(glob.glob(os.path.join(GAME, '*.EEX'))):
    fn = os.path.basename(p); b = open(p, 'rb').read()
    tbl = block_table(b)
    bounds = tbl + [len(b)]
    blocks = []
    for k in range(len(tbl)):
        lo, hi = bounds[k], bounds[k+1]
        seg = b[lo:hi]
        lines = text_runs(b, lo, hi)
        # 명령 워드 빈도 (제목 앞 8B 헤더 제외, 텍스트 제외 구간 근사)
        for o in range(lo, min(hi-1, lo+200), 2):
            w = struct.unpack_from('<H', b, o)[0]
            if w < 256: op_freq[w] += 1
        blocks.append({
            'offset': lo, 'size': hi-lo,
            'title': lines[0] if lines else '',
            'lineCount': len(lines), 'lines': lines,
        })
    rec = {'file': fn, 'size': len(b), 'blockCount': len(blocks), 'blocks': blocks}
    with open(os.path.join(OUT, fn.replace('.EEX','.json')), 'w', encoding='utf-8') as f:
        json.dump(rec, f, ensure_ascii=False, indent=1)
    index.append({'file': fn, 'blocks': len(blocks),
                  'titles': [bl['title'] for bl in blocks[:6]]})

with open(os.path.join(OUT, '_index.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, indent=1)

print(f'{len(index)}개 EEX → {OUT}')
print(f'총 이벤트 블록 {sum(x["blocks"] for x in index)}개')
print('\n블록 다수 파일 (멀티장면 이벤트):')
for x in sorted(index, key=lambda r:-r['blocks'])[:6]:
    print(f'  {x["file"]}: {x["blocks"]}블록  {x["titles"]}')
print('\n명령부 최빈 opcode 워드 (의미 미해독):', op_freq.most_common(15))
