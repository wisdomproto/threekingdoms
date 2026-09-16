# 프로젝트 스튜디오 UI v1

2026-09-14. 기존 전투를 복사해 챕터를 구성하고 로컬 프로젝트로 저장하는 개발용 작업면.

후속 업데이트: 기존 스토리·맵·전투 상세 편집기와 같은 프로젝트 저장을 연결했다. 아래 초기 v1 범위에 더해 [기본·고급 모드 및 UX](editor-modes-and-ux-review.md)의 1차 구현을 지원한다.

## 상세 편집 연결

리소스 작업면에서 ‘장면 상세 편집’ 또는 ‘맵·장수 배치 편집’을 누르면 기존 편집기를 연다. 실행 전 Studio 수정을 저장하고, 상세 편집 중 Studio의 다른 편집은 잠근다. 상세 편집 저장은 해당 프로젝트의 선택 리소스와 연결된 맵/스토리만 갱신하며 원본 게임 JSON에는 쓰지 않는다. 다른 창의 저장과 충돌하면 409로 중단하고 복구본 및 JSON 보관 기능을 제공한다.

dev 전용 `/api/studio/legacy/`는 지정된 HTML·JS·참조 데이터만 서빙한다. `/api/studio/projects/{id}/legacy`의 GET은 선택 대상, PUT은 revision을 비교한 저장, POST는 미리보기 스냅샷 생성이다. 스토리 단독 리소스도 전투 없이 편집·미리보기할 수 있다. 모드 선택은 저장 데이터와 분리돼 있다. 돌아오면 선택했던 챕터·단계를 유지하며, 상세 편집의 Undo 이력은 그 편집 세션 안에서만 유지한다.

검증: 테스트 1,256개 통과/9개 건너뜀, 타입 검사 통과. HTTP로 미완성 draft 저장·오래된 revision 거부·잘못된 미리보기 거부·정상 전투 스냅샷 생성을 검사했다. 브라우저에서 상세 대사 수정→자동저장→모드 전환→Studio 복귀, 장면 플레이어 재생, 전투 1턴 진입을 확인했다. 검증용 대사는 원래 내용으로 복원했다. 캐릭터·아이템 등 다른 편집기의 공통 저장과 전체 챕터 실행은 아직 후속 범위다.

## 열기

저장소에서 `pnpm --filter @tk/web dev`를 실행하고 `http://localhost:3000/studio`를 연다. 기존 `tools/index.html` 대시보드에도 진입 링크가 있다. 페이지와 API 모두 development 환경에서만 동작한다.

## 이번 구현

- 프로젝트 생성: 원본 27개 전투에서 선택하거나 빈 프로젝트로 시작. 선택한 전투와 맵은 원본 JSON에서 읽어 호환 계층으로 복사한다.
- 프로젝트 목록/재열기, JSON 파일 가져오기/내보내기. 미지원 버전은 보존하되 일반 편집 화면은 열지 않는다.
- 내보내기는 현재 편집본의 스냅샷을 `.studio/exports/`에 만들고 다운로드 링크로 제공한다. 서버 연결 실패 시 브라우저 Blob 저장을 시도한다. 준비한 파일은 생성 시점 내용이며 이후 편집은 새로 내보낸다.
- 챕터 추가, 시작 단계 지정, 스토리/전투/종료 카드 추가·삭제, 공유 리소스 선택, 승리/패배/장면 완료의 다음 단계 연결.
- 스토리 작업면: 일반 대사 장면의 배경 키·화자·본문·대사 추가/삭제. 기존 만화·맵 연출은 보존하고 이 화면에서는 수정하지 않는다.
- 전투 작업면: 전투 이름·턴 제한·맵 선택·기존 배치 유닛의 좌표/레벨 수정. 목표·증원·전투 대사·보상은 보존한다.
- 저장: 1.2초 디바운스 자동저장, 수동 저장/Ctrl+S, 변경 이력 80개, 빠른 같은 필드 입력 병합, Undo/Redo. 입력 칸의 Ctrl+Z는 브라우저 텍스트 편집 동작에 양보한다.
- 오류 진단: 한국어 요약과 편집 위치 링크. 누락된 분기가 있어도 저장한다. 한 전투 테스트는 전체 챕터 실행과 구분한다.
- 선택 전투 테스트: 현재 편집 내용에서 분리된 스냅샷 생성 → 기존 `/playtest` → `__lab` 전투. 테스트 탭 종료 시 원래 편집 탭으로 복귀하며, opener가 없으면 해당 프로젝트 주소로 돌아간다.

