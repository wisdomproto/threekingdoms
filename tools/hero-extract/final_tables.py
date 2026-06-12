# -*- coding: utf-8 -*-
"""BAKDATA.R3 → 통합 마크다운 테이블 생성
21B 장수 레코드 (0x1100, 384개) + 18B 초기상태 레코드 (0x3080, 384개) 병합
"""
import sys, struct
sys.stdout.reconfigure(encoding='utf-8')

data = open(r'C:\HERO\BAKDATA.R3', 'rb').read()

CLASSES = ['단병','장병','전차','궁병','연노병','발석차','경기병','중기병','친위대','산적',
           '흉적','의적','군악대','맹수부대','무도가대','주술사','이민족','백성','수송대']
FACTIONS = ['유비','조조','손권','공손찬','원소','동탁','원술','여포','도겸','유표','유장','장노','마등','공융','무소속']

ITEMS = []
for k in range(63):
    off = 0xD00 + k * 16
    nm = data[off:off+13].split(b'\x00')[0].decode('cp949', errors='replace')
    ITEMS.append(nm)

rows = []
for n in range(384):
    g = 0x1100 + n * 21
    rec = data[g:g+21]
    raw = rec[0:6].split(b'\x00')[0]
    name = raw.decode('cp949', errors='replace')
    face = rec[14] | (rec[15] << 8)
    b16 = rec[16]
    lead, war, intel = rec[17], rec[18], rec[19]
    look = rec[20]

    s = 0x3080 + n * 18
    st = data[s:s+18]
    fac = st[0]
    fac_s = FACTIONS[fac - 0x80] if 0x80 <= fac < 0x80 + len(FACTIONS) else (f'0x{fac:02X}')
    flag = st[1]
    morale = st[4]
    troops = st[5] | (st[6] << 8)
    cls = st[7]
    cls_s = CLASSES[cls] if cls < len(CLASSES) else f'?{cls}'
    level = st[8] | (st[9] << 8)
    items = [ITEMS[b] for b in st[10:18] if b != 0xFF and b < len(ITEMS)]
    rows.append((n, name, lead, war, intel, fac_s, cls_s, level, troops, morale, face, b16, look, flag, ', '.join(items)))

out = open(r'C:\project\threekingdoms\tools\hero-extract\out\generals_table.md', 'w', encoding='utf-8')
out.write('| # | 이름 | 통솔 | 무력 | 지력 | 소속 | 병종 | 초기Lv | 초기병력 | 얼굴# | 보유 아이템 |\n')
out.write('|---|---|---|---|---|---|---|---|---|---|---|\n')
for r in rows:
    n, name, lead, war, intel, fac_s, cls_s, level, troops, morale, face, b16, look, flag, items = r
    out.write(f'| {n} | {name} | {lead} | {war} | {intel} | {fac_s} | {cls_s} | {level} | {troops} | {face} | {items} |\n')
out.close()
print('saved generals_table.md')

# 아이템 테이블도
out = open(r'C:\project\threekingdoms\tools\hero-extract\out\items_table.md', 'w', encoding='utf-8')
out.write('| 코드 | 이름 | b13(효과치) | b14(공/지력보정) | b15(분류) |\n|---|---|---|---|---|\n')
for k in range(63):
    off = 0xD00 + k * 16
    rec = data[off:off+16]
    nm = rec[0:13].split(b'\x00')[0].decode('cp949', errors='replace')
    out.write(f'| {k} (0x{k:02X}) | {nm} | {rec[13]} | {rec[14]} | {rec[15]} |\n')
out.close()
print('saved items_table.md')

# 통계 몇 가지
named = [r for r in rows if r[1] not in ('보병대','궁병대','기병대','적병','군악대','맹수사','요술사','무도가','이민족','민중','수송대') and r[2]+r[3]+r[4] > 0]
print(f'named generals with stats: {len(named)}')
lv = sorted(set(r[7] for r in rows))
print('initial levels present:', lv)
