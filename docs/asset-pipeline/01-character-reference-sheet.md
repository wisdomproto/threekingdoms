# 01 캐릭터 레퍼런스 시트 생성 가이드

> 대상 독자: 이 프로젝트의 에셋 제작 담당자. AI 이미지 생성 초심자를 가정해 단계별로 설명한다.

---

## 1. 레퍼런스 시트의 역할

레퍼런스 시트는 **모든 파생 에셋의 원본**이다.

```
레퍼런스 시트 (1장)
├── 쿼터뷰 스프라이트 (4~6장)
├── Spine 리깅 파츠 소스
└── Seedance 일기토 영상 입력 이미지
```

- 게임에 직접 수록되지 않는다. 파이프라인의 입력 원료다.
- 한 번 확정된 시트가 이후 모든 파생물의 일관성 기준점이 된다.
- 시트가 바뀌면 파생 에셋 전체를 재생성해야 하므로, 첫 확정 전에 외형을 충분히 검토한다.

### 왜 시그니처 무기를 시트 단계부터 포함하는가

관우의 청룡언월도는 장비 아이템이 아니라 **캐릭터 정체성**이다. 시트 단계부터 포함해야:
- 무기 포함 실루엣이 쿼터뷰 축소 시에도 가독성을 유지하는지 검증할 수 있다.
- Spine 무기 슬롯의 파츠 형태를 시트에서 직접 추출할 수 있다.
- 일기토 영상 입력 이미지에 무기가 이미 반영되어 있다.

---

## 2. 산출물 정의

관우 레퍼런스 시트 1장은 다음 요소를 **하나의 이미지**에 담는다.

| 구성 요소 | 설명 |
|---|---|
| 전신 정면 | 중립 대기 포즈, 무기 장착 |
| 전신 측면 | 정면과 동일 의상·무기 |
| 전신 후면 | 등 디테일, 망토·갑주 확인용 |
| 표정 클로즈업 2종 | 기본(평온) + 전투 의지(눈매 강조) |
| 포즈 변형 1종 | 무기 든 공격 준비 포즈 |

총 이미지 1장에 5~6개 뷰가 배치된 **캐릭터 시트 레이아웃**으로 생성한다.

---

## 3. Gemini 프롬프트 템플릿

### 3-1. 템플릿 (변수 버전)

아래를 Gemini 이미지 생성에 **그대로 복사**하여 `{중괄호}` 부분만 교체한다.

```
A character reference sheet for a 2D tactical RPG set in ancient China.
Layout: one image with six panels arranged in a 3x2 grid —
  top row: front view (full body), side view (full body), back view (full body);
  bottom row: two facial close-ups (neutral expression, battle-ready expression) and one action pose holding the weapon.

Character description:
- Name context: {캐릭터 역할/관계 한 줄}
- Build: {체형 묘사}
- Hair: {머리카락 묘사}
- Facial features: {얼굴 묘사}
- Clothing: {의상 묘사}
- Weapon: {무기 이름과 형태 묘사}
- Color palette: {주요 색상 2~3가지}

Style requirements:
- Original artistic style; do NOT imitate any specific game or publisher's art style
- Hand-painted illustration, clean line art with bold outlines
- Flat plain white background in every panel — no gradients, no shadows cast on background
- Full body visible from head to toe in all three standing views
- Consistent character appearance across all six panels (same face, costume, and weapon)
- Neutral standing pose for the three-view panels; weapon held upright or at rest
- Action pose panel: dynamic stance gripping the weapon with both hands, slight forward lean

Output: single image, no text labels, no UI elements
```

**한국어 해설:**
- "3x2 grid" — 6칸 그리드에 뷰를 배치하도록 레이아웃을 명시한다. Gemini가 자동으로 캐릭터 시트 레이아웃을 잡는다.
- "plain white background" — 배경이 깔끔해야 Spine 파츠 분리와 영상 입력 시 배경 제거가 쉽다.
- "do NOT imitate any specific game or publisher's art style" — 법적 제약 준수. 코에이 등 특정 게임사 스타일 모방 금지.
- "Consistent character appearance across all six panels" — 일관성이 이 시트의 핵심 목적이다. 생략하면 각 패널의 얼굴/색이 달라진다.

---

### 3-2. 관우 완성 예시 프롬프트

아래는 바로 복사해서 실행할 수 있는 완성형이다.