## 저장과 충돌

서버 저장은 `.studio/projects/{opaque UUID}.json`이다. 사용자 문서 ID나 파일 이름을 경로에 직접 사용하지 않는다. 파일에는 서버 저장 ID·revision·updatedAt·원본 project 객체를 담는다. 생성과 수정은 임시 파일 쓰기/fsync/rename, 파일별 독점 lock으로 처리한다. 이전 revision의 수정은 409, 다른 저장과 경합 중이면 423으로 거부한다. 저장 중 추가 편집은 이전 응답으로 덮어쓰지 않는다.

서버 장애·충돌 시 자동 재시도를 멈추고 사용자가 재시도할 수 있게 한다. 브라우저 복구본(`tk.studio.recovery.{storageId}`)을 별도로 유지하며 재열기 시 복원/저장본 선택을 제공한다. 오래된 복구본은 최신 저장본을 조용히 덮어쓰지 않는다. 파일 내보내기 후 별도 프로젝트로 가져올 수 있다.

파일별 lock은 정상 종료/오류 시 해제한다. 저장 중 프로세스가 강제 종료되어 `.lock`이 남으면 자동으로 제거하지 않는다. 해당 프로젝트를 저장 중인 프로세스가 없는지 확인한 후 로컬 운영자가 정리해야 한다. 현재 v1의 운영상 한계다.

API는 같은 출처 요청을 확인하고 요청/프로젝트 크기를 10MB로 제한한다. JSON draft의 의미 오류를 저장 거부 조건으로 삼지 않는다. 서버 프로젝트와 테스트 스냅샷은 gitignore 대상이며 게임 원본/Published 데이터나 R2에 쓰지 않는다.

## 검증

- 신규 자동 테스트 12개: 파일 저장/재열기, 미지원 데이터 보존, stale revision, 실제 동시 저장, 임시 파일·lock 해제, 경로·크기 제한, 개발 환경/출처 경계, undo/redo·입력 병합·저장 중 추가 편집.
- 전체 `pnpm test`: 1,251개 통과, 원작 입력 파일이 필요한 9개 건너뜀.
- `pnpm typecheck`: 전체 통과.
- `pnpm --filter @tk/web build`: 통과. Studio First Load JS 약 130kB, 개발 환경 밖에서는 페이지/API 접근을 차단한다.
- 프로덕션 서버에서도 `/studio`, 프로젝트 GET, 프로젝트 POST가 모두 404를 반환하는 것을 확인했다.
- 실제 브라우저: 사수관 프로젝트 생성, 단계 이름/대사 수정, 자동저장, 대사 Undo, 패배 분기 누락 상태의 저장·새로고침·오류 위치 이동·연결 복구, 실제 사수관 전투 1턴 진입을 확인.
- 데스크톱과 모바일 390px viewport에서 레이아웃 확인. 모바일 문서 폭과 콘텐츠 폭이 같아 가로 넘침 없음.
- 파일 선택기로 미지원 버전/미지원 중첩 필드가 있는 JSON을 가져와 보존 화면을 확인했다. 서버 다운로드 링크의 실제 다운로드 이벤트와 응답 내용을 확인했으며 가져온 JSON과 일치했다.

복구본 선택의 전체 시나리오는 이번 실브라우저 검증에 포함하지 않았다. 전체 챕터 실행, native Project 0.2.0 변환, 클라우드 저장, 배포, 이벤트/만화/맵의 고급 편집은 후속 범위다.

## 후속: 프로젝트 장수·로스터·아이템

Studio 상단에서 기존 캐릭터/아이템 편집기를 열어 같은 프로젝트에 자동저장한다. `project.catalogs`의 `commanders`, `rosters`, `items`는 원본 객체로 보존한다. 목록이 없는 기존 프로젝트는 저장소 JSON을 기본값으로 읽으며, 카탈로그 첫 저장 시 세 목록을 프로젝트에 담는다. 미지원 필드를 저장 시 스키마 출력으로 치환하지 않는다.

카탈로그 편집은 프로젝트 revision으로 충돌을 검사하며 실행 취소/다시 실행, 저장 후 복귀, 프로젝트·편집기별 복구본을 제공한다. 이 편집기의 실행 취소 이력은 해당 편집기를 닫으면 끝난다. 기본 모드는 내부 ID·효과 JSON·초상화 ID·스킬 설정을 숨기며 값은 유지한다. 고급 모드에서 다시 노출한다. 좁은 화면의 목록과 폼은 세로 배치한다.

