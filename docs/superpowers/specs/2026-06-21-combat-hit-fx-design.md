# 전투 타격 FX 이미지화 — 설계 (Sub-project #1)

> 2026-06-21. 길중이 생성한 전투 타격 이펙트 시트(C/D, `_board_dump/`)를 게임의 절차적 Graphics 이펙트에 드롭인한다.

## 배경 / 동기

CLAUDE.md §12(도파민 — 격파 코인팝·크리 잭팟)·§15에서 전투 VFX는 "코드로 그림"으로 분류돼 있다(`FxLayer`가 PixiJS `Graphics`로 원·호·사각형 + 트윈만 그림, 텍스처 미사용). 길중이 보드에서 양질의 발광 이펙트 시트(참격호·금빛폭발·적록임팩트·연기·**코인팝**·섬광)를 생성했고, 현재 `apps/web/public/assets/_board_dump/{C-1,C-2,D-1}/`에 원본 보존돼 있다. 이 그림을 코드 이펙트에 얹어 전투 손맛을 격상한다(§2-1 게임성 격상, §12 카지노 결산 톤).

## 범위 결정 (분해)

길중이 고른 "C. 앰비언트 포함" 범위는 **독립된 두 서브시스템**이다. 본 스펙은 **#1만** 다룬다.

- **#1 (본 스펙) 전투 타격 FX** — 슬래시·섬광·스파클·코인팝. *transient* 이펙트, 기존 전투 이벤트로 즉시 구동, 엔진/지형 의존 없음.
- **#2 (별도 사이클) 앰비언트/화공 VFX** — K-8 불·연기·먼지 *지속* 오버레이. "불타는 타일"을 만들 **화공 메커니즘**(점화·확산·피해)이 선행돼야 하며 이는 CLAUDE.md §11-C "후속"으로 미구현. K-8 아트는 `_board_dump`에 보존, 화공 메커니즘과 묶어 후속.

### 비범위 (명시)

- 화공/연소 지형 메커니즘, 지속 타일 오버레이 레이어.
- 새 전투 이벤트·트리거 추가(기존 seam만 사용).
- 데미지/명중/밸런스 등 **게임 상태에 영향 주는 변경 일절 없음** — 본 작업은 순수 *표현*(§11 "순수 표현, 게임 상태 불변, TweenRunner 경유 배속 존중").
- 일기토 컷신(§9, 별건), UI 시트(L-*), 신규 지형 바닥(K-1~3).

## 현재 구조 (탐색 결과)

`apps/web/src/pixi/layers/FxLayer.ts` — 이펙트 호출 seam은 **3개 메서드**:

| 메서드 | 현재(절차적) | 호출 트리거(BattleRenderer) |
|---|---|---|
| `slashArc(from, to, indirect)` | 흰금빛 호 1회 트윈(`SLASH_MS=200`) | `damageDealt`(평타, line ~651) |
| `impactFlash(at)` | 흰빛 원 확장·소멸(`FLASH_MS=110`) | `damageDealt`·`flank`(협공)·`ultimate`(필살) |
| `retreatBurst(at)` | 흰빛 섬광 + 흰/연두 파편 10개 방사(`RETREAT_MS=600`) | `unitRetreated`(격파) |

`damagePopup`/`missPopup`/`healPopup`/`banner`는 **텍스트** — 본 작업 비대상(이미지화 안 함).

트리거 사이트가 이 3개 메서드로 수렴하므로, **메서드 내부만** 이미지화하면 트리거 코드는 0 수정으로 전부 반영된다. `damageDealt`는 `big`(intensity≥0.85 또는 반격) 플래그를 이미 계산함 — 회심/대형타 구분에 재사용.

텍스처 로딩 패턴 = `textures.ts`의 `OBJECT_FILES`/`loadObjects()`/`getObject(key)` (line 397·421). FX도 동일 패턴으로 미러.

## 아키텍처 — 4개 유닛

### 유닛 1: 슬라이스 도구 `tools/sprite-pipeline/cut_fx_sheet.py`

