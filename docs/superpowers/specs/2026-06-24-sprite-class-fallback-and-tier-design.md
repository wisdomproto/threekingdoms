# 스프라이트 병종 폴백 + 레벨 tier 스위칭 — 설계

**작성일:** 2026-06-24

**Goal:** ① SD 시트 없는 장수를 병종 기본 이미지로 표시(색 사각형 제거) ② 캐릭터 레벨에 따른 코스메틱 외형 승급(t1→t2→t3) 게임 반영. 둘 다 **순수 표현 변경** — 엔진/밸런스/세이브/manifest 불변.

> **구현 상태(2026-06-28):** 작업 A(계열 폴백)·B(부족 병종 매핑+보드 항목) **구현**. spriteMap `CLASS_SIDE_SPRITE_MAP`에 6병종(중기병·책사·군주·산적·주술사·백성)×진영 추가 + `CLASS_LINE_REP` 계열 폴백(장병/전차→보병, 친위대→중기병, 흉적/의적/이민족→산적) + ally→player 재사용. 보드 SD 드롭다운 11항목 + `GEN` 영문 묘사 주입. ⚠️ 방식 차이: spec의 `LINE_GENERIC`+`unitClasses.line`(데이터 구동) 대신 `CLASS_LINE_REP`(classId 하드코딩 — 후속 리팩터 여지). ⏸ 미완: tier 스위칭(t2/t3 작업 C), beastUnit(1명) 전용 제네릭, **실제 SD 이미지(사용자 생성 대기)**.

---

## 배경 / 현 상태

- `spriteMap.ts`의 `spriteCandidates(commanderId, classId, side)`는 이미 **캐릭터 SD → `classId_side` 제네릭** 폴백을 한다. UnitView가 후보를 순서대로 `getSprite` 시도해 첫 로드 텍스처를 쓰고, 없으면 진영색 사각형 폴백.
- 그러나 제네릭 스프라이트가 **`footman/archer/lightCavalry × player/enemy` 6종뿐**이다. 그 외 병종이나 `ally`측은 폴백 대상이 없어 색 사각형으로 빠진다.
- **감사 결과**(등장 유니크 207유닛 기준): 색 사각형 **33명**.
  - **line 대표로 커버 가능 (15명)**: `heavyCavalry`(cavalry) 7 · `ally`측 `archer`/`footman`/`lightCavalry` 8.
  - **대표 line 제네릭 없음 (18명)**: `bandit` 8 · `civilian` 6 · `strategist` 2 · `beastUnit` 1 · `sorcerer` 1.
- t2/t3 스프라이트는 `cut_posesheet.py`가 `sprites/{id}/t2,t3/front_*.png`에 저장하지만 `manifest.json`엔 등급1만 등록 → `loadSprites`가 로드 안 함 → 게임 미사용(현재 42명 시트 캐릭터 전원 등급1만 표시).

---

## 작업 A — line 기반 제네릭 폴백 (순수 코드)

`spriteCandidates` 폴백 체인을 확장한다:

```
캐릭터 SD(override||commanderId) → classId_side → lineGeneric_side → lineGeneric_player
```

- `LINE_GENERIC: Record<line, spriteClass> = { infantry: "footman", archer: "archer", cavalry: "lightCavalry" }`.
- `line`은 `gameData.unitClasses[classId].line`에서 얻는다(`@tk/data`에 `gameData.unitClasses`로 이미 노출됨 — 패키지 변경 불요, 리뷰 확인 완료).
- `lineGeneric_player` 후보는 **ally 흡수용** — ally 전용 제네릭이 없으니 player 제네릭 텍스처를 재사용(진영색은 유닛 베이스가 구분).
- `line`이 `support`/`bandit`이면 `LINE_GENERIC`에 없으므로 A는 후보를 추가하지 않는다 → 작업 B의 전용 제네릭으로만 해결(footman 근사는 채택하지 않음 — 사용자 결정).

**해결:** 15명(heavyCavalry → 기병 제네릭, ally → player 제네릭 재사용).

**테스트:** `spriteCandidates` 단위 — `(_, heavyCavalry, enemy)` → `lightCavalry_enemy` 포함, `(_, footman, ally)` → `footman_player` 포함(ally→player 재사용, 핵심 동작), `(_, archer, ally)` → `archer_player` 포함, `(_, strategist, enemy)` → 제네릭 후보 없음(B 대기), 기존 `(관우, lightCavalry, player)` → `guanyu` 우선 불변.

---

## 작업 B — 부족 병종 전용 제네릭 (에셋 생성 → 코드 매핑)

대표 line이 없는 5병종의 제네릭 SD를 생성한다:

| 병종 | side | 해당 장수 수 |
|---|---|---|
| strategist | player, enemy | 서서 / 이유 (2) |
| bandit | enemy | 산적류 8 |
| civilian | ally | 백성류 6 |
| beastUnit | enemy | 원윤 1 |
| sorcerer | enemy | 요술사 1 |