전투 및 장면 플레이테스트 스냅샷에 카탈로그를 포함하고 실행 경계에서 현재 스키마와 배치 참조를 검증한다. 전투 엔진과 PC/모바일 도구 메뉴가 이 데이터를 사용한다. 아이템 편집기의 기존 로더가 `effects` 및 미지원 필드를 버리던 문제를 수정하고, 현재 효과 키를 정상적으로 인식하도록 보완했다.

검증: 전체 테스트 1,259개 통과/9개 건너뜀, 타입 검사 및 프로덕션 빌드 통과. 실제 HTTP에서 카탈로그 저장·이전 revision 거절·미지원 필드 보존·스냅샷 반영을 확인했다. 실제 브라우저에서 장수 무력 수정/실행 취소/다시 실행/저장 복귀, 아이템 이름 수정 후 재열기와 `multiHit` 효과 보존을 확인했다. 복구본 충돌의 모든 UI 조합은 아직 실브라우저 검증 범위 밖이다.

로스터 편집은 프로젝트 데이터 저장까지이며, 프로젝트 챕터 전체 실행과 로스터의 챕터별 자동 합류는 후속 범위다. 병종·리그 편집, native Project 0.2.0, 클라우드 배포도 아직 완료한 것이 아니다.

## 후속: 선택 챕터 흐름 테스트

`챕터 처음부터 테스트`는 프로젝트 저장 후 해당 revision을 확인하고, 선택 챕터의 단계·장면·전투·카탈로그를 불변 스냅샷으로 만든다. `/studio/play`에서 기존 `/scene`과 `/battle` 플레이어를 순차 실행한다. 스토리 완료는 `completed`, 전투 결산의 다음 버튼은 `victory` 또는 `defeat` 연결을 따른다. 종료 단계에서는 완료 화면을 표시한다. 중단·처음부터 다시 테스트·Studio 복귀를 제공한다. 새로고침하면 챕터 처음부터 시작한다.

실행 전에 시작점·단계 ID 중복·양쪽 승패 연결·실행 데이터 스키마를 검증한다. 불완전한 초안 저장은 계속 허용한다. 결과 메시지는 같은 출처와 현재 iframe·실행 ID·단계 ID·방문 번호를 확인해 이전 단계의 중복 결과를 무시한다. 반복 연결의 폭주를 막기 위해 한 번의 테스트에서 100단계까지만 실행한다. 테스트 데이터의 브라우저 저장 실패 시 이전 전투 데이터로 진입하지 않고 오류를 표시한다.

범위는 **선택 챕터의 연결 흐름 검증**이다. 전투는 설정된 배치와 시드 1로 시작하며, 전투 간 성장·장비는 아래 후속 구현으로 이어받는다. 실제 게임의 골드·클리어·성장 저장은 sandbox 경계로 차단한다. 웹툰 전용 단계는 아직 지원하지 않으며 스토리 리소스의 만화 파트는 기존 플레이어로 재생한다. 프로젝트 전용 맵 장면의 리소스 전달은 추가 작업이 필요하다.

검증: 기존 전체 1,262개 및 추가 완료 경계 테스트 2개 통과(총 1,264개, 원작 파일 의존 9개 건너뜀). 전체 타입 검사와 프로덕션 빌드 통과. 브라우저에서 사수관 스토리→전투 진입, 별도 검증 프로젝트의 승리→승리 이야기→종료, 패배→패배 이야기, 중단→처음부터 재시작을 확인했다. HTTP API에서 저장 revision 불일치 시 409를 확인했다.

## 후속: 챕터 테스트의 성장과 로스터

승리한 전투의 아군 병종·레벨·경험치·장비와 남은 공유 소모품을 이후 전투의 같은 장수에게 전달한다. 초기 배치와 증원 모두 적용하며 적군·좌표·저작한 병력 수는 유지한다. 병력과 MP는 각 전투 생성 규칙으로 회복한다. 패배한 전투의 변화는 버리고 직전 진행 상태로 패배 분기를 실행한다. 처음 등장한 장수는 전투에 설정한 장비와 능력치로 시작한다.

