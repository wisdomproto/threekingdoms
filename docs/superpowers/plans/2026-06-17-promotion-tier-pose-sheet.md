# 캐릭터 SD 코스메틱 승급 포즈시트 (9칸) 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

> **상태(2026-06-17):** ✅ 구현 완료 — 브랜치 `feat/promotion-tier-sheet` 5커밋, 4 테스트 통과, 최종 코드리뷰 ✅ 승인. 전 태스크 완료.

**Goal:** S-pose 포즈시트 생성기를 "코스메틱 3등급 × 3포즈 = 9칸"으로 격상하고, 9칸 시트를 등급별 스프라이트 파일(등급1=기존 경로, t2/t3=하위폴더)로 컷한다.

**Architecture:** ① `asset-board.html`의 S-pose 프롬프트 템플릿을 3×3 그리드 사양으로 교체 + `POSE_MOUNT` 문구를 9칸용으로 일반화(탈것 주입은 기존 `MOUNT_BY_NAME`→`POSE_MOUNT` 배선 그대로). ② `cut_posesheet.py`를 1D(가로 밴드)에서 2D(행=등급 × 열=포즈) 그리드 컷으로 확장하되, 행 1개면 기존 1×3 동작 유지(하위호환), 등급1은 루트 경로 유지.

**Tech Stack:** 정적 HTML+바닐라 JS, Python+Pillow, Node(프롬프트 검증·일회용).

**스펙:** [docs/superpowers/specs/2026-06-17-promotion-tier-pose-sheet-design.md](../specs/2026-06-17-promotion-tier-pose-sheet-design.md)

> **커밋 정책:** 각 태스크는 **로컬 커밋만**(push 안 함). 푸시는 사용자의 "업데이트 하자" 워크플로에서 일괄.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `docs/art/asset-board.html` | S-pose 프롬프트 생성 | 수정: `POSE_MOUNT` 문구, S-pose 카드 `prompt`(3×3) |
| `tools/sprite-pipeline/cut_posesheet.py` | 시트→프레임 컷 | 수정: ROOT 하드코딩 제거, importable `cut_sheet()` 분리, 2D 그리드 컷(등급×포즈) + 등급별 출력경로 |
| `tools/sprite-pipeline/test_cut_posesheet.py` | 컷 로직 테스트 | 신규: 합성 이미지로 3×3·1×3 컷 검증 (stdlib unittest) |

---

## Chunk 1: 보드 프롬프트 9칸화

### Task A1: `POSE_MOUNT` 문구를 9칸용으로 일반화

**Files:** Modify `docs/art/asset-board.html` (`const POSE_MOUNT` 블록, `MOUNT_FOOT` 선언 직후)

- [ ] **Step 1:** `const POSE_MOUNT = {` 검색 → 세 값(horse/chariot/cart)이 모두 `... : in ALL three poses the character ...`로 시작함을 확인.
- [ ] **Step 2:** 세 값의 도입부 `in ALL three poses` → `in EVERY cell of the sheet (the same mount in all 3 poses and all 3 rank rows)` 로 치환. 뒤의 IDLE/MOVE/ATTACK·SCREEN-LEFT 설명은 그대로 둔다. (cart의 `scholar\'s` 이스케이프 유지)
- [ ] **Step 3 (검증):** 인라인 JS 문법 무결 확인. `tools/_syntax.cjs` 생성:
  ```js
  const fs=require('fs');const s=fs.readFileSync('docs/art/asset-board.html','utf8');
  const m=[...s.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n;\n');
  new Function(m);console.log('SYNTAX OK');
  ```
  Run: `cd C:/projects/threekingdoms && node tools/_syntax.cjs; rm -f tools/_syntax.cjs`
  Expected: `SYNTAX OK`
- [ ] **Step 4 (커밋):** `git add docs/art/asset-board.html && git commit -m "feat(board): generalize POSE_MOUNT clauses for 9-cell tier sheet"`

### Task A2: S-pose 카드 프롬프트를 3×3 그리드로 교체

**Files:** Modify `docs/art/asset-board.html` (`{ id: 'S-pose', ... prompt: '...' }`)

