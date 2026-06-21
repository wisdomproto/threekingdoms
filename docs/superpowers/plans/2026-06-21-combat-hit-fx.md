# 전투 타격 FX 이미지화 Implementation Plan

> **상태: ✅ 구현 완료 (2026-06-21)** — 6 태스크 전부 구현·검증·커밋(abde610→046e51d, subagent-driven). 검증: Python unittest·vitest·web 517테스트·typecheck 그린, 브라우저 `[TextureResolver] fx 로드 완료: 4종`. 실슬라이스=`assets/fx/{slash,sparkle,coin,flash}.png`(C-1 시트). 실제 타격 비주얼은 전투 중 발동. Sub-project #2(앰비언트/화공)는 화공 메커니즘 선행 필요라 이연.

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 길중이 생성한 발광 이펙트 시트를 `FxLayer`의 절차적 Graphics 이펙트에 드롭인해, 평타·협공·필살·격파 연출을 이미지로 격상한다(이미지 없으면 현 연출 폴백 = 무회귀).

**Architecture:** 이펙트 호출 seam인 `FxLayer`의 3개 메서드(`slashArc`/`impactFlash`/`retreatBurst`) 내부에서 텍스처 리졸버 `getFx(key)`를 조회 — 있으면 additive 스프라이트 + 기존 트윈, 없으면 기존 Graphics 폴백. 텍스처 로딩은 `getObject`/`loadObjects` 패턴을 그대로 미러. 시트→슬라이스는 검은배경 휘도 컷 도구로. 트리거 사이트(BattleRenderer)는 메서드 시그니처 옵션 추가(`big`) 외 무수정.

**Tech Stack:** TypeScript + PixiJS 8 (apps/web), Python + Pillow (tools/sprite-pipeline), vitest(web)·unittest(python).

**Spec:** `docs/superpowers/specs/2026-06-21-combat-hit-fx-design.md`

---

## Chunk 1: 전투 타격 FX 이미지화 (전체)

### Task 1: 휘도 컷 도구 `cut_fx_sheet.py`

검은배경 발광 시트를 휘도(밝기) 기반으로 요소별 컷. 알파 제거 안 함(additive 렌더라 검정=무가산). 핵심 트릭: **검은배경 → 알파=휘도 프록시 이미지를 만들어 기존 `cut_posesheet.detect_grid`(알파>20 기반)를 재사용**, 박스는 *원본*(검정 유지)에서 크롭.

**Files:**
- Create: `tools/sprite-pipeline/cut_fx_sheet.py`
- Create: `tools/sprite-pipeline/test_cut_fx_sheet.py`
- Reuse(import): `tools/sprite-pipeline/cut_posesheet.py` (`detect_grid`)

- [ ] **Step 1: 실패 테스트 작성** — `test_cut_fx_sheet.py`

