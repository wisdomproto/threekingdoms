# Phase C: 전투 특성 엔진 (피해/반격 수정자) 설계

> 날짜: 2026-06-16 · 로드맵 Phase C (A·B 완료 위에) · 전투 모델 = 시드 고정 확률(§2-1)
> 레퍼런스: docs/reference/yeonggeoljeon-rifine-combat.md §1(전투 특성 카탈로그)
> 선행: Phase B(명중/회피 롤) — attack 경로의 타격/반격 구조.

## 0. 스코프 (그룹 1 — 피해/반격 수정자, 길중 확정 2026-06-16)

리파인 전투 특성 중 **공격 해석에 국소적인 결정론 수정자 6종**만. 구조적(선제·분전)·이동(돌파·도약)은
Phase C2/C3로 분리.

| 특성 | 의미 | 레퍼런스 |
|---|---|---|
| 무반격 | 공격 시 상대 반격 없음 | 청룡언월도·적토마 |
| 관통(다단 N) | 한 공격이 N회 전타격 | 장팔사모·황충궁 |
| 재반격/연환 | 이 유닛이 반격할 때 N회 친다 | 쌍고검·연환갑옷·여포궁 |
| 고정 피해 | 방어무시 정량(레벨 비례) | 사소검 |
| 필중 | 명중 롤 생략(항상 명중) | 사소검 |
| ~~흡혈~~ | ~~입힌 피해 비례 자가 회복~~ | **Phase E로 연기** |

> **흡혈 연기(2026-06-16)**: 흡혈은 *공격자 회복*을 일으켜 이벤트로 서술해야 하는데(diffSnapshot 계약 —
> 공격자 병력↑가 프레젠터 투영에 반영돼야 함), 회복 이벤트 + 프레젠터 처리가 새로 필요하다. 위 5종은
> 전부 damageDealt로 이미 서술돼 웹/이벤트 추가가 0이라, 흡혈은 회복 이벤트·방천화극 배선과 함께
> **Phase E**에서 다룬다. **Phase C = 5종(무반격·관통·재반격/연환·고정뎀·필중).**

> **Phase C = 메커니즘 + 테스트만.** 실제 아이템에 효과를 *할당하지 않는다*(밸런스 불변) — ★시그니처
> 무기 배선·아이템 대확장은 **Phase E**. 테스트는 합성(patchUnit으로 UnitState 특성 주입)으로 검증.

## 1. 데이터 모델 — ItemEffects 확장 (6필드)

`ItemEffectsSchema`에 추가(전부 optional, 미지정=무효 — 하위호환):
```
noCounter?: boolean              // 무반격(공격자 → 피격자 반격 안 받음)
multiHit?: number (int ≥2)       // 관통: 개시 공격 N회 전타격
counterStrikes?: number (int ≥1) // 재반격/연환: 이 유닛이 반격 시 치는 횟수(기본 1)
flatDamagePerLevel?: number (≥0) // 고정 피해 = 값×(레벨+1), 방어/지형/협공 무시
alwaysHit?: boolean              // 필중(명중 롤 생략)
// (흡혈 lifestealPercent는 Phase E — 회복 이벤트 필요)
```

## 2. UnitState 집약 (spawnUnit)

기존 `damageReduction`/`grantsDoubleStrike`와 동형으로, 소지품 effects를 합쳐 UnitState에 주입:
```
noCounter?: boolean              // OR 합산(하나라도 true면 true)
multiHit?: number                // max(소지 multiHit) — 미보유 시 undefined
counterStrikes?: number          // max(소지 counterStrikes, 1) — 기본 1
lifestealPercent?: number        // 합산(캡 100)
flatDamagePerLevel?: number      // max(소지) — 미보유 시 undefined
alwaysHit?: boolean              // OR 합산
```

## 3. 공격 해석 리팩터 (actions.ts attack)

현재 attack 블록(1타→연속2타→반격, 각 명중 롤 — Phase B)을 **타격 루프**로 정리한다.

### 3-1. 단일 타격 헬퍼 `resolveStrike`
```
resolveStrike(ctx, state, attackerId, defenderId, { counter, mult }) →
  { state, events, hit, dealt }
```
한 번의 타격을 처리: ① 명중 롤(`attacker.alwaysHit`면 생략, 항상 명중) → ② 명중 시 피해 산출
(`attacker.flatDamagePerLevel`면 `값×(lv+1)`(방어/지형/협공 무시, minDamage 하한), 아니면
`computeDamage(...,mult)`) → ③ dealDamage(hit 플래그) + 경험치 + **흡혈**(피해×lifesteal% 자가 회복)
→ 미스면 `damageDealt{damage:0,hit:false}`만. 반환에 hit/dealt(실피해).

