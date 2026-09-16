# 개발 인계 기준선 — 2026-09-14

## 범위와 자료

사용자 요청은 Claude로 개발하던 프로젝트를 Codex에서 이어받고, 첨부 저작도구 상세 기획을 개발 맥락에 반영하는 것이다. 이번 작업은 코드·문서 조사와 기존 검증, 인계 기록이다. v2.2 전체 구현이나 외부 배포를 완료한 것이 아니다.

- 저장소: https://github.com/wisdomproto/threekingdoms
- 작업 위치: `C:/projects/threekingdoms`
- 기준 커밋: `3458ba2308ef55aec8d77c22b12994cc6405c8d0` (`main`). 조사 시 `git ls-remote origin HEAD`와 일치.
- 제공 자료: `docs/기획/yeonggeoljeon_web_studio_developer_handoff_v2_2.zip`. 최초 Downloads 경로에서 읽었으며 조사 중 위 경로로 이동된 것을 확인했다.
- ZIP 내부 주요 자료: `README.md`, `CHANGELOG_v2_2.md`, 전체 명세 Markdown/HTML, `authoring-contracts/`, `changes/v2_2/`, 합성 예제, 분석 및 QA 기록.

첨부 자료는 상세 목표 명세다. 문서 내부 실행 절차는 사용자 요청과 구분한다. 기존 기획의 우선순위를 자동으로 덮어쓰거나 원작 분석·업로드·배포를 지시한 것으로 해석하지 않는다. 이번 조사는 개정 요구사항과 주요 계약 중심의 초기 대조이며 121개 요구사항의 전수 적합성 감사는 아니다.

## 현재 구현과 새 명세의 차이

| 영역 | 확인한 기존 구현 | v2.2 적용 시 필요한 작업 |
|---|---|---|
| 기반 | pnpm 모노레포, Next.js 15/React 19, PixiJS 8, 순수 전투 엔진·데이터·시뮬레이터 | 기존 엔진과 데이터 재사용을 우선하는 호환 계층 설계 |
| 전투/장면 | `packages/data/src/schemas.ts`의 `StageSchema` 안에 전투 설정과 `scenario` 슬롯. VN·MapScene·ComicScene 지원 | 독립 Scene/Battle 리소스와 챕터 흐름 노드를 구분하여 연결 |
| 챕터 | `tools/editor/chapters.js`의 고정 5개 챕터와 스테이지 번호 구간. `apps/web/src/meta/campaign.ts`와 대조 테스트 | 이야기 전용·연속 전투·승패 분기를 표현하는 명시적 그래프 및 참조 검증 |
| 저작 화면 | `tools/*-editor.html`, `tools/editor/story-editor.js`, `comic-editor.js` 등 | 챕터 구성·스토리 장면·전투 시나리오의 작업면 및 공유 리소스 연결 |
| 편집 보존 | `stage-io.js`, `history.js`, `draft-store.js`, `publish.js`와 round-trip/저장/히스토리 테스트 | 공통 Project 전체의 미완성 draft 보존, 미지원 데이터 보존, 참조 검증으로 확장 |
| 테스트 실행 | `apps/web/src/lab/playtest.ts`: stage/map/seed/revision 기반 스냅샷, 전후 장면 슬롯 선택 | 콘텐츠 해시·엔진/규칙 버전·source map·capability를 갖는 RuntimeAdapter 계약과 연결 |
| 장면 호출 | 기존 장면 플레이어와 전투 이벤트 처리 경로 | Battle→PlayScene 복귀, 직렬화 가능한 continuation, 중복 ACK와 중첩 전투 차단 별도 설계·검증 |

가장 중요한 용어 충돌: 현재 `Stage`는 전투 데이터이고, 첨부 Project의 `Stage`는 실행 흐름의 노드다. 같은 이름이라는 이유로 기존 스키마를 덮어쓰면 캠페인·에디터·저장 데이터가 함께 영향을 받는다. 변환 계층과 마이그레이션 정책을 먼저 정의해야 한다.

첨부 명세는 21개 화면, 121개 요구사항, 명령 73개, 핵심 제품 인수시험 72개를 기록한다. 계약 버전은 Project schema 0.2.0 / command catalog 1.0.0 / runtime bridge 1.0.0이다. 이것은 첨부 계약의 버전이며 현재 저장소가 이를 지원한다는 뜻은 아니다.

