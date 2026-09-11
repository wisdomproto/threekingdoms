# 에디터 round-trip 무손실 + Save/Playtest/Publish 3단 검증 — 설계 (2026-09-11)

> master-plan §16·§22 **P0 데이터 안전성**, design-guide 원칙 8·10 및 P0 항목의 실체.
> 대상 = `tools/stage-editor.html`(스테이지 + 맵). 다른 데이터 에디터(class/item/strategy)는 범위 밖(후속 확인).

## 1. 문제

`stage-editor.html`은 로드(`loadStageObject`)와 저장(`serializeStage`) 모두 **화이트리스트로 객체를 새로 조립**한다.
소유 키 15개(`id name mapId turnLimit camera reward levelCap units objectives failConditions reinforcements strategyConditions victory defeat events`) 외는 전부 버린다.

실측(2026-09-11, 27 스테이지): `scenario` 27/27 · `dialogue` 27/27 · `decorations` 24/27 소실. 그 외 `weather`·`autoPromote`·`bossOf`, 유닛/이벤트/증원의 미지 필드 소실, `once`는 강제 `true`, 이벤트 `type`은 강제 `'duel'`, `turnLimit`은 부재 시 `30`이 새로 박힘.
→ **에디터로 열고 저장하면 두 달치 시나리오 저작이 사라진다.** 또한 검증 에러가 있으면 저장 자체를 차단한다(design-guide "Save is always allowed" 위반).

성공 기준: **`Load → 수정 없음 → Save` 결과가 원본과 구조·키 순서까지 동일**(27 스테이지 + 30 맵 자동 검증), 저장은 항상 가능, 검증은 Save/Playtest/Publish 3단으로 분리.

## 2. 접근 — 원본 보존 오버레이 (채택 A)

로드 시 원본 객체를 보관하고, 저장은 **원본 위에 에디터가 소유한 키만 덮어쓴다.** 에디터 UI 코드(모델을 직접 변형하는 기존 코드)는 불변.

기각: B 원본 in-place 편집(로드 기본값이 저장에 박혀 no-op 동일성 깨짐 → 결국 소유 키 관리 필요), C 스키마 주도 폼(P2 Creator 범위).

## 3. 구조

| 파일 | 역할 |
|---|---|
| `tools/editor/stage-io.js` (신규, ESM, DOM 무관) | `loadStage(obj) → model`, `serializeStage(model) → obj`, `loadMap(obj) → model`, `serializeMap(model) → obj`. 원본 보관 `WeakMap`은 모듈 내부. |
| `tools/editor/stage-io.d.ts` (신규) | 테스트(TS)용 최소 선언 |
| `packages/data/test/editor-roundtrip.test.ts` (신규) | 회귀 게이트 (§6) |
| `tools/stage-editor.html` (수정) | 인라인 `loadStageObject`/`serializeStage`/`loadMapObject`/`serializeMap` 제거 → `<script type="module">`에서 모듈 import. 저장 차단 제거, 검증 3단 표시, 「Publish 검사」 버튼 |
| `tools/serve.py` (수정) | `POST /validate-data` |

모듈은 serve.py(기본 :8080, launch 설정 `tools`는 8081) 아래에서 같은 출처로 로드된다. `file://`로 열면 module import가 막히므로 안내 문구 1줄. 에디터 HTML에 인라인 `onclick=` 핸들러는 0건(확인됨)이라 스크립트 전체를 `type="module"`로 바꿔도 전역 참조 파손이 없다.

`stage-io.js`는 **브라우저 `<script type="module">`·vitest 전용**이다 — 루트 `package.json`에 `"type":"module"`이 없어 node가 직접 실행하면 CJS로 해석된다. CLI 재사용은 범위 밖. 테스트(TS)에서는 `import ... from "../../../tools/editor/stage-io.js"` 지정자를 TS가 사이드카 `stage-io.d.ts`로 해석한다(`moduleResolution: Bundler`, include 밖 파일도 import 추적으로 포함) — `allowJs`나 tsconfig 변경 없음.