테스트 시작 시 프로젝트의 챕터 배열 순서(1부터)와 `joinChapter`로 합류 명단을 만든다. 전투 종료 시 아군 장수를 명단에 추가하고 `departsAfterStage`를 반영한다. 합류 명단은 화면에서 확인할 수 있으며 자동 출진·배치 기능은 아니다. 출전 장수와 위치는 저작한 전투 배치가 결정한다. 이탈 뒤의 전투에도 같은 장수를 직접 배치한 경우에는 그 배치를 따른다. 로스터의 시작 장비 자동 지급, 이탈 장비 환수, 보상 자금·보물의 인벤토리 연계는 아직 구현하지 않았다.

진행 상태는 실행 ID별 `sessionStorage`로 부모 플레이어와 iframe 사이에 전달한다. 단계 ID·방문 번호가 다르거나 저장에 실패하면 실행을 멈춘다. 실제 게임 저장은 변경하지 않으며 새로고침/처음부터 다시 테스트 시 초기화한다. 챕터 간 캠페인 진행 저장은 후속 범위다.

별도로 일반 게임의 출진에서도 경험치가 전투 생성 시 0으로 초기화되던 누락을 수정했다. `StageUnit.exp`는 선택 필드이며 없으면 기존처럼 0으로 시작한다. 기존 편집기 저장 왕복과 출진→엔진 생성까지 회귀 테스트로 확인했다.

검증: 전체 테스트 1,268개 통과, 원작 파일 의존 9개 건너뜀. 타입 검사 통과. 전투 리포트는 건강 26·쉬움 1·어려움/불가 0이다. 브라우저에서 레벨 5·경험치 37·장비 1개·소모품 1개로 첫 전투 승리→이야기→원래 레벨 1/장비 없는 두 번째 전투→승리→종료까지 값이 유지되고, 다시 시작 시 초기화됨을 확인했다. 검증 프로젝트는 원본과 별도로 생성했다.
프로덕션 빌드도 통과했으며, 검증용 프로젝트는 작업 목록에서 분리했다. 기존 사수관 프로젝트 revision 7은 유지했다.

## 후속 계획: 테스트 이어하기
단계 시작 시점의 진행 상태를 실행 스냅샷 ID별로 브라우저에 저장한다. 같은 테스트 주소를 다시 열면 이어하기/처음부터를 선택한다. 전투 중 턴이나 대사 위치는 저장하지 않고 해당 단계 처음부터 재생한다. Studio에는 프로젝트별 마지막 테스트 주소를 표시하며, 새 편집본 테스트는 별도 스냅샷으로 시작한다. 실제 캠페인 저장 및 챕터 간 자동 이동과 구분한다.

구현 완료: localStorage의 실행별 체크포인트와 프로젝트별 마지막 테스트 링크를 추가했다. 다시 열면 이어하기와 처음부터 중 선택한다. 저장 손상/실행 불일치/저장 실패는 오류로 표시하고 기존 진행을 자동으로 덮어쓰지 않는다. 위 이전 구현의 ‘새로고침 시 초기화’ 동작은 이 선택 화면으로 대체했다. 단일 실행을 여러 탭에서 진행하면 마지막으로 저장한 단계가 남는다.
검증: 웹 테스트 754개 및 전체 타입 검사 통과. 실제 브라우저에서 첫 전투 승리 후 탭 닫기→같은 주소 새 탭 열기→이야기 단계와 레벨 5/경험치 37/장비 1/소모품 1 복원, 중단→처음부터 초기화, Studio 마지막 테스트 링크 생성을 확인했다. 전투 중간 턴 저장·챕터 간 캠페인 저장은 포함하지 않았다.
프로덕션 빌드 통과. 좁은 화면에서 Studio 이어하기 링크가 작업 버튼 아래로 배치되는 것을 확인했으며, 기존 사수관 프로젝트 revision 7을 유지했다.

## 후속 계획: 프로젝트 맵 장면
프로젝트 스냅샷에 스토리에서 참조한 프로젝트 맵을 포함한다. 같은 ID는 프로젝트 맵을 우선하며 프로젝트에 없는 기본 맵은 기존 데이터를 사용한다. 실제 플레이테스트에서 찾을 수 없는 맵은 실행 전에 오류로 표시한다. 편집 초안 저장은 계속 허용한다.

