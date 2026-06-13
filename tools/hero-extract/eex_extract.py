# -*- coding: utf-8 -*-
"""EEX → 대사/내레이션 스크립트 추출 (CP949 한국어 + Shift-JIS 일본어 명대사 혼재).
구조화된 이벤트/일기토 트리거(opcode 디컴파일)는 후속 작업 — 여기선 텍스트 레이어만.
"""
import sys, os, json, struct, glob
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import GAME

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..',
                                   'packages', 'data', 'json', 'sosoden', 'scripts'))
os.makedirs(OUT, exist_ok=True)

def is_cp949_lead(b, i):
    return i+1 < len(b) and 0xB0 <= b[i] <= 0xC8 and 0xA1 <= b[i+1] <= 0xFE
def is_sjis_lead(b, i):
    return i+1 < len(b) and (0x81 <= b[i] <= 0x9F or 0xE0 <= b[i] <= 0xEF) \
           and (0x40 <= b[i+1] <= 0x7E or 0x80 <= b[i+1] <= 0xFC)

def extract_text_runs(b, min_len=2):
    """이중바이트 텍스트 런(+인접 ascii)을 위치순으로. (offset, encoding, text)."""
    runs = []; i = 0; n = len(b)
    while i < n:
        if is_cp949_lead(b, i):
            j = i; s = bytearray()
            while j < n and (is_cp949_lead(b, j) or (0x20 <= b[j] < 0x7f)):
                if is_cp949_lead(b, j): s += b[j:j+2]; j += 2
                else: s.append(b[j]); j += 1
            try:
                t = bytes(s).decode('cp949')
                if len([c for c in t if not c.isascii()]) >= min_len:
                    runs.append((i, 'cp949', t.strip()))
            except: pass
            i = max(j, i+1)
        elif is_sjis_lead(b, i):
            j = i; s = bytearray()
            while j < n and (is_sjis_lead(b, j) or (0x20 <= b[j] < 0x7f)):
                if is_sjis_lead(b, j): s += b[j:j+2]; j += 2
                else: s.append(b[j]); j += 1
            try:
                t = bytes(s).decode('shift_jis')
                if len([c for c in t if not c.isascii()]) >= min_len:
                    runs.append((i, 'sjis', t.strip()))
            except: pass
            i = max(j, i+1)
        else:
            i += 1
    return runs

def parse_header(b):
    return {
        'magic': b[:3].decode('ascii', 'replace'),
        'version': struct.unpack_from('<H', b, 4)[0],
        'headerWords': [struct.unpack_from('<H', b, o)[0] for o in range(10, 28, 2)],
    }

index = []
for p in sorted(glob.glob(os.path.join(GAME, '*.EEX'))):
    fn = os.path.basename(p)
    b = open(p, 'rb').read()
    runs = extract_text_runs(b)
    lines = [{'off': o, 'enc': e, 'text': t} for (o, e, t) in runs if t]
    rec = {'file': fn, 'size': len(b), 'header': parse_header(b),
           'lineCount': len(lines), 'lines': lines}
    with open(os.path.join(OUT, fn.replace('.EEX', '.json')), 'w', encoding='utf-8') as f:
        json.dump(rec, f, ensure_ascii=False, indent=1)
    index.append({'file': fn, 'size': len(b), 'lineCount': len(lines),
                  'firstLine': lines[0]['text'] if lines else ''})

with open(os.path.join(OUT, '_index.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, indent=1)

tot = sum(x['lineCount'] for x in index)
print(f'{len(index)}개 EEX → {OUT}')
print(f'총 대사/텍스트 라인 {tot}개')
print('\n샘플 (S_00, R_00):')
for x in index:
    if x['file'] in ('S_00.EEX','R_00.EEX'):
        print(f"  {x['file']}: {x['lineCount']}줄, 첫줄=\"{x['firstLine']}\"")
