# Phase D: 상태이상 서브시스템 (부동·금책·중독) 설계

> 날짜: 2026-06-16 · 로드맵 Phase D (A·B·C 완료 위에) · 전투 모델 = 시드 고정 확률(§2-1)
> 레퍼런스: docs/reference/yeonggeoljeon-rifine-combat.md §2(상태이상)
> 선행: Phase A(시드 RNG)·B(명중 롤)·C(resolveStrike 타격 루프).

## 0. 스코프 (길중 확정 2026-06-16)

상태이상 **공통 인프라 + 부동·금책·중독 3종**. 연기:
- **혼란** → D2(무작위 행동·조작권 상실 — 구조적 침습).
- **스탯 하강**(방어/순발/이동 −) → 후속(각 스탯 read 수정 + ★청룡언월도 방어감소는 Phase E).
- **상태 회복**(태평요술서 등) → Phase E(아이템 배선).

> **Phase D = 메커니즘 + 테스트만.** 실제 아이템에 `inflictStatus` 미할당 → **밸런스 불변**(상태 부여
> 롤은 능력 보유 유닛에만 발생, Phase D엔 0명 → 시드 시퀀스 보존). ★무기 배선은 Phase E.

## 1. 데이터 모델

### schemas.ts
```
StatusKind = z.enum(["poison", "seal", "immobilize"])   // 중독·금책·부동 (확장: confuse/debuff 후속)
StatusEffectSchema = { kind: StatusKind, turns: int ≥1 } // 런타임 부여분(지속 턴)
ItemEffectsSchema.inflictStatus?: { kind: StatusKind, chance: int 0~100, turns: int ≥1 } // 적중 시 부여 능력
CombatConfig.status: { poisonDamage: int ≥0 }.default({ poisonDamage: 20 })  // 중독 1틱 피해(데이터 노브)
```

### UnitState (engine/types)
```
statuses?: StatusEffect[]          // 런타임 부여된 활성 상태(미설정/[]= 없음). spawnUnit에서 []
inflictStatuses?: { kind, chance, turns }[]  // 아이템 effects 집약 — 적중 시 부여 능력(미보유=빈/undefined)
```
spawnUnit: 소지품 effects의 `inflictStatus`를 `inflictStatuses` 배열로 모은다. `statuses` = 미설정(런타임 누적).

## 2. 순수 헬퍼 — `packages/engine/src/status.ts` (신규)

```
hasStatus(u, kind): boolean
applyStatus(statuses, kind, turns): StatusEffect[]   // 같은 kind 있으면 turns=max로 갱신, 없으면 추가(순수)
tickStatuses(ctx, state, side): { state, events }     // side 진영 유닛의 페이즈 시작 처리:
   각 유닛 statuses에 대해 — 중독이면 poisonDamage 피해(troops 차감·0이면 퇴각) + statusTick 이벤트,
   모든 상태 turns−1, 0 이하 제거 + statusExpired 이벤트. 결정론(난수 없음 — 틱은 확정).
```

## 3. 적용 — resolveStrike (actions.ts)

명중한 타격 뒤, **공격자 `inflictStatuses` 각각**에 대해 `chance` **시드 롤**(nextRandom, rngState 전진) →
발동 시 방어자 `statuses = applyStatus(...)` + `statusApplied` 이벤트. (Phase D엔 보유 유닛 0 → 롤 0 → 시드
시퀀스 불변.) 미스 타격은 상태 부여 없음. 필살/책략 부여는 후속(현재 resolveStrike 경유 물리만).

## 4. 지속 틱 — maybeAdvancePhase (actions.ts)

`nextPhase` 확정 후, 그 진영 유닛에 `tickStatuses(ctx, state, nextPhase)` 적용 — 중독 피해 + 만료 처리를
페이즈 시작에 1회. (moved/acted 리셋과 같은 지점.) 빈 페이즈 스킵 재귀와 무관(해당 진영 유닛에만).

## 5. 행동 차단

