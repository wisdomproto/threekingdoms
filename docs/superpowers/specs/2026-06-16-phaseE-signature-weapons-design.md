# Phase E: 시그니처 무기 배선 + 흡혈 + rangeBonus + 재밸런스 설계

> 날짜: 2026-06-16 · 로드맵 Phase E (A~D 완료 위에) · 전투 모델 = 시드 고정 확률(§2-1)
> 레퍼런스: docs/reference/yeonggeoljeon-rifine-combat.md §3(★시그니처 무기)·§1(특성)
> 선행: Phase C(전투 특성: 무반격·관통·재반격·고정뎀·필중)·D(상태이상).

## 0. 스코프 (길중 확정 2026-06-16 — "+ 용담창 range까지")

**처음으로 실제 게임 동작이 바뀌는 단계.** ★4 시작 시그니처 무기 배선 + 신규 효과 2개 + 재밸런스.

| 장수 | 무기(현황) | 효과 | 매핑 |
|---|---|---|---|
| 관우 | 청룡언월도(장착, 효과 無) | 무반격 | `noCounter`(효과 추가) |
| 장비 | 사모(장착, 효과 無) | 관통 | `multiHit:2`(효과 추가) |
| 유비 | 빈손 | 재반격 | 쌍고검(신규)+배정 `counterStrikes:2` |
| 조운 | 빈손(기병 사거리1) | 간접 2칸 | 용담창(신규)+배정 `rangeBonus:1`(신규 효과) |

추가: **흡혈**(Phase C 연기분) 구현 + 방천화극에 부여(데이터 준비). 보물 풀 전체·적토마(선제/돌파)·
스탯하강·상태회복은 후속(F/E2).

## 1. 신규 효과 2개

### schemas.ts — ItemEffects
```
rangeBonus?: int ≥1        // 사거리 +N (용담창: 기병이 원거리 타격, 사거리 밖이라 자연 무반격)
lifestealPercent?: int 0~100  // 흡혈: 입힌 피해 × % 자가 회복(상한 maxTroops)
```

### UnitState (engine/types)
```
lifestealPercent?: number  // 아이템 집약(합산, 캡 100)
```
rangeBonus는 별도 필드 없이 **spawnUnit에서 rangeMax += rangeBonus**로 흡수(사거리 자체를 늘림).

## 2. 흡혈 — troopsHealed 이벤트 (정공법)

흡혈은 *공격자 회복* → diffSnapshot 정합 위해 **이벤트로 서술**(Phase C에서 막혔던 부분).
- BattleEvent 추가: `troopsHealed { unitId, amount }`.
- resolveStrike: 명중 타격으로 피해를 입힌 뒤 `attacker.lifestealPercent`면 `heal = floor(dmg×pct/100)`,
  `healTroops`(상한 maxTroops)로 회복 + `troopsHealed` emit. (미스·고정뎀 0이면 회복 0.)
- 프레젠터: troopsHealed → troops 증가 투영(FakePresenter/Tracking·BattleRenderer). damageDealt의 역.

## 3. rangeBonus — 원거리 타격

spawnUnit: `rangeMax = cls.rangeMax + (rangeBonus 합)`. (rangeMin 불변 → 1~N 타격 가능.)
- 사거리 2 타격 = 방어자(근접 사거리1)가 반격 불가(기존 counter 거리 게이트 `d≤defender.rangeMax`로 자연 무반격).
- getAttackableTargets·예측·하이라이트는 rangeMax를 이미 사용 → 자동 반영.
- chargeMultiplier(이동 후 기병)는 그대로 — 조운 돌격+원거리 정체성.

## 4. 아이템 데이터 (items.json)

- **청룡언월도**: `effects: { noCounter: true }` 추가(기존 bonusPercent 12 유지).
- **사모**: `effects: { multiHit: 2 }` 추가(장비 관통 = 장팔사모 역할).
- **쌍고검**(신규): weapon, power 255, bonusPercent 0, `effects: { counterStrikes: 2 }`.
- **용담창**(신규): weapon, power 255, bonusPercent 0, `effects: { rangeBonus: 1 }`.
- **방천화극**(기존): `effects: { lifestealPercent: 50, inflictStatus: { kind: "immobilize", chance: 100, turns: 1 } }`
  추가(흡혈 데모 — 보물 배치는 후속이라 시작 장착 아님, 메커니즘·데이터만 준비).