- [ ] **Step 1:** `id: 'S-pose'` 검색 → 현재 `prompt:`가 `'A single horizontal POSE SHEET of {캐릭터} (a Three Kingdoms warrior/officer), the SAME character repeated in 3 distinct full-body poses ...'`(1행 3포즈)임을 확인.
- [ ] **Step 2:** `prompt:` 값을 아래 3×3 사양으로 교체(한 줄 문자열):

```
prompt: 'A single SD pose sheet of {캐릭터}, ONE image containing a 3-row by 3-column grid on a fully transparent background, cells evenly spaced with clear transparent gaps and NO overlap. The SAME character in all 9 cells — identical face, weapon and identity in every cell. ROWS = three cosmetic rank tiers of the SAME unit, differing ONLY in armor color and ornamentation (NOT body, NOT pose, NOT mount, NOT unit type): TOP row = basic rank (plain field armor, muted colors); MIDDLE row = veteran rank (reinforced darker steel armor, added pauldrons and trim); BOTTOM row = elite rank (ornate gilded armor with gold filigree, richer saturated colors, a small rank emblem). COLUMNS = three poses, every cell in 3/4 SIDE view FACING SCREEN-LEFT (profile turned left, NOT facing camera): column 1 = IDLE relaxed battle stance, column 2 = MOVE mid-stride advancing, column 3 = ATTACK dynamic weapon swing with a sweeping motion arc. Each cell a complete finished chibi (SD, ~2.5 heads).' },
```

- [ ] **Step 3 (검증):** `tools/_vpose.cjs` 생성:

```js
const fs=require('fs');const src=fs.readFileSync('docs/art/asset-board.html','utf8');
const scripts=[...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n;\n');
new Function(scripts); // 문법 게이트
const grab=n=>eval('('+src.match(new RegExp('const '+n+'\\s*=\\s*(\\{[\\s\\S]*?\\});'))[1]+')');
const POSE_MOUNT=grab('POSE_MOUNT'),MOUNT_BY_NAME=grab('MOUNT_BY_NAME');
const tmpl=src.match(/id:\s*'S-pose'[\s\S]*?prompt:\s*'([\s\S]*?)' \},/)[1];
const grid9=/3-row by 3-column/.test(tmpl)&&/TOP row[\s\S]*MIDDLE row[\s\S]*BOTTOM row/.test(tmpl);
const clause=n=>{const mt=MOUNT_BY_NAME[n];return mt?POSE_MOUNT[mt]:null;};
const cases=[['유비','chariot','war chariot'],['관우','horse','warhorse'],['미축',null,null]];
let ok=grid9;console.log('9-cell template:',grid9?'OK':'MISSING');
for(const[n,e,kw]of cases){const c=clause(n);const p=e===null?c===null:(MOUNT_BY_NAME[n]===e&&!!c&&c.includes(kw));console.log((p?'PASS':'FAIL'),n,'→',MOUNT_BY_NAME[n]||'(foot)');ok=ok&&p;}
console.log(ok?'ALL PASS':'SOME FAIL');process.exit(ok?0:1);
```

  Run: `cd C:/projects/threekingdoms && node tools/_vpose.cjs; rm -f tools/_vpose.cjs`
  Expected: `9-cell template: OK` + 유비/관우/미축 모두 `PASS` + `ALL PASS`
- [ ] **Step 4 (커밋):** `git add docs/art/asset-board.html && git commit -m "feat(board): S-pose prompt → 3x3 cosmetic-tier x pose sheet"`

> **9칸 일관성 게이트(스펙 §5):** 실제 생성은 길중이 보드에서 수행. 첫 1~2장 시각 검수에서 인물/실루엣/탈것 일관성이 무너지면 3행 분할 폴백으로 전환(스펙 §7). 이 계획은 프롬프트 산출까지 책임.

---

## Chunk 2: 9칸 컷 (cut_posesheet.py, TDD)

### Task B1: ROOT 하드코딩 제거 + 컷 코어를 importable 함수로 분리

**Files:** Modify `tools/sprite-pipeline/cut_posesheet.py`