- **부동(immobilize)**: `assertCanAct(forMove=true)`에 `if (forMove && hasStatus(unit,"immobilize")) throw "부동 상태"`.
  이동만 막고 공격은 가능(공격 케이스는 forMove=false).
- **금책(seal)**: strategy 케이스 진입부에 `if (hasStatus(unit,"seal")) throw "금책 상태"`. 책략만 봉인.

## 6. 이벤트 (engine/types BattleEvent +3)

```
statusApplied  { unitId, kind, turns }   // 부여 — 프레젠터: 상태 아이콘 추가
statusTick     { unitId, kind, damage }  // 중독 1틱 — 프레젠터: troops 차감(damageDealt와 동형 투영)
statusExpired  { unitId, kind }          // 만료 — 프레젠터: 아이콘 제거
```
**diffSnapshot 계약**: 중독 피해(troops 변화)는 `statusTick.damage`로 서술 → 프레젠터가 차감해 투영 일치.
부여/만료의 statuses 변화도 이벤트로 서술(프레젠터가 상태 리스트 갱신).

## 7. 예측·표시 (최소)

- `attackPreview`: 공격자 `inflictStatuses` 있으면 `inflicts?: { kind, chance }[]` 추가(연출 태그용).
- 유닛 표시: 활성 `statuses` 아이콘(중독/금책/부동) — 간단 배지. Phase D는 실 아이템 0이라 트리거는 E부터,
  로직·테스트로 정합만.

## 8. 컴포넌트 / 파일

| 파일 | 변경 |
|---|---|
| `packages/data/src/schemas.ts` | StatusKind·StatusEffect·ItemEffects.inflictStatus·CombatConfig.status |
| `packages/data/json/combat.json` | `status.poisonDamage` |
| `packages/engine/src/status.ts` (신규) | hasStatus·applyStatus·tickStatuses(순수) |
| `packages/engine/src/types.ts` | UnitState.statuses/inflictStatuses + BattleEvent +3 |
| `packages/engine/src/createBattle.ts` | spawnUnit inflictStatuses 집약 |
| `packages/engine/src/actions.ts` | resolveStrike 부여 + maybeAdvancePhase 틱 + assertCanAct/strategy 차단 |
| `packages/engine/src/index.ts` | status 헬퍼 export |
| `apps/web/src/battle/eventPlayer.ts` (+presenters) | 3 이벤트 처리(특히 statusTick 피해 투영) |
| `apps/web/src/battle/attackPreview.ts` | inflicts 예측 |

## 9. 테스트

합성(patchUnit/withUnit으로 inflictStatuses·statuses 주입):
- **applyStatus**: 신규 추가, 같은 kind면 turns=max 갱신(순수).
- **부여**: chance=100이면 적중 시 statusApplied + 방어자 statuses에 추가. chance=0이면 없음.
- **중독 틱**: 페이즈 시작 시 poisonDamage 차감 + statusTick, turns 감소, 0이면 statusExpired. 치사 시 퇴각.
- **부동**: immobilize 유닛 move 시 throw, attack은 가능.
- **금책**: seal 유닛 strategy 시 throw, attack은 가능.
- **이벤트 정합**: TrackingPresenter로 statusTick 피해·부여/만료 diffSnapshot 통과.
- **시드 불변**: inflictStatuses 미보유 유닛은 롤 0 → 기존 전투 결과·밸런스 리포트 바이트 동일(회귀 게이트).

## 10. 비침범

- 결정론·시드(§2-1): 상태 *부여*만 시드 롤(chance), *틱*은 확정(중독 피해 데이터값). 순수 헬퍼로 테스트.
- 이벤트 정합: 모든 상태 변화(부여·틱·만료)를 이벤트로 서술(diffSnapshot 유지).
- 밸런스: Phase D는 메커니즘만 — 실 아이템 무할당 → 리포트 불변. 배선·재밸런스는 Phase E.
- 하위호환: statuses/inflictStatuses·inflictStatus 전부 optional. 기존 JSON/리터럴 무파손.
