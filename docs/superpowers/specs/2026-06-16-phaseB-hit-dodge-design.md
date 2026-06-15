# Phase B: 기본 전투 RNG — 명중/회피 (시드 고정) 설계

> 날짜: 2026-06-16 · 로드맵 Phase B (A 완료 위에) · 전투 모델 = 시드 고정 확률(§2-1, 2026-06-16)
> 레퍼런스: docs/reference/yeonggeoljeon-rifine-combat.md(순발력=명중/회피), docs/reference/sosoden-combat-formula.md §3(명중률)
> 선행: Phase A(시드 RNG 기반) — `rng.ts nextRandom`·`BattleState.rngState`·소비 계약.

## 0. 스코프 (조사로 좁힘)

조사 결과(2026-06-16): 우리 commanders는 3스탯(통솔/무력/지력)뿐 — **민첩·운 없음**. 병종 `agility`
등급은 "미사용 보존". 조조전 `generals.json`엔 `agi`/`luck` 존재(스케일 ÷2). 조조전 원작은 **데미지
분산 없음**.

- ✅ **명중/회피 (순발력 기반 시드확률)** — Phase B 코어.
- ❌ **데미지 분산** — 드롭(조조전/리파인 원작에 없음, 충실 = 안 넣음).
- ⏸ **회심(치명)** — B2로 분리(운 데이터·공식 별도).

## 1. 명중 공식 (완만/플레이버 — 길중 결정 2026-06-16)

순수 함수 `hitChance(atkAgi, defAgi, cfg) → 0..100`:
```
명중% = clamp(100 − missSlope × max(0, defAgi − atkAgi), floorPercent, 100)
```
- 동급(atkAgi=defAgi) → **100%**. 방어자가 빠를수록 하락, **하한 floorPercent**.
- 기본값: `missSlope = 0.5`, `floorPercent = 80` → 방어자가 40 빠르면 바닥 80%(최대 20% 미스).
- §2-3 "캐주얼 우선·막힘없이 완주" 준수 — 빡센 회피는 후속(아이템/병종 특성/챌린지)로.
- **데이터 구동**: `combat.json`에 `accuracy: { missSlope, floorPercent }` 추가(언제든 조절). `필중`
  계열(사소검 등 — 후속 Phase)이 생기면 이 롤을 우회한다.

## 2. 순발력(agility) 파생

`순발력(Lv) = floor(민첩/2) + 등급계수(agility 등급)×Lv` (다른 스탯과 동형, growth.ts corpsStat 재사용).
- 입력 = 장수 `민첩`(신규 commander 필드) + 병종 `agility` 등급(기존, 활성화).
- `UnitState`에 `agility: number` 추가, `spawnUnit`에서 계산해 주입.

## 3. 데이터 — 민첩 주입

- `CommanderSchema`에 `agility: Stat.optional()`(1~100, 미지정 시 기본 50). 하위호환(기존 JSON 무파손).
- 조조전 `generals.json` 이름매칭 → `agi`(÷2 스케일)를 우리 1~100 스케일로 환산해 매칭되는 장수에 주입.
  - 환산: 조조전 raw는 표시값의 ÷2(combat-formula §1) → 우리 스케일 ≈ `round(agi × 2)` 클램프 1~100.
  - 미매칭(generic 적병-NN/적장-NN 등) = 기본 50(병종 등급이 차이를 만들므로 충분).
  - 1회성 스크립트(`tools/` 또는 packages/data 빌드 스텝)로 commanders.json 갱신 — CRLF/NFC 보존(라인 splice).
- 운(luck)은 B2에서 같은 방식.

## 4. 롤 통합 (Phase A 계약 준수)

- `applyAction`의 attack 경로: 피해 계산 전 `hitChance`로 명중 판정 — `nextRandom(state.rngState)`로
  롤, **rngState 전진을 결과 state에 반영**. 반격도 각자 독립 롤.
- **이벤트 정합(§2-1 계약)**: 명중/빗맞음을 이벤트가 서술 — `damageDealt`에 `hit: boolean` 추가
  (miss = `hit:false, damage:0`). 프레젠터가 hit=false면 "빗나감" 연출, 피해 0 적용. dev `diffSnapshot`
  단언이 통과해야 함(롤 결과가 이벤트에 다 실렸으므로 투영=커밋).
