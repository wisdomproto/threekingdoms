# 02 일기토 영상 테스트 가이드 (Seedance I2V)

> 이 가이드의 목표: 관우 레퍼런스 시트 → Seedance I2V → 일기토 클립 생성 테스트.
> 결과를 평가해 **Spine 합 연출 vs 영상 컷신 하이브리드 비율**을 결정한다.
> 선결 조건: `01-character-reference-sheet.md`의 관우 시트 확정 완료.

---

## 1. 테스트 목적

CLAUDE.md §9에서 일기토 연출을 두 종류로 나눈다.

| 종류 | 연출 방식 | 조건 |
|---|---|---|
| 일반 일기토 | Spine 자동 합 연출 (3~5회 교환) | 네임드 vs 네임드 확률 발동 |
| 스토리 일기토 | Seedance 영상 컷신 (고정 스크립트) | 발동 조건·결과 고정, 10~12개 |

영상 컷신은 비용과 생산 시간이 크므로, **실제 결과물의 품질이 투자를 정당화하는지** 이 테스트에서 확인한다. 특히:
- 캐릭터 동일성 (시트 대비)
- 무기 형태 유지
- 1~2초 컷인 추출 가능 구간 존재 여부

---

## 2. 입력 에셋 준비

### 2-1. 관우 시트 (주역)
`assets/characters/guanyu/ref-sheet.png` — `01-character-reference-sheet.md` 완료 후 생성된 확정 시트.

I2V 입력용 **단일 포즈 크롭** 이미지를 추가로 준비한다.
- 전신 정면 뷰만 크롭 → `assets/characters/guanyu/ref-front.png`
- 전신 측면 뷰만 크롭 → `assets/characters/guanyu/ref-side.png`
- 공격 포즈만 크롭 → `assets/characters/guanyu/ref-attack.png`

### 2-2. 화웅 임시 시트 (상대역)
스토리 일기토 `관우 vs 화웅` 테스트에 필요한 상대 캐릭터.
상세 묘사보다 **대비 실루엣**이 중요하다. 아래 프롬프트로 빠르게 생성한다.

```
A full-body character portrait of an ancient Chinese general,
for use as a reference in a 2D tactical RPG.
Build: heavily armored, stocky and broad, slightly shorter than a typical warrior general.
Clothing: dark red and black heavy plate armor with shoulder guards and a crested helmet.
Weapon: a large straight dao (broadsword) held in both hands at the ready.
Style: hand-painted illustration, bold outlines, plain white background, full body visible.
Original artistic style; do NOT imitate any specific game or publisher's art style.
```

저장: `assets/characters/huaxiong/ref-temp.png`

---

## 3. 테스트 매트릭스

4~6클립을 생성한다. 아래 표에서 체크된 조합을 우선 실행한다.

| 클립 ID | 입력 이미지 | 클립 길이 | 액션 | 카메라 | 우선순위 |
|---|---|---|---|---|---|
| T-01 | ref-front.png (관우) | 2초 | 말 위에서 언월도 횡베기, 단독 | 측면 고정 | ★ 필수 |
| T-02 | ref-attack.png (관우) | 4초 | 언월도 돌진 → 크로스 교차 (화웅 포함) | 측면 고정 | ★ 필수 |
| T-03 | ref-side.png (관우) | 2초 | 언월도 종베기 내려치기, 단독 | 측면 고정 | ★ 필수 |
| T-04 | ref-front.png (관우) | 4초 | 언월도 횡베기 → 회전 공격 | 추적(트래킹) | 권장 |
| T-05 | ref-temp.png (화웅) | 2초 | 대도 방어 → 밀려남 | 측면 고정 | 권장 |
| T-06 | ref-front.png (관우) | 2초 | 언월도 들어올리는 시작 모션만 | 측면 클로즈업 | 컷인 테스트용 |

> **T-06은 결정타 컷인 테스트**: 1~2초 영상 컷인이 실현 가능한지 가장 빠르게 확인하는 클립이다.
> 동일성·무기 유지 점수가 낮아도 이 클립만은 별도로 평가한다.

---

## 4. Seedance I2V 모션 프롬프트 템플릿

