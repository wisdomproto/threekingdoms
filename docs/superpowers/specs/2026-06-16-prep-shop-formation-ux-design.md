# 출진 준비 셸(상점/편성) UX 보강 — 설계

> 날짜: 2026-06-16 · 범위: `/prep` 막간 화면(§10 상점→편성→출진) UX 폴리시
> 원칙: 결정론 불변(§2-1/§15) — 표시·미리보기·전력은 **전투와 같은 엔진 함수**를 재사용한다.
> 별도 공식·RNG 없음. 확률 강화·랜덤 스탯 없음. sortie.ts 계약 유지(빈 편성=stage 기본값).

## 1. 배경 / 문제

`/prep`는 현재 `<Shop/>`를 위, `<Formation/>`을 아래로 세로 스택하고 하단에 출진 버튼 하나를
둔다. 둘 다 동작은 하지만 얕다:

- **상점**: 보물·탈것 효과가 "고유 효과"로만 떠 — 실제로 뭘 하는지 안 보인다. 한 평면 목록.
- **편성**: 장비 장착이 장수별 `<details>` 아코디언에 묻혀 있고, 장착 시 능력/전력 변화 피드백이
  전혀 없다. 후보 정렬·전력 표시 없음. 이번 장 새로 합류한 장수 표식 없음. 출전 명단 요약 없음.

4개 영역(아이템 효과 가독성 / 능력 변화 미리보기 / 후보 정렬·전력 / NEW 배지·출진 게이트)을
한 번에 보강하되, 셸을 **탭 구조(B안)** 로 재구성해 모바일에서 각 화면이 한눈에 들어오게 한다.

## 2. 셸 구조 (B안 — 탭 + 고정 출진 바)

`PrepShell`을 **탭 셸**로 재구성:

- 상단 탭 `[ 편성 | 상점 ]`, 기본 = 편성. 탭 상태는 PrepShell `useState<"formation"|"shop">`.
- 하단 **고정(sticky) 출진 바**는 두 탭 공통 — 출전 요약 + 권고 경고 + 출진 버튼.
- 기존 출진 흐름(`onSortie` → `LoadingTransition` 전환 → `/battle`)은 불변.
- 활성 탭만 조건부 렌더(비활성 탭은 언마운트). 선택 편성·인벤토리·gold 등 상태는 PrepShell이
  보유하므로 탭을 오가도 유지된다(자식 언마운트와 무관).

## 3. 전력(전투력) 수치 — 공용 정의

밸런스 sim의 `packages/sim/src/gen/force.ts`와 **동일 정의**를 표시에 재사용한다.
엔진(@tk/engine)이 `attackPower`/`defensePower`/`spiritPower`/`spawnUnit`을 전부 export(확인됨)하므로
웹에서 직접 합성한다(sim 의존 없음).

- **전력 = `attackPower(u) + defensePower(u)`** — 병력 무관(장수+병종+레벨+아이템 반영).
  병력은 stage 슬롯에서 결정되므로 후보 비교용 수치는 병력을 빼 안정적으로 둔다.
- 새 순수 헬퍼 `unitStats.ts`(web): `(commanderId, classId, level, items[]) → spawnUnit(gameData, su)`로
  합성(troops=100 명목, side=player, x/y=0) → `{ atk, def, spirit, move, power: atk+def }` 반환.
- **총전력** = 출전 명단 각 멤버 전력의 합(각자 장착 아이템 반영).

## 4. 보강① 상점 — 아이템 효과 가독성

`shopItemView.ts`(순수, node 테스트)를 확장:

- **효과 문구**(`effectText` 확장): `item.effects`를 읽어 실제 문구 생성, 여러 효과는 ` · `로 연결.
  - `move` → `이동 +N`
  - `atkPercent` → `공격 +N%`
  - `spiritPercent` → `정신 +N%`
  - `defensePercent` → `받는 피해 −N%`
  - `doubleStrike` → `연속공격`
  - 레거시 `bonusPercent`(무기/병법서) → `+N%`(유지)
  - 소모품(supplyItem/attackItem, power≠255) → `회복/피해 N`(유지)
  - effects도 bonusPercent도 없으면 `고유 효과`(폴백 유지).
- **카테고리 그룹핑**: 행을 `item.category`로 그룹, 그룹 헤더 표시.
  순서 = `weapon, treasure, horse, book, supplyItem, attackItem`. 그룹 내 데이터 순서 유지.
  그룹 구조 빌드도 순수 함수(`buildShopGroups`)로 — node 테스트.
- 구매 가능/보유 수량/광고 골드 충전/구매 동작은 그대로.

## 5. 보강② 편성 — 능력 변화 미리보기 + 깔끔한 장착

- **SortieRow 장착 UI에서 `<details>` 아코디언 제거.** 장착 후보를 칩으로 인라인 노출하되,
  각 후보 칩에 **전력 델타를 영구 표시**(hover 불필요 — 모바일 터치 친화):
  - 예: `철갑 보물  전력 +14`. 계산 = `unitStats(현재 items+후보).power − unitStats(현재 items).power`.
  - 탭하면 장착(기존 `addItem`). 장착된 칩은 `✕`로 해제(기존).
