# -*- coding: utf-8 -*-
"""DATA.E5 → 조조전 레퍼런스 JSON (packages/data/json/sosoden/).
병종 스탯·책략·아이템·장수 스탯 테이블 추출. 확정 라벨 + _raw 원본 동봉.
"""
import sys, os, json, struct
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import extract, gpath

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..',
                                   'packages', 'data', 'json', 'sosoden'))
os.makedirs(OUT, exist_ok=True)

# JOB.TXT 병종 번호표 (원본 동봉 문서)
JOBS = {
    0:'군주계1',1:'군주계2',2:'군주계3',3:'보병계1',4:'보병계2',5:'보병계3',
    6:'궁병계1',7:'궁병계2',8:'궁병계3',9:'기병계1',10:'기병계2',11:'기병계3',
    12:'궁기병계1',13:'궁기병계2',14:'궁기병계3',15:'포차계1',16:'포차계2',17:'포차계3',
    18:'무도가계1',19:'무도가계2',20:'무도가계3',21:'적병계1',22:'적병계2',23:'적병계3',
    24:'참모계1',25:'참모계2',26:'참모계3',27:'풍수사계1',28:'풍수사계2',29:'풍수사계3',
    30:'도사계1',31:'도사계2',32:'도사계3',33:'기마책사계1',34:'기마책사계2',35:'기마책사계3',
    36:'무용수계1',37:'무용수계2',38:'무용수계3',39:'서량기병',40:'황건적',41:'해적',
    42:'곰부대',43:'맹호대',44:'제독',45:'주술사',46:'선인',47:'물자부대',
    48:'식량대',49:'나무인형',50:'흙인형',51:'황제',52:'민중',
}

def kstr(b):
    """레코드 앞쪽 CP949 이름 (0x00 전까지)."""
    end = b.find(b'\x00')
    raw = b if end < 0 else b[:end]
    try: return raw.decode('cp949')
    except: return raw.hex()

def hx(b): return b.hex()

outs = extract(gpath('DATA.E5'))
g, w, s = outs[0], outs[1], outs[5]

# ---------- 장수 (chunk 0, 32B) ----------
generals = []
for off in range(0, len(g), 32):
    r = g[off:off+32]
    if len(r) < 32: break
    name = kstr(r)
    if not name: continue
    generals.append({
        'index': off // 32,
        'name': name,
        'graphicId': r[13],          # 그래픽/얼굴 id (= r[15])
        'classId': r[26],            # 병종 번호 (JOB.TXT 검증됨)
        'className': JOBS.get(r[26], f'#{r[26]}'),
        'stats_18_22': list(r[18:23]),   # 추정: 무력/지력/통솔/순발/운 계열 (순서 미확정)
        'val23': r[23],              # 추정: 사기/HP 계열 (~100)
        'level': r[25],              # 추정: 레벨
        'val29': r[29],              # 추정: 진영/플래그
        '_raw': hx(r),
    })

# ---------- 무기/아이템 (chunk 1, 25B) ----------
weapons = []
for off in range(0, len(w), 25):
    r = w[off:off+25]
    if len(r) < 25: break
    name = kstr(r)
    if not name: continue
    m = r.find(0xff, len(name.encode('cp949')))   # 이름 뒤 첫 0xff 마커
    post = list(r[m+1:]) if m >= 0 else []
    weapons.append({
        'index': off // 25,
        'name': name,
        'markerAt': m,
        'preMarker': list(r[len(name.encode('cp949')):m]) if m >= 0 else [],
        'power': post[0] if post else None,   # 단검5<대검10<강검30 — 순서 검증됨
        'fields': post,
        '_raw': hx(r),
    })

# ---------- 책략 (chunk 5, 70B) ----------
strategies = []
for off in range(0, len(s), 70):
    r = s[off:off+70]
    if len(r) < 70: break
    name = kstr(r)
    if not name: continue
    strategies.append({
        'index': off // 70,
        'name': name,
        'mp': r[13],                 # 추정: MP 소모 (초열13/업화12)
        'val15': r[15],              # 추정: 위력/레벨
        # 레벨별 데미지 삼중값으로 보이는 후반부 (offset 41~)
        'tail': list(r[40:]),
        '_raw': hx(r),
    })

# ---------- 순수 수치 테이블 (chunk 2,3,4) — 병종/성장 후보, 원본 보존 ----------
raw_tables = {}
for ci, stride in ((2, 24), (3, None), (4, 30)):
    b = outs[ci]
    entry = {'length': len(b), 'strideGuess': stride, '_raw': hx(b)}
    if stride:
        entry['records'] = [list(b[i:i+stride]) for i in range(0, len(b)-len(b)%stride, stride)]
    raw_tables[f'chunk{ci}'] = entry

def dump(name, obj):
    p = os.path.join(OUT, name)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    print(f'  {name}: {len(obj) if isinstance(obj, list) else len(obj)} entries')

print(f'출력 → {OUT}')
dump('generals.json', generals)
dump('weapons.json', weapons)
dump('strategies.json', strategies)
dump('classTablesRaw.json', raw_tables)
print(f'장수 {len(generals)} / 무기 {len(weapons)} / 책략 {len(strategies)}')