- **책임**: 발광 이펙트 시트(검은 배경) → `apps/web/public/assets/fx/{key}.png` 개별 컷.
- **검은배경 처리**: 알파 제거 **안 함**. 렌더가 additive 블렌드라 검정=무가산 → 투명화 불필요. 컷은 **휘도(luminance) 기반 bbox**로 요소만 크롭(`bg_remove`의 흰배경 로직과 대칭: 밝은 픽셀=내용).
- **격자**: `cut_object_sheet`처럼 휘도 기반 간격 감지 + `--grid RxC` 폴백. 실제 시트 배치는 생성물 보고 맞춤(비전 QA — Claude가 컷 결과 Read로 확인 후 키 매핑 조정, 포즈/오브젝트 시트 선례).
- **키맵**(C-1 기준, 실물 보고 확정): `slash`(참격호), `flash`(흰 섬광 — 평타 임팩트), `sparkle`(금빛 폭발 — 회심/필살), `coin`(코인팝 — 격파 §12), `smoke`(연기, 보조).
- **입력**: `_board_dump/{card}/*.png` 중 택1(가장 좋은 시트). **출력**: `assets/fx/*.png`.
- **gitignore**: `assets/fx/_sheet_*.png`(원본 시트)만 무시, 잘린 `{key}.png` 슬라이스는 추적(tiles/objects 관례 일치).

### 유닛 2: 텍스처 리졸버 확장 `apps/web/src/pixi/textures.ts`

- **책임**: fx 텍스처 1회 로드 + 키→Texture 조회.
- **인터페이스**: `getFx(key: string): Texture | null` (미보유=null → 폴백 신호). `OBJECT_FILES`↔`FX_FILES`, `loadObjects`↔`loadFx`, `objectTex`↔`fxTex`, `OBJECT_BASE`↔`FX_BASE = assetUrl("/assets/fx")` 그대로 미러.
- **의존**: PixiJS `Assets`, `assetUrl`. 로드 실패해도 throw 안 함(빈 맵 유지 = 전부 폴백).

### 유닛 3: `FxLayer` 이미지 변형 `apps/web/src/pixi/layers/FxLayer.ts`

- **책임**: 3개 메서드가 fx 텍스처 있으면 `Sprite`(additive 블렌드)+기존 트윈, 없으면 기존 `Graphics` 폴백.
- **인터페이스 변화**: 생성자에 `TextureResolver` 주입(현재 `tweens`만). 메서드 시그니처 **불변**(호출부 무수정).
  - `slashArc`: `getFx('slash')` → 스프라이트를 공격 방향 회전·쓸기 트윈(현 `drawArc`의 sweep을 sprite.rotation/scale로). 없으면 현 Graphics 호.
  - `impactFlash`: `getFx('flash')` → 스프라이트 확장·페이드. 없으면 현 흰 원.
  - `retreatBurst`: `getFx('coin')` → 코인팝 스프라이트가 튀어오르며 페이드(§12). 없으면 현 흰/연두 파편.
  - **신규 분기**: `impactFlash(at, big=false)` 옵션 — `big`이면 `getFx('sparkle')`(대형 금빛). `damageDealt`/`ultimate`의 기존 `big` 전달. 폴백 시 기존 큰 원.
- **렌더 규약**: 스프라이트 `anchor 0.5`, `blendMode='add'`, world 컨테이너(카메라 변환 하), 트윈은 기존 `TweenRunner`(배속 timeScale 존중·§11). 1회 재생 후 `destroy`.
- **의존**: `TextureResolver`, `TweenRunner`, PixiJS `Sprite`.

### 유닛 4: 배선 `apps/web/src/pixi/BattleRenderer.ts`

- **책임**: mount 시 `loadFx` 보장(기존 `loadObjects`와 함께), `FxLayer`에 리졸버 주입.
- **트리거 사이트 무수정** — `slashArc`/`impactFlash`/`retreatBurst` 호출은 그대로. 단 `ultimate`/`damageDealt`에서 `impactFlash(at, big)`로 `big` 전달(시그니처 옵션 추가라 하위호환).