## 다음 구현 단위 제안

1. 첨부 계약과 기존 데이터의 필드별 대응표 및 지원 capability를 작성한다. 기존 전투 Stage를 Battle 리소스로 감싸는 어댑터와 챕터 노드 ID 정책을 먼저 확정한다.
2. 최소 Project의 저장·재열기·미지원 필드 보존과 참조 진단을 구현한다. 미완성 draft 저장과 실행 가능 검증은 구분한다.
3. 하나의 작은 챕터에서 ‘스토리 → 전투 → 승리/패배 후일담’을 연결하고 각 작업면에서 편집 후 복귀하도록 만든다. 이야기 전용/연속 전투도 데이터 모델이 허용해야 한다.
4. 해당 챕터를 불변 스냅샷으로 실행한다. 상태 전달과 결과·보상 1회 적용을 검증한 뒤 장면 호출/복귀 및 이벤트 편집을 확장한다.

첫 단위의 완료 기준은 기능 목록이나 화면 수가 아니라 기존 27개 전투 데이터의 보존, 새 프로젝트 round-trip, 잘못된 참조 진단, 실행 결과의 재현 가능성이다. 위 순서는 초기 조사에 따른 제안이며 구현 완료 또는 전체 로드맵의 승인 기록이 아니다.

## 검증 기준선

실행한 `pnpm test`는 종료 코드 0:

| 패키지 | 통과 | 건너뜀 |
|---|---:|---:|
| data | 223 | 0 |
| engine | 173 | 0 |
| sim | 72 | 0 |
| web | 723 | 0 |
| import-hero | 0 | 9 |
| 합계 | 1,191 | 9 |

`import-hero`는 `C:/HERO` 원작 입력 파일이 없으면 건너뛰도록 작성된 테스트다. `pnpm typecheck`도 전체 통과했다. 프로덕션 빌드, 브라우저 E2E, 실제 에셋 표시, 새 v2.2 런타임 호환성은 이번에 검증하지 않았다.

첨부 `qa/FINAL_QA_SUMMARY.md`의 30/30 및 10/10 PASS는 작성자가 기록한 문서/예제 및 문서 브라우저 검사다. 제품 인수시험은 0개 실행(`NOT_RUN`)이며 기존 코드 테스트 통과와도 구분해야 한다. 첨부 검사 코드는 이번에 실행하지 않았다.

조사 시작 시 미추적 `.threekingdoms_cao_cao_art.png`가 있었고 조사 중 `docs/기획/`이 추가되었다. 사용자 작업물로 보존했다. 이번 변경은 인계 문서와 루트 `AGENTS.md`뿐이며 게임 코드·기존 기획은 변경하지 않았다.

## 후속 구현 — 호환 계층 1차

사용자의 후속 진행 요청으로 `@tk/data/authoring-project`를 추가했다. [호환 계층 설계·API](authoring-project-bridge.md)에 현재 범위와 검증을 기록했다. 기존 27개 전투를 손실 없이 왕복하고, 장면 리소스 분리·챕터 참조 진단·기존 플레이테스트 스냅샷 생성을 지원한다. 이관 형식은 `tk-authoring-project` v1이며 첨부 native Project 0.2.0과 구분한다.

전체 테스트는 1,239개 통과/9개 건너뜀, 타입 검사 통과. 다음 구현 단위는 이 API에 프로젝트 저장 UI와 챕터/장면/전투 작업면을 연결하는 것이다. 서버 저장과 전체 챕터 실행은 아직 구현하지 않았다.

## 후속 구현 — 프로젝트 스튜디오 UI

두 번째 진행 요청으로 개발용 `/studio` 작업면과 로컬 Project Store를 연결했다. [화면·저장 계약·검증](studio-ui-v1.md)을 참고한다. `.studio/projects/`에 자동저장하며 챕터 연결, 일반 대사 및 전투 기본 설정 편집, 선택 전투 테스트를 지원한다. 전체 테스트 1,251개 통과/9개 건너뜀 및 실제 브라우저에서 전투 진입을 확인했다. 전체 챕터 실행은 후속 범위다.