구현 완료: 독립 장면·전투 상세 편집기·선택 전투·챕터 테스트 스냅샷에 참조된 프로젝트 맵을 포함한다. 실행 파서는 맵 스키마/키와 ID/장면 참조를 검증하고, 장면 플레이어는 프로젝트 맵→기본 맵 순서로 선택한다. 관계없는 미완성 맵은 스냅샷에 넣지 않는다. 원본 프로젝트의 미지원 맵 필드는 보존한다. 기존 일반 게임의 미등록 맵 처리 방식은 변경하지 않았다.
검증: 웹 테스트 757개 및 전체 타입 검사 통과. HTTP에서 챕터/상세 편집기/선택 전투 스냅샷 생성과 누락 맵의 400 거절 확인. 실제 브라우저에서 프로젝트 전용 평지·강 지형과 등장인물/대사 표시, 장면 완료 후 전투 이동, 상세 편집기 단독 장면 재생을 확인했다. 검증 프로젝트는 원본과 분리했다.
프로덕션 빌드 통과. 기존 사수관 프로젝트 revision 7을 유지했다. 위 이전 항목의 프로젝트 맵 장면 전달 미지원은 이번 연결로 해소했다.

## 전체 캠페인 이관 — 2026-09-14

`POST /api/studio/import-campaign`은 원본 JSON을 직접 읽어 새로운 프로젝트로 저장한다. 기존 프로젝트를 수정하지 않는다. 캠페인의 `CHAPTERS` 정의로 5개 챕터를 나누고, 각 챕터의 전투를 원래 순서로 연결한다. 구간 밖 전투와 중복 ID는 누락시키지 않고 오류로 반환한다. 반복 요청은 별도 사본을 만든다.

실제 저장한 ‘삼국지 · 전체 캠페인’은 전투 27개, 이야기 슬롯 54개, 맵 30개(이야기 전용 3개 포함), 장수 379개, 도구 68개 및 로스터를 포함한다. 장수·로스터·도구는 원본 필드를 보존한 프로젝트 사본이다. 병종·전투 규칙·상점 정의·이미지·음악 등은 기존 저장소의 공용 리소스를 계속 사용하며 독립 배포 번들로 변환한 것은 아니다. 챕터 테스트는 선택 챕터 범위이며 챕터 간 저장/자동 이동은 별도 작업이다.

검증: 원본 27개 전투 복원 비교, 모든 맵/카탈로그 비교, 프로젝트 참조 검증, 5개 챕터 전체 노드의 실행 스냅샷 검증 통과. 웹 테스트 761개 및 전체 타입 검사 통과. 실제 서버에서 5개 챕터 테스트 생성 HTTP 201 확인. 기존 사수관 샘플 revision 7의 파일 해시가 동일함을 확인했다. 27개 전투 전체 수동 플레이 검증은 수행하지 않았다.

## 전투 중심 탐색 — 2026-09-14
왼쪽 탐색을 챕터 카드에서 챕터별 전투 목록으로 변경했다. 전투 클릭은 해당 챕터/노드를 선택하고 전투 시나리오 편집을 바로 연다. 챕터 제목의 흐름 버튼은 이야기 전용 챕터를 포함한 기존 그래프 편집을 유지한다. 프로젝트를 열 때 첫 전투를 선택하며 전투가 없으면 챕터 흐름을 연다. 긴 목록은 독립 스크롤하고 모바일에서는 높이를 제한한다. 원본 프로젝트 데이터와 연결은 변경하지 않는다.
검증: 웹 타입 검사 통과. 실제 브라우저에서 27개 전투 항목 표시와 사수관 선택 시 전투 시나리오·맵 편집 버튼·선택 전투 테스트 활성화를 확인했다.

챕터별 탐색은 접기/펼치기 트리로 보완했다. 챕터 제목과 화살표는 하위 전투만 토글하며, 별도 ‘흐름’ 버튼으로 그래프를 연다. 선택 챕터가 변경되면 해당 가지를 펼치고, 사용자가 현재 가지를 접어도 편집 선택을 유지한다. 프로젝트를 다시 열 때는 선택 챕터만 펼친다. 접힌 전투는 키보드 탐색에서도 제외한다. 웹 타입 검사 통과.

