# 저작 프로젝트 호환 계층 v1

2026-09-14. 구현 범위: 기존 JSON → 편집 프로젝트 → 기존 플레이테스트 데이터.

## 계약 경계

첨부 v2.2의 Project 0.2.0은 UUID, 독립 Battle/Scene, Expression, RuleSet과 명령 AST를 요구한다. 기존 전투 JSON은 이 계약이 아니다. 이번 `tk-authoring-project` version 1은 기존 엔진 전용 이관/편집 형식이다. native Project 0.2.0으로 내보내거나 전체 챕터 실행을 지원한다고 표시하지 않는다.

| 기존 필드 | 호환 프로젝트 | 내보내기 |
|---|---|---|
| 전투 Stage | battles[].data | 기존 전투 스키마로 검증 가능 |
| scenario.intro/outro/outroDefeat | scenes[].data, battle.sceneSlots가 ID로 참조 | 기존 슬롯 위치에 복원 |
| scenario의 미지원 키 | battles[].data.scenario | 그대로 보존 |
| 맵 JSON | maps[].data | 그대로 보존 |
| 명시적으로 전달한 전투 순서 | chapter.stages의 scene/battle/end 노드 | 기존 캠페인 순서를 변경하지 않음 |
| 원본 키 순서 | battle.sourceLayout | 필드 순서 복원용 메타데이터, 원본 데이터 사본 아님 |

ID는 유형 접두사와 원본 ID를 인코딩한 결정론적 문자열이다. UUID native 계약과 구분한다. 입력 순서는 호출자가 결정하며 파일 이름으로 챕터를 추측하지 않는다. 맵은 재사용 가능하지만 입력 전투/맵 ID 중복은 거부한다. 존재하는 모든 장면 슬롯은 빈 배열/null/미지원 값도 보존한다. 전투 중 dialogue/events는 전투에 남는다.

기본 흐름은 intro → battle → victory/outro → 다음 전투, defeat/outroDefeat → 종료다. 이는 새 이관 프로젝트의 명시적 초기 연결이며 기존 게임의 패배/재시도 동작을 변경하지 않는다. 준비/결과를 새로운 Stage.kind로 추가하지 않는다.

## 저장과 진단

load/save는 JSON 객체를 깊게 복제하고 의미 검증으로 draft 저장을 막지 않는다. 알 수 없는 중첩 필드·null·빈 배열을 보존한다. 지원하지 않는 버전도 재저장은 가능하지만 진단 및 플레이테스트 변환에서는 거부한다. JSON으로 표현할 수 없는 값은 조용히 삭제하지 않고 오류로 처리한다.

validate는 구조 오류, 중복 ID, 타입이 틀린 리소스 참조, 지역 챕터 외 next, entry 누락, 필수 결과 분기 누락, 종단 노드의 잘못된 연결, 맵/전투/장면 데이터 오류를 경로와 함께 반환한다. 빈 draft는 보존하되 실행용 구조 오류를 표시한다. 이것은 전체 native 명령 컴파일러나 런타임 capability 검사가 아니다.

첫 완료 기준: 기존 27개 전투와 사용 맵의 무편집 왕복 일치, 장면 편집 시 해당 슬롯만 변경, 원본/반환값 참조 격리, 미완성/미지원 draft 보존, 이야기 전용·연속 전투·승패 후일담 참조 검증. UI·서버 저장·전체 챕터 실행·보상 커밋·native 변환은 후속 범위다.

## 사용 API

독립 서브패스 `@tk/data/authoring-project`로 가져온다. 기존 게임 데이터 엔트리포인트와 런타임 로더는 변경하지 않았다.

```ts
import {
  importLegacyChapter, serializeAuthoringProject, parseAuthoringProject,
  validateAuthoringProject, exportLegacyBattle, createLegacyPlaytestSnapshot,
} from "@tk/data/authoring-project";

// stages/maps는 JSON 파일에서 읽은 원본 객체. gameData의 파싱 결과를 사용하면
// 그 이전 파싱 단계에서 제거된 미지원 필드는 복구할 수 없다.
const project = importLegacyChapter({ id: "chapter-1", name: "황건적의 난", stages, maps });
const reopened = parseAuthoringProject(serializeAuthoringProject(project));
const issues = validateAuthoringProject(reopened);
const battleId = project.battles[0]!.id;
const legacyStage = exportLegacyBattle(reopened, battleId);
const snapshot = createLegacyPlaytestSnapshot(reopened, battleId, {
  draftId: "preview-1", revision: 1, seed: 42, savedAt: new Date().toISOString(),
});
```

`serializeAuthoringProject`는 JSON 문자열을 반환한다. 디스크/브라우저 저장소 쓰기는 호출 측 책임이다. 플레이테스트 스냅샷은 원본과 참조가 분리되며 기존 `/playtest` 파서 계약을 사용한다. 실제 서버 전송과 UI 버튼은 아직 연결하지 않았다. 단일 전투 테스트는 해당 전투·장면·맵을 검증하며 관련 없는 챕터의 미완성 연결로 막지 않는다.

## 구현 검증

- `packages/data/test/authoring-project.test.ts`: 47개 통과. 실제 27개 전투의 왕복, 장면 분리 편집, draft 보존, 참조 진단, 스냅샷 검증.
- `apps/web/src/lab/__tests__/authoringProject.test.ts`: 생성한 스냅샷을 기존 `parsePlaytestSnapshot`이 받아 원래 전투/맵/seed를 반환하는 경계 테스트 통과.
- `pnpm test`: 총 1,239개 통과, 원작 입력이 필요한 9개 건너뜀.
- `pnpm typecheck`: 전체 통과.
- 전투 규칙/원본 데이터 변경 없음. 브라우저 E2E 및 native Project 전체 인수시험은 미실행.
