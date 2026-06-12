# 03 Spine 셋업 가이드

> 대상: Spine 라이선스 구매 전 검토 단계. 이 문서를 읽고 라이선스를 구매한 뒤, 관우 1체 데모를 완성한다.
> 선결 조건: `01-character-reference-sheet.md`의 관우 시트 확정 완료.

---

## 1. Spine 라이선스

### 1-1. 에디터 가격표 (2026년 6월 기준, esotericsoftware.com에서 확인)

| 에디션 | 정가 | 할인가 | 비고 |
|---|---|---|---|
| **Essential** | — | **$69** | 기본 기능, 메시·IK·물리 제외 |
| **Professional** | — | **$379** | 전체 기능 포함 |
| Enterprise | $2,499 기본 + $379/유저 | — | 연 매출 $500,000 이상 필수 |
| Education | $850~$2,900 | — | 컴퓨터 대수에 따라 상이 |

> **공식 사이트에서 재확인 필요**: 위 가격은 esotericsoftware.com/spine-purchase 페이지 기준이며 변동될 수 있다. 구매 전 직접 확인한다.

Essential은 할인 없이 $69 수준의 영구 라이선스이며, Professional로 업그레이드 시 **차액만 지불**한다.

### 1-2. 런타임 사용 조건

- Spine 에디터 라이선스 보유자만 Spine 런타임을 자신의 게임·애플리케이션에 사용할 수 있다.
- 라이선스가 만료되어도 **이미 통합한 제품은 계속 배포 가능**하다.
- 단, 라이선스 없이 런타임을 새 제품에 통합하는 것은 금지된다.
- 런타임 자체의 코드 사용료는 없다 (오픈소스 아파치 2.0, 단 에디터 라이선스 조건 첨부).

### 1-3. Essential vs Professional — 이 프로젝트 기준 비교

| 기능 | Essential | Professional | 필요 여부 |
|---|---|---|---|
| 기본 본 애니메이션 | O | O | **필수** |
| 슬롯·어태치먼트 교체 (무기 스킨) | O | O | **필수** — BM의 핵심 |
| 메시 변형 (Mesh Deformation) | X | O | 권장 — 옷자락·수염 자연스러운 변형 |
| IK 제약 (Inverse Kinematics) | X | O | 권장 — 팔/손 자연스러운 리깅 |
| 물리 제약 (Physics) | X | O | 선택 — 수술·망토 흔들림 |
| 클리핑 (마스크) | X | O | 선택 |
| 경로 제약 (Path Constraint) | X | O | 선택 — 사용 빈도 낮음 |
| Professional로 만든 프로젝트 열기 | X | O | — |

**권고사항:**
- **데모 단계**: Essential($69)로 시작. 파츠 분리·슬롯 교체·2모션은 Essential로 충분히 구현 가능하다.
- **본격 제작 전**: Professional($379)로 업그레이드. 메시와 IK 없이는 수염·옷자락 리깅 품질에 한계가 있다. 차액($379 - $69 = $310) 지불로 업그레이드.
- **Enterprise는 불필요**: 연 매출 $500,000 이하 프로젝트에 해당 없음.

---

## 2. 웹 런타임: spine-ts (PixiJS 런타임)

이 프로젝트는 PixiJS/Canvas 기반 웹 게임이므로 **spine-pixi** 런타임을 사용한다.

