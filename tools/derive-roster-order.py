# -*- coding: utf-8 -*-
"""시나리오 등장 순 → asset-board.html S-pose ROSTER 드롭다운 재정렬 (통합 타임라인).

캐릭터가 ~100명이라 가나다순 드롭다운은 찾기 어렵다. 캠페인 진행 순(등장 순)으로 한 줄로 엮어
"플레이어가 만나는 순서"대로 정렬한다.

등장 순 정의(통합 타임라인):
  [아군] rosters.json 에 있으면 joinChapter(1~5) 로 그 챕터 첫 스테이지에 등장 + rosters 선언 순.
         (조운 등 합류 전 카메오 유닛 출현은 무시 — joinChapter 가 캐논 합류 시점)
  [적·게스트] rosters 없음 → stages/01~27 을 순서대로 걸어 '첫 등장 스테이지' + 그 스테이지 units 배열 위치.
         (units 는 player→ally→enemy 순이라 배열 위치가 곧 등장 순)
  정렬키 = (등장 스테이지, 아군0/적1/미상2, 부순서)  → 같은 스테이지면 아군 먼저, 그 안에선 선언/배열 순.
  병종 제네릭([제네릭] *)은 항상 맨 끝(원래 순서 보존).

데이터: ROSTER(asset-board.html) · rosters.json · stages/*.json
출력: 등장 순 표(챕터 구분) + 미매칭 목록 + 새 ROSTER 블록.
실행:  python tools/derive-roster-order.py          (감사만)
       python tools/derive-roster-order.py --write  (보드의 const ROSTER 블록 교체)
"""
import os, re, json, glob, sys
from collections import defaultdict
sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "packages", "data", "json")
BOARD = os.path.join(ROOT, "docs", "art", "asset-board.html")

board_src = open(BOARD, encoding="utf-8").read()
roster = re.findall(r'\{n:"([^"]+)",s:"([^"]+)"\}', board_src)  # [(n, s)…] 선언 순

# 챕터 첫 스테이지 (CLAUDE.md §5: 1장=1-4, 2장=5-9, 3장=10-15, 4장=16-22, 5장=23-27)
CH_FIRST = {1: 1, 2: 5, 3: 10, 4: 16, 5: 23}
def chapter_of(stage):
    if stage <= 4: return 1
    if stage <= 9: return 2
    if stage <= 15: return 3
    if stage <= 22: return 4
    if stage <= 27: return 5
    return 99

# 아군: rosters.json (선언 순 = 합류 순)
rosters = json.load(open(os.path.join(DATA, "rosters.json"), encoding="utf-8"))
ally_idx, ally_chapter = {}, {}
for i, (nm, r) in enumerate(rosters.items()):
    if isinstance(r, dict):
        ally_idx[nm] = i
        ally_chapter[nm] = r.get("joinChapter")

# 적·게스트: stages 첫 등장 (stage_idx, pos_in_units)
first_app = {}
stage_files = sorted(glob.glob(os.path.join(DATA, "stages", "*.json")))
for idx, f in enumerate(stage_files, 1):
    d = json.load(open(f, encoding="utf-8"))
    for pos, u in enumerate(d.get("units", []) if isinstance(d, dict) else []):
        nm = u.get("commanderId") if isinstance(u, dict) else None
        if nm and nm not in first_app:
            first_app[nm] = (idx, pos)

def is_generic(s): return s.endswith("_player") or s.endswith("_enemy")

# 정렬키 + 근거
def sort_key(n, s):
    if n in ally_idx and ally_chapter.get(n):
        return (CH_FIRST[ally_chapter[n]], 0, ally_idx[n])
    if n in first_app:
        st, pos = first_app[n]
        return (st, 1, pos)
    return (999, 2, n)

def basis(n, s):
    if n in ally_idx and ally_chapter.get(n):
        return f"아군·합류{ally_chapter[n]}장"
    if n in first_app:
        return f"적/게스트·{first_app[n][0]}스테이지첫등장"
    return "⚠ 등장 미상"

named = [(n, s) for n, s in roster if not is_generic(s)]
generics = [(n, s) for n, s in roster if is_generic(s)]
named_sorted = sorted(named, key=lambda ns: sort_key(*ns))

# ── 감사 출력 ──
print(f"=== 시나리오 등장 순 (네임드 {len(named_sorted)}명 + 제네릭 {len(generics)}) ===")
cur_ch = None
for n, s in named_sorted:
    ch = chapter_of(sort_key(n, s)[0])
    if ch != cur_ch:
        cur_ch = ch
        print(f"\n── {ch}장 ──" if ch != 99 else "\n── 기타(등장 미상) ──")
    flag = "  ⚠" if sort_key(n, s)[1] == 2 else ""
    print(f"  {n:<8} ({s:<18}) {basis(n, s)}{flag}")

unmatched = [n for n, s in named_sorted if sort_key(n, s)[1] == 2]
print(f"\n미매칭(등장 미상, 끝으로): {unmatched or '없음'}")

# ── 새 ROSTER 블록 생성 (챕터 구분 주석) ──
def entry(n, s): return '{n:"' + n + '",s:"' + s + '"}'
lines = ["  const ROSTER = ["]
lines.append("    // 시나리오 등장 순 — tools/derive-roster-order.py 자동 생성. 아군=합류챕터·로스터순, 적/게스트=첫 등장 스테이지순.")
cur_ch = None
buf = []
def flush():
    if buf: lines.append("    " + ",".join(buf) + ",")
for n, s in named_sorted:
    ch = chapter_of(sort_key(n, s)[0])
    if ch != cur_ch:
        flush(); buf.clear()
        cur_ch = ch
        lines.append(f"    // ── {ch}장 ──" if ch != 99 else "    // ── 기타(등장 미상) ──")
    buf.append(entry(n, s))
flush()
lines.append("    // 병종 제네릭(무명 장수 공용)")
g_player = [entry(n, s) for n, s in generics if s.endswith("_player")]
g_enemy = [entry(n, s) for n, s in generics if s.endswith("_enemy")]
if g_player: lines.append("    " + ",".join(g_player) + ",")
if g_enemy: lines.append("    " + ",".join(g_enemy) + ",")
lines.append("  ];")
new_block = "\n".join(lines)

print("\n=== 새 ROSTER 블록 미리보기(앞 8줄) ===")
print("\n".join(new_block.splitlines()[:8]))

if "--write" in sys.argv:
    pat = r'  const ROSTER = \[[\s\S]*?\n  \];'
    new_src, n = re.subn(pat, lambda _m: new_block, board_src, count=1)
    if n != 1:
        print(f"\n[--write] 실패: const ROSTER 블록 {n}건 매칭(1건이어야 함). 보드 미수정.")
        sys.exit(1)
    open(BOARD, "w", encoding="utf-8").write(new_src)
    print(f"\n[--write] ✅ docs/art/asset-board.html 의 ROSTER 재정렬 완료 (네임드 {len(named_sorted)} + 제네릭 {len(generics)}).")