## 전투 페이지 통합 — 2026-09-14
기본 모드의 챕터는 접기/펼치기 분류로 유지하고, 전투 페이지를 전투 전 이야기·전투 시나리오·승리 후 이야기·패배 후 이야기 탭으로 통합했다. 각 이야기 탭은 기존 sceneSlots의 리소스를 직접 편집한다. 없는 이야기 추가는 해당 전투의 모든 흐름 사용처에 전후 노드를 삽입하고 기존 승패 후속 연결을 보존한다. 전투 시나리오 편집 버튼은 기존 상세 편집기의 배치·대사·이벤트·목표·보상 편집을 연다. 챕터 그래프와 참조 Inspector는 고급 모드에서 유지한다.
검증: 웹 타입 검사 및 웹 테스트 통과. 신규 이야기 연결/원본 필드 보존/중복 생성 차단과 기존 27개 전투 이관 테스트 포함. 캐릭터·아이템 상세 편집기는 기존 수치 폼이며 이미지 미리보기는 아직 없고, 별도 VFX/책략 편집기를 Studio 프로젝트 저장에 연결한 것은 아니다.

## 이야기 미리보기 및 안정적인 편집 화면
이야기 폼에 정적 배경/초상화/대사 미리보기를 추가했다. 대사 선택 시 그 시점까지의 배경 전환을 반영하고, 맵 장면은 배경 이미지, 만화는 페이지 이미지를 표시한다. 에셋은 기존 게임의 assetUrl 경로를 사용하며 누락 파일은 안내한다. 전체 연출 재생과 구분한다.
상세 편집기는 전체 화면을 덮지 않고 Studio 상단 아래에 표시한다. 저작 경로 /studio 및 /motion-editor에서는 BGM을 정지하며 게임 볼륨 설정은 변경하지 않는다. /studio/play는 실행 미리보기이므로 기존 오디오를 유지한다. 웹 타입 검사 및 BGM 경로 테스트 3개 통과.

## 상단 작업 영역 및 프로젝트 메뉴
상단에 시나리오·캐릭터/로스터·무기/아이템 영역 버튼을 유지하고 현재 영역은 강조색과 aria-current로 표시한다. 상세 편집에서 영역 전환은 저장 완료 응답 후 수행한다. 프로젝트 열기·새 프로젝트·파일 가져오기·파일 내보내기는 왼쪽 위 메뉴로 이동했다. 바깥 클릭, Escape, 포커스 이탈과 항목 선택 시 닫힌다. 상세 편집 중에는 저장 전 프로젝트 전환/오래된 스냅샷 내보내기를 방지한다. 웹 타입 검사 및 브라우저 메뉴 펼치기/접기 확인.

## 공통 전투 이벤트 확장
전투별 `scriptEvents`는 기존 일기토 `events`와 분리한 조건/실행 목록이다. 턴·좌표 진입·퇴각·체력 임계·선행 사건 조건을 지원하고, 실행은 메시지·범위 연출·피해·회복·상태이상·날씨·증원 호출을 순서대로 적용한다. 사건은 ID별 한 번 발동하며 선언 순서로 평가한다. 피해/상태는 순수 엔진에, 이미지/효과음은 프레젠터에 둔다. 에디터 저장은 미지원 필드를 보존한다. 기절은 행동 차례를 소비하며 전원 기절로 페이즈 진행이 멈추지 않아야 한다. 적벽 예시는 기존 캠페인 원본과 구분해 Studio에서 적용하며, 다른 전투의 사건을 임의로 지어내어 추가하지 않는다.

## 전투 상세 화면 탐색 정리
Studio 전투 상세에서는 전후 이야기 탭과 이야기 미리보기 드롭다운을 숨기고 해당 탭으로의 전환도 막는다. 전투 중 대사 탭은 우측 패널만 바뀌며 전투 맵과 지형 도구를 유지한다. 상단에 전투명·작업 영역·현재 세부 탭을 표시한다. 독립 실행하는 구형 에디터의 이야기 기능은 유지한다. 실제 브라우저에서 이야기 탭 제거 및 대사 탭 선택 후 지형 영역 유지 확인.
공통 사건 기능은 전체 테스트, 타입 검사, 프로덕션 빌드, 기존 전투 밸런스(26 healthy / 1 easy) 통과. Studio 적벽 편집 예시에서 4턴 화공·구역 피해·기절과 원래 증원 동시 적용 확인. 화재는 범위 시각 연출이며 지속 연소 지형/선박 오브젝트 상태 전환은 구현하지 않았다. 기존 27개 맵의 원작 사건을 전수 재현한 것은 아니다. 원본 게임 JSON은 유지한다.