### 3-2. 개시 공격 타수
- `strikes = attacker.multiHit ?? (doubleStrikes(legacy)면 2 : 1)`.
  - **multiHit 지정 시 그 횟수**(전부 전타격, 각 독립 명중 롤). 이때 **레거시 이동력 doubleStrike는
    미적용**(무기 multiHit가 타수의 단일 진실).
  - multiHit 미지정 시 **기존 동작 보존**: 1타 + (이동력 우위면 2타 secondHitPercent). ⚠️ Phase B와
    동일 — 회귀 없음. (legacy 2타는 secondHitPercent 부분피해 유지, multiHit는 전타격 — 다른 메커니즘.)
- 각 타격마다 `resolveStrike(counter:false, mult=flank×charge)`. 대상 퇴각 시 중단.

### 3-3. 반격
- 공격자 `noCounter`면 **반격 블록 전체 생략**.
- 아니면 기존 조건(방어자 생존 + 공격자 사거리 안) 충족 시 **`defender.counterStrikes`회** 반복
  `resolveStrike(attacker=defender, counter:true, mult=counterRatio)`. 각 독립 명중 롤. 공격자 퇴각 시 중단.

### 3-4. SP·콤보
- 기존(Phase B) 게이팅 유지: 공격자 SP는 개시 타격이 한 번이라도 명중 시, 피격 SP는 피해 입었고 생존 시.
- 콤보·필살(ultimate)은 불변. 필살은 여전히 무반격·항상명중(별 경로).

## 4. 컴포넌트 / 파일

| 파일 | 변경 |
|---|---|
| `packages/data/src/schemas.ts` | ItemEffectsSchema +6필드 |
| `packages/engine/src/types.ts` | UnitState +6 트레잇 필드 |
| `packages/engine/src/createBattle.ts` (spawnUnit) | effects 집약 |
| `packages/engine/src/actions.ts` | `resolveStrike` 헬퍼 + attack 타격/반격 루프 리팩터 |
| `packages/engine/src/combat.ts` | (선택) flat 피해 헬퍼 `flatStrikeDamage` |

> attack 블록이 Phase B로 커졌다 — `resolveStrike` 추출로 1타/관통/반격을 한 헬퍼로 통일해 가독성↑.

## 5. 예측·표시 (최소)

- `attackPreview.ts`: multiHit/flat/noCounter/흡혈을 예측에 반영(피해=multiHit 합산, noCounter면 반격 생략,
  flat면 고정피해). AttackForecast에 특성 태그(예: `관통3`·`무반격`·`흡혈`)는 **간단 배지**로.
  ⚠️ Phase C는 실제 아이템 미할당이라 인게임 트리거는 Phase E 전까지 없음 — 예측 로직만 정합 유지(테스트로).

## 6. 테스트 (핀 vitest)

합성 UnitState(patchUnit으로 트레잇 주입)로:
- **무반격**: 공격 후 반격 이벤트 없음(노트레잇은 반격 있음 대조).
- **관통 N**: damageDealt(비반격) N개, 합산 피해.
- **재반격/연환**: counterStrikes=2면 반격 damageDealt 2개.
- **흡혈**: 공격자 병력이 입힌 피해×% 회복(상한 maxTroops).
- **고정 피해**: 방어/지형 무관 = 값×(lv+1), 상성 변화에도 불변.
- **필중**: 순발 열세여도 항상 hit=true.
- **합성 결정성**: 같은 시드 → 같은 결과(재현). 시드42 회귀 — 전 패키지 green.
- **밸런스 불변**: 실제 아이템 미변경이므로 reportCard 라벨·BASELINE 그대로(재생성 시 동일).

## 7. 비침범

- 결정론·시드(§2-1): 특성은 전부 결정론(명중 롤만 Phase B 시드). flat/흡혈/관통 난수 없음.
- 데이터 구동: 특성은 ItemEffects(JSON). 코드-데이터 분리.
- 밸런스: Phase C는 메커니즘만 — 실제 아이템 무변경 → 라벨 불변. 할당·재밸런스는 Phase E.
- 하위호환: 전 필드 optional, 기존 아이템/스테이지 무파손.
