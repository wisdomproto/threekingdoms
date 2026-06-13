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

def main():
  outs = extract(gpath('DATA.E5'))
  g, w, s, cls = outs[0], outs[1], outs[5], outs[3]

  # ---------- 장수 (chunk 0, 32B) — 능력치 순서 원형 삼각측량으로 확정 ----------
  generals = []
  for off in range(0, len(g), 32):
    r = g[off:off+32]
    if len(r) < 32: break
    name = kstr(r)
    if not name: continue
    generals.append({
        'index': off // 32,
        'name': name,
        'graphicId': r[13],          # 얼굴/그래픽 id (= r[15])
        'classId': r[26],            # 병종 번호 (JOB.TXT 검증)
        'className': JOBS.get(r[26], f'#{r[26]}'),
        # 능력치 5바이트 — 허저/곽가 등 원형 대조 + 팬에디터 필드순 일치로 확정
        'mar': r[18],   # 무력
        'ldr': r[19],   # 통솔력
        'int': r[20],   # 지력
        'agi': r[21],   # 민첩성
        'luck': r[22],  # 운
        'hp': r[23],    # HP (무관 120 / 문관 80)
        'mp': r[25],    # MP (문관 ↑ / 무관 ↓)
        'val29': r[29], # 추정: 진영/플래그
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
        'index': off // 25, 'name': name, 'markerAt': m,
        'preMarker': list(r[len(name.encode('cp949')):m]) if m >= 0 else [],
        'power': post[0] if post else None,   # 단검5<대검10<강검30 — 순서 검증
        'fields': post, '_raw': hx(r),
    })

  # ---------- 책략 (chunk 5, 70B) — c11=책략 종류 28종(책략명 대조로 확정) ----------
  CAT = {0:'화', 1:'수', 2:'지', 3:'풍', 4:'현혹', 5:'유혹', 6:'첩보', 7:'압박',
         8:'도발', 9:'둔병', 10:'허탈', 11:'분기', 12:'견고', 13:'연병', 14:'고양',
         15:'허보', 16:'독', 17:'포박', 18:'봉책', 19:'보급', 20:'조언', 21:'각성',
         22:'회귀', 23:'날씨', 24:'팔진도', 25:'사신', 26:'패기', 27:'강행'}
  strategies = []
  for off in range(0, len(s), 70):
    r = s[off:off+70]
    if len(r) < 70: break
    name = kstr(r)
    if not name: continue
    strategies.append({
        'index': off // 70, 'name': name,
        'category': r[11],                   # 책략 종류 id (0~3=화수지풍 공격, 4+=상태/보조/특수) — 검증
        'categoryName': CAT.get(r[11], f'#{r[11]}'),
        'mp': r[13],                         # MP 소모 — 검증
        'power': r[15],                      # 위력 (종류 내 상승 검증)
        'tierVal': r[14],                    # 추정: 레벨/변형
        'rangeShapeRef': r[16],              # 추정: chunk2 범위 셰이프 참조
        'effectMatrix': list(r[35:64]),      # 레벨/구역별 데미지 매트릭스
        '_raw': hx(r),
    })

  # ---------- 병종 클래스 (chunk 3, 53종 × 27B) — JOB.TXT 1:1 ----------
  classes = []
  for i in range(len(cls) // 27):
    r = cls[i*27:(i+1)*27]
    # c09~c26 원핫에서 스프라이트/카테고리 그룹 추출
    cat = next((j for j in range(9, 27) if r[j]), None)
    classes.append({
        'classId': i,
        'name': JOBS.get(i, f'#{i}'),
        'move': r[0],          # 이동력 (기병6/보병4/포차3, 승급3단 +1) — 검증
        'casterType': r[8],    # 1 일반 / 2 책사계 / 3 주술·선인 — 검증
        'flag1': r[1],         # 추정: 특수 플래그 (비전투병종 11)
        'terrain_c2_6': list(r[2:7]),  # 추정: 지형 적성 5값
        'c7': r[7],            # 추정: 기본 계수
        'categoryBit': cat,    # c09~26 원핫 위치 = 스프라이트/병종 카테고리
        '_raw': hx(r),
    })

  # ---------- chunk4 성장 프로파일 (27 × 60B: [HP증가 30] + [스탯업코드 30, 255=없음]) ----------
  c4 = outs[4]
  growth = []
  for i in range(len(c4) // 60):
    rec = c4[i*60:(i+1)*60]
    growth.append({
        'profileId': i,
        'hpGrowth': list(rec[:30]),   # 추정: 레벨별 HP/병력 증가 (~10, 거의 균일)
        'statGain': [None if x == 255 else x for x in rec[30:]],  # 추정: 스탯업 코드(255=없음)
    })

  # ---------- 범위 셰이프 (chunk 2, 58 × 36B) — 책략/무기 AoE 셀 오프셋 ----------
  c2 = outs[2]
  shapes = []
  for i in range(len(c2) // 36):
    rec = c2[i*36:(i+1)*36]
    cells = [rec[j] for j in range(4, 36) if rec[j] != 0xff]  # 헤더 4B 뒤 셀 오프셋
    shapes.append({
        'shapeId': i,
        'head': list(rec[:4]),   # [X,0,Y,0] — X·Y 의미 추정
        'cells': cells,          # AoE 셀 오프셋 리스트
        '_raw': hx(rec),
    })

  def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    n = len(obj) if isinstance(obj, (list, dict)) else 0
    print(f'  {name}: {n}')

  print(f'출력 → {OUT}')
  dump('generals.json', generals)
  dump('classes.json', classes)
  dump('weapons.json', weapons)
  dump('strategies.json', strategies)
  dump('growthProfiles.json', growth)
  dump('rangeShapes.json', shapes)
  print(f'장수 {len(generals)} / 병종 {len(classes)} / 무기 {len(weapons)} / 책략 {len(strategies)} / 성장 {len(growth)} / 셰이프 {len(shapes)}')

if __name__ == '__main__':
  main()
