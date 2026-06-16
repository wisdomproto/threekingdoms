# Phase F: ★ 시작 로드아웃 + 상점·편성 UX (효과 문구 확장) 설계

> 날짜: 2026-06-16 · 로드맵 Phase F (A~E 완료 위에 — 전투 모델 시드확률 + 전 특성 구현 완료) · `/prep` 막간
> 베이스: docs/superpowers/specs/2026-06-16-prep-shop-formation-ux-design.md (탭 셸·전력·정렬·NEW·출진 바 —
> 그 스펙을 그대로 채택하고, 아래 **§A ★ 로드아웃**·**§B 효과 문구 확장** 2가지를 더한다.)
> 원칙: 결정론·시드 불변(§2-1/§15). 전력/미리보기는 전투와 같은 엔진 함수 재사용. sortie.ts 계약 유지.

## 0. 배경

A~E로 전투가 풍부해졌다(무반격·관통·재반격·고정뎀·필중·흡혈·사거리·상태이상·명중%). 이제 **막간
상점/편성**이 그걸 보여주고 다뤄야 한다. + **네임드는 처음부터 기본 무기**가 있어야 하는데(길중 지적),
유비 쌍고검·조운 용담창이 빠져 있다(roster equipped 기본 `[]`). Phase F가 둘 다 해결한다.

## §A. ★ 시작 로드아웃 (RosterEntry.startItems)

### 문제
캠페인 전투의 플레이어 유닛 장비는 **sortie(=roster equipped)** 가 stage 기본을 덮어쓴다
(`applySortieToStage`). roster equipped 기본값이 `[]`(selectRoster)이라 — ★를 편성해 출진하면
**stage에 박힌 무기까지 잃는다**(관우 청룡언월도 등). 네임드 시작 무기를 roster 데이터로 박아야 한다.

### 설계
- **schemas.ts** `RosterEntrySchema`에 `startItems: z.array(z.string()).default([])` 추가.
- **rosters.json** ★4에 startItems:
  - 유비 `["쌍고검"]`, 관우 `["청룡언월도"]`, 장비 `["사모"]`, 조운 `["용담창"]`.
  - (합류 네임드 마초/황충/제갈량 등은 해당 무기 아이템·매핑이 준비되면 후속 — 이번엔 ★4.)
- **metaStore selectRoster**: `equipped: p?.equipped ?? entry.startItems` (진행 저장이 있으면 그걸,
  없으면 시작 무기). 즉 신규 게임 ★는 시작 무기 장착 상태로 등장, 이후 편성 변경은 progress에 영속.
- 결과: 편성 화면에 ★ 기본 무기가 보이고(장착됨), 해제/교체 가능. sortie가 그 equipped를 battle에 주입
  → 캠페인 1스테이지부터 시그니처 무기 손맛(§16 첫 마일스톤, §6 ★ 정체성).

### 테스트
- selectRoster: progress 없는 ★는 equipped=startItems; progress 있으면 progress.equipped 우선.
- rosters.json 데이터: ★4 startItems가 실제 존재 아이템 id.

## §B. 효과 문구 확장 (전 효과 커버)

`shopItemView.ts effectText`(순수)를 **모든 ItemEffects + 전투 특성**으로 확장. 여러 효과는 ` · ` 연결.
편성 장착 칩·상점 행 공용.

| 효과 | 문구 |
|---|---|
| move | 이동 +N |
| atkPercent | 공격 +N% |
| spiritPercent | 정신 +N% |
| defensePercent | 받는 피해 −N% |
| doubleStrike | 연속공격 |
| **noCounter** | 무반격 |
| **multiHit** | 관통 N격 |
| **counterStrikes** | 재반격 N회 |
| **flatDamagePerLevel** | 고정 피해(방어무시) |
| **alwaysHit** | 필중 |
| **lifestealPercent** | 흡혈 N% |
| **rangeBonus** | 사거리 +N |
| **inflictStatus** | {중독/금책/부동} 부여 N% |
| 레거시 bonusPercent(무기/병서) | +N% |
| 소모품(supply/attackItem, power≠255) | 회복/피해 N |
| 그 외 | 고유 효과(폴백) |