- **SortieRow 헤더에 현재 전력 표시**(장착 반영). 변경된 스탯도 짧게(`무 78`).
- 중복 장착 방지(인벤토리 보유 수 − 편성 전체 사용 수) 로직은 기존 유지.

## 6. 보강③ 편성 — 후보 정렬 + 전력 + 요약

- **후보 정렬 칩**: `전력순`(기본) / `레벨` / `역할` / `NEW`(이번 장 합류 우선).
  순수 함수 `rosterSort.ts`(node 테스트): `(roster, sortKey, chapter) → 정렬된 배열`.
  - 전력순: `unitStats(unit.equipped).power` 내림차순(각자 영속 장착 반영).
  - 레벨: level 내림차순. 역할: role 순(lord→melee→caster→support→guest).
  - NEW: `joinChapter === chapter` 먼저, 그다음 전력순.
  - 2차 정렬(동률) = commanderId 안정 정렬.
- **후보 카드에 전력 수치** 표시(섹션 3 정의).
- **출진 바 총전력** = 선택 멤버 전력 합.

## 7. 보강④ NEW 배지 + 출진 게이트

- **NEW 배지**: 후보 카드에서 `joinChapter === chapter`(스테이지 챕터)면 빨간 `NEW`.
  RosterUnit이 이미 joinChapter 보유(확인됨) — 데이터 추가 없음.
- **고정 출진 바(권고만, 절대 하드블록 안 함)**:
  - 표시: `출전 N/maxSlots · 총전력 X`.
  - 경고(노랑): `빈 슬롯 K개`(slotsLeft>0); `군주 미편성`(roster에 lord 역할 있는데 미선택).
  - 선택 0명: 경고 대신 `기본 편성으로 출진` 안내(sortie.ts: 빈 편성=stage 기본값).
  - **출진 버튼은 항상 활성** — sortie.ts 계약 준수.
  - 요약/경고 산출은 순수 함수 `sortieSummary(selected, roster, maxSlots, chapter) →
    { count, totalPower, warnings[], emptyDefault }`(node 테스트). React SortieBar는 얇게.

## 8. 컴포넌트 경계 / 파일

| 파일 | 변경 |
|---|---|
| `apps/web/app/prep/PrepShell.tsx` | 탭 상태 + SortieBar 합성. 셸 재구성(상점·편성 탭 전환). |
| `apps/web/src/meta/screens/SortieBar.tsx` (신규) | 고정 바(요약/경고/출진). 얇은 표현 — onSortie 부모 주입. |
| `apps/web/src/meta/screens/Shop.tsx` | 그룹 헤더 렌더. 효과 문구는 확장된 shopItemView. |
| `apps/web/src/meta/screens/shopItemView.ts` | effectText(effects) 확장 + buildShopGroups(순수). |
| `apps/web/src/meta/screens/Formation.tsx` | 정렬 칩, 카드 전력, NEW 배지, SortieRow 인라인 장착+델타. |
| `apps/web/src/meta/screens/unitStats.ts` (신규) | @tk/engine 재사용 순수 전력/스탯 합성. |
| `apps/web/src/meta/screens/rosterSort.ts` (신규) | 순수 정렬. |
| `apps/web/src/meta/screens/sortieSummary.ts` (신규) | 순수 요약/경고. |

> Formation.tsx가 이미 크다 — SortieRow/정렬/요약 로직을 순수 헬퍼(unitStats/rosterSort/sortieSummary)로
> 빼 React 컴포넌트는 표현에 집중하게 한다(테스트 가능 경계).

## 9. 테스트 (핀 vitest — `pnpm -r test`)

- **shopItemView**: effects 각 필드·복합·소모품·레거시 bonusPercent·폴백 문구; 그룹 순서/빈 그룹.
- **unitStats**: 결정론(같은 입력→같은 출력); 단조성(atkPercent↑→power↑, defensePercent↑→power↑,
  move 아이템→move↑); 알려진 장수 atk/def 새너티(엔진 일치).
- **rosterSort**: 각 정렬 키 순서; NEW 우선; 동률 안정성.
- **sortieSummary**: 빈 슬롯/군주 미편성 경고; 선택 0명 → emptyDefault; totalPower 합산.

## 10. 비침범 (CLAUDE.md)

- **결정론 유지**(§2-1/§15): 전력/미리보기는 전투와 동일 엔진 함수 — 별도 공식·RNG 없음.
- **확률 강화·랜덤 스탯 없음**(§10): 장착은 결정적 지정 장착만(불변).
- **sortie.ts 계약**: 빈 편성=stage 기본값, 출진 하드블록 금지.
- **표현**: 청동·수묵 팔레트/frames.ts 재사용. KOEI 모방 금지 — 자체 표현만.
