# 에디터 Playtest 왕복 — 설계 (2026-09-12)

> master-plan §14 "EDIT ↔ PLAY 왕복 — 수정 → 플레이 → 수정 → 플레이를 몇 초 안에", §22 P1 "현재 챕터 Playtest · Editor 복귀". design-guide 원칙 7 "Three clicks to Playtest". 벤치마크(`docs/design/oss-editor-benchmark.md`) §10 **불변 Playtest 스냅샷 + 독립 런타임 상태 + 복귀**의 첫 실물.
> 선행: `2026-09-11-editor-roundtrip-design.md`(P0, 머지됨) — `tools/editor/stage-io.js`가 편집 모델을 무손실로 직렬화한다.

## 1. 문제

에디터(`tools/stage-editor.html`, serve.py `:8080/8081/8082`)에서 고친 스테이지를 게임에서 보려면 **레포 파일에 저장 → next dev가 데이터를 다시 번들 → 게임 새로고침 → 스테이지 선택 → 편성 → 출진**을 거친다. 편집 중 미저장 상태는 아예 테스트할 수 없다.

성공 기준: 에디터의 **▶ 이 스테이지 테스트** 한 번으로 **지금 편집 중인(미저장 포함) 스테이지+맵**이 새 탭의 전투로 뜨고(수 초), 전투를 끝내거나 나가면 에디터 탭으로 돌아오며 에디터의 선택·줌·Undo 이력은 그대로다. 테스트 전투는 레포 파일·R2·메타(골드/클리어/레벨)를 절대 바꾸지 않는다.

## 2. 제약과 결정

- **에디터와 게임은 origin이 다르다**(serve.py vs Next `:3000`). `sessionStorage`·iframe 공유 불가 → 드래프트는 **서버 파일**로 건넨다. 게임 쪽은 같은 origin(`/_draft/…`)에서 그 파일을 읽는다.
- 게임의 `__lab` 경로(`LabPayload` → `writeLab` → `/battle?stage=__lab` → `BattleScreen.makeCtx` → 결산 `sandbox`)를 **그대로 재사용**한다. 전투 코드는 종료 목적지 외 불변.
- 기각: `postMessage` 핸드오프(핸드셰이크·팝업 차단·드래프트가 어디에도 안 남음), URL 해시 페이로드(60KB 스테이지 → 80KB URL).

## 3. 구조

| 파일 | 역할 |
|---|---|
| `tools/serve.py` (수정) | `POST /playtest-draft` — 스냅샷 파일 저장 |
| `.gitignore` (수정) | `apps/web/public/_draft/` |
| `apps/web/src/lab/playtest.ts` (신규) | 순수 로직: `PlaytestSnapshot` 타입, `parsePlaytestSnapshot(json) → { ok: true, payload: LabPayload } \| { ok: false, message }`(kind/version 확인 + `StageSchema`/`BattleMapSchema` parse + 첫 zod 이슈 메시지). DOM·Next 무관 → node 테스트 가능 |
| `apps/web/app/playtest/page.tsx` (신규) | 착륙 페이지(얇은 클라이언트 컴포넌트, `/lab/page.tsx`처럼 `dynamic(ssr:false)`): `?draft=` → fetch → `parsePlaytestSnapshot` → 성공 시 `writeLab` + `router.replace('/battle?stage=__lab')`, 실패 시 메시지 + 「닫기」 |
| `apps/web/src/lab/lab.ts` (수정) | `LabPayload.returnUrl?`, `exitTarget(payload)` 순수 헬퍼 |
| `apps/web/src/battle/BattleScreen.tsx`, `hud/ResultSequence.tsx`(481·958행), `hud/PauseMenu.tsx` (수정) | 실험실 종료 목적지 `/lab` 하드코딩 → `exitTarget()` |
| `tools/stage-editor.html` (수정) | ▶ 이 스테이지 테스트 버튼 + `GAME_ORIGIN` 상수 |
| `apps/web/src/lab/__tests__/playtest.test.ts` (신규) | §8 — `exitTarget`·`parsePlaytestSnapshot` 단위 테스트(node 환경, 기존 web 테스트 관례: jsdom 없음) |

## 4. Playtest 스냅샷 (계약)

`apps/web/public/_draft/{draftId}.json` — **불변 입력**. 생성 후 수정하지 않는다(다시 테스트 = 새 스냅샷).

```ts
interface PlaytestSnapshot {
  kind: "tk-playtest-snapshot"; version: 1;
  draftId: string;        // `${stage.id}-${revision}` — 파일명. [A-Za-z0-9_-]+
  revision: number;       // Date.now() — 같은 스테이지의 연속 테스트를 구분
  stage: Stage;           // 에디터 모델의 serializeStage() 결과 (미저장 편집 포함)
  map: BattleMap;         // 에디터가 들고 있는 현재 맵의 serializeMap() 결과 — stage.mapId 와 무관하게 편집 중인 맵을 우선
  seed: number;           // 고정 1 — 같은 편집 = 같은 롤(재현). 시드 선택 UI는 범위 밖
  returnUrl: string;      // 에디터 탭 URL(location.href)
  savedAt: string;        // ISO
}
```