### 공통 접두어 (모든 클립에 붙인다)

```
Animate the character in the reference image as a single continuous motion clip.
Maintain character appearance strictly identical to the reference image:
same face, same beard, same costume colors, same weapon shape.
Style: dramatic 2D illustration animation, cinematic lighting, no camera shake unless specified.
Background: simple stylized fog or abstract battlefield — no complex environments.
```

**한국어 해설:** "Maintain character appearance strictly identical" 문구가 없으면 I2V 모델이 자체적으로 외형을 변형한다. 이 문구가 동일성 점수에 직접 영향을 미친다.

---

### T-01: 횡베기 단독 2초

```
Animate the character in the reference image as a single continuous motion clip.
Maintain character appearance strictly identical to the reference image:
same face, same beard, same costume colors, same weapon shape.
Style: dramatic 2D illustration animation, cinematic lighting, no camera shake unless specified.
Background: simple stylized fog or abstract battlefield — no complex environments.

Motion: The character is mounted on a horse. The horse rears slightly then charges forward.
The character raises the Green Dragon Crescent Blade with both hands and executes
a powerful horizontal sweeping slash from right to left.
The blade leaves a motion trail.
Camera: fixed side-view, full body visible throughout.
Duration: 2 seconds.
```

---

### T-02: 돌진 교차 4초 (화웅 포함)

```
Animate the character in the reference image as a single continuous motion clip.
Maintain character appearance strictly identical to the reference image:
same face, same beard, same costume colors, same weapon shape.
Style: dramatic 2D illustration animation, cinematic lighting, no camera shake unless specified.
Background: simple stylized fog or abstract battlefield — no complex environments.

Motion: Two warriors charge toward each other from opposite sides of the frame.
The left warrior (the reference character) grips the Green Dragon Crescent Blade.
They meet at the center — weapons clash with a flash of light — then both slide past each other.
The animation ends just after the crossing moment, both warriors having passed.
Camera: fixed side-view, both characters fully visible.
Duration: 4 seconds.
```

---

### T-03: 종베기 단독 2초

```
Animate the character in the reference image as a single continuous motion clip.
Maintain character appearance strictly identical to the reference image:
same face, same beard, same costume colors, same weapon shape.
Style: dramatic 2D illustration animation, cinematic lighting, no camera shake unless specified.
Background: simple stylized fog or abstract battlefield — no complex environments.

Motion: The character stands, lifts the Green Dragon Crescent Blade high above the head
with both hands, then brings it down in a powerful vertical overhead strike.
The blade stops at waist level; a shockwave ripples outward at the point of impact.
Camera: fixed side-view, full body visible throughout.
Duration: 2 seconds.
```

---

### T-04: 횡베기 → 회전 추적 카메라 4초

```
Animate the character in the reference image as a single continuous motion clip.
Maintain character appearance strictly identical to the reference image:
same face, same beard, same costume colors, same weapon shape.
Style: dramatic 2D illustration animation, cinematic lighting, no camera shake unless specified.
Background: simple stylized fog or abstract battlefield — no complex environments.

Motion: The character runs forward, performs a wide horizontal slash,
then spins 360 degrees with the blade extended for a follow-up spinning strike.
Camera: tracking shot that slowly circles from side view to three-quarter view during the spin.
Duration: 4 seconds.
```

---

### T-05: 화웅 방어 2초

입력 이미지: `ref-temp.png` (화웅)

```
Animate the character in the reference image as a single continuous motion clip.
Maintain character appearance strictly identical to the reference image.
Style: dramatic 2D illustration animation, cinematic lighting.
Background: simple stylized fog.

Motion: The character raises the sword to block an incoming blow from the upper left.
The impact hits — sparks fly — the character is pushed backward two steps, stumbling.
Camera: fixed side-view, full body visible.
Duration: 2 seconds.
```

---

### T-06: 결정타 컷인 (2초, 클로즈업)