- StatusKind 라벨: poison=중독 · seal=금책 · immobilize=부동.
- 순수 함수라 node 테스트. 상점(shopItemView 행)·편성(장착 칩 효과 요약) 둘 다 이 문구 사용.

> ⚠️ **전력 수치(베이스 스펙 §3)는 스탯 기반**(attackPower+defensePower) — 무반격/관통/흡혈 등 *행동*
> 특성은 전력 숫자를 안 바꾼다. 그래서 효과 *문구/배지*로 가치를 보여준다(전력만 보면 관통검이 저평가됨).
> 편성 카드·장착 칩에 효과 문구를 노출해 보완.

## C. 베이스 스펙 채택 (요약 — 상세는 베이스 문서)

- **탭 셸** `[편성|상점]` + 고정 출진 바(요약/권고경고/출진). PrepShell 재구성.
- **전력** = `attackPower+defensePower`(순수 `unitStats.ts`, 엔진 재사용).
- **편성 미리보기**: 장착 후보 칩에 전력 델타(`전력 +14`) + §B 효과 문구. `<details>` 아코디언 제거.
- **정렬**(`rosterSort.ts`): 전력순/레벨/역할/NEW. **NEW 배지**: joinChapter==챕터.
- **출진 바**(`sortieSummary.ts` 순수): 출전 N/슬롯·총전력·경고(빈 슬롯/군주 미편성)·항상 출진 가능.

## D. 컴포넌트 / 파일

| 파일 | 변경 |
|---|---|
| `packages/data/src/schemas.ts` | RosterEntry.startItems |
| `packages/data/json/rosters.json` | ★4 startItems |
| `apps/web/src/meta/metaStore.ts` | selectRoster equipped = progress ?? startItems |
| `apps/web/src/meta/screens/shopItemView.ts` | effectText 전 효과 확장 + buildShopGroups(베이스) |
| `apps/web/src/meta/screens/unitStats.ts` (신규) | 순수 전력/스탯(엔진 재사용) |
| `apps/web/src/meta/screens/rosterSort.ts` (신규) | 순수 정렬 |
| `apps/web/src/meta/screens/sortieSummary.ts` (신규) | 순수 요약/경고 |
| `apps/web/src/meta/screens/SortieBar.tsx` (신규) | 고정 바 |
| `apps/web/app/prep/PrepShell.tsx` | 탭 셸 + SortieBar |
| `apps/web/src/meta/screens/Shop.tsx` | 그룹 헤더 + 확장 효과 문구 |
| `apps/web/src/meta/screens/Formation.tsx` | 정렬칩·카드 전력·NEW·인라인 장착+델타+효과문구 |

## E. 테스트

- **§A**: selectRoster startItems 기본값/progress 우선; rosters.json ★4 startItems 유효.
- **§B effectText**: 전 효과 각 문구 + 복합(` · `) + 상태이상 라벨 + 폴백. node.
- **unitStats**: 결정론·단조성·엔진 일치(베이스).
- **rosterSort/sortieSummary**: 베이스 스펙대로.
- 핀 vitest, 전 패키지 회귀.

## F. 비침범

- 결정론(§2-1): 전력/미리보기는 전투와 동일 엔진 함수. 효과 문구는 순수 표시.
- sortie.ts 계약: 빈 편성=stage 기본값(단 ★는 roster startItems로 비지 않음), 출진 하드블록 금지.
- §10: 확률 강화·랜덤 스탯 없음 — 장착은 결정적 지정만. 청동·수묵 팔레트 재사용.
- 하위호환: startItems default [] — 기존 roster·progress 무파손.