```
A character reference sheet for a 2D tactical RPG set in ancient China.
Layout: one image with six panels arranged in a 3x2 grid —
  top row: front view (full body), side view (full body), back view (full body);
  bottom row: two facial close-ups (neutral expression, battle-ready expression) and one action pose holding the weapon.

Character description:
- Name context: a legendary general renowned for honor and martial prowess
- Build: tall and powerfully built, broad shoulders, commanding presence
- Hair: long black hair tied in a high topknot, with a flowing beard reaching the chest
- Facial features: long, narrow face; heavy brow; sharp, piercing eyes with a dignified expression; prominent cheekbones; a full, well-groomed beard that is a defining trait
- Clothing: dark green battle robe (战袍) layered over a black scale-armor breastplate; dark red trim and gold accents on the collar and cuffs; simple dark trousers; armored boots; a fur-trimmed dark sash at the waist
- Weapon: Green Dragon Crescent Blade (青龍偃月刀) — a large polearm with a wide crescent-shaped blade at the top and a red tassel beneath the blade; the shaft is dark lacquered wood, approximately two and a half times the character's height
- Color palette: deep forest green, dark charcoal, gold accents

Style requirements:
- Original artistic style; do NOT imitate any specific game or publisher's art style
- Hand-painted illustration, clean line art with bold outlines
- Flat plain white background in every panel — no gradients, no shadows cast on background
- Full body visible from head to toe in all three standing views
- Consistent character appearance across all six panels (same face, costume, and weapon)
- Neutral standing pose for the three-view panels; weapon held upright at the character's right side
- Action pose panel: dynamic stance, weapon raised diagonally for a sweeping strike, feet planted wide

Output: single image, no text labels, no UI elements
```

**외형 묘사 근거:** 삼국지연의 묘사(키 9척, 수염 2척, 긴 얼굴, 청룡언월도)를 기반으로 독자적 시각화. 코에이의 그래픽 디자인 묘사는 포함하지 않았다.

---

## 4. 일관성 워크플로

### 4-1. 1차 생성 → 선택

1. 위 완성 프롬프트를 Gemini에 입력, **3~5회 생성**한다.
2. 각 결과물을 `ref-draft-01.png`, `ref-draft-02.png` 등으로 저장한다.
3. 평가 항목:
   - 6개 패널 간 얼굴/색/무기 일관성
   - 수염 형태와 색 일관성
   - 무기(청룡언월도) 형태 — 초승달형 날 + 붉은 수술
   - 흰 배경 여부
   - 전신이 모두 잘리지 않고 보이는지
4. 가장 일관성 높은 1장을 **베스트 컷**으로 선택한다.

### 4-2. 베스트 컷 → 변형 생성 (레퍼런스 이미지 재투입)

Gemini의 이미지-to-이미지(Image Reference) 기능을 사용한다.

1. 베스트 컷을 **레퍼런스 이미지로 첨부**한다.
2. 프롬프트 앞에 다음 문장을 추가한다:
   ```
   Using the attached image as a strict style and character reference,
   generate [원하는 변형 내용].
   Keep the character's face, beard, costume colors, and weapon identical to the reference.
   ```
3. 이 방식으로 추가 표정, 다른 포즈, 승급 후 외형 변형 등을 생성한다.

### 4-3. 프롬프트 기록 필수

결과물 옆에 사용한 프롬프트 전문을 항상 기록한다. 재생성 가능성이 이 파이프라인의 핵심 원칙이다 (CLAUDE.md §2, §7 참조).

---

## 5. 보관 규칙

```
assets/characters/guanyu/
├── ref-sheet.png            ← 확정된 레퍼런스 시트
└── ref-sheet.prompt.md      ← 사용한 프롬프트 전문 + 생성 날짜 + Gemini 설정
```

두 파일 모두 git에 커밋한다. 이미지 파일은 LFS 없이도 커밋 가능한 크기(보통 1~3MB)이면 직접 커밋, 그 이상이면 Cloudflare R2에 업로드 후 URL을 `prompt.md`에 기록한다.

`ref-sheet.prompt.md` 포함 내용:
- 사용 프롬프트 전문
- 생성 일자
- Gemini 모델 버전 (예: Gemini 2.5 Flash Image)
- 사용한 파라미터 (온도, 시드 등 — 기록 가능한 경우)
- 베스트 컷 선택 이유 한 줄

---

## 6. 품질 체크리스트

시트를 확정하기 전에 아래 항목을 전부 확인한다. 미통과 항목이 있으면 재생성한다.

| # | 체크 항목 | 확인 방법 |
|---|---|---|
| 1 | 청룡언월도 형태(초승달 날, 붉은 수술, 긴 자루)가 3뷰 모두 일관하는가 | 3개 뷰를 나란히 놓고 비교 |
| 2 | 복식 색상(녹색 전포, 흑색 갑주, 금색 장식)이 6패널 모두 동일한가 | 스포이드 도구로 색 값 비교 |
| 3 | 얼굴(긴 수염, 눈매, 윤곽)이 6패널에서 동일인으로 인식되는가 | 클로즈업 2종과 전신 정면 비교 |
| 4 | 모든 패널 배경이 순수 흰색인가 (그라디언트·그림자 없음) | 배경 영역 색 값 확인 (R255, G255, B255) |
| 5 | 쿼터뷰 64×64px로 축소했을 때 실루엣이 가독 가능한가 | 이미지 편집기에서 실제 축소 테스트 |
| 6 | 전신 전체(발끝까지)가 모든 입식 뷰에서 잘리지 않는가 | 발 부분 확인 |

---

## 다음 단계

- 시트 확정 후 → `02-duel-video-test.md` (시트를 Seedance I2V 입력으로 사용)
- 시트 확정 후 → `03-spine-setup.md` (파츠 분리 및 리깅 시작)