- 빗맞음 시: 피해 0, 격파/SP/콤보/협공 등 후속 효과는 명중한 타격에만. 연속공격(doubleStrike)·반격은
  각 타가 독립 명중 판정.

## 5. 예측 UX

- `attackPreview.ts`: `hitChance`(공유 순수 함수, 엔진과 동일)로 **명중%**를 계산해 forecast에 추가.
- `hud/AttackForecast.tsx`: `명중 N%` 표시(피해 옆). 반격도 `명중 M%`. 100%면 생략 가능(노이즈 감소).
- ⚠️ 종전 "명중% 넣지 말 것"(결정론 전제) 지침 폐기 — 시드확률 전환으로 명중% 표시가 정당.

## 6. AI 정책

- `greedyPolicy`/`naivePolicy`: 행동 가치 = **기댓값**(피해 × 명중%/100). 빗나갈 행동을 과대평가하지
  않게. 시드 고정이라 봇도 결정론적으로 같은 롤을 본다(재현).

## 7. 밸런스 재기준선 (§11)

- 변량 발생 → `reportCard`가 시드 차원 추가: {정책 티어 × 레벨 오프셋 × N시드(예: 8)} → 셀별 **승률**.
- `classify`를 승률 분포 기반으로 갱신(HEALTHY/HARD/…). 회귀 게이트 `BASELINE_LABELS` 재스냅샷.
- **리스크**: 미스 도입으로 일부 스테이지 라벨 변동 가능 — report-card 재생성 후 라벨 검수, 필요 시
  accuracy 노브(floorPercent↑)로 완화. greedy 정렙 승리 게이트는 유지가 목표.

## 8. 컴포넌트 / 파일

| 파일 | 변경 |
|---|---|
| `packages/data/src/schemas.ts` | `CommanderSchema.agility?` + `CombatConfig.accuracy{missSlope,floorPercent}` |
| `packages/data/json/combat.json` | `accuracy` 기본값 |
| `packages/data/json/commanders.json` | 민첩 주입(스크립트) |
| `packages/engine/src/combat.ts` | `hitChance(atkAgi,defAgi,cfg)` 순수 export |
| `packages/engine/src/growth.ts` | agility corpsStat 파생 |
| `packages/engine/src/createBattle.ts` (spawnUnit) | `UnitState.agility` 주입 |
| `packages/engine/src/types.ts` | `UnitState.agility`, `damageDealt.hit` |
| `packages/engine/src/actions.ts` | attack/counter 명중 롤 + 이벤트 hit + rngState 전진 |
| `apps/web/src/battle/attackPreview.ts` | 명중% 계산 |
| `apps/web/src/battle/hud/AttackForecast.tsx` | 명중% 표시 |
| `apps/web/src/battle/eventPlayer.ts` + presenter | hit=false 빗나감 연출 |
| `packages/sim/src/policy.ts` | 기댓값(×명중%) |
| `packages/sim/src/reportCard.ts` + runner | 시드 분포 + 게이트 재스냅샷 |

## 9. 테스트

- `hitChance`: 동급 100%, 방어자 빠름→하락, 하한 floor, 공격자 빠름 100%. 결정론.
- 순발력 파생: 민첩/등급/Lv 단조. spawnUnit agility 주입.
- 명중 롤: 같은 시드 같은 명중 결과(재현). 미스 시 damage=0·hit=false 이벤트·SP/격파 미발생.
- 이벤트 정합: TrackingPresenter로 miss 케이스 diffSnapshot 통과.
- 예측: forecast 명중% = 엔진 hitChance 일치.
- 정책: 기댓값 정렬(낮은 명중 행동 디프리오리타이즈).
- reportCard: 시드 분포 승률 + 게이트 green(재스냅샷).
- 핀 vitest, 전 패키지 회귀.

## 10. 비침범

- 시드 고정(§2-1): 명중 롤은 rngState만, 재현·세이브스컴 방지. 결과는 이벤트에 실어 정합.
- §2-3 캐주얼: 완만 미스(floor 80) — 기본 완주 가능 유지, 빡셈은 후속 레이어.
- 데이터 구동: accuracy·민첩 전부 JSON. 코드-데이터 분리.
