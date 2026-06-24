# Sprite Class Fallback + Level Tier Switching Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SD 시트 없는 장수를 병종 기본 이미지로 표시(색 사각형 제거) + 캐릭터 레벨에 따른 코스메틱 외형 승급(t1→t2→t3)을 게임에 반영한다. 순수 표현 변경 — 엔진/밸런스/세이브/manifest 불변.

**Architecture:** 스프라이트 해석은 `spriteCandidates`(spriteMap.ts)가 후보 spriteId 리스트를 만들고 `TextureResolver.getSprite`(textures.ts)가 텍스처를 반환하는 구조. 폴백을 두 축으로 확장한다 — (1) **병종 line 대표 제네릭**을 후보에 추가(A), (2) **getSprite에 tier 인자**를 더해 레벨 기반 t2/t3 텍스처를 선택하되 없으면 t1로 폴백(C). UnitView는 `setTier`(기존 `setActed` 패턴)로 tier를 받아 텍스처 선택에 반영. 부족 병종 전용 제네릭(B)은 에셋 생성 후 `CLASS_SIDE_SPRITE_MAP`에 매핑만 추가하면 (1)의 경로로 자동 픽업.

**Tech Stack:** TypeScript, PixiJS 8, Next.js, Vitest. 모노레포 `@tk/web`(apps/web), 데이터 `@tk/data`.

**Spec:** `docs/superpowers/specs/2026-06-24-sprite-class-fallback-and-tier-design.md`

---

## File Structure

| 파일 | 책임 | 작업 |
|---|---|---|
| `apps/web/src/pixi/spriteTier.ts` (신규) | `tierForLevel(level)` 순수 함수 1개 | C |
| `apps/web/src/pixi/__tests__/spriteTier.test.ts` (신규) | tierForLevel 경계 테스트 | C |
| `apps/web/src/pixi/spriteMap.ts` | `spriteCandidates`에 line 제네릭 폴백 + (B) 매핑 슬롯 | A, B |
| `apps/web/src/pixi/__tests__/spriteMap.test.ts` (신규) | spriteCandidates 폴백 테스트 | A |
| `apps/web/src/pixi/textures.ts` | `loadSprites` t2/t3 로드 + `getSprite` tier 인자 | C |
| `apps/web/src/pixi/layers/UnitView.ts` | `setTier` + `applySpriteTexture` tier 적용 + 현재 view 추적 | C |
| `apps/web/src/pixi/layers/UnitLayer.ts` | `sync`에서 `level`→`tierForLevel`→`setTier` | C |
| `docs/art/asset-board.html` | (B) 부족 병종 제네릭 카드 | B |

**커밋 정책:** 이 프로젝트는 `main`에서 직접 작업하고 "업데이트 하자" 워크플로우로 일괄 커밋·푸시한다. 아래 각 Task의 커밋 step은 표준 형식이나, **실행 시에는 사용자 워크플로우에 맞춰 통합 커밋해도 된다**(task별 개별 커밋 강제 아님). 커밋 트레일러: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Chunk 1: 순수 코드 (작업 A + C)

에셋 없이 검증 가능. 완료 시 15명(heavyCavalry·ally)이 병종 제네릭으로 표시되고, 시트 보유 42명이 레벨에 따라 t1/t2/t3 외형으로 표시된다.

### Task 1: `tierForLevel` 순수 함수 (C-1)

**Files:**
- Create: `apps/web/src/pixi/spriteTier.ts`
- Test: `apps/web/src/pixi/__tests__/spriteTier.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/pixi/__tests__/spriteTier.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { tierForLevel } from "../spriteTier";

describe("tierForLevel", () => {
  it("레벨 1~15 → tier 1", () => {
    expect(tierForLevel(1)).toBe(1);
    expect(tierForLevel(15)).toBe(1);
  });
  it("레벨 16~30 → tier 2", () => {
    expect(tierForLevel(16)).toBe(2);
    expect(tierForLevel(30)).toBe(2);
  });
  it("레벨 31+ → tier 3", () => {
    expect(tierForLevel(31)).toBe(3);
    expect(tierForLevel(99)).toBe(3);
  });
  it("방어: 0·음수는 tier 1", () => {
    expect(tierForLevel(0)).toBe(1);
    expect(tierForLevel(-5)).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @tk/web test spriteTier`
Expected: FAIL — `tierForLevel` 모듈 없음.

- [ ] **Step 3: 최소 구현**

