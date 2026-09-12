# packages — engine · data · sim 계약

> 루트 CLAUDE.md의 모듈 문서. 규칙의 근거·이력은 [docs/design/game-design.md](../docs/design/game-design.md) §7·§10·§11, 조조전 이식 상태는 docs/reference/sosoden-port-status.md.

## engine (`@tk/engine` — 헤드리스, 전투 연산 100% 클라이언트)
- 확률은 전부 **(게임상태 + 시드) 고정 롤**. 롤 순서 명중 → 회심 → 가드. 순수 RNG 금지 — 리플레이·리더보드·밸런스 sim이 이 위에 선다.
- **이벤트 자기서술 계약**: troops/mp를 바꾸는 효과는 서술 이벤트(`troopsHealed`·`itemUsed` …)를 emit한다 — 드레인 정합. 회복/도구 형제 버그의 근본.
- 승급 = **레벨의 순수 함수**(`unitClasses.promotesTo`, `combat.json promotion`), 상향 전용, 메타 상태 0. 스폰·grantExp·selectRoster 3지점 동일 값.
- 소모품은 유닛 장착이 아니라 **진영 공유 풀**(`BattleState.sharedItems`), 장착은 무기/말/보물 3슬롯.
- 구현 완료 규칙(§7): 협공·병종 패시브·연속공격·필살(SP)·콤보·시그니처 궁극기·회심·가드·날씨·지형 회복. 새 규칙 = `combat.json` 노브 + 테스트 + report-card.

## data (`@tk/data` — JSON SSOT + zod)
- **rosters/stages가 병종 진실**(§6 표는 v1.0 구상). 원작 원천은 initialForces(영걸전)·sosoden generals.
- 스테이지 `decorations`는 계약 테스트(`test/decorations.test.ts`)가 강제 — 경계·통행칸·유닛칸·중복. `kind` 추가 시 `apps/web textures.ts OBJECT_FILES` 등록 필수.
- 씬 슬롯 `stage.scenario.{intro,outro,outroDefeat}` = 단일 VN 객체 **또는** 파트 배열(VN | MapScene | **ComicScene** `{kind:"comic", pages:[{image, bgm?, panels:[{rect:[x,y,w,h] 정규화, lines?, fx?, hold?, sfx?}]}]}` — strict, `ScenePartSchema` union 순서 [MapScene, Comic, VN]; `isComicScene` 타입가드). 기존 단일 객체는 로더가 1파트로 정규화.
- 스키마 변경 = `src/schemas.ts` + `test/schemas.test.ts` + **에디터 round-trip 확인**(master-plan P0: 에디터가 모르는 필드를 저장 중 버리지 않는다).

## sim (`@tk/sim`)
- `report-card`: {greedy/naive} × {−2/0/+2} 매트릭스 → HEALTHY/EASY/HARD/BRITTLE/IMPASSABLE. `BASELINE_LABELS` 스냅샷 + 전 스테이지 greedy@0 승리 = 회귀 게이트. 규칙·데이터 변경 후 반드시 실행.
- `generate-stage` / `generate-map`: 페이싱 커브 적 배치 · 지형 문법 템플릿 + autoTune(신규 스테이지용, 기존 27은 원작 재현이라 불침범). `asset-manifest`: 필요 에셋 요청서.