## 5. 시작 장비 배선 (initialForces.json)

- 유비 `items: []` → `["쌍고검"]`.
- 조운 `items: []` → `["용담창"]`.
- 관우·장비는 기존 청룡언월도·사모에 효과만 추가(배선 불요).

> ⚠️ initialForces.json은 원작 추출 — 시작 장비 추가는 *우리 디자인 레이어*(roster/stage가 아닌 초기 편성).
> §6 "★=시그니처 무기로 시작" 정합. CRLF/NFC 보존(라인 splice 스크립트 또는 정밀 편집).

## 6. 재밸런스 (핵심 — §11)

★무기 배선으로 **실제 전투가 바뀐다**(관우 무반격·장비 관통·조운 원거리 → 플레이어 강화). 절차:
1. 배선 후 `pnpm --filter @tk/sim report-card` 재생성.
2. 라벨 변동 검수 — 예상: 일부 스테이지 EASY化(플레이어 강화). **greedy@0 전 스테이지 승리 게이트 유지**가
   최우선(불가/취약 0). EASY는 §2-3 캐주얼 허용 범위 — 과도하면 accuracy.floorPercent↓ 또는 적 보강(후속).
3. `BASELINE_LABELS` 재스냅샷(test/reportCard.test.ts) — 의도된 변동을 새 기준으로 못박음.
   ⚠️ Phase A~D는 "밸런스 불변"이 게이트였지만 **E는 의도적 변동** — 라벨 갱신이 정상.

## 7. 예측·표시

- attackPreview: 흡혈/range는 피해 예측에 직접 영향 적음(range는 getAttackableTargets로 이미). 흡혈 태그
  `lifesteal?: number`를 예측에 추가(연출용, 선택). 용담창 사거리는 타깃팅이 자동 처리.
- BattleRenderer: troopsHealed → 회복 팝(초록) + setTroops 증가.

## 8. 컴포넌트 / 파일

| 파일 | 변경 |
|---|---|
| `packages/data/src/schemas.ts` | ItemEffects.rangeBonus·lifestealPercent |
| `packages/data/json/items.json` | 청룡언월도·사모 effects + 쌍고검·용담창 신규 + 방천화극 effects |
| `packages/data/json/initialForces.json` | 유비 쌍고검·조운 용담창 배정 |
| `packages/engine/src/types.ts` | UnitState.lifestealPercent + BattleEvent troopsHealed |
| `packages/engine/src/createBattle.ts` | spawnUnit rangeMax += rangeBonus, lifestealPercent 집약 |
| `packages/engine/src/actions.ts` | resolveStrike 흡혈(회복+troopsHealed) |
| `apps/web/src/battle/eventPlayer.ts`(+presenters) | troopsHealed 투영 |
| `apps/web/src/pixi/BattleRenderer.ts` | troopsHealed 회복 연출 |
| `packages/sim/test/reportCard.test.ts` | BASELINE_LABELS 재스냅샷 |

## 9. 테스트

- **흡혈**: lifestealPercent 공격자가 피해 N → floor(N×%/100) 회복 + troopsHealed; 상한 maxTroops; 미스/0뎀=회복0.
- **troopsHealed 투영**: TrackingPresenter troops 증가, diffSnapshot 통과.
- **rangeBonus**: 용담창 조운 rangeMax=병종+1; 사거리2 타격 시 반격 없음(기존 거리 게이트).
- **배선 통합**: 청룡언월도 관우=무반격, 사모 장비=관통2, 쌍고검 유비=재반격2, 용담창 조운=range2 (createBattle 후 UnitState 확인 + applyAction 행동 확인).
- **재밸런스 게이트**: report-card greedy@0 전 스테이지 승리 + IMPASSABLE 0; BASELINE_LABELS 새 스냅샷 통과.
- 핀 vitest, 전 패키지 회귀.

## 10. 비침범

- 결정론·시드(§2-1): 흡혈/range/특성 전부 결정론(상태 부여만 시드). 회복도 이벤트로 서술.
- §6 ★ 정체성: 시작 시그니처 무기 = 1스테이지부터 손맛(§16 첫 마일스톤).
- §11 밸런스: E는 *의도적* 변동 — greedy@0 승리 게이트 유지가 불가침, 라벨은 재스냅샷.
- 하위호환: rangeBonus/lifestealPercent optional. 기존 JSON 무파손.