게임은 이 파일을 `LabPayload {stage, map, sharedItems: [], seed, returnUrl}`로 변환해 sessionStorage에 쓴다. 전투 런타임 상태(병력·위치·턴)는 sessionStorage/ctx 안에서만 살고 스냅샷 파일·레포 JSON·metaStore를 건드리지 않는다(결산 `sandbox` = 기존 보장).

## 5. 데이터 흐름

1. 에디터 ▶ 클릭 → `validate()` 에러가 있으면 토스트 "테스트 불가 N건" 후 중단(Playtest 단 검증 — P0 스펙 §5).
2. `POST /playtest-draft` body = 스냅샷(§4). serve.py: `draftId` 정규식 검사, 본문 ≤ 5MB, `apps/web/public/_draft/` 생성, 임시 파일 → `os.replace` 원자 쓰기, 응답 `{ok, draftId, url: "/_draft/{draftId}.json"}`. 실패는 200 + `ok:false` + 메시지(기존 serve.py 관례). `do_POST` 허용 목록에 추가, R2 업로드 없음.
3. 에디터 `window.open(GAME_ORIGIN + "/playtest?draft=" + draftId)`. `GAME_ORIGIN` 상수 기본 `http://localhost:3000`(보드의 「🎮 게임 열기」와 동일 값).
4. `/playtest` 페이지: `useSearchParams().get("draft")` → `fetch("/_draft/{id}.json", {cache:"no-store"})` → `parsePlaytestSnapshot(json)`(kind/version 확인 → `StageSchema.parse(stage)`·`BattleMapSchema.parse(map)` → `LabPayload {stage, map, sharedItems: [], seed, returnUrl}`) → `writeLab(payload)` → `router.replace("/battle?stage=__lab")`. 로딩 중 한 줄 표시. 페이지 자체는 얇아서 테스트하지 않고(`LabScreen`과 같은 급) 로직은 `playtest.ts`에서 검증한다.
5. 전투: 기존 `__lab` 경로. 종료 3지점(일시정지 「나가기」, 승리 결산 종료, 패배 결산 종료)이 `exitTarget(readLab())`을 따른다.

## 6. 복귀

```ts
/** 실험실/플레이테스트 전투의 종료 목적지. returnUrl 이 있으면 에디터가 연 탭이므로 닫아서 복귀. */
export function exitTarget(payload: Pick<LabPayload, "returnUrl"> | null, hasOpener: boolean): { kind: "close" } | { kind: "navigate"; to: string }
```
- `returnUrl` 없음 → `navigate "/lab"` (현행 동일, 무회귀).
- `returnUrl` 있음 + `hasOpener`(`window.opener != null`) → `close` (호출측이 `window.close()`; 에디터 탭이 자연히 앞으로 옴).
- `returnUrl` 있음 + opener 없음(탭을 직접 새로고침/복사한 경우) → `navigate returnUrl`.
에디터 상태(선택·줌·탭·Undo 스택)는 에디터 탭이 계속 열려 있으므로 보존된다 — 별도 저장 없음.

## 7. 검증·에러
- 착륙 페이지: fetch 404 → "드래프트가 없습니다 — 에디터에서 ▶ 테스트를 다시 누르세요" + 「닫기」; `kind`/`version` 불일치 → 같은 안내; zod 실패 → 첫 이슈의 `path`·`message` 표시(이게 "실행 최소 조건" 실검사) + 「닫기」. 「닫기」 = `exitTarget` 규칙.
- `readLab()`은 `returnUrl`을 선택 필드로 통과(기존 검증 로직 불변).
- serve.py: `draftId` 불일치/경로 탈출(`..`)/JSON 파싱 실패/크기 초과 → `ok:false`.
- 드래프트는 dev 전용: `public/_draft/`는 gitignore, `next build` 산출물에 없음, R2 업로더는 `apps/web/public/assets`만 훑는다(`tools/upload-assets.py` `ASSET_DIR` — 확인됨, 변경 없음).

## 8. 테스트
- `exitTarget` 순수 함수: (없음, any) → `/lab`; (있음, opener) → close; (있음, no opener) → navigate returnUrl.
- `parsePlaytestSnapshot`(node): 유효 스냅샷(실제 `packages/data/json` 05-sishuiguan + sishuiguan 맵을 읽어 구성) → `ok:true`, payload에 `sharedItems: []`·`seed`·`returnUrl` 전달; `kind` 불일치 → `ok:false` 안내; zod 실패(예: `turnLimit` 삭제) → `ok:false` 메시지에 `turnLimit` 경로 포함. (web 테스트는 `environment: node` — jsdom·`next/navigation` 모킹은 도입하지 않는다.)
- serve.py: `python -m py_compile` + curl 수동(정상 저장 / 잘못된 id 거부).
- 브라우저 E2E(플랜 단계): 에디터에서 유닛 좌표를 바꾸고 ▶ → 전투에 바뀐 좌표로 시작 → 나가기 → 에디터 탭 복귀·상태 유지. 레포 JSON `git status` 무변화, `_draft/` 파일만 생성.

## 9. 범위 밖 (후속)
맵 단독 모드 테스트(유닛 없음) · 게임 안 「✏ 이 스테이지 편집」 역방향 진입 · 시드/편성/공유풀 선택 UI · 테스트 결과를 에디터로 돌려주기(벤치마크 §10) · Autosave·Draft 버전 관리(P1 후속) · 스냅샷의 공통 데이터 접근 계층화(두 번째 소비자가 생길 때).