```
Animate the character in the reference image as a single continuous motion clip.
Maintain character appearance strictly identical to the reference image:
same face, same beard, same costume colors, same weapon shape.
Style: dramatic 2D illustration animation, high contrast lighting, impact frame effect.
Background: dark abstract — motion lines radiating outward.

Motion: Extreme close-up on the upper body and weapon only.
The character slowly raises the Green Dragon Crescent Blade to shoulder height,
then suddenly snaps it forward in a thrusting motion toward the camera.
The final frame is a freeze-frame with the blade tip pointing directly at the viewer.
Camera: slow push-in close-up, slight low angle.
Duration: 2 seconds.
```

---

## 5. 평가 기준표

각 클립을 생성한 후 아래 기준으로 채점한다. **5점 척도.**

| 평가 항목 | 1점 | 3점 | 5점 |
|---|---|---|---|
| **캐릭터 동일성** | 얼굴·수염·색이 시트와 완전히 달라 별개 인물처럼 보임 | 전체적 인상은 유사하나 얼굴·색 일부 변형 | 시트와 거의 동일, 즉시 동일인 인식 |
| **무기 형태 유지** | 초승달 날이 사라지거나 완전히 다른 형태 | 형태는 인식 가능하나 날 형태·수술 왜곡 | 초승달 날·붉은 수술·자루 비율 유지 |
| **모션 자연스러움** | 신체 부위 분리·관통·비자연적 변형 | 일부 어색함이 있으나 전체 흐름 이해 가능 | 자연스러운 연속 동작, 관절 처리 양호 |
| **1~2초 컷인 추출 가능 구간** | 클린하게 추출할 수 있는 임팩트 프레임 없음 | 1구간 존재하나 품질이 보통 | 임팩트 프레임이 명확, 즉시 추출 가능 |

### 채점 시트 템플릿

```
클립 ID: ______
생성 일자: ______
입력 이미지: ______

점수:
- 캐릭터 동일성:      /5
- 무기 형태 유지:     /5
- 모션 자연스러움:    /5
- 컷인 추출 가능:     /5
합계: ___/20

메모:
```

---

## 6. 판정 규칙

테스트 클립 전체(T-06 제외)의 **캐릭터 동일성**과 **무기 형태 유지** 두 항목의 평균을 계산한다.

```
(전 클립 동일성 합계 + 전 클립 무기유지 합계) / (클립 수 × 2) = 핵심 평균
```

| 핵심 평균 | 판정 결과 |
|---|---|
| **3.0 이상** | 영상 사용 확대 검토. 스토리 일기토 전 클립 영상. 일반 일기토도 부분 영상 도입 검토 가능 |
| **2.0 이상 ~ 3.0 미만** | **스토리 일기토(10~12개)만 영상**, 일반 일기토는 Spine 단독 확정 |
| **2.0 미만** | 영상은 이벤트성 연출(비전투 컷신)에만 한정. 일기토 전체 Spine 단독 확정 |

T-06 (컷인 클립) 별도 판정:
- 컷인 추출 항목 3점 이상 → 결정타 순간 영상 컷인 기능 프로토타입 진행
- 3점 미만 → 결정타 연출은 Spine 이펙트로 대체

---

## 7. 보관 규칙

```
assets/duel-tests/
├── T-01_guanyu-slash-2s.mp4
├── T-01_guanyu-slash-2s.prompt.md      ← 사용한 프롬프트 전문
├── T-02_clash-4s.mp4
├── T-02_clash-4s.prompt.md
├── ...
└── evaluation-sheet.md                  ← 채점 결과 + 최종 판정
```

모든 클립과 프롬프트를 git에 커밋하거나, 대용량이면 Cloudflare R2에 업로드 후 URL을 `evaluation-sheet.md`에 기록한다.

`evaluation-sheet.md`에 포함할 내용:
- 각 클립 채점 결과 (위 채점 시트 템플릿)
- 핵심 평균 계산 결과
- 최종 판정 (위 판정 규칙 적용)
- 하이브리드 비율 결정 내용 (예: "스토리 일기토 영상, 일반 일기토 Spine 단독")

---

## 다음 단계

- 판정 결과와 관계없이 Spine 설정은 병행 진행 → `03-spine-setup.md`
- 영상 클립 확정 후 → `assets/characters/guanyu/`에 스토리 일기토용 최종 클립 저장