## 4. 로드·저장 규칙

### 4-1. 원본 보관
`const ORIG = new WeakMap<object, object>()`. `loadStage`가 만드는 **모델 객체와 배열 원소**(top-level stage, unit, event, reinforcement, reinforcement.unit, strategyCondition)마다 `ORIG.set(modelEl, origEl)`. 맵도 동일(`loadMap` 모델 → 원본).

**중첩 소유 객체**(`camera`·`reward`·event `trigger`/`outcome`·reinforcement `trigger`·strategy `trigger`/`reward`)는 로드 시 `{ ...orig }` **얕은 복사로 모델에 두고, 저장 시 모델 객체를 그대로 쓴다** — 필드 단위 재조립·`!!` 강제 변환 금지. (실데이터 02·04·06은 `camera`가 `{decorations, zoom, focus}` 순서로 미지 키를 품고 있다 — 재조립하면 소실.) UI가 kind 변경 시 `r.trigger = {...}`로 통째 교체하는 것은 편집이라 무방.

**objectives·failConditions** 원소는 로드 `{ ...o }`, 저장 **그대로 통과**(현행의 kind별 재조립·`captureTile side:'player'` 주입·`optional` truthy 강제 제거 — 데이터에 `"optional": false`가 명시된 원소가 있다). 새 원소의 필드는 UI가 만든다.

**Undo 경로**: 현행 `pushUndo`는 `JSON.parse(JSON.stringify(stage.units))`로 깊은 복제하고 `doUndo`가 `stage.units = s.units`로 교체해 ORIG 연결이 끊긴다. 모듈이 `cloneUnits(units)`(깊은 복제 + ORIG 재부착)를 export하고 `pushUndo`/`doUndo`가 이를 쓴다 — UI 코드 수정 3줄(§2 "UI 코드 불변"의 유일한 예외). §6 테스트에 "Undo 후 저장" 케이스 포함.

### 4-2. 로드는 기본값을 넣지 않는다
`turnLimit ?? 30`, `items || []`, `reward.gold ?? 0` 류의 주입 제거. 부재는 부재(`undefined`)로 두고 UI는 placeholder로 보여준다. (기존 UI 코드가 `stage.units[i].items.push`처럼 배열을 전제하는 지점은 모듈이 아니라 UI 쪽에서 `?? []`로 읽는다 — 저장엔 영향 없음.)

### 4-3. 소유 키 (한 곳에 선언)
```
STAGE: id name mapId turnLimit camera reward levelCap units objectives failConditions reinforcements strategyConditions victory defeat events
UNIT:  commanderId classId level troops items side x y
EVENT: id type trigger outcome once       (type 은 새 원소 생성 시에만 'duel', 기존은 원본 값)
REINF: id side trigger units once         (파일 관행 순서. once 는 원본 값 유지, 새 원소만 true)
STRAT: id description trigger reward
MAP:   id name width height tileLegend tiles
```

### 4-4. 저장 = 스프레드 병합
```
out = { ...ORIG.get(model), ...pickOwned(model) }
배열: model.units.map(u => ({ ...ORIG.get(u), ...pickOwned(u) }))
```
- 미지 키·미지 필드는 손대지 않고 통과한다.
- 삭제된 원소는 사라지고, 새 원소는 ORIG가 없어 소유 필드만으로 생성된다(정규화는 여기서만).
- **키 순서** = 원본 순서(스프레드가 보존), 새 키는 뒤에 추가. 원본이 없는 새 스테이지는 현행 직렬화 순서.

### 4-5. 존재 규칙 (no-op 저장의 동일성)
- 소유 키 값이 `null`/`undefined`면 **원본 유무와 무관하게 키 삭제**(`camera`·`reward`·`levelCap`·`victory`·`defeat` 해제 = 삭제. 원본에 있던 키를 비웠는데 `null`이 기록되면 스키마 실패).
- 빈 배열: 원본에 그 키가 있었으면 쓴다(`[]` 유지), 없었으면 생략. **예외 = `units`·`events`는 스키마 필수라 항상 쓴다**(새 스테이지의 빈 배열도).
- 그 외 값은 원본 유무와 무관하게 쓴다.