```python
# -*- coding: utf-8 -*-
import unittest, sys, os, tempfile, shutil
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cut_fx_sheet as F

def make_glow_sheet(rows, cols, cell=60, gap=40):
    """검은 배경 + 밝은(발광) 사각형 요소 격자. 실제 fx 시트(검정+발광) 모사."""
    W = cols*cell + (cols+1)*gap; H = rows*cell + (rows+1)*gap
    im = Image.new("RGB", (W, H), (0, 0, 0)); d = ImageDraw.Draw(im)
    for r in range(rows):
        for c in range(cols):
            x = gap + c*(cell+gap); y = gap + r*(cell+gap)
            d.rectangle([x, y, x+cell-1, y+cell-1], fill=(255, 220, 120))  # 밝은 금빛
    return im

class TestFxCut(unittest.TestCase):
    def test_luminance_proxy_alpha_from_brightness(self):
        # 검정 픽셀→alpha 0, 밝은 픽셀→alpha 큼
        im = make_glow_sheet(1, 1)
        proxy = F.luminance_alpha(im)
        self.assertEqual(proxy.mode, "RGBA")
        px = proxy.load()
        self.assertEqual(px[0, 0][3], 0)                 # 모서리=검정 배경
        cx, cy = proxy.size[0]//2, proxy.size[1]//2
        self.assertGreater(px[cx, cy][3], 200)           # 중앙=밝은 요소

    def test_cut_2x3_keys(self):
        keys = ["slash", "sparkle", "flash", "smoke", "coin", "pierce"]
        cells = F.cut_cells(make_glow_sheet(2, 3), keys)
        self.assertEqual(len(cells), 6)
        self.assertEqual([k for k, _ in cells], keys)    # 행-우선 매핑
        for _, img in cells:
            self.assertEqual(img.mode, "RGB")            # 검정 유지(투명화 안 함)

    def test_main_writes_fx_pngs(self):
        tmp = tempfile.mkdtemp()
        try:
            F.FX_DIR = tmp
            sheet = os.path.join(tmp, "_sheet.png"); make_glow_sheet(2, 3).save(sheet)
            argv = sys.argv; sys.argv = ["cut", sheet, "--keys", "slash,sparkle,flash,smoke,coin,pierce"]
            try: F.main()
            finally: sys.argv = argv
            for k in ("slash", "coin", "flash"):
                self.assertTrue(os.path.exists(os.path.join(tmp, f"{k}.png")))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `python tools/sprite-pipeline/test_cut_fx_sheet.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'cut_fx_sheet'`

- [ ] **Step 3: `cut_fx_sheet.py` 구현**

```python
# -*- coding: utf-8 -*-
"""발광 이펙트 시트(검은 배경) → /assets/fx/{key}.png 휘도 컷.

검은배경 = additive 렌더에서 무가산이라 알파 제거 안 함(검정 유지). 요소 경계 검출은
'알파=휘도' 프록시로 만들어 cut_posesheet.detect_grid(알파>20 기반)를 재사용한 뒤,
박스를 *원본*(검정 유지)에서 크롭한다. 격자 감지 실패 시 --grid RxC 고정 폴백.

사용: python cut_fx_sheet.py <시트경로> --keys slash,sparkle,flash,smoke,coin[,pierce] [--grid 2x3]
"""
import sys, os
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_posesheet import detect_grid

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FX_DIR = os.path.join(ROOT, "apps", "web", "public", "assets", "fx")


def luminance_alpha(im):
    """검은배경 RGB → RGBA, alpha=max(r,g,b)(휘도). detect_grid가 쓰는 알파 채널 생성용."""
    rgb = im.convert("RGB")
    W, H = rgb.size
    out = Image.new("RGBA", (W, H))
    sp = rgb.load(); dp = out.load()
    for y in range(H):
        for x in range(W):
            r, g, b = sp[x, y]
            dp[x, y] = (r, g, b, max(r, g, b))
    return out


def cut_cells(im, keys, grid=None):
    """(key, RGB크롭) 리스트(행-우선). grid=(rows,cols)면 고정분할, 아니면 휘도 감지."""
    rgb = im.convert("RGB")
    if grid:
        rows, cols = grid
        W, H = rgb.size; cw, ch = W // cols, H // rows
        boxes = [(c*cw, r*ch, (c+1)*cw, (r+1)*ch) for r in range(rows) for c in range(cols)]
    else:
        proxy = luminance_alpha(rgb)
        boxes = [b for row in detect_grid(proxy) for b in row]  # 행-우선
    out = []
    for i, key in enumerate(keys):
        if i >= len(boxes):
            break
        out.append((key, rgb.crop(boxes[i])))
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    keys, grid, path = None, None, None
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--keys": keys = args[i+1].split(","); i += 2
        elif a == "--grid": grid = tuple(int(x) for x in args[i+1].lower().split("x")); i += 2
        else: path = a; i += 1
    if not path or not keys:
        print("사용: python cut_fx_sheet.py <시트> --keys slash,sparkle,flash,smoke,coin [--grid 2x3]"); sys.exit(1)
    if not os.path.exists(path):
        print(f"시트 없음: {path}"); sys.exit(1)
    im = Image.open(path)
    cells = cut_cells(im, keys, grid)
    os.makedirs(FX_DIR, exist_ok=True)
    for key, crop in cells:
        crop.save(os.path.join(FX_DIR, f"{key}.png"))
        print(f"  → {key}.png  {crop.size}")
    print(f"\n저장: {FX_DIR}  ({len(cells)}/{len(keys)})")
    print("게임 하드리프레시 시 FxLayer가 additive로 표시(미보유 키는 절차적 폴백).")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `python tools/sprite-pipeline/test_cut_fx_sheet.py`
