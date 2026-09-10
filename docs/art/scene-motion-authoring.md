# 삼형제 동작 · 도원결의 시범

2026-09-09. 전투 시스템은 유지하고 시나리오의 캐릭터 연기를 먼저 검증한다.

## 사용

1. `pnpm --filter @tk/web dev`
2. 기존 캐릭터 에디터의 **동작 · 방향 편집** 버튼 또는 `http://localhost:3000/motion-editor`.
3. 유비/관우/장비 → 방향 → 동작 선택. 프레임 클릭은 정지 미리보기, 재생 버튼은 전체 동작 재생.
4. 이미지 넣기(PNG/WebP), 프레임 복제/삭제/앞으로 이동, 시간과 반복 여부 편집.
5. **게임에 저장** 후 시나리오를 새로 연다. 저장은 개발 서버에서만 가능하며 고정 경로의 동작 JSON만 변경한다. JSON 내보내기도 제공한다.
6. **도원결의 시나리오** 링크에서 거리 → 주점 → 복숭아밭을 재생한다. Enter/클릭으로 대사 완성 또는 다음 줄, 동작 중 탭은 즉시 최종 위치로 진행한다.

## 파일과 연결

- `apps/web/public/assets/scene-motions/library.json`: actor → 방향.동작 → 프레임/시간/반복.
- `brothers-gestures.png`: 좌측 대기·걷기·손짓·인사·무릎 꿇기. 오른쪽은 좌측 반전.
- `brothers-directions.png`: 아래(정면)·위(뒷모습)의 대기 및 두 걷기 자세.
- 시트는 6열 3행. 이미지 원본을 보존하며 편집기와 게임이 같은 로더에서 프레임을 분할하고 가장자리와 연결된 배경을 투명하게 표시한다.
- `src/scene/motions.ts`: 공통 데이터 검증, 방향별 동작 조회, 시간→프레임 선택, 이미지 처리.
- `src/scene/map/ActorView.ts`: 시나리오 전용 그림 재생. UnitView는 이동 위치와 말풍선의 부모로 재사용.
- 기존 `MapSceneLine.pose`가 `talk`, `salute`, `kneel` 등을 지정한다. `face.dir`는 left/right/up/down.
- `packages/data/json/stages/01-zhuojun.json`: 초반 장면 행동 데이터.
- `assets/maps/scene-01-{street,tavern,orchard}.png`: 새 시나리오 배경. 가구가 포함돼 주점·복숭아밭 데이터의 중복 소품을 제거했다.

## 현재 범위

세 사람의 4방향 걷기와 옆보기 몸짓을 검증하는 첫 시안이다. 팔 관절을 보간하는 리깅이 아니라 포즈 프레임 방식이며, 특히 옆 걷기는 원화의 발 간격 차이가 작아 추가 중간 프레임이 필요하다. 위·아래 인사와 무릎 꿇기는 아직 미제작이며 같은 방향 대기로 폴백한다(편집기에 표시). 다른 캐릭터는 기존 스프라이트를 사용한다. 전투 공격·피격은 이번 동작 라이브러리로 교체하지 않았다.

생성 이미지 출처: 내장 ImageGen, 2026-09-09. 기존 유비·관우·장비 그림을 디자인 참조로 사용. 원본은 `assets/scene-motions`에 보관.

## 검증

웹 typecheck, scene motion/interpreter 테스트, data 스키마 테스트. 브라우저에서 방향 선택·재생·시간 수정·게임 저장, 거리→주점→도원결의 진행 확인. 테스트 워커의 Windows EPIPE가 발생하면 `pnpm --filter @tk/web exec vitest run --maxWorkers=2 --minWorkers=1`로 실행한다.