### Detail editor navigation and map preview
- Scenario navigation remains visible beside story/battle detail editors and supports collapse/expand. Selecting another battle requests save/close before switching.
- Studio owns the single editing-mode selector; a same-origin message updates the embedded editor without remounting it.
- Battle settings tabs no longer shrink behind long forms. Meta is labeled 기본 설정 with Korean field labels.
- Map display supports terrain grid or painted map with character sprites. Studio previews terrain objects using shared wall/deco rules and authored decorations. Preview requests do not persist data; missing textures are omitted. The painted background itself does not regenerate after terrain edits.
- Embedded automatic battle testing remains a follow-up: the existing game already supports auto battle, but Studio currently opens its playtest separately.

- The left scenario tree omits the duplicate project-name field; the shared header displays the project name.
- Map selection supports click, Shift-click, rectangle selection, group drag and Delete. Context actions add units, terrain and props. Ctrl+C/V copies only terrain/props: characters are excluded and duplicate commander placement is blocked against initial/reinforcement units. Decoration edits retain unknown fields; group moves commit once on mouse release.


### Focused battle workspace and separate connections page
- Selecting a battle opens its map editor directly in both editing modes. The two workspace tabs are 전투 편집 and 시나리오 작성; story authoring includes before/after scenes and battle events.
- Chapter graph, entry node and outcome links are managed at `/studio/connections?project=...`, reachable through the top 시나리오 연결 button. They are excluded from the individual battle workspace.
- Page transitions request embedded-editor save completion before navigation. Parent edits are saved before leaving for the connections page.

- The two battle workspace tabs stay sticky below the main header. Removed the duplicate detail breadcrumb/return button, Studio project badge and successful validation banner; errors remain visible.
- Map zoom: +/- buttons, percentage, reset, fit and Ctrl-wheel (view only). Initial unit facing is optional left/right; absent values face the map center in editor and game rendering.

- Right-click opens only character/object add choices. Character form searches unplaced commanders; roster class is preselected with an advanced override. Object form displays the selected asset image before adding.
- Verified browser: 100→120% zoom stays saved, duplicate header/badge removed, right-click two choices, 조운 search returns one result with roster cavalry, tree preview loads. Development server was restarted with Turbopack after repeated webpack vendor-chunk read failures.

### Battle event panel correction (2026-09-14)
- Keep the battle map and fixed Battle / Story workspace tabs mounted while editing events.
- The right-panel event list includes script events, dialogue, reinforcements, and strategy goals. Selecting a row edits it inline; no secondary event navigation or separate event page.
- Pre-battle and post-battle stories belong exclusively to Story authoring. Hide legacy story tabs before module initialization in embedded battle documents.
- The legacy stage model owns scriptEvents with deep-copy isolation and preserves unknown fields on save.

### Simple and complex events
Event creation offers simple fire/dialogue/reinforcement templates and a complex condition/action editor. Simple fire defaults to three turns, 10% damage, no spread, and rain extinguishing. Pick two opposite map corners to define its rectangle; detailed coordinates and spread restrictions are collapsed. Complex mode preserves the same event data and supports fire among ordered actions.

### Integrated asset editing (2026-09-14)
- Motion workspace lists the complete commander catalog, keeps edits across selection changes, and separates battle sprites from scenario motion clips. Character-editor links pass the selected commander and project. Return/close controls preserve unsaved-work checks.
- Battle sprites use the runtime sprite candidates and edit front/back idle, move, and attack assets. Mirroring/hit effects remain runtime behavior.
- Battle settings include map artwork replacement; items include icon replacement; battle events include the runtime FX image selector. Each offers a preview before applying. Local asset files are shared across projects and backed up under `.studio/asset-backups` before replacement; project JSON exports do not bundle these files.

### Character workspace consolidation
Character editing keeps one persistent list and three inline tabs: stats, battle images, and scenario motions. Six battle pose thumbnails are visible together. The embedded motion editor shares the selected commander through origin/source-checked messages and retains scenario drafts across tab/character changes. Pending image replacements block navigation until applied or cancelled. Catalog toolbars keep undo/redo/save/status in one row; secondary commands move into More, and the Studio header owns editing mode.

### Promotion-tier image editing
Battle image editing exposes tiers 1/2/3 separately. Tier 2 and 3 target `t2/` and `t3/`; replacing a pose does not overwrite the base-tier asset. Missing poses are explicitly marked instead of presenting fallback artwork as an existing tier asset. Pending file previews require apply/cancel before switching tiers.