`apps/web/src/pixi/spriteTier.ts`:
```ts
/**
 * 캐릭터 레벨 → 코스메틱 외형 tier (1|2|3). CLAUDE.md §4: 외형만 격상, 엔진 스탯/클래스와 별개.
 * 임계: 레벨 16(→t2), 31(→t3). §10 레벨캡(스테이지×1.5+5) 기준 1~2장 t1 / 3~4장 t2 / 5장 t3.
 */
export type SpriteTier = 1 | 2 | 3;

export function tierForLevel(level: number): SpriteTier {
  if (level >= 31) return 3;
  if (level >= 16) return 2;
  return 1;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @tk/web test spriteTier`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/pixi/spriteTier.ts apps/web/src/pixi/__tests__/spriteTier.test.ts
git commit -m "feat(sprite): tierForLevel — level→cosmetic tier (16/31)"
```

---

### Task 2: line 기반 제네릭 폴백 (A)

**Files:**
- Modify: `apps/web/src/pixi/spriteMap.ts`
- Test: `apps/web/src/pixi/__tests__/spriteMap.test.ts` (신규)

폴백 체인: 캐릭터 SD → `classId_side` → `lineGeneric_side` → `lineGeneric_player`(ally 흡수). line은 `gameData.unitClasses[classId].line`.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/pixi/__tests__/spriteMap.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { spriteCandidates } from "../spriteMap";

describe("spriteCandidates — line 제네릭 폴백", () => {
  it("heavyCavalry/enemy → cavalry line → lightCavalry_enemy 폴백", () => {
    const c = spriteCandidates("기령", "heavyCavalry", "enemy");
    expect(c).toContain("lightCavalry_enemy");
  });
  it("footman/ally → infantry line → footman_player 재사용(ally 흡수)", () => {
    const c = spriteCandidates("정봉", "footman", "ally");
    expect(c).toContain("footman_player");
  });
  it("archer/ally → archer_player", () => {
    const c = spriteCandidates("태사자", "archer", "ally");
    expect(c).toContain("archer_player");
  });
  it("strategist/enemy(support line, 제네릭 없음) → 제네릭 후보 없음", () => {
    const c = spriteCandidates("이유", "strategist", "enemy");
    // 캐릭터 전용(commanderId)만, 제네릭 폴백 없음 → B 전용 제네릭 대기
    expect(c).toEqual(["이유"]);
  });
  it("캐릭터 전용 우선 — 관우는 guanyu가 첫 후보", () => {
    const c = spriteCandidates("관우", "lightCavalry", "player");
    expect(c[0]).toBe("guanyu");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @tk/web test spriteMap`
Expected: FAIL — heavyCavalry/ally 케이스에서 폴백 후보 없음.

- [ ] **Step 3: 구현 — `spriteMap.ts` 수정**

상단 import에 추가:
```ts
import { gameData } from "@tk/data";
```

`CLASS_SIDE_SPRITE_MAP` 정의 다음에 LINE_GENERIC 추가:
```ts
/**
 * 병종 line → 대표 제네릭 spriteClass. SD 시트도 classId_side 전용 제네릭도 없는 유닛이
 * 같은 line의 대표 제네릭으로 폴백하게 한다(heavyCavalry→기병 등). support/bandit line은
 * 대표가 없으므로(없음) 폴백 안 함 — 전용 제네릭(CLASS_SIDE_SPRITE_MAP) 생성 시 그 경로로 잡힌다.
 */
const LINE_GENERIC: Record<string, string> = {
  infantry: "footman",
  archer: "archer",
  cavalry: "lightCavalry",
};
// ⚠ lord는 line=infantry라 footman으로 폴백된다(익명 lord = 보병 외형). 현 lord 군주(유비·조조)는
//   전용 SD가 있어 미발생이나, 시트 없는 lord 추가 시 의도된 동작(색사각형 대신 보병).
```

`spriteCandidates` 함수를 교체:
```ts
export function spriteCandidates(commanderId: string, classId: string, side: Side): string[] {
  const out: string[] = [];
  if (commanderId) out.push(COMMANDER_SPRITE_MAP[commanderId] || commanderId);
  const template = CLASS_SIDE_SPRITE_MAP[`${classId}_${side}`];
  if (template) out.push(template);
  // line 대표 제네릭 폴백: 전용 제네릭이 없는 병종(heavyCavalry 등) + ally(전용 제네릭 부재) 흡수.
  const line = gameData.unitClasses[classId]?.line;
  const generic = line ? LINE_GENERIC[line] : undefined;
  if (generic) {
    const sideGeneric = CLASS_SIDE_SPRITE_MAP[`${generic}_${side}`];
    if (sideGeneric) out.push(sideGeneric);
    const playerGeneric = CLASS_SIDE_SPRITE_MAP[`${generic}_player`]; // ally → player 재사용
    if (playerGeneric) out.push(playerGeneric);
  }
  return [...new Set(out)];
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @tk/web test spriteMap`
Expected: PASS (5 tests).

