# -*- coding: utf-8 -*-
"""실용 스탯 이식: commanders.json 의 war/leadership/intelligence 를 조조전 값(×2 스케일)으로 갱신.
엔진/공식/병종/스테이지/faceId/id 는 불변. 조조전 셋에 없는 장수는 영걸전값 유지."""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')

J = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'packages', 'data', 'json'))

def clamp(v): return max(1, min(100, v))

gens = json.load(open(os.path.join(J, 'sosoden', 'generals.json'), encoding='utf-8'))
# 이름 → 조조전 장수 (첫 등장 우선)
gmap = {}
for g in gens:
    gmap.setdefault(g['name'], g)

cmds = json.load(open(os.path.join(J, 'commanders.json'), encoding='utf-8'))
updated, kept = [], []
for cid, c in cmds.items():
    g = gmap.get(c['name'])
    if g:
        c['war'] = clamp(g['mar'] * 2)
        c['leadership'] = clamp(g['ldr'] * 2)
        c['intelligence'] = clamp(g['int'] * 2)
        updated.append(c['name'])
    else:
        kept.append(c['name'])

with open(os.path.join(J, 'commanders.json'), 'w', encoding='utf-8') as f:
    json.dump(cmds, f, ensure_ascii=False, indent=2)

print(f'commanders 총 {len(cmds)}')
print(f'  조조전 스탯으로 갱신: {len(updated)}')
print(f'  조조전 셋에 없어 영걸전 유지: {len(kept)} → {kept[:40]}{"..." if len(kept)>40 else ""}')
print('\n검증(갱신 후):')
for nm in ['유비','관우','장비','조조','제갈량','여포']:
    for c in cmds.values():
        if c['name'] == nm:
            print(f'  {nm}: war{c["war"]}/통{c["leadership"]}/지{c["intelligence"]}')
            break