## 5. 검증 3단

| 단계 | 시점 | 검사 | 실패 시 |
|---|---|---|---|
| **Save** | 저장 버튼 / 붙여넣기 내보내기 | 없음 | 없음 — 항상 저장. 토스트 "저장됨 · 테스트 불가 N건" |
| **Playtest** | 편집 중 상시(현행 `refreshValidation`) | 맵 범위·참조 존재·필수 필드 = 실행 최소 조건 | 경고 패널 라벨 "테스트 불가 N건". 저장은 막지 않음 |
| **Publish** | 「Publish 검사」 버튼 | `POST /validate-data` → serve.py가 `pnpm --filter @tk/data test` 실행 (`index.ts`가 27 스테이지·30 맵 전부 zod `safeParse`) | 패널에 통과/실패 + 출력 꼬리 60줄 |

Publish 검사는 **레포의 `packages/data/json/*` 저장본**을 검사한다(File System Access 저장은 임의 경로가 가능하므로 레포 밖에 저장한 파일은 검사되지 않음) — 버튼 옆 "레포에 저장 후 검사" 문구. `loadJson`은 **첫 실패 파일에서 throw**하므로 에러는 한 번에 1건이다 — 패널 문구는 "첫 실패: {파일}: …"로, 전체 목록처럼 읽히지 않게. 이 명령은 round-trip 테스트(§6)도 함께 실행한다(의도). 새 의존성 없음.

## 6. 테스트 (`packages/data/test/editor-roundtrip.test.ts`)
1. **round-trip 동일성**: `readdirSync`로 `stages/*.json`·`maps/*.json`을 열거(신규 파일 자동 포함, `decorations.test.ts`와 같은 방식)해 각각 `JSON.stringify(serialize(load(x))) === JSON.stringify(x)` — 구조 + 키 순서. (원문 텍스트 비교는 하지 않는다: 맵 9개가 2-space 규격과 다르다.)
2. **편집 의미론**: 유닛 `x` 변경 → 그 필드만 바뀌고 `scenario`·유닛 미지 필드·`camera` 안의 미지 키 보존 / `camera=null`·`victory=null` → 키 삭제 / 새 이벤트 → `type:'duel'`·`once:true` / 유닛 삭제 → 원소 제거 / `turnLimit` 없는 입력 → 저장에도 없음 / `optional:false` 목표 보존 / **`cloneUnits`로 Undo 스냅샷 후 복원 → 저장해도 유닛 미지 필드 보존**.
3. 기존 `pnpm test` 게이트(data 패키지)에 포함.

## 7. 에러 처리
- 스키마상 유효하지 않은 원본도 로드된다(보존이 목적). 유효성은 Publish 단계가 말한다.
- `/validate-data`: Windows에서 `pnpm`은 `pnpm.cmd`라 `shutil.which("pnpm")`로 실행 파일을 찾아 `subprocess.run([...], cwd=ROOT, shell=False)` (없으면 `ok:false` + "pnpm 미발견"). 타임아웃 120초, 동시 실행 1개(락, 진행 중이면 409), 출력 마지막 60줄만. 실패도 200 + `ok:false`.
- 모듈 로드 실패(file://) → "serve.py(:8081)로 여세요".

## 8. 범위 밖 (후속)
Playtest 실행 버튼(`__lab` 패턴의 `__draft` 주입, P1) · Autosave/Undo 확장(P1) · class/item/strategy 에디터 round-trip 테스트 · Project Store.

**리뷰에서 발견된 데이터 버그(별도 태스크)**: `02-yingchuan`·`04-zhangjue`·`06-huluguan`의 `decorations`가 최상위가 아니라 `camera` 안에 들어가 있어 zod(비-strict)가 조용히 벗겨낸다 → 게임에서 그 3스테이지 데코가 렌더되지 않는다. round-trip 게이트는 이를 보존만 하지 고치지 않는다.