## 데이터 흐름

```
mount → textures.loadFx(assets/fx/*)         [1회, 실패해도 빈 맵]
      → new FxLayer(tweens, textures)
이벤트(damageDealt/flank/ultimate/unitRetreated)
      → BattleRenderer가 기존대로 slashArc/impactFlash/retreatBurst 호출
      → 메서드가 getFx(key) 확인
         ├ Texture → Sprite(additive) + 기존 트윈
         └ null    → 기존 Graphics(절차적) 폴백
```

## 이벤트 → fx 키 매핑

| 이벤트 | 메서드 | fx 키 | 폴백 |
|---|---|---|---|
| `damageDealt` 평타 | `slashArc` + `impactFlash(big)` | `slash` + (`flash`\|`sparkle` if big) | 호 + 원 |
| `damageDealt` 간접(궁/포) | `slashArc(indirect)` | `slash`(청백 tint) 또는 별도 `pierce` | 직선 스트로크 |
| `flank` 협공 | `impactFlash` | `flash` | 원 |
| `ultimate` 필살 | `impactFlash(big=true)` | `sparkle` | 큰 원 |
| `unitRetreated` 격파 | `retreatBurst` | `coin` | 흰/연두 파편 |

## 폴백 / 회귀 안전

스프라이트·오브젝트와 **동일한 드롭인 계약**: fx 이미지 없으면 100% 현재 절차적 연출 유지 → **무회귀**. 부분 보유(예: `slash`만)도 키별 독립 폴백. 길중이 슬라이스를 R2/public에 넣으면 새로고침으로 격상.

## 테스트 전략

- **순수 로직(단위 테스트 가능)**: ① 슬라이스 도구의 휘도 bbox·격자 분할(픽셀 입력→칸 수) ② `getFx` 키 해석(보유/미보유→Texture|null) ③ 이벤트→키 매핑 + `big` 분기 선택(폴백 결정 함수를 순수화해 테스트).
- **비주얼(브라우저 검증)**: FxLayer 트윈 렌더는 PixiJS라 단위테스트 부적합 → preview/Chrome로 평타·격파·필살 1회씩 육안 + 폴백(이미지 제거 시 절차적 유지) 확인.
- **회귀 게이트**: 기존 `pnpm --filter @tk/web typecheck`·sim 테스트 그린 유지. FxLayer 시그니처 옵션 추가는 하위호환.

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `tools/sprite-pipeline/cut_fx_sheet.py` | 신규 | 발광 시트 → `assets/fx/{key}.png` 휘도 컷 |
| `apps/web/src/pixi/textures.ts` | 수정 | `FX_FILES`·`loadFx`·`getFx` (getObject 미러) |
| `apps/web/src/pixi/layers/FxLayer.ts` | 수정 | 3 메서드 이미지 변형 + 폴백, 생성자에 리졸버 |
| `apps/web/src/pixi/BattleRenderer.ts` | 수정 | `loadFx` 배선, `FxLayer` 리졸버 주입, `big` 전달 |
| `apps/web/public/assets/fx/{slash,flash,sparkle,coin,smoke}.png` | 신규(에셋) | 잘린 슬라이스(추적) |
| `.gitignore` | 수정 | `assets/fx/_sheet_*.png` 무시 |
| `packages/.../*.test.ts` 또는 web 테스트 | 신규 | 순수 로직 3종 단위 테스트 |

## 미해결 / 구현 시 확정

- 실제 시트 격자(C-1 vs D-1, 몇 행×열) — 슬라이스 단계에서 실물 Read 후 키맵 확정.
- `slash` 스프라이트의 회전·쓸기 트윈 파라미터(현 `drawArc` sweep을 sprite로 옮길 때 시각 튜닝) — 브라우저 검증으로 조정.
- 간접공격(궁/포) 전용 `pierce` 키를 둘지, `slash` tint 재사용할지 — 실물 시트에 관통형 요소 있으면 분리.