- [ ] **Step 1:** 16행 `ROOT = r"C:\project\threekingdoms"` → `ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))` (sprite-pipeline → tools → repo root). 검증: `cd C:/projects/threekingdoms && python -c "import os;p=os.path.dirname(os.path.dirname(os.path.abspath('tools/sprite-pipeline/cut_posesheet.py')));print(os.path.isdir(os.path.join(p,'apps')))"` → `True`
- [ ] **Step 2:** 컷 코어를 순수 함수로 분리(파일·manifest I/O와 분리). 시그니처:
  `def cut_sheet(im, poses) -> list[tuple[int, str, "Image"]]:`  # 반환: (tier_index, pose_name, crop) 목록. tier_index 0=등급1, 1=t2, 2=t3.
  내부: `detect_grid(im)`로 행(등급)·열(포즈) 2D 밴드 검출 후, 행별로 `poses` 길이만큼 칸을 크롭. `main()`은 시트 로드→`cut_sheet`→경로 저장+manifest를 담당(다음 태스크). 기존 `column_filled/split_bands/y_bounds` 재사용.
- [ ] **Step 3 (커밋):** `git add tools/sprite-pipeline/cut_posesheet.py && git commit -m "refactor(cut): derive ROOT from __file__, extract cut_sheet() core"`

### Task B2: 실패하는 테스트 작성 (3×3 그리드 + 1×3 하위호환)

**Files:** Create `tools/sprite-pipeline/test_cut_posesheet.py`

- [ ] **Step 1:** 테스트 작성. 합성 RGBA 시트를 코드로 생성(투명 배경 + 불투명 사각형 격자, 칸 사이 투명 간격)하고 `detect_grid`/`cut_sheet`를 호출해 검증:

```python
# -*- coding: utf-8 -*-
import unittest, sys, os
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cut_posesheet as C

def make_sheet(rows, cols, cell=60, gap=30):
    W = cols*cell + (cols+1)*gap; H = rows*cell + (rows+1)*gap
    im = Image.new("RGBA", (W, H), (0,0,0,0)); d = ImageDraw.Draw(im)
    for r in range(rows):
        for c in range(cols):
            x = gap + c*(cell+gap); y = gap + r*(cell+gap)
            d.rectangle([x, y, x+cell-1, y+cell-1], fill=(200, 60+r*60, 60+c*60, 255))
    return im

class TestCut(unittest.TestCase):
    def test_grid_3x3(self):
        grid = C.detect_grid(make_sheet(3, 3))
        self.assertEqual(len(grid), 3)
        for row in grid: self.assertEqual(len(row), 3)
    def test_cut_3x3_tiers(self):
        res = C.cut_sheet(make_sheet(3, 3), ["idle","move","attack"])
        self.assertEqual(len(res), 9)
        tiers = sorted(set(t for t,_,_ in res)); self.assertEqual(tiers, [0,1,2])
        row0 = [p for t,p,_ in res if t==0]; self.assertEqual(sorted(row0), ["attack","idle","move"])
    def test_cut_1x3_backcompat(self):
        res = C.cut_sheet(make_sheet(1, 3), ["idle","move","attack"])
        self.assertEqual(len(res), 3)
        self.assertTrue(all(t==0 for t,_,_ in res))  # 단일 행 → 전부 등급1(루트)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2 (실패 확인):** 테스트 파일이 자기 디렉터리를 `sys.path`에 넣고 `unittest.main()`을 돌리므로 레포 루트에서 직접 실행:
  Run: `cd C:/projects/threekingdoms && python tools/sprite-pipeline/test_cut_posesheet.py -v`
  Expected: FAIL/ERROR — `detect_grid`/`cut_sheet` 미정의 또는 동작 불일치.

### Task B3: 2D 그리드 컷 구현 (등급 행 × 포즈 열)

**Files:** Modify `tools/sprite-pipeline/cut_posesheet.py`

- [ ] **Step 1:** `row_filled(im)`(Y축 채움 검출, `column_filled`의 행 버전) + `detect_grid(im)` 구현:
  - `split_bands(row_filled, min_gap=max(8,H//40))` → 행 밴드, 높이 `> H*0.04` 필터.
  - 각 행 스트립을 crop → `column_filled` → `split_bands(min_gap=max(8,W//40))` → 열 밴드, 폭 `> W*0.04` 필터.
  - 각 칸의 정밀 bbox는 `y_bounds`로 보정. 반환: 행 리스트(위→아래), 각 행은 칸 (x0,y0,x1,y1) 리스트(좌→우).
- [ ] **Step 2:** `cut_sheet(im, poses)` 구현: `detect_grid` 호출 → 행 인덱스=tier, 행 내 칸을 `poses` 순서로 매핑(`min(len(cells), len(poses))`개) → `(tier_idx, pose_name, im.crop(bbox))` 목록 반환.
- [ ] **Step 3 (통과 확인):** Run `cd C:/projects/threekingdoms && python tools/sprite-pipeline/test_cut_posesheet.py -v`
  Expected: 3 tests PASS.
- [ ] **Step 4 (커밋):** `git add tools/sprite-pipeline/cut_posesheet.py tools/sprite-pipeline/test_cut_posesheet.py && git commit -m "feat(cut): 2D grid cut (rank rows x pose cols) + tests"`

### Task B4: 등급별 출력 경로 + manifest(등급1만) — TDD

**Files:** Modify `tools/sprite-pipeline/cut_posesheet.py` (`main()`), Modify `tools/sprite-pipeline/test_cut_posesheet.py` (테스트 추가)

- [ ] **Step 1 (실패 테스트):** `test_cut_posesheet.py`에 `test_main_tier_paths` 추가 — `cut_posesheet.SPRITES`를 임시폴더로 몽키패치, 합성 3×3을 `_posesheet.png`로 저장, `main()` 호출, 등급별 파일·manifest 단언:

```python
    def test_main_tier_paths(self):
        import tempfile, json, shutil
        tmp = tempfile.mkdtemp()
        try:
            C.SPRITES = tmp
            d = os.path.join(tmp, "_tiertest"); os.makedirs(d)
            make_sheet(3, 3).save(os.path.join(d, "_posesheet.png"))
            argv = sys.argv; sys.argv = ["cut", "_tiertest"]
            try: C.main()
            finally: sys.argv = argv
            for pose in ("idle", "move", "attack"):
                self.assertTrue(os.path.exists(os.path.join(d, f"front_{pose}.png")))       # 등급1=루트
                self.assertTrue(os.path.exists(os.path.join(d, "t2", f"front_{pose}.png")))  # 등급2
                self.assertTrue(os.path.exists(os.path.join(d, "t3", f"front_{pose}.png")))  # 등급3
            man = json.load(open(os.path.join(tmp, "manifest.json"), encoding="utf-8"))
            self.assertEqual(sorted(man["_tiertest"]["poses"]), ["front_attack", "front_idle", "front_move"])  # 등급1만
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
```

  Run: `cd C:/projects/threekingdoms && python tools/sprite-pipeline/test_cut_posesheet.py -v`
  Expected: `test_main_tier_paths` FAIL (현 `main()`은 평면 출력·tier 미인식).
- [ ] **Step 2 (구현):** `main()`을 `cut_sheet` 기반으로 교체. `TIER_SUBDIR = {0: "", 1: "t2", 2: "t3"}` (빈 문자열=루트=등급1). 각 `(tier_idx, pose, crop)`를 `outdir = os.path.join(d, TIER_SUBDIR.get(tier_idx, f"t{tier_idx+1}"))`(비면 `d`, 아니면 생성)에 `front_{pose}.png`로 저장. **manifest는 `tier_idx==0`의 pose만** `front_{pose}` 형식으로 기존과 동일 등록(t2/t3는 파일만).
- [ ] **Step 3 (통과):** Run `cd C:/projects/threekingdoms && python tools/sprite-pipeline/test_cut_posesheet.py -v`
  Expected: 4 tests PASS.
- [ ] **Step 4 (커밋):** `git add tools/sprite-pipeline/cut_posesheet.py tools/sprite-pipeline/test_cut_posesheet.py && git commit -m "feat(cut): tier output paths (t1 root, t2/t3 subdirs), manifest t1-only"`

---

## 실행 후 (수동, 길중)
보드 http://localhost:8080/docs/art/asset-board.html → ① SD 포즈시트 → 캐릭터 선택 → 프롬프트 복사 → 생성 → 붙여넣기 → 📤 시트 넘기기 → `python tools/sprite-pipeline/cut_posesheet.py <spriteId>` → 게임 새로고침. 기존 12세트는 재생성 권장(스펙 §4.3).