Expected: PASS (`Ran 3 tests ... OK`)

- [ ] **Step 5: 커밋**

```bash
git add tools/sprite-pipeline/cut_fx_sheet.py tools/sprite-pipeline/test_cut_fx_sheet.py
git commit -m "feat(fx-pipeline): luminance-based fx sheet cutter (black-bg additive)"
```

---

### Task 2: fx 키 매핑 순수 헬퍼 `fxKeys.ts`

이벤트→fx 키 + `big` 분기를 순수 함수로 분리(스펙 §이벤트→키 매핑의 단일 진실). FxLayer가 소비.

**Files:**
- Create: `apps/web/src/pixi/fxKeys.ts`
- Create: `apps/web/src/pixi/__tests__/fxKeys.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `fxKeys.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { FX, pickFlashKey } from "../fxKeys";

describe("fxKeys", () => {
  it("FX 키 상수는 파일명과 1:1", () => {
    expect(FX.slash).toBe("slash");
    expect(FX.flash).toBe("flash");
    expect(FX.sparkle).toBe("sparkle");
    expect(FX.coin).toBe("coin");
  });
  it("pickFlashKey: big이면 대형 금빛(sparkle), 아니면 일반 섬광(flash)", () => {
    expect(pickFlashKey(true)).toBe("sparkle");  // 회심/필살
    expect(pickFlashKey(false)).toBe("flash");   // 평타/협공
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @tk/web test -- fxKeys`
Expected: FAIL — `Cannot find module '../fxKeys'`

- [ ] **Step 3: `fxKeys.ts` 구현**

```typescript
/**
 * fx 텍스처 키 상수 + 이벤트→키 선택 (스펙 §이벤트→키 매핑의 단일 진실).
 * 파일명(assets/fx/{key}.png)과 1:1. FxLayer와 textures.FX_FILES가 공유.
 */
export const FX = {
  slash: "slash",     // 참격 호 (평타·간접)
  flash: "flash",     // 흰 섬광 (평타·협공 임팩트)
  sparkle: "sparkle", // 대형 금빛 폭발 (회심·필살)
  coin: "coin",       // 코인팝 (격파, §12)
} as const;

export type FxKey = (typeof FX)[keyof typeof FX];

/** 임팩트 섬광 키 — 큰 타격(회심/필살)은 대형 금빛, 그 외 일반 섬광. */
export function pickFlashKey(big: boolean): FxKey {
  return big ? FX.sparkle : FX.flash;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @tk/web test -- fxKeys`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/pixi/fxKeys.ts apps/web/src/pixi/__tests__/fxKeys.test.ts
git commit -m "feat(fx): pure fx key mapping (event->key, big->sparkle/flash)"
```

---

### Task 3: 텍스처 리졸버 `getFx`/`loadFx`

`getObject`/`loadObjects` 패턴(textures.ts ~397/421)을 fx로 그대로 미러. pixi 의존이라 단위테스트 없음 — 코드베이스 관례(리졸버 untested, 통합·브라우저로 검증). 검증 = typecheck.

**Files:**
- Modify: `apps/web/src/pixi/textures.ts` (OBJECT_FILES 인접·loadObjects 인접·objectTex 인접)

- [ ] **Step 1: `FX_FILES` + `FX_BASE` + `fxTex` 추가** — OBJECT_FILES 정의 아래

```typescript
// 전투 타격 fx 텍스처(검은배경 발광, additive). 미보유 키는 FxLayer가 절차적 폴백.
const FX_FILES: Record<string, string> = {
  slash: "slash.png", flash: "flash.png", sparkle: "sparkle.png", coin: "coin.png",
};
const FX_BASE = assetUrl("/assets/fx");
```
그리고 `objectTex` 필드 옆에:
```typescript
private readonly fxTex = new Map<string, Texture>();
```

- [ ] **Step 2: `loadFx()` 추가** — `loadObjects()` 바로 아래에, 동형으로

```typescript
/** fx 텍스처 로드 (실패해도 빈 맵 유지 — throw 안 함, 전부 폴백). */
private async loadFx(): Promise<void> {
  const entries = Object.entries(FX_FILES);
  const urls = entries.map(([, f]) => `${FX_BASE}/${f}`);
  try {
    const loaded = await Assets.load<Texture>(urls);
    for (const [key, f] of entries) {
      const tex = loaded[`${FX_BASE}/${f}`];
      if (tex) this.fxTex.set(key, tex);
    }
    console.info(`[TextureResolver] fx 로드 완료: ${this.fxTex.size}종`);
  } catch (e) {
    console.warn("[TextureResolver] fx 로드 오류(아트 미보유 단계 정상):", e);
  }
}
```

- [ ] **Step 3: `getFx()` 추가** — `getObject()` 바로 아래

```typescript
/** 전투 fx 텍스처(없으면 null → FxLayer 절차적 폴백). */
getFx(key: string): Texture | null {
  return this.fxTex.get(key) ?? null;
}
```

- [ ] **Step 4: `loadFx()`를 로드 시퀀스에 등록** — `loadObjects()`는 `private async loadTiles()` 안의 await 체인(`loadDecos → loadObjects → loadGround`)에 있다. 그 체인에 `loadFx`를 끼운다:

```typescript
await this.loadObjects();
await this.loadFx();    // ← 추가
await this.loadGround();
```
*(`grep -n "loadObjects\|loadGround\|private async loadTiles" apps/web/src/pixi/textures.ts`로 체인 위치 확인. **BattleRenderer line 188이 `textures.loadTiles()`를 호출하므로 loadFx는 자동 배선** — Task 5에서 별도 로드 호출 불필요.)*

- [ ] **Step 5: typecheck**

Run: `pnpm --filter @tk/web typecheck`
Expected: 에러 없음(exit 0)

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/pixi/textures.ts
git commit -m "feat(fx): FX_FILES + loadFx + getFx resolver (mirrors getObject)"
```

---

### Task 4: `FxLayer` 이미지 변형 + 폴백

3개 메서드가 텍스처 있으면 additive 스프라이트, 없으면 기존 Graphics. pixi 렌더라 단위테스트 없음 — 검증 = typecheck + 기존 web 테스트 그린(무회귀) + Task 6 브라우저 검증.

**Files:**
- Modify: `apps/web/src/pixi/layers/FxLayer.ts`
- Reference: `apps/web/src/pixi/textures.ts` (`TextureResolver` 타입), `apps/web/src/pixi/fxKeys.ts`

- [ ] **Step 1: import + 생성자에 리졸버 주입(옵셔널)**

상단 import에 `Sprite` 추가, fxKeys·리졸버 타입 import:
```typescript
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { TextureResolver } from "../textures";
import { FX, pickFlashKey } from "../fxKeys";
```
생성자: `constructor(tweens: TweenRunner, textures?: TextureResolver)` — 필드 `private readonly textures?: TextureResolver;` 보관. **옵셔널**이라 기존 호출(있다면)·테스트 무파손.

- [ ] **Step 2: 공통 헬퍼 — additive 스프라이트 1회 재생**

클래스에 private 헬퍼 추가(텍스처 소유 안 함 — 스프라이트만 destroy, texture 유지):
```typescript
/** fx 텍스처를 additive 스프라이트로 1회 재생. update(t, sprite)로 트윈, ms 후 제거. */
private playFxSprite(
  key: string, at: WorldPoint, ms: number,
  update: (t: number, s: Sprite) => void, baseRot = 0,
): Promise<void> | null {
  const tex = this.textures?.getFx(key);
  if (!tex) return null; // 폴백 신호
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.blendMode = "add";
  s.position.set(at.x, at.y);
  s.rotation = baseRot;
  this.world.addChild(s);
  return this.tweens.run(ms, (t) => update(t, s)).then(() => {
    this.world.removeChild(s);
    s.destroy(); // texture는 공유 캐시라 파기 안 함
  });
}
```

- [ ] **Step 3: `slashArc` 이미지 분기** — 메서드 맨 앞에 시도, 실패 시 기존 코드로

`slashArc(from, to, indirect=false)` 본문 시작부에:
```typescript
const dx0 = to.x - from.x, dy0 = to.y - from.y;
const ang0 = Math.atan2(dy0, dx0);   // 공격 방향 (기존 line 217과 동일 관례)
const img = this.playFxSprite(FX.slash, { x: to.x, y: to.y - 8 }, SLASH_MS, (t, s) => {
  const e = easeOut(t);
  s.rotation = ang0 + (e - 0.5) * 0.9;          // 휘두르는 쓸기
  s.scale.set(0.8 + e * 0.5);
  s.alpha = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
  if (indirect) s.tint = 0x9fd8ff;              // 간접=청백(PIERCE_TINT 톤)
}, ang0);
if (img) return img;
// ── 폴백: 기존 절차적 호 (아래 원래 코드 그대로) ──
```
*(원래 `slashArc` 본문은 그대로 남겨 폴백으로 사용.)*

- [ ] **Step 4: `impactFlash`에 `big` 옵션 + 이미지 분기**

시그니처: `impactFlash(at: WorldPoint, big = false)`. 본문 시작부:
```typescript
const key = pickFlashKey(big);                  // big→sparkle, else flash
const scaleTo = big ? 2.0 : 1.3;
const img = this.playFxSprite(key, { x: at.x, y: at.y - 6 }, big ? 220 : FLASH_MS, (t, s) => {
  s.scale.set(0.5 + t * scaleTo);
  s.alpha = Math.max(0, 1 - t);
});
if (img) return img;
// ── 폴백: 기존 흰 원 (아래 원래 코드) ──
```

- [ ] **Step 5: `retreatBurst`에 코인팝 분기**

`retreatBurst(at)` 시작부:
```typescript
const img = this.playFxSprite(FX.coin, { x: at.x, y: at.y - 4 }, RETREAT_MS, (t, s) => {
  const e = 1 - (1 - t) * (1 - t);              // ease-out
  s.position.y = at.y - 4 - 18 * e;             // 튀어오름
  s.scale.set(0.6 + e * 0.7);
  s.alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
});
if (img) return img;
// ── 폴백: 기존 흰/연두 파편 (아래 원래 코드) ──
```

- [ ] **Step 6: typecheck + 기존 테스트 무회귀 확인**

Run: `pnpm --filter @tk/web typecheck && pnpm --filter @tk/web test`
Expected: typecheck 0 에러; 기존 테스트 전부 PASS(fxKeys 포함). FxLayer 변경은 옵셔널 리졸버·시그니처 옵션이라 기존 통합테스트 무파손.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/pixi/layers/FxLayer.ts
git commit -m "feat(fx): image variants for slash/impact/retreat with procedural fallback"
```

---

### Task 5: `BattleRenderer` 배선

`FxLayer`에 리졸버 주입 + `loadFx` 보장 + `big` 전달. typecheck + web 테스트 그린.

**Files:**
- Modify: `apps/web/src/pixi/BattleRenderer.ts` (FxLayer 생성부 ~ damageDealt strike(line 651-652) ~ ultimate(line 784))

- [ ] **Step 1: FxLayer 생성에 리졸버 주입**

mount의 line 189 `const fx = new FxLayer(tweens);` — 지역변수 `textures`(line 182에서 `new TextureResolver(...)`)를 두 번째 인자로 추가:
```typescript
const fx = new FxLayer(tweens, textures);
```
*(`grep -n "new FxLayer" apps/web/src/pixi/BattleRenderer.ts`로 확인. `tweens`(line 179)·`textures`(line 182)는 둘 다 지역변수 — `s.`/`this.` 접두 없음.)*

- [ ] **Step 2: `loadFx` 배선은 자동** — Task 3에서 `loadFx`를 `loadTiles()` 체인에 넣었고, mount line 188이 `textures.loadTiles()`를 호출하므로 fx 로드는 자동. **BattleRenderer에 별도 로드 호출 불필요(확인만, 코드 추가 없음).**

- [ ] **Step 3: `damageDealt` strike에 `big` 전달**

line ~651-652 `strike` 클로저: `impactFlash(popupAt)` → `impactFlash(popupAt, big)`. (`big`은 line 646에 이미 있음.)

- [ ] **Step 4: `ultimate`에 `big=true` 전달**

line ~784 `void s.fx.impactFlash(at);` → `void s.fx.impactFlash(at, true);` (필살=대형 금빛 sparkle).

- [ ] **Step 5: typecheck + 테스트**

Run: `pnpm --filter @tk/web typecheck && pnpm --filter @tk/web test`
Expected: 0 에러, 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/pixi/BattleRenderer.ts
git commit -m "feat(fx): wire FxLayer texture resolver + pass big to impactFlash"
```

---

### Task 6: 실물 시트 슬라이스 + 엔드투엔드 검증

코드 완성 후 실제 fx 에셋을 만들고 브라우저로 확인. **시트 선택·격자·키맵은 Claude가 실물 Read로 확정(비전 QA)** — 포즈/오브젝트 시트 선례.

**Files:**
- Create(asset): `apps/web/public/assets/fx/{slash,flash,sparkle,coin}.png`
- Modify: `.gitignore` (`apps/web/public/assets/fx/_sheet_*.png` 무시)

- [ ] **Step 1: 최적 시트 선택 + 격자 확정** — `_board_dump/{C-1,C-2,D-1}/*.png`를 Read로 비교, 가장 또렷한 1장 선택. 요소 위치(슬래시/섬광/금빛폭발/코인/연기)를 보고 `--keys` 순서·`--grid` 결정.

- [ ] **Step 2: 슬라이스 실행**

```bash
cp "apps/web/public/assets/_board_dump/<선택카드>/<파일>.png" apps/web/public/assets/fx/_sheet_combat.png
python tools/sprite-pipeline/cut_fx_sheet.py apps/web/public/assets/fx/_sheet_combat.png --keys slash,sparkle,flash,smoke,coin[,...] [--grid RxC]
```

- [ ] **Step 3: 컷 결과 비전 QA** — `apps/web/public/assets/fx/{slash,flash,sparkle,coin}.png`를 Read로 확인. 요소가 올바로 잘렸나(슬래시=호, coin=동전더미, sparkle=금빛폭발), 검정배경 유지됐나. 어긋나면 `--grid`/`--keys` 조정 재실행.

- [ ] **Step 4: 브라우저 엔드투엔드 검증**

게임 dev 서버(:3000)에서 사수관 등 전투 로드 → 평타(슬래시+섬광)·격파(코인팝)·필살(대형 금빛) 1회씩 발생시켜 육안 확인. 서버가 새 `/assets/fx/*.png`를 200으로 서빙하는지 curl로도 확인:
```bash
for f in slash flash sparkle coin; do curl -s -o /dev/null -w "$f → %{http_code}\n" "http://localhost:3000/assets/fx/$f.png"; done
```
Expected: 전부 200 image/png. 전투에서 절차적 대신 이미지 이펙트가 보임.

- [ ] **Step 5: 폴백 무회귀 확인** — `assets/fx/`의 한 키를 임시로 치워(예: `slash.png`) 새로고침 → 그 이펙트만 기존 절차적 호로 폴백, 나머지는 이미지. 확인 후 복구.

- [ ] **Step 6: .gitignore + 에셋 커밋**

`.gitignore`에 추가:
```
# fx 원본 시트(대용량·재생성) — 잘린 슬라이스만 추적
apps/web/public/assets/fx/_sheet_*.png
```
```bash
git add .gitignore apps/web/public/assets/fx/slash.png apps/web/public/assets/fx/flash.png apps/web/public/assets/fx/sparkle.png apps/web/public/assets/fx/coin.png
git commit -m "feat(fx): combat hit effect slices (slash/flash/sparkle/coin) + gitignore sheets"
```

---

## 완료 기준

- `python tools/sprite-pipeline/test_cut_fx_sheet.py` PASS
- `pnpm --filter @tk/web test` 전부 PASS(fxKeys 포함, 기존 무회귀)
- `pnpm --filter @tk/web typecheck` 0 에러
- 전투에서 평타·격파·필살이 이미지 이펙트로 표시, fx 제거 시 절차적 폴백(무회귀)
- 게임 상태·밸런스 불변(순수 표현) — sim 리포트카드 게이트 영향 없음

## 마무리(후속, 본 플랜 외)

- CLAUDE.md §12/§15·메모리 갱신은 "업데이트 하자" 워크플로우로.
- #2 앰비언트/화공 VFX는 화공 메커니즘 사이클에서.
