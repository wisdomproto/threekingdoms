# TROIA 첫 전투 — 기존 전투 화면과 엔진 재사용

2026-09-15. `/troia`는 트로이 챕터 진입점이며, 실제 전투는 삼국지의 `BattleScreen`을 그대로 실행한다.

## 공유 범위

- 기존 BattleStore, Pixi BattleRenderer, 전신 스프라이트, 이동·공격 연출, HUD, 행동 메뉴, 책략, 협공, SP 필살, 자동전투, 일시정지, 결산을 사용한다.
- 이야기와 승리·패배 후일담은 기존 ScenePlayer를 사용한다. 순서는 시작 화면 → 이야기 → 전투 → 결산 → 후일담이다.
- 콘텐츠는 `packages/data/json/troia/first-battle.json`에서 기존 스키마로 검증한다. 기존 전략 카탈로그와 병종 규칙을 사용한다.
- 전투 연산과 AI는 기존 엔진과 정책을 사용한다. 별도 후퇴 AI나 별도 전투 UI는 없다.
- 독립 챕터는 sandbox로 실행하여 삼국지 캠페인 보상을 기록하지 않는다. 현재 트로이 전투의 새로고침 이어하기는 지원하지 않는다.

## 캐릭터 표시

원화를 동그란 말로 잘라 표시하던 별도 화면을 제거했다. 아킬레우스·파트로클로스·디오레스·그리스 창병/궁병·트로이 창병/궁병 7종의 귀요미 전신 애니메이션을 새로 제작했다. 각 32장(앞/뒤 × 대기 2·이동 4·공격 6·피격 2·방어 2), 총 224장의 서로 다른 그림을 기존 UnitView와 spriteClips에서 재생한다. 원래 귀요미 원화는 대화·장수 초상에도 유지한다.

## 첫 전투 규칙

- 아군 4명, 적군 6명. 봉화대 (34, 8)에 20턴 안에 도착하면 즉시 승리한다.
- 아킬레우스 또는 파트로클로스 퇴각 시 패배한다.
- 테티스의 조개 부적은 기존 방어 아이템으로 무기 피해를 30% 경감한다.
- 붕대 3개는 기존 진영 공유 회복 아이템이다.
- 필살·협공·책략 사용 조건, SP/MP 소비, 사거리, 효과와 연출은 삼국지와 동일하다.

## 로컬 실행 및 에셋

`pnpm --filter @tk/web dev` 후 `/troia`를 연다. Windows webpack 개발 캐시에서 파일 읽기 오류가 발생한 이번 세션은 `pnpm --filter @tk/web dev --turbopack --port 3002`로 복구했다.

생성 원본은 `docs/troia/first-battle/assets/`에 보존한다. 로컬 재구성 시 아래 파일을 복사한다. 원본과 복사본은 커밋하거나 외부 업로드하지 않는다.

| 원본 assets 파일 | apps/web/public 아래 대상 |
|---|---|
| achilles-chibi.png | assets/troia/achilles.png |
| patroclus-chibi.png | assets/troia/patroclus.png |
| diores-chibi.png | assets/troia/diores.png |
| opening.png | assets/troia/opening.png |
| map-v2/troia-coast.webp | assets/maps/troia-coast.webp |

기존 `public/assets/sprites`와 manifest도 필요하다. 이 챕터는 기존 TextureResolver의 로컬 에셋 옵션을 사용한다.

## 검증

- 브라우저에서 기존 전투 HUD, 전신 캐릭터, 해안 맵, 트로이 대화 초상, 파트로클로스 선택 및 기존 책략 메뉴 표시를 확인했다.
- 전용 테스트는 실제 BattleStore 책략 시전, 협공·필살 이벤트, 아이템 피해 경감·회복, 점령·필수 장수 패배 조건을 검사한다.
- 확장 맵에서 기존 자동전투 정책으로 고정 시드 10개 모두 12~20턴 승리. 기본 시드 731은 17턴 승리다.
- 타입 검사 통과. 기존 27개 전투 report-card는 모두 HEALTHY.
- 2026-09-16 전체 패키지 테스트 통과. 원작 입력 파일이 필요한 import-hero 9개만 건너뜀. 확장 맵의 경로 연결·배치·책략·협공·필살·승패 전용 검사 9개 통과.


### 트로이 애니메이션 제작

- 내장 imagegen 사용. 정확한 프롬프트: `animation-prompts.json`. 생성 원본·출처·검증 해시: `assets/animation/`.
- `node docs/troia/first-battle/install-animation.cjs`: 기존 `tools/pack-hero-motion.cjs`로 256×256 WebP를 분할하고 발 기준선을 맞춘 뒤, 기존 manifest 메타데이터를 보존하며 트로이 항목만 등록한다.
- 설치 경로: `apps/web/public/assets/sprites/troia-*`. 224개 프레임의 크기, 투명 가장자리, 알파, 서로 다른 파일 해시를 검증했다. 정적 폴백은 각 동작 첫 프레임이다.
- `/battle-motion-preview`의 트로이 3개 묶음에서 실제 UnitView로 재생할 수 있다. 기존 공격 시간 420ms, 타격 시점 180ms를 유지한다.
- 스킨 변경 후 웹 테스트 803개 및 전체 타입 검사 통과.
- 브라우저 실전에서 아군·적군 10명 모두 트로이 전용 전신 이미지로 표시됨을 확인했다.


## 확장 해안 맵 v2 — 2026-09-16

40×24칸(960칸), 기존 대비 면적 4.44배. 상륙 (10,12) → 해안 교전 (17,11)/(18,14) → 중앙 (23,12) → 봉화대 (34,8). 카메라는 탁군과 같은 1.6배, 시작 초점 (12,12)이다. 드래그로 이동하며 미니맵은 현재 위치와 병력 분포를 표시한다. 전방 창병 둘만 병력 80→70으로 조정하고 나머지 전투 규칙과 적 병력은 유지했다.

기존 export_chunks.py에 선택 입력·출력 경로를 추가해 독립 프로젝트 번들도 처리한다. 24×24칸 청크 두 개를 8칸 겹쳐 생성한 뒤 기존 stitch_chunks.py로 3840×2304 WebP를 합성했다. 출력 크기는 합성 시 재표본화한 해상도이며 생성 원본의 native 해상도와 구분한다. 바위·나무·수레·봉화 모닥불은 기존 오브젝트 레이어다. 이전 배경 원본은 보존한다.

재현 명령:

```powershell
python docs/troia/first-battle/expand-map.py
python tools/sprite-pipeline/export_chunks.py troia-coast 3 48 packages/data/json/troia/first-battle.json docs/troia/first-battle/assets/map-v2
# map-prompts.json records the built-in image generation prompts and selected files.
python tools/sprite-pipeline/stitch_chunks.py troia-coast 96 docs/troia/first-battle/assets/map-v2 docs/troia/first-battle/assets/map-v2/troia-coast.webp
Copy-Item docs/troia/first-battle/assets/map-v2/troia-coast.webp apps/web/public/assets/maps/troia-coast.webp
```

- 브라우저에서 해안부터 봉화대까지 드래그 이동, 별도 나무·바위·봉화 오브젝트, 기본 카메라 복귀를 확인했다.
