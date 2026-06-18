# Phase F: 상점/편성 UX 보강 — 설계

> 날짜: 2026-06-18 · 범위: `/prep` 막간 화면(§10 상점→편성→출진) UX 폴리시
> 원칙: 결정론 불변(§2-1/§15) — 표시·미리보기·전력은 **전투와 같은 엔진 함수를 재사용**한다.
> 확률 강화·랜덤 스탯 없음. sortie.ts 계약 유지(빈 편성=stage 기본값).

---

## 0. 이미 완료 (이 스펙에서 구현하지 않음)

아래는 Phase C~E · 이전 세션에서 이미 배선된 항목이다. 확인 완료.

| 항목 | 위치 | 상태 |
|---|---|---|
| `effectText` 전 효과 문구(무반격/관통/재반격/흡혈/사거리/상태이상/고정뎀/필중/연속공격) | `shopItemView.ts` | ✅ |
| `buildShopGroups` 카테고리 그룹 순수 함수 | `shopItemView.ts` | ✅ |
| `RosterEntry.startItems` 스키마 | `packages/data/src/schemas.ts` | ✅ |
| rosters.json ★4 시작 장비(유비 쌍고검·관우 청룡언월도·장비 사모·조운 용담창) | `packages/data/json/rosters.json` | ✅ |
| `selectRoster` equipped 기본값 = `startItems ?? []` | `apps/web/src/meta/metaStore.ts` | ✅ |

---

## 1. 배경 / 문제

`/prep`는 현재 `<Shop/>`와 `<Formation/>`을 세로 스택하고 하단에 출진 버튼 하나를 둔다.
두 화면 모두 동작은 하지만:

- **상점**: buildShopGroups가 구현됐지만 Shop.tsx가 아직 그룹 헤더를 렌더하지 않음.
- **편성**: 장비 장착이 `<details>` 아코디언에 묻혀 있고, 장착 시 능력/전력 변화 피드백이 없음.
  후보 정렬·전력 표시·NEW 배지·출진 요약 없음. 모바일에서 두 화면이 한눈에 안 들어옴.

---

## 2. 셸 구조 — 탭 + 고정 출진 바

`PrepShell`을 **탭 셸**로 재구성한다:

- 상단 탭 `[ 편성 | 상점 ]`, 기본 = 편성.
  탭 상태: `PrepShell useState<"formation"|"shop">`.
- 하단 **고정(sticky) 출진 바** = 두 탭 공통. `<SortieBar/>` 신규 컴포넌트.
- 기존 출진 흐름(`writeSortie` → `/battle`)은 불변.
- 활성 탭만 조건부 렌더(비활성은 언마운트). 선택 편성·금 등 PrepShell 상태는 탭 오가도 유지.

---

## 3. 전력(전투력) 수치 — 공용 정의

`unitStats.ts` 신규 순수 모듈(`apps/web/src/meta/screens/unitStats.ts`):

```ts
// 반환형
interface UnitStats { atk: number; def: number; spirit: number; move: number; power: number; }
// 인터페이스
function calcUnitStats(commanderId: string, classId: string, level: number, items: string[]): UnitStats
```

내부: `spawnUnit(gameData, { commanderId, classId, level, items, troops:100, maxTroops:100, side:"player", x:0, y:0 })`
→ `{ atk: attackPower(u), def: defensePower(u), spirit: spiritPower(u), move: u.move, power: atk+def }`.

`spawnUnit`은 `@tk/engine`에서 직접 import — sim 의존 없음, node 테스트 가능.

**총전력** = 출전 멤버 각각 `calcUnitStats(…).power` 합산.

---

## 4. 보강① 상점 — 그룹 헤더 렌더

`Shop.tsx`에서 `buildShopGroups(rows)` 결과를 순회해 **카테고리 헤더**를 삽입한다.

- 현재: 평면 목록. 변경: 그룹별 헤더(`무기/보물/탈것/병법서/회복 도구/공격 도구`) + 그룹 내 행.
- 효과 문구는 이미 `effectText`가 전부 반환 — 그대로 표시.
- 구매/소유 수량/광고 골드 충전 동작은 불변.

---

## 5. 보강② 편성 — 인라인 장착 칩 + 전력 델타

**`<details>` 아코디언 제거.** SortieRow 장착 후보를 **인라인 칩**으로 노출:

- 각 칩 = `{아이템명} {전력 델타}`. 델타 = `calcUnitStats(현재+후보).power − calcUnitStats(현재).power`.
  양수 → `+N` 초록. 0/음수 → 회색.