- 공식 저장소: [https://github.com/EsotericSoftware/spine-runtimes](https://github.com/EsotericSoftware/spine-runtimes)
- 패키지명: `@esotericsoftware/spine-pixi-v8` (PixiJS v8 기준)
- 설치: `pnpm add @esotericsoftware/spine-pixi-v8`

**런타임 라이선스 조건 요약:**
- 런타임 코드는 Spine Editor License Agreement에 따라 배포된다.
- **에디터 라이선스 보유자**에 한해 상업적 사용 허용.
- 소스 코드는 GitHub에 공개되어 있으나 에디터 라이선스 없이 상업 제품에 통합 불가.
- 런타임 자체에 별도 로열티나 런타임 사용료는 없다.

> 참고: Spine 버전과 런타임 버전은 **반드시 일치**해야 한다. 에디터를 구매할 때 버전을 확인하고, 동일 버전의 런타임 패키지를 사용한다.

---

## 3. 병종 골격 규격화 방침

> ⚠️ **법적 제약**: Spine 파츠·스킨 제작에 쓰는 모든 이미지는 코에이(KOEI) 게임 그래픽 스타일 모방 금지 (CLAUDE.md §1 법적 라인). 파츠 소스 이미지를 생성할 때도 01 가이드와 동일하게 프롬프트에 "do NOT imitate any specific game or publisher's art style"을 포함한다.

CLAUDE.md §4의 원칙: **같은 병종은 같은 골격을 공유하고, 무기는 슬롯 교체로 처리한다.**

### 3-1. 명명 규칙

#### 골격 파일명
```
skel_<병종>_<tier>
예:
  skel_cavalry_base      ← 기병계 기본 골격 (관우, 조운, 장비 공유)
  skel_infantry_base     ← 보병계 기본 골격
  skel_archer_base       ← 궁병계 기본 골격
  skel_strategist_base   ← 책사계 기본 골격
  skel_cavalry_hero      ← 풀제작(★) 장수 전용 골격 (표준 골격과 구조 동일, 추가 뼈대 포함)
```

#### 슬롯 명명 규칙
```
slot_<카테고리>_<세부>
예:
  slot_weapon_main       ← 주 무기 (교체 가능)
  slot_weapon_sub        ← 부 무기/방패 (교체 가능)
  slot_face              ← 얼굴 (캐릭터별 교체)
  slot_hair              ← 머리카락
  slot_armor_upper       ← 상의 갑주
  slot_armor_lower       ← 하의 갑주
  slot_accessory_01      ← 장식류 (수술, 망토 등)
```

#### 뼈대(Bone) 명명 규칙
```
bone_<신체부위>_<L|R|없음>
예:
  bone_root
  bone_spine_01 / bone_spine_02
  bone_neck / bone_head
  bone_upperarm_L / bone_upperarm_R
  bone_forearm_L / bone_forearm_R
  bone_hand_L / bone_hand_R
  bone_weapon_main       ← 무기 부착점
  bone_thigh_L / bone_thigh_R
  bone_shin_L / bone_shin_R
  bone_foot_L / bone_foot_R
```

#### 애니메이션 명명 규칙
```
anim_<동작>
예:
  anim_idle              ← 대기 (루프)
  anim_walk              ← 이동 (루프)
  anim_attack_01         ← 기본 공격
  anim_duel_strike       ← 일기토 공격 모션
  anim_duel_hit          ← 일기토 피격 모션
  anim_death             ← 퇴각/사망
  anim_skill_01          ← 책략 1
```

#### 스킨 명명 규칙
```
skin_<캐릭터>_<종류>
예:
  skin_guanyu_default    ← 기본 스킨
  skin_guanyu_weapon_alt ← 무기 대체 스킨 (BM 가챠 대상)
  skin_guanyu_costume_01 ← 코스튬 스킨
```

### 3-2. 골격 공유 원칙

```
skel_cavalry_base
├── 관우 (bone 전체 공유, slot_face/hair/armor/weapon 교체)
├── 조운 (동일)
└── 장비 (동일)
```

- 骨格이 동일하므로 `anim_idle`, `anim_walk` 등 **공통 애니메이션을 공유**한다.
- 캐릭터별 차이는 슬롯에 장착하는 어태치먼트(이미지) 교체로만 처리한다.
- 무기 파츠(`slot_weapon_main`)는 Spine의 스킨 기능으로 런타임 교체 — 이것이 무기 스킨 BM의 기술적 근거다.

---

## 4. 첫 데모 범위: 관우 1체

### 4-1. 파츠 분리 (Photoshop/Krita 작업)

레퍼런스 시트의 정면 뷰에서 파츠를 분리한다.

```
guanyu_parts/
├── body_torso.png       ← 몸통 (갑주 포함)
├── body_hips.png        ← 하체
├── arm_upper_L.png
├── arm_upper_R.png
├── arm_forearm_L.png
├── arm_forearm_R.png
├── arm_hand_L.png
├── arm_hand_R.png
├── leg_thigh_L.png
├── leg_thigh_R.png
├── leg_shin_L.png
├── leg_shin_R.png
├── leg_foot_L.png
├── leg_foot_R.png
├── head_base.png        ← 머리 (수염 포함)
├── hair.png
├── weapon_guandao.png   ← 청룡언월도 (기본 스킨)
└── weapon_guandao_alt.png  ← 대체 스킨 테스트용
```

파츠 분리 시 주의:
- 관절 부위는 **약간 겹치게** 분리한다 (회전 시 틈 방지).
- 수염은 별도 레이어로 분리 — Professional에서 메시 변형 적용 예정.
- 배경은 반드시 투명(알파 채널).

### 4-2. 구현 목표 (데모 체크리스트)

| # | 항목 | 확인 |
|---|---|---|
| 1 | Spine에서 `skel_cavalry_base` 골격 생성, 관우 파츠 임포트 | |
| 2 | 모든 파츠를 위 명명 규칙에 따라 슬롯·뼈대에 연결 | |
| 3 | `anim_idle` — 약 60프레임, 호흡 느낌의 미세 움직임 | |
| 4 | `anim_attack_01` — 청룡언월도 횡베기 (약 30프레임) | |
| 5 | `skin_guanyu_default` 스킨 정의 | |
| 6 | `skin_guanyu_weapon_alt` 스킨 정의 — 대체 무기 이미지 교체 시연 | |
| 7 | Spine 에디터에서 두 스킨 간 **런타임 교체** 동작 확인 | |
| 8 | `.skel` + `.atlas` + `.png` 익스포트 | |
| 9 | `apps/web`에서 spine-pixi 런타임으로 렌더링 확인 | |

### 4-3. 애니메이션 작업 방침

CLAUDE.md §4의 원칙: **수작업 프레임 애니메이션 없음. 포즈 전환 + 트윈/이펙트로 연출.**

- `anim_idle`: 뼈대 키프레임 최소화. root 뼈대 위아래 0.5px 왕복 + 무기 뼈대 1~2° 미세 흔들림.
- `anim_attack_01`: 준비 포즈(10f) → 임팩트(5f) → 리커버리(15f). Spine 트윈으로 처리.
- 이펙트(칼바람, 타격 스파크)는 Spine 내부 파티클이 아닌 코드 레이어(PixiJS)에서 처리한다.

---

## 5. 익스포트 설정

Spine에서 게임 런타임용 익스포트 시:

```
Export Type: Binary (.skel)  ← JSON보다 파일 크기 작고 로딩 빠름
Atlas Settings:
  - Max width: 2048
  - Max height: 2048
  - Pack: Tight
  - Premultiplied alpha: ON
Output Directory: assets/characters/guanyu/spine/
```

익스포트 후 결과물:
```
assets/characters/guanyu/spine/
├── guanyu.skel
├── guanyu.atlas
└── guanyu.png   (또는 여러 장의 atlas 텍스처)
```

---

## 6. 웹 통합 코드 스니펫 (참고용)

`apps/web` 연동 시 기본 구조. 실제 구현은 Task 12 이후에 진행한다.

```typescript
import { SpineDebugRenderer, SpineTexture } from '@esotericsoftware/spine-pixi-v8';

// Spine 에셋 로드
app.loader.add('guanyu', 'assets/characters/guanyu/spine/guanyu.skel');

// 인스턴스 생성 및 스킨 교체
const guanyu = SpineLoader.from('guanyu');
guanyu.skeleton.setSkinByName('skin_guanyu_weapon_alt');  // 무기 스킨 교체
guanyu.state.setAnimation(0, 'anim_idle', true);          // 대기 애니메이션 루프
```

> 정확한 API는 사용하는 spine-pixi 버전의 공식 문서를 따른다.

---

## 7. 다음 단계

1. **즉시**: esotericsoftware.com에서 Spine Essential($69) 구매
2. **데모 완성 후**: Professional 업그레이드 여부 결정 (수염·옷자락 메시 품질 보고 판단)
3. **데모 완성 후**: `02-duel-video-test.md` 결과와 종합해 하이브리드 비율 확정
4. **Task 12 이후**: `apps/web`에 spine-pixi 런타임 통합, 실제 렌더링 확인