- [ ] **Step 5: 타입 체크**

Run: `pnpm --filter @tk/web typecheck`
Expected: 에러 없음. (`gameData.unitClasses[classId]?.line` 타입 확인 — `gameData`는 `@tk/data` export.)

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/pixi/spriteMap.ts apps/web/src/pixi/__tests__/spriteMap.test.ts
git commit -m "feat(sprite): line-based generic fallback (heavyCavalry/ally → 병종 기본)"
```

---

### Task 3: t2/t3 텍스처 로드 + `getSprite` tier 인자 (C-2, C-3)

**Files:**
- Modify: `apps/web/src/pixi/textures.ts` (`loadSprites` ~223-263, `getSprite` ~645-655)

PixiJS `Assets`/`Renderer` 의존이라 단위테스트 환경이 없다(기존 textures 테스트 없음). **typecheck + preview 검증**으로 진행하고, 순수 로직은 Task 1·2에서 커버됨.

- [ ] **Step 1: `loadSprites` — t2/t3 로드 큐 추가**

`loadSprites`의 loadQueue 구성부(현재 `entry.poses`만 도는 부분)를 교체. poseKey에 tier 접두(`t2:`/`t3:`)를 붙여 저장:
```ts
const loadQueue: Array<{ spriteId: string; key: string; url: string }> = [];
for (const [spriteId, entry] of Object.entries(manifest)) {
  // tier1(루트) — manifest 등록 포즈
  for (const pose of entry.poses) {
    loadQueue.push({ spriteId, key: pose, url: `${SPRITE_BASE}/${spriteId}/${pose}.png` });
  }
  // tier2/3 — manifest 미등록(경로 규약). 같은 포즈명을 t2/t3 폴더에서 시도(없으면 allSettled로 그 키만 빠짐).
  for (const tier of [2, 3] as const) {
    for (const pose of entry.poses) {
      loadQueue.push({
        spriteId,
        key: `t${tier}:${pose}`,
        url: `${SPRITE_BASE}/${spriteId}/t${tier}/${pose}.png`,
      });
    }
  }
}
```

`Promise.allSettled` 결과 반영부에서 `item.pose` 대신 `item.key`를 쓰도록 수정:
```ts
results.forEach((r, i) => {
  if (r.status !== "fulfilled" || !r.value) return;
  const item = loadQueue[i];
  if (!item) return;
  if (!this.sprites.has(item.spriteId)) {
    this.sprites.set(item.spriteId, new Map());
  }
  this.sprites.get(item.spriteId)!.set(item.key, r.value);
});
```
(loadQueue 항목의 `pose` 필드명을 `key`로 바꿨으므로 참조도 `item.key`로.)

- [ ] **Step 2: `getSprite` — tier 인자 + tier→t1 폴백**

`getSprite` 시그니처와 본문 교체:
```ts
/**
 * 스프라이트 텍스처 조회. tier(1|2|3) 우선, 없으면 t1로 폴백.
 * 각 tier 안에서 기존 view/pose 폴백(back→front, pose→idle)이 합성된다.
 * 폴백 순서: (tier,view,pose) → (tier,view,idle) → (tier,front,pose) → (tier,front,idle)
 *           → (t1,view,pose) → (t1,view,idle) → (t1,front,pose) → (t1,front,idle) → null.
 */
getSprite(
  spriteId: string,
  view: "front" | "back",
  pose: "idle" | "move" | "attack",
  tier: 1 | 2 | 3 = 1,
): Texture | null {
  const poseMap = this.sprites.get(spriteId);
  if (!poseMap) return null;
  const tp = tier > 1 ? `t${tier}:` : "";
  return (
    poseMap.get(`${tp}${view}_${pose}`) ??
    poseMap.get(`${tp}${view}_idle`) ??
    poseMap.get(`${tp}front_${pose}`) ??
    poseMap.get(`${tp}front_idle`) ??
    // tier 미보유 → t1 폴백 (tp="" 일 때는 위 4줄과 중복이나 ?? 단락이라 무해)
    poseMap.get(`${view}_${pose}`) ??
    poseMap.get(`${view}_idle`) ??
    poseMap.get(`front_${pose}`) ??
    poseMap.get("front_idle") ??
    null
  );
}
```

- [ ] **Step 3: 로드 카운트 로그 확인(선택)**

`loadSprites` 끝의 `console.info` 메시지는 그대로 둔다(이제 t2/t3 포함 컷 수가 늘어남 — 정상).

- [ ] **Step 4: 타입 체크**

Run: `pnpm --filter @tk/web typecheck`
Expected: 에러 없음. (`getSprite` 호출처 UnitView는 Task 4에서 tier 전달 — 그 전엔 기본값 1로 기존 동작 유지.)

- [ ] **Step 5: 전체 테스트(회귀 없음 확인)**

Run: `pnpm --filter @tk/web test`
Expected: 기존 테스트 전부 PASS (getSprite 기본값 tier=1 → 기존 동작 불변).

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/pixi/textures.ts
git commit -m "feat(sprite): load t2/t3 cosmetic tiers + getSprite tier arg (t1 fallback)"
```

