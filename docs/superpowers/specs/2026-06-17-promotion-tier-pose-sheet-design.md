# 설계: 캐릭터 SD 코스메틱 승급 포즈시트 (3등급 × 3포즈 9칸) — 2026-06-17

> 상태: ✅ **구현 완료 (2026-06-17)** — asset-board.html S-pose 9칸 + cut_posesheet.py 2D 컷, 4 테스트 통과, 최종 코드리뷰 승인. 엔진 tier 스위칭·back_* 등급화는 후속(§2 비목표). 계획=docs/superpowers/plans/2026-06-17-promotion-tier-pose-sheet.md.
> 관련: [docs/art/asset-board.html](../../art/asset-board.html) S-pose 생성기, [tools/derive-mount-map.py](../../../tools/derive-mount-map.py), CLAUDE.md §4(에셋 파이프라인).

---

## 1. 배경 & 동기

- **발단**: S-pose 포즈시트 생성기가 병종별 탈것(말/전차/사륜거)을 프롬프트에 넣지 않아 전 캐릭터가 도보로 생성됨 → 병종 데이터에서 탈것을 도출(`MOUNT_BY_NAME`)해 주입하도록 수정 완료.
- **이어진 발견**: 승급 시 외형 변화가 필요. 근거는 CLAUDE.md §4 **"승급 외형 변화는 색/장식 변형 재생성으로 처리"** — *같은 인물의 등급이 올라가며 치장이 강화*되는 **per-캐릭터 코스메틱 승급**이다.
- **⚠ 두 개의 "tier" 구분 (이 스펙의 전제)**:
  - **(A) 엔진 병종 클래스-tier** = `unitClasses.tier 1~3`. *한 line 안의 서로 다른 세 클래스*다: 보병계=단병(t1)/장병(t2)/**전차**(t3), 궁병계=궁병/연노병/**발석차**, 기병계=경/중/친위. 실루엣·탈것이 바뀐다. `packages/data/test/data.test.ts:34-38`이 "각 line은 tier [1,2,3]을 서로 다른 클래스로 가진다"를 단언하고, `lord`(군주/전차)는 "3승급 체계 밖"으로 명시 제외(`data.test.ts:37`, `unitClasses.json:22`). 이 축은 **기존 별도 템플릿**(B-2/B-2b/J-*)이 담당.
  - **(B) 코스메틱 캐릭터 승급-tier** ＝ *이 스펙이 다루는 것*. 같은 인물·같은 형태·같은 탈것에 **색/장식만 3단계**. 클래스가 바뀌지 않는다.
  - **이 시트의 t1/t2/t3는 (B)다. (A)와 의도적으로 분리됨** — 즉 시트의 t2/t3 스프라이트는 엔진의 장병·전차·연노병 클래스가 *아니다.*
- **타이밍**: 현재 스프라이트 12/109만 생성됨(거의 미착수) → **지금 시트 구조를 코스메틱 3등급 포함으로 확정**해야 재작업을 피함.

## 2. 목표 / 비목표

**목표**
- 캐릭터당 **한 장에 코스메틱 3등급 × 3포즈 = 9칸** SD 포즈시트를 생성하는 프롬프트로 S-pose 카드를 격상.
- 9칸을 등급별 스프라이트 파일로 컷하되 **기존 게임 로더 무수정**(하위호환).
- 탈것은 이미 구축한 `MOUNT_BY_NAME`을 9칸 전체에 고정 적용.

**비목표(후속·별도 스펙)**
- 무엇이 캐릭터의 코스메틱 등급을 올리는가(레벨/계급 마일스톤 등)와 게임 내 등급별 스프라이트 스위칭 — 엔진 메커니즘.
- `manifest.json`의 등급 인식.
- 엔진 **병종 클래스-tier (A)**와의 연동. (B)는 (A)와 분리되며, 형태가 다른 병종(전차·발석차·연노병 등)은 기존 별도 템플릿 유지.
- `back_*`(뒷모습)의 등급화 — §4.2 스코프 컷.

## 3. 결정 사항 (브레인스토밍 결과)

1. **시트 = 9칸 (코스메틱 3등급 행 × 3포즈 열)**, 한 번 생성으로 완결.
2. **등급 행 = 같은 형태 + 색/장식 강화**, 탈것·포즈·인물 동일. 형태(실루엣) 변화 없음. ※ 엔진 클래스-tier(A, 형태 변화)와 무관.
3. **탈것 고정**: 캐릭터의 `MOUNT_BY_NAME` 값을 9칸 전체 공용(관우=말×9, 유비=전차×9, 보병=도보×9).
4. **범위**: 로스터 109명 전원(네임드+제네릭). 제네릭도 "같은 형태+색/장식" 3등급(예: [제네릭] 보병 = 같은 보병 갑옷 강화 ×3).

## 4. 상세 설계

### 4.1 시트·프롬프트 구조 (asset-board.html, S-pose 카드)

- 현 S-pose 템플릿(1행 3포즈)을 **3행 × 3열 그리드** 사양으로 교체.
- **행(코스메틱 등급)** — 같은 인물/탈것/포즈, 갑옷 색·장식만 단계 강화:
  - 등급1: 기본 야전갑(평이한 가죽/찰갑, 차분한 기본색)
  - 등급2: 보강 철갑(어두운 강철, 견갑·테두리 추가)
  - 등급3: 정예 명광·금장(금사 문양, 채도↑, 소형 계급 표식/깃)
- **열(포즈)** — 기존 동일: (1)대기 (2)이동 (3)공격, ¾ 좌향(SCREEN-LEFT) 고정.
- **탈것 구절**: 기존 `POSE_MOUNT[mt]` 재사용하되 문구를 "in ALL three poses" → **"in EVERY cell (all poses across all three rank rows)"**로 일반화. `MOUNT_BY_NAME[캐릭터]`로 선택, 9칸 공용.
- **조립**(`buildPrompt` poseSheet 분기, asset-board.html:1439-1447): `body(3×3 사양) + 탈것구절 + 화풍 + 네거티브` 순서 유지.
- **lord/단일등급 병종 처리(명시)**: 엔진 클래스-tier가 단일등급인 병종(예: `lord`=유비)도 이 시트에선 **색/장식 3등급을 동일하게 가진다.** 유비=전차 9칸 = "같은 전차·군주, 금장식만 등급1→3 강화"이며 클래스 승급이 아니다. (코스메틱 등급은 클래스-tier와 무관하므로 단일등급 병종에도 그대로 적용.)

프롬프트 스케치:
```
A single SD pose sheet of {캐릭터}, one image with a 3-row × 3-column grid on a fully
transparent background. The SAME character in all 9 cells — identical face, weapon and identity.
ROWS = three cosmetic rank tiers of the SAME unit, differing ONLY in armor color and ornamentation
(NOT body, NOT pose, NOT mount, NOT unit type): row 1 = basic rank (plain field armor, muted colors);
row 2 = veteran rank (reinforced darker steel armor, added pauldrons and trim);
row 3 = elite rank (ornate gilded armor with gold filigree, richer saturated colors, a small rank emblem).
COLUMNS = three poses, every cell a ¾ SIDE view FACING SCREEN-LEFT (profile turned left, not facing camera):
(1) IDLE relaxed battle stance, (2) MOVE mid-stride advancing, (3) ATTACK dynamic weapon swing with a motion arc.
{탈것 구절: 9칸 전체에 적용}
Each cell a complete finished chibi (SD, ~2.5 heads), evenly spaced with clear transparent gaps, no overlap.
+ [화풍 블록] + [네거티브]
```

### 4.2 컷 & 파일 레이아웃 (하위호환 핵심)

- 워크플로 변경 없음: 보드에서 "📤 시트 넘기기"로 원본 시트를 디스크 저장 → **Claude가 PIL로 9칸 컷**.
- 컷 산출 경로:
  - **등급1 = 기존 경로 그대로** `assets/sprites/{id}/front_{idle,move,attack}.png`
    (= 게임이 현재 읽는 경로 = 코스메틱 등급1. 로더·manifest 무수정)
  - **등급2/3 = 하위 폴더** `assets/sprites/{id}/t2/front_{pose}.png`, `assets/sprites/{id}/t3/front_{pose}.png`
- **하위호환 전제(명시·load-bearing)**: 현 로더(`asset-board.html` `renderExisting` 1576-1588; 게임 텍스처 로더)는 `sprites/{id}/` **루트에서 `front_{idle,move,attack}` 고정 이름만** 조회하고 하위 폴더를 순회/glob하지 않는다. 따라서 `t2/`·`t3/`는 현 로더에 **불가시 → 무수정 동작.** ⚠ 이후 로더를 하위 디렉터리 열거 방식으로 바꾸면 이 보장은 깨진다(그때 등급1도 `t1/`로 옮기는 마이그레이션 필요).
- **back_* 는 이번 범위 밖(스코프 컷)**: front 9칸만 등급화. 기존 네임드 6종(guanyu·liubei·lvbu·zhangfei·zhangliao·huaxiong)은 `back_*`를 이미 보유 → front를 9칸으로 재생성하면 그 6종은 **front(코스메틱 3등급·신규) vs back(단일·구버전) 불일치**가 생긴다. 의도된 컷이며 back 등급화는 후속.

### 4.3 범위 & 롤아웃

- 구조는 **109명 전원** 적용. 생성은 우선순위 캐릭터부터 길중 페이스.
- **제네릭 병종**([제네릭] 보병/궁병/기병): "같은 형태+색/장식" 3등급. 전차·발석차 등 *다른 형태* 병종은 기존 B-2b/J-* 별도 템플릿 유지(§1 (A) 축).
- **기존 12 스프라이트 세트 재생성**(네임드 6: guanyu·liubei·lvbu·zhangfei·zhangliao·huaxiong + 제네릭 6: footman/archer/lightCavalry × player·enemy): 9칸 신규 프롬프트로 다시 생성 → 탈것(말/전차)까지 일괄 반영(어차피 탈것 빠진 옛 버전). 네임드의 `back_*`는 §4.2대로 이번 범위 밖.
- **엔진 소비는 후순위**: 지금은 등급1이 기존 위치라 게임 즉시 동작, t2/t3는 코스메틱 승급 메커니즘 구현 시 드롭인.

## 5. 검증 방법

- **프롬프트**: `buildPrompt`가 유비(전차)/관우(말)/보병 캐릭터에 대해 9칸 사양 + 올바른 탈것 구절을 산출하는지 추출·시뮬레이션 — 일회용 node 스크립트로 보드에서 `MOUNT_BY_NAME`·`POSE_MOUNT`를 regex 추출하고 poseSheet 룩업식(`POSE_MOUNT[MOUNT_BY_NAME[name]]`)을 복제해 샘플 캐릭터로 검사 + 인라인 JS 문법 무결성(`new Function`). (별도 커밋 헬퍼 아님 — 검증 후 폐기.)
- **컷**: 9칸 시트 1장 → 9파일(등급1 기존 경로 + t2/t3 하위폴더) 생성 확인, **등급1 경로 무변경**(게임 로더 호환) 자동 확인.
- **9칸 일관성 게이트(중요)**: 대량 생성 전 **첫 1~2장**의 9칸 시트를 시각 검수 → 인물 동일성·실루엣·탈것 일관성이 무너지면 **즉시 §7의 3행 분할 폴백**(등급당 1장씩 3장)으로 전환 후 본격 생성. 폴백 결정을 롤아웃 중 임기응변이 아니라 이 게이트로 고정.
- **시각 확인**: 생성 결과는 길중이 보드에서 붙여넣어 눈으로 검수(생성 AI 산출물이라 자동 픽셀 검증 비대상).

## 6. 영향 파일

- `docs/art/asset-board.html` — S-pose 프롬프트 템플릿(3×3) + `POSE_MOUNT` 문구 일반화 + `buildPrompt` poseSheet 분기.
- (컷 단계) Claude 컷 스크립트/프로세스 — 9칸 등급 레이아웃 산출(등급1 루트 + t2/t3 하위폴더).
- 후속(별도 스펙): 엔진 코스메틱 등급 스프라이트 선택(이때 등급1을 `t1/`로 옮겨 t1/t2/t3 경로를 대칭화하는 마이그레이션을 함께 — §4.2 ⚠ 참조), back_* 등급화.

## 7. 열린 항목 / 리스크

- **9칸 밀도**: 모델이 9칸 일관성을 못 잡으면 → **3행 분할 폴백**(등급당 1장씩 3장, 각 장은 현 3포즈 구조 재사용 + base 첨부로 등급 일관). 트리거는 §5 일관성 게이트.
- **tier3 정예 외형**이 네임드 고유 디자인과 충돌하지 않도록 "색/장식만, 인물·무기·탈것 불변" 제약 강조.
- **front/back 불일치**(§4.2): 네임드 6종은 back이 한 세대 뒤처짐 — 후속 back 등급화 전까지 감수.