- 칩 탭 → 장착(기존 `addItem` 경로). 장착된 칩은 `✕`로 해제.
- **SortieRow 헤더에 현재 전력** 표시 (장착 반영, 실시간 갱신).

---

## 6. 보강③ 편성 — 후보 정렬 + 전력 + 요약

**`rosterSort.ts`** 신규 순수 모듈:

```ts
type SortKey = "power" | "level" | "role" | "new";
function sortRoster(roster: RosterUnit[], key: SortKey, chapter: number): RosterUnit[]
```

- `power`: `calcUnitStats(equipped).power` 내림차순.
- `level`: level 내림차순.
- `role`: `lord > melee > caster > support > guest` 순.
- `new`: `joinChapter === chapter` 먼저, 그다음 power 내림차순.
- 동률 2차 정렬 = commanderId 안정 정렬.

Formation 상단에 정렬 칩 4개. 후보 카드에 전력 수치 표시.

---

## 7. 보강④ NEW 배지 + 출진 바

**NEW 배지**: 후보 카드에서 `unit.joinChapter === chapter` → 빨간 `NEW`.
데이터 추가 없음(RosterUnit이 이미 joinChapter 보유).

**`sortieSummary.ts`** 신규 순수 모듈:

```ts
interface SortieSummary {
  count: number;         // 선택 인원
  totalPower: number;    // 선택 멤버 전력 합
  warnings: string[];    // 빈 슬롯/군주 미편성 경고 문구
  emptyDefault: boolean; // 선택 0명 → 기본 편성 사용
}
function summarizeSortie(
  selected: SortieMember[], roster: RosterUnit[], maxSlots: number, chapter: number
): SortieSummary
```

경고 조건:
- `emptyDefault = selected.length === 0`.
- `slotsLeft = maxSlots − selected.length > 0` → `"빈 슬롯 {K}개"`.
- lord 역할 roster에 있는데 미선택 → `"군주 미편성"`.

**`SortieBar.tsx`** 신규 컴포넌트(얇은 표현층):

```
[ 출전 N/max · 총전력 X ]  [⚠ 군주 미편성]  [출진 →]
```

출진 버튼 **항상 활성** — sortie.ts 계약(빈 편성=stage 기본값, 하드블록 금지).

---

## 8. 파일 목록

| 파일 | 변경 |
|---|---|
| `apps/web/app/prep/PrepShell.tsx` | 탭 셸 재구성([편성\|상점]) + SortieBar 합성 |
| `apps/web/src/meta/screens/SortieBar.tsx` | **신규** — 고정 출진 바 |
| `apps/web/src/meta/screens/Shop.tsx` | buildShopGroups 사용해 그룹 헤더 렌더 |
| `apps/web/src/meta/screens/Formation.tsx` | 정렬 칩 + 카드 전력 + NEW 배지 + SortieRow 인라인 칩 + 델타 |
| `apps/web/src/meta/screens/unitStats.ts` | **신규** — 순수 전력 합성 |
| `apps/web/src/meta/screens/rosterSort.ts` | **신규** — 순수 정렬 |
| `apps/web/src/meta/screens/sortieSummary.ts` | **신규** — 순수 요약/경고 |

---

## 9. 테스트

모두 순수 함수(node 테스트 — `pnpm --filter web exec vitest run`):

- **unitStats**: 결정론(같은 입력=같은 출력); 단조성(atkPercent↑→power↑, 아이템 없음=기본값); 알려진 장수 새너티(관우 war 98 반영).
- **rosterSort**: 각 키 순서; NEW 우선; 동률 안정성; 빈 배열 무사.
- **sortieSummary**: 빈 슬롯/군주 미편성 경고; 0명=emptyDefault; totalPower 합산; 경고 없는 정상 케이스.

컴포넌트(PrepShell 탭, Shop 그룹 헤더, Formation 칩)는 로직이 순수 함수에 집중 → React 단위 테스트 불필요. 기존 web 테스트 회귀(470 유지) 확인.

---

## 10. 비침범

- **결정론**(§2-1): 전력은 전투 엔진 함수 재사용 — 별도 공식 없음.
- **확률 강화 없음**(§10): 장착은 결정적 지정만.
- **sortie.ts 계약**: 빈 편성=stage 기본값, 출진 하드블록 금지.
- **표현**: 청동/수묵 팔레트·기존 frames.ts 재사용. KOEI 모방 금지.
- **기존 회귀**: simtest(BASELINE_LABELS) 불침범 — UI 레이어만 변경.