---

### Task 4: UnitView/UnitLayer tier 배선 (C-4)

**Files:**
- Modify: `apps/web/src/pixi/layers/UnitView.ts` (`applySpriteTexture` ~257, `setActed` 근처)
- Modify: `apps/web/src/pixi/layers/UnitLayer.ts` (`sync` — `setActed` 호출부 근처)

- [ ] **Step 1: UnitView — tier 상태 + 현재 view 추적 필드 추가**

`UnitView` 클래스 필드부(예: `private actedDim = false;` 근처)에 추가:
```ts
private tier: 1 | 2 | 3 = 1;
// 현재 view는 UnitView 기존 `private view` 필드 재사용 — 별도 추적 필드 불요(리뷰 권고).
```

`SpriteTier` 타입 import:
```ts
import { tierForLevel, type SpriteTier } from "../spriteTier";
```
(tierForLevel은 UnitLayer에서 쓰지만, 타입 일관을 위해 여기선 `SpriteTier`만 써도 됨. UnitLayer에서 import해도 무방 — Step 3 참조.)

- [ ] **Step 2: `applySpriteTexture` — view 저장 + tier 전달**

`applySpriteTexture` 본문에서 (a) 시작부에 현재 view 저장, (b) getSprite에 tier 전달:
```ts
private applySpriteTexture(view: "front" | "back", pose: "idle" | "move" | "attack"): void {
  if (this.skeletonView) return;
  this.pose = pose;
  if (this.spriteCands.length === 0) return;

  let tex = null;
  for (const sid of this.spriteCands) {
    tex = this.textures.getSprite(sid, view, pose, this.tier); // ← tier 전달
    if (tex) break;
  }
  if (!tex) return;
  // ... (이하 기존 스케일/표시 로직 그대로)
```

- [ ] **Step 3: `setTier` 메서드 추가 (setActed 패턴 미러)**

`setActed` 메서드 근처에 추가:
```ts
/** 코스메틱 외형 tier 설정. 변경 시에만 현재 view/pose 텍스처를 재적용(setActed 패턴). */
setTier(tier: SpriteTier): void {
  if (this.tier === tier) return;
  this.tier = tier;
  if (!this.skeletonView) this.applySpriteTexture(this.view, this.pose);
}
```

- [ ] **Step 4: UnitLayer.sync — level→tier 주입**

`UnitLayer.ts`의 `sync`에서 `setActed` 호출 줄 근처(유닛 v를 state로 갱신하는 부분)에 추가:
```ts
v.setActed(u.side === "player" && u.acted);
v.setTier(tierForLevel(u.level)); // ← 추가
```

`UnitLayer.ts` 상단 import:
```ts
import { tierForLevel } from "../spriteTier";
```

- [ ] **Step 5: 타입 체크 + 전체 테스트**

Run: `pnpm --filter @tk/web typecheck && pnpm --filter @tk/web test`
Expected: 타입 에러 없음, 기존 테스트 전부 PASS.

- [ ] **Step 6: preview 검증 (시각 확인)**

