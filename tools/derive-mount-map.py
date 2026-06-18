# -*- coding: utf-8 -*-
"""병종 데이터 → S-pose 포즈시트용 탈것(mount) 맵 도출 + 전수 감사.

asset-board.html 의 S-pose 생성기는 캐릭터별 탈것을 알아야 한다.
스테이지마다 병종이 다른 적·게스트가 많아(46명 충돌), '대표 병종'을 다음 규칙으로 안정·결정적 도출:

  [아군] rosters.json 에 있으면 그 classId 가 캐논(초기 병종) — 어느 스테이지든 이걸 사용.
  [적·게스트] rosters 없음 →
     · 제갈량                 → cart (사륜거, 특례)
     · classId 집합에 'lord'  → chariot (군주=전차)
     · 그 외                  → 최빈(가장 많은 스테이지) classId 로 결정 (동률은 먼저 등장한 스테이지 우선)
  classId → 탈것:  lord/chariot→chariot · line==cavalry→horse · 그 외→foot

데이터: ROSTER(asset-board.html) · rosters.json · stages/*.json · unitClasses.json
출력: 전수 표 + 충돌 목록 + 현재 보드 맵과의 diff + 새 MOUNT_BY_NAME JS.
실행: python tools/derive-mount-map.py
"""
import os, re, json, glob, sys
from collections import defaultdict
sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "packages", "data", "json")
BOARD = os.path.join(ROOT, "docs", "art", "asset-board.html")

unit_classes = json.load(open(os.path.join(DATA, "unitClasses.json"), encoding="utf-8"))
board_src = open(BOARD, encoding="utf-8").read()
roster = re.findall(r'\{n:"([^"]+)",s:"([^"]+)"\}', board_src)

# 이름 → {classId: [출처…]}  (rosters 먼저, 그 다음 stage glob 순서로 삽입 → 삽입순=등장순)
name_cids = defaultdict(lambda: defaultdict(list))
rosters = json.load(open(os.path.join(DATA, "rosters.json"), encoding="utf-8"))
for nm, r in rosters.items():
    if isinstance(r, dict) and r.get("classId"):
        name_cids[nm][r["classId"]].append("rosters")

def walk(o, src):
    if isinstance(o, dict):
        cid = o.get("classId"); nm = o.get("commanderId") or o.get("unitId") or o.get("name")
        if cid and isinstance(nm, str):
            name_cids[nm][cid].append(src)
        for v in o.values(): walk(v, src)
    elif isinstance(o, list):
        for v in o: walk(v, src)

for f in sorted(glob.glob(os.path.join(DATA, "stages", "*.json"))):
    walk(json.load(open(f, encoding="utf-8")), os.path.basename(f))

def mount_of(name, cid):
    if name == "제갈량": return "cart"
    if cid in ("lord", "chariot"): return "chariot"
    if cid and unit_classes.get(cid, {}).get("line") == "cavalry": return "horse"
    return "foot"

def resolve(name, sprite):
    # 제네릭 병종 엔트리: spriteId 접두 = classId
    if sprite.endswith("_player") or sprite.endswith("_enemy"):
        cid = sprite.rsplit("_", 1)[0]
        return cid, mount_of(name, cid), "generic"
    cids = name_cids.get(name)            # dict: cid → [sources]  (삽입순 보존)
    if name == "제갈량":
        return (next(iter(cids)) if cids else None), "cart", "특례"
    if not cids:
        return None, "foot", "데이터없음"
    # [아군] rosters 우선
    for cid, srcs in cids.items():
        if "rosters" in srcs:
            return cid, mount_of(name, cid), "로스터"
    # [적·게스트] 군주 이력 → 전차
    if "lord" in cids:
        return "lord", "chariot", "군주이력"
    # 그 외 → 최빈(많은 출처), 동률은 먼저 등장(삽입순) 우선
    order = list(cids)
    maj = sorted(cids.items(), key=lambda kv: (-len(kv[1]), order.index(kv[0])))[0][0]
    return maj, mount_of(name, maj), "최빈"

def kname(cid): return unit_classes.get(cid, {}).get("name", "?") if cid else "—"

rows, summary, mount_map = [], defaultdict(int), {}
ICON = {"horse": "🐴말", "chariot": "🛞전차", "cart": "🛺사륜거", "foot": "🚶도보"}
for nm, sp in roster:
    cid, m, how = resolve(nm, sp)
    summary[m] += 1
    rows.append((nm, sp, cid, m, how))
    if m != "foot": mount_map[nm] = m

print(f"=== 탈것 배정 (비-도보 {sum(1 for r in rows if r[3]!='foot')}명) — 규칙: 로스터 우선·군주=전차·나머지 최빈 ===")
print(f"{'이름':<14}{'classId':<14}{'병종':<10}{'탈것':<8}{'근거'}")
print("─" * 60)
order = {"chariot": 0, "cart": 1, "horse": 2}
for nm, sp, cid, m, how in sorted((r for r in rows if r[3] != "foot"), key=lambda r: (order[r[3]], r[0])):
    print(f"{nm:<14}{str(cid):<14}{kname(cid):<10}{ICON[m]:<8}{how}")
print(f"\n요약: 전차 {summary['chariot']} · 사륜거 {summary['cart']} · 말 {summary['horse']} · 도보 {summary['foot']}  (총 {len(roster)})")

# 현재 보드 맵과 diff
cur = dict(re.findall(r'"([^"]+)":"([^"]+)"', re.search(r'const MOUNT_BY_NAME\s*=\s*\{([^}]*)\}', board_src).group(1)))
added = {k: v for k, v in mount_map.items() if k not in cur}
removed = {k: cur[k] for k in cur if k not in mount_map}
changed = {k: (cur[k], mount_map[k]) for k in mount_map if k in cur and cur[k] != mount_map[k]}
print("\n=== 현재 보드 맵 대비 변경 ===")
print(f"  추가: {added or '없음'}")
print(f"  제거(→도보): {removed or '없음'}")
print(f"  변경: { {k: f'{a}→{b}' for k,(a,b) in changed.items()} or '없음'}")

items = ", ".join(f'"{k}":"{v}"' for k, v in mount_map.items())
new_line = "const MOUNT_BY_NAME = {" + items + "};"
print("\n=== 새 MOUNT_BY_NAME (foot 제외) ===")
print(new_line)

# --write: 보드의 MOUNT_BY_NAME 한 줄을 새 맵으로 교체(in-place). lambda 치환=백슬래시 해석 회피.
if "--write" in sys.argv:
    new_src, n = re.subn(r'const MOUNT_BY_NAME\s*=\s*\{[^}]*\};', lambda _m: new_line, board_src)
    if n != 1:
        print(f"\n[--write] 실패: MOUNT_BY_NAME 패턴 {n}건 매칭 (1건이어야 함). 보드 미수정.")
        sys.exit(1)
    open(BOARD, "w", encoding="utf-8").write(new_src)
    print(f"\n[--write] ✅ docs/art/asset-board.html 의 MOUNT_BY_NAME 갱신 완료 (변경 {len(added)+len(removed)+len(changed)}건 반영)")