- ※ 데이터상 `civilian`/`strategist`/`beastUnit`/`sorcerer`는 `line: "support"`를 공유하나(`bandit`만 별도 line), 외형이 제각각이라 **classId별** 제네릭이 필요하다(하나의 `support_*` 제네릭으론 백성·요술사·맹수를 시각적으로 못 덮음). 표를 classId로 키잉한 이유.
- 생성: 에셋보드에 병종 제네릭 카드 추가(기존 `footman/archer/lightCavalry`를 만든 B-2류 프롬프트 패턴) → Gemini(paid) → `cut`(blob 또는 포즈컷) → `sprites/{classId}_{side}/front_*.png` + manifest.
- 코드: `CLASS_SIDE_SPRITE_MAP`에 `strategist_player` 등 매핑 추가 → `spriteCandidates`가 자동 픽업(추가 로직 불요).
- **순서:** 코드 슬롯(매핑)을 먼저 깔아두면 SD 생성 즉시 자동 표시. 생성 전까지 해당 18명은 색 사각형 유지(임시).

**해결:** 18명.

---

## 작업 C — 레벨 tier 스위칭 (순수 코드)

1. **tier 판정** — `tierForLevel(level: number): 1 | 2 | 3`. 임계 **레벨 16(→t2), 31(→t3)**. 신규 `apps/web/src/pixi/spriteTier.ts`. 순수 함수, 단위 테스트(경계 15→1, 16→2, 30→2, 31→3).
2. **텍스처 로드** (`textures.ts`) — `loadSprites`가 등급1 로드 후 같은 `spriteId`의 `t2/`·`t3/{pose}.png`도 시도. **경로 규약 방식**(allSettled per-file 내성 — manifest·cut 도구 불변). 저장은 기존 `sprites: Map<spriteId, Map<poseKey, Texture>>`의 poseKey에 tier 접두로(등급1=`front_idle` 그대로, t2=`t2:front_idle`, t3=`t3:front_idle`) → getSprite 폴백이 한 줄 lookup 유지.
3. **getSprite tier 인자** — `getSprite(spriteId, view, pose, tier = 1)`. 해당 tier 텍스처, **없으면 t1로 폴백**. 기존 view/pose 폴백(back→front, pose→idle; `textures.ts:645`)이 tier 폴백 **아래**서 합성된다: (tier,view,pose) → … → (t1,front,idle). t2/t3 미보유 캐릭터·병종 제네릭은 자동 t1 → 무회귀.
4. **UnitView/UnitLayer 배선** — `UnitView.setTier(tier)` 메서드 추가(기존 `setActed` 패턴 미러: 값 보관, 변화 시에만 텍스처 갱신). `UnitLayer.sync`가 매 드레인 `tierForLevel(u.level)`로 호출 → UnitView 텍스처 선택 루프가 `getSprite`에 tier 전달. (`UnitViewInit`엔 `level` 없음 → setTier로 주입. sync가 매 드레인 도니 "다음 전투 반영" 의미가 자연 충족.)

**경계(YAGNI):** 전투 중 레벨업으로 tier가 즉시 바뀌는 반영은 생략(다음 전투에 반영). back 뷰는 front 미러라 그대로 동작.

---

## 영향 파일

| 파일 | 작업 |
|---|---|
| `apps/web/src/pixi/spriteMap.ts` | A(line 폴백), B(CLASS_SIDE 매핑 추가) |
| `apps/web/src/pixi/spriteTier.ts` (신규) | C(tierForLevel) |
| `apps/web/src/pixi/textures.ts` | C(t2/t3 로드, getSprite tier 인자) |
| `apps/web/src/pixi/layers/UnitView.ts` | C(텍스처 선택에 tier 적용) |
| `apps/web/src/pixi/layers/UnitLayer.ts` | C(level→tier 주입) |
| `docs/art/asset-board.html` | B(병종 제네릭 카드) |

(`packages/data`는 `gameData.unitClasses.line`이 이미 노출돼 변경 불요 — 리뷰 확인.)

## 진행 순서

1. **A + C 순수 코드 먼저** — 에셋 없이 검증(typecheck/단위테스트/preview). A의 B용 매핑 슬롯도 함께 깔아둠.
2. **B 제네릭 SD 생성** — 보드 프롬프트 준비 → Gemini 생성 → 컷 → 자동 표시.

## 비목표 (YAGNI)

- 전투 중 레벨업 tier 즉시 반영.
- support/bandit의 footman 근사(사용자가 전용 제네릭 생성을 선택).
- 엔진 클래스 tier(병종 승급) 연동 — 코스메틱 tier는 엔진과 별개(§4).
- back_* 등급화(t2/t3 back) — front 미러 유지.