dev 서버(:3000)에서 전투 진입 — 시트 보유 캐릭터(관우/유비/장비 등) 중 레벨 16+ / 31+ 유닛이 t2/t3 외형(갑옷·탈것 호화)으로 표시되는지 확인. 색 사각형이던 heavyCavalry(적장) / ally 유닛이 병종 기본 이미지로 표시되는지 확인. 콘솔에 `[TextureResolver] 스프라이트 로드 완료` 컷 수가 t2/t3 포함해 증가했는지.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/pixi/layers/UnitView.ts apps/web/src/pixi/layers/UnitLayer.ts
git commit -m "feat(sprite): wire level→tier into UnitView (setTier mirrors setActed)"
```

---

## Chunk 2: 부족 병종 전용 제네릭 (작업 B)

대표 line이 없는 5병종(strategist·bandit·civilian·beastUnit·sorcerer)의 제네릭 SD를 생성한다. **에셋 생성(Gemini paid)이 선행**하므로, 이 chunk는 코드 step(매핑)과 에셋 step(생성)을 분리한다. 에셋 생성 전까지 해당 18명은 색 사각형 유지(임시) — Chunk 1의 line 폴백은 이들에 적용 안 됨(support/bandit line은 LINE_GENERIC에 없음).

### Task 5: 제네릭 SD 생성 + 매핑

**Files:**
- Modify: `docs/art/asset-board.html` (병종 제네릭 카드 추가)
- Modify: `apps/web/src/pixi/spriteMap.ts` (`CLASS_SIDE_SPRITE_MAP` 매핑 추가 — **SD 생성 후**)

- [ ] **Step 1: 에셋보드에 병종 제네릭 카드 추가**

`docs/art/asset-board.html`에서 기존 `footman/archer/lightCavalry` 제네릭을 만든 카드(B-2류, blob 방식)를 참고해 다음 제네릭 카드를 추가한다. SD 포즈 = front idle/move/attack, facing=screen-left, 투명 배경:
- `strategist_player`, `strategist_enemy` (책사 — 도포·두루마리·도보)
- `bandit_enemy` (산적 — 가죽·도끼/곤봉)
- `civilian_ally` (백성 — 평민복, 비무장)
- `beastUnit_enemy` (맹수부대 — 야수 동반)
- `sorcerer_enemy` (요술사 — 주술 복장)

(이 step은 보드 편집이며, 실제 이미지 생성은 다음 step.)

- [ ] **Step 2: 제네릭 SD 생성 (Gemini paid)**

보드에서 각 카드 📤 → `serve.py` 자동 컷, 또는 자동 파이프라인(`tools/sprite-pipeline/gen/`)으로 생성. 결과: `apps/web/public/assets/sprites/{classId}_{side}/front_{idle,move,attack}.png` + `manifest.json` 등록.
⚠️ 이미지 모델은 paid tier 필수(CLAUDE.md §3). 생성 결과는 Claude가 Read로 비전 QA(투명 배경·방향·형태) 후 필요 시 재생성.

- [ ] **Step 3: `CLASS_SIDE_SPRITE_MAP` 매핑 추가**

**SD 파일이 실제 존재하는 것만** 추가(spriteMap.ts 주석 정책 — 존재하지 않는 spriteId 매핑 금지). `apps/web/src/pixi/spriteMap.ts`:
```ts
export const CLASS_SIDE_SPRITE_MAP: Record<string, string> = {
  footman_player:       "footman_player",
  archer_player:        "archer_player",
  lightCavalry_player:  "lightCavalry_player",
  footman_enemy:        "footman_enemy",
  archer_enemy:         "archer_enemy",
  lightCavalry_enemy:   "lightCavalry_enemy",
  // ↓ Task 5에서 생성된 것만 추가
  strategist_player:    "strategist_player",
  strategist_enemy:     "strategist_enemy",
  bandit_enemy:         "bandit_enemy",
  civilian_ally:        "civilian_ally",
  beastUnit_enemy:      "beastUnit_enemy",
  sorcerer_enemy:       "sorcerer_enemy",
};
```
(`spriteCandidates`는 수정 불요 — `classId_side`를 이미 본다. `civilian_ally`처럼 ally 전용 제네릭이 생기면 line 폴백보다 먼저 직접 매칭된다.)

- [ ] **Step 4: preview 검증**

전투에서 책사(서서/이유)·산적·백성·요술사가 색 사각형이 아닌 병종 기본 이미지로 표시되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/pixi/spriteMap.ts docs/art/asset-board.html
git commit -m "feat(sprite): generic SD for strategist/bandit/civilian/beastUnit/sorcerer"
```
(생성된 SD PNG는 `sprites/`가 gitignore라 커밋 제외 — R2 업로드는 `tools/upload-assets.py`.)

---

## 검증 요약

- **단위 테스트**(Task 1·2): `pnpm --filter @tk/web test` — tierForLevel 4 + spriteCandidates 5 신규 통과, 기존 회귀 없음.
- **타입**: `pnpm --filter @tk/web typecheck`.
- **preview**(Task 4·5): 색 사각형 33명 → 병종 기본 이미지(15명 즉시 + 18명 B 생성 후), 시트 보유 42명 레벨별 t1/t2/t3.

## 비목표 (YAGNI)

- 전투 중 레벨업 tier 즉시 반영(다음 전투에 반영 — sync가 매 드레인 도므로 자연 충족).
- support/bandit footman 근사(전용 제네릭으로 해결).
- 엔진 클래스 tier(병종 승급) 연동.
- back_* t2/t3 등급화(front 미러 유지).
