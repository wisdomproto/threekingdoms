# 에셋 생성 프롬프트 팩 v1 — 첫 마일스톤 (사수관·호로관 수직 슬라이스)

> 대상: 길중 (Gemini 2.5 Flash Image / nano banana 등으로 생성 → 결과물 회신)
> 범위: CLAUDE.md §16 첫 마일스톤 — ① 관우 기술 검증 세트 ② 사수관/호로관 1스테이지 분량 ③ 최소 이펙트/UI
> 근거 데이터: docs/reference/yeonggeoljeon-data.md (등장 병종·지형·맵 구조는 원작 추출 데이터 기준)
> 작성: 2026-06-12

---

## 0. 사용법

1. **모든 프롬프트 = [STYLE 블록] + [COMMON 블록] + [개별 프롬프트]** 순서로 이어붙여 한 번에 입력.
2. 스타일은 아래 3종 중 하나를 끼움. **같은 개별 프롬프트 × 스타일 3종 = 비교 변형 3컷** — 화풍 픽이 끝나면 이후 모든 에셋은 픽된 스타일 블록으로 고정.
3. 캐릭터는 반드시 **레퍼런스 시트부터** 생성 → 통과된 시트 이미지를 다음 생성의 참조 이미지로 첨부 (nano banana 멀티 이미지 입력으로 일관성 유지).
4. 파일명 규칙: `{대상}_{용도}_{스타일}_{변형번호}.png` (예: `guanyu_refsheet_inkA_01.png`)
5. 결과물은 원본 해상도 그대로 보존 (다운스케일은 파이프라인에서).

### STYLE 블록 3종 (변형 생산용)

**[STYLE-A: 수묵 담채 + 선묘]**
```
Art style: East Asian ink-wash painting fused with modern game illustration. Confident calligraphic linework, muted earth tones with selective vivid accent colors (vermilion, jade green, gold), textured rice-paper feel in shading, dramatic negative space. Clean silhouette readability for game use. NOT photorealistic, NOT anime-cel.
```

**[STYLE-B: 모던 셀셰이딩 SRPG]**
```
Art style: modern tactical-RPG cel shading. Bold clean outlines, two-step cel shadows, saturated but controlled palette, slightly stylized proportions (7-head heroic), crisp metallic highlights on armor. Reads clearly at small sizes. Contemporary mobile-game polish, NOT retro pixel art, NOT watercolor.
```

**[STYLE-C: 세미리얼 동양 판타지]**
```
Art style: semi-realistic East Asian historical fantasy illustration. Painterly rendering, realistic armor and fabric materials, cinematic rim lighting, grounded color grading with warm highlights. Detailed but with strong shape language for game readability. NOT photograph, NOT anime.
```

### COMMON 블록 (전 프롬프트 공통)
```
Setting: Three Kingdoms era China (Han dynasty, ~190 AD), historically grounded armor and clothing with fantasy flair. Original character design — must NOT resemble any existing game's artwork (especially Koei Tecmo's style or illustrations). No text, no watermark, no logo, no UI elements in the image.
```

### 네거티브/금지 (모델이 지원하면 추가)
```
Avoid: Koei-style portraits, Dynasty Warriors look, Japanese sengoku armor, photobash, text, watermark, frame, border, modern objects.
```

---

## 1. 우선순위 A — 관우 기술 검증 세트 (Spine 리깅 + 무기 교체 + 일기토 영상의 원료)

### A-1. 관우 레퍼런스 시트 (캐릭터 파이프라인의 시작점) ⭐최우선
```
Character reference sheet of GUAN YU, the God of War archetype: a towering, dignified warrior in his 30s-40s, very long flowing black beard (his signature), phoenix eyes, stern loyal expression. Deep green war robe over lamellar armor with gold trim, green official's hat or topknot. 
Sheet layout on plain white background: full-body front view, side view, and back view standing in neutral A-pose, same scale, aligned. Add two head close-ups with different expressions (calm dignity / battle fury).
He holds his signature weapon: the Green Dragon Crescent Blade (guandao — long pole arm with a heavy curved single-edged blade, dragon motif at the socket).
Flat even lighting, no dramatic shadows, character design sheet for game production.
```
- 체크포인트: 3뷰 비율 일치 / 무기가 신체와 분리 식별 가능 / 실루엣만 봐도 관우
- 변형: 스타일 3종 × 2~3회 생성 → 베스트 픽

### A-2. 관우 무기 파츠 단독 (무기 스킨 교체 검증용)
```
Game weapon asset: the Green Dragon Crescent Blade (Chinese guandao pole arm) alone on plain white background. Full weapon visible, vertical orientation, slight 3/4 angle. Heavy curved blade with engraved dragon motif, red tassel at the blade socket, dark wooden shaft with metal fittings. Flat even lighting, no hand, no character, game item design sheet quality.
```
- 같은 프롬프트로 **스킨 변형 2종** 추가 생성: ① `...blade made of dark meteorite iron with gold inlay...` ② `...ornate jade-and-silver ceremonial version...` → Spine 파츠 교체 데모용 3종 세트

### A-3. 관우 쿼터뷰 전투 스프라이트 (시트 참조 첨부 필수)
```
[A-1 베스트 시트를 참조 이미지로 첨부]
Same character as the reference sheet. Isometric 3/4 top-down view (quarter view, camera elevated ~40 degrees) for a tactics RPG battle map. Single full-body unit sprite on plain white background, facing front-left diagonal. Pose: {POSE}. Keep exact same costume, colors and weapon as the reference sheet. Clean silhouette, slightly bold outline, readable at small size.
```
- {POSE} 3회: ① `idle combat stance, weapon held ready` ② `mid-stride charging run` ③ `wide horizontal slash, weapon trailing motion arc`
- 등비스듬(back-left diagonal) 1세트 추가 = 총 6장. 좌우는 코드 미러링이니 한 방향만.

### A-4. 일기토 키프레임 (Seedance I2V 소스, 관우 vs 화웅)
```
[A-1 시트 첨부]
Cinematic duel keyframe: GUAN YU (same as reference) on horseback mid-gallop, Green Dragon Crescent Blade raised for a decisive strike, cape and beard streaming. Low camera angle, dust and dawn mist, besieged gate fortress blurred in background. Dramatic backlight. Single decisive moment, full body in frame, dynamic diagonal composition. 16:9.
```
- 변형: ② 적장(화웅) 시점 리액션 컷 — `enemy general recoiling on rearing horse, broken spear` ③ 격돌 순간 와이드 — 영상 테스트는 이 3키프레임으로 충분

---

## 2. 우선순위 B — 사수관·호로관 수직 슬라이스

원작 데이터 근거: 사수관 적장 = 화웅(경기병)·이숙(궁병)·호진(단병), 호로관 = 여포(경기병)·장료(단병)·후성·송헌·위속 + 궁병. 아군 = 유비(단병)·관우·장비(경기병). → 필요한 외형: 네임드 5명 + 병종 템플릿 3종(단병/궁병/경기병).

### B-1. 네임드 레퍼런스 시트 4종 (A-1과 동일 포맷, 인물 묘사만 교체)

**유비**
```
...sheet layout 동일... Character: LIU BEI, benevolent warlord in his 30s, gentle but resolute face, long ears (classical iconography), modest dark-red and white robe over light leather armor reflecting his humble origins, straw-sandal era hero rising. Weapons: twin straight swords (one in each hand, elegant simple design).
```
**장비**
```
Character: ZHANG FEI, wild tiger of a man, massive build, fierce round eyes, bristling black beard like wire, dark skin, leopard-pattern accents on rough heavy armor, open roaring expression. Weapon: serpent spear (long spear with wavy snake-like blade).
```
**여포** (적측 ★급 — 최강 비주얼 투자)
```
Character: LU BU, the unrivaled warrior — tall, imposing, beautiful and terrifying at once, arrogant eyes. Magnificent armor with golden pheasant-tail plumes on his headpiece, crimson and black with gold, fur-trimmed cloak. Weapon: sky-piercer halberd (ji — crescent axe blade + spear point). Aura of an untouchable apex predator.
```
**화웅** (1장 중간보스 — 병종 템플릿+α 급)
```
Character: HUA XIONG, Dong Zhuo's vanguard champion. Brutal veteran with scarred face, heavy dark iron armor with bronze accents, war braids, intimidating bulk. Weapon: heavy dao saber. Menacing but clearly a stepping-stone villain (less ornate than a lord).
```

### B-2. 병종 템플릿 유닛 3종 (쿼터뷰, 얼굴 가림 디자인 = 색/머리 교체로 양산)
```
Isometric quarter-view game unit sprite, plain white background, facing front-left diagonal, idle pose. Generic soldier whose face is partially hidden by helmet (for palette-swap mass production). {CLASS}. Period-accurate Han dynasty military equipment, cohesive squad-uniform look. Clean silhouette, readable at small size. {FACTION_COLOR}
```
- {CLASS} 3종:
  - 단병: `Short-spear infantryman: one-hand spear + large rectangular tower shield, lamellar cuirass, conical helmet`
  - 궁병: `Archer: recurve composite bow drawn quiver at hip, lighter leather armor, wide-brim helmet`
  - 경기병: `Light cavalryman on a sturdy Mongolian-type horse, lance and small round shield, minimal horse armor`
- {FACTION_COLOR} 2벌: 아군 `Faction color: green-and-white accents` / 동탁군 `Faction color: black-and-crimson accents`
- 각 클래스 × 진영색 2 × 포즈(대기/공격) 2 = 12장이 슬라이스 최소치. 이동 포즈는 후순위.

### B-3. 사수관 맵 타일셋 (추출 맵 구조 기준: 관문+산악+길+평지)

타일 개별 생성은 모델이 아이소 그리드를 정확히 못 맞추는 경우가 많아 **2단계**로:

**① 무드보드/마스터 컷 (엔진 아트 기준 잡기)**
```
Isometric tactics-RPG battle map illustration, elevated 3/4 view: a fortified mountain pass in northern China at dawn. A massive gate fortress with twin watchtowers on the left, a winding dirt road crossing grassy plains toward it, rocky mountain ridges along the top, sparse pine trees, a small stream with a wooden bridge. Hand-crafted game-map look with clear walkable grid feel, NO actual grid lines, no units, no UI. 16:9.
```
**② 타일/오브젝트 시트 (코드 조립용 파츠)**
```
Isometric game tile set sheet on plain white background, consistent 2:1 isometric diamond angle, same scale, arranged in a grid: (1) grass plain tile, (2) dirt road tile straight, (3) road curve, (4) rocky mountain block, (5) pine tree, (6) shallow stream tile, (7) wooden bridge, (8) stone wall segment, (9) fortified gate (2-tile wide centerpiece with twin towers), (10) army camp tent, (11) supply depot, (12) treasure storehouse. Each element separated, clean edges for cutting into sprites.
```
- ②는 8~12조각이 한 장에 나오게 2~3회 반복 생성해서 좋은 조각만 채택 (조각별 재생성 OK)
- 호로관은 동일 타일셋 재사용 + `night/dusk torchlit variant` 마스터 컷 1장만 추가

### B-4. 전투 배경 (맵 뒤에 깔리는 원경, 패럴랙스 1~2겹)
```
Wide panoramic background art for the top edge of an isometric battle map: distant hazy mountains and pale dawn sky over the Central Plains of China, very low detail at bottom (fades to neutral), atmospheric perspective, no foreground objects. 21:9, muted tones that won't compete with battle units.
```

---

## 3. 우선순위 C — 이펙트 파츠 (코드 합성용)

원칙(CLAUDE.md §4): 프레임 애니메이션 없음 — **단일 요소 + 코드 트윈/파티클 합성**. 따라서 전부 "검은 배경 위 단일 발광 요소"로 생성 (additive 블렌딩용). 시퀀스 아님.

공통 접두:
```
Single VFX sprite element on pure black background, centered, additive-blending ready (bright on black), no character, no scenery, game effect asset.
```

| # | 용도 (원작 책략 대응) | 개별 프롬프트 |
|---|---|---|
| C-1 | 화계 (초열/화룡/업화) | `Stylized burst of flames, swirling fire tongues forming a loose dragon shape, orange-to-white core, ink-brush flame edges` |
| C-2 | 수계 (소용돌이/탁류) | `Spiraling water vortex with foam crests, deep blue to cyan, dynamic circular motion feel` |
| C-3 | 낙석/산사태 | `Cluster of tumbling boulders with dust trail, warm grey rock, motion-blurred debris` |
| C-4 | 슬래시(통상 공격) | `Single curved sword-slash arc, sharp white-gold crescent light trail with thin tapering ends` |
| C-5 | 크리티컬/잭팟 | `Radial burst of golden light rays with sparks and small coins scattering, celebratory jackpot energy` |
| C-6 | 일기토 발동 플래시 | `Two crossed blade glints colliding at center, X-shaped spark flash, red vs green light clash` |
| C-7 | 회복 | `Soft rising green-gold healing motes and gentle lotus-petal light swirl` |
| C-8 | 사기 저하/혼란 | `Dark purple descending wisps and a cracked morale symbol feel, drooping smoke tendrils` |
| C-9 | 격파 코인 팝 | `Small bouncing gold coins and a tiny treasure pouch, 3-4 separated elements on black, game pickup sprites` |
| C-10 | 먼지/돌진 | `Horizontal dust kick-up puffs, 3 separate puff stages side by side, tan-grey, cartoon-physics energy` |

각 1~2회 생성이면 충분. 파티클 텍스처(원형 글로우, 스파크 점)는 코드로 만들 수 있으니 생성 불필요.

---

## 4. 우선순위 D — UI 최소 세트 (전투 HUD가 도는 정도만)

```
Game UI asset sheet on plain dark background, East Asian historical fantasy theme matching {픽된 STYLE}: (1) ornate portrait frame (square, bronze-and-lacquer border with subtle dragon corner motifs), (2) horizontal HP gauge frame + fill bar (lacquered wood + jade), (3) morale gauge variant (flame motif), (4) action button (round bronze seal/stamp style, blank center), (5) turn banner ribbon (blank center for text). Flat presentation, each element separated, no text anywhere.
```
- 결산/별점/상자 연출 UI는 다음 팩(v2)에서. 폰트/텍스트는 절대 이미지에 넣지 않기.

---

## 5. 진행 순서 제안 & 회신 포맷

1. **A-1 관우 시트 × 스타일 3종** 먼저 → 화풍 픽 (여기서 멈추고 회신 1회)
2. 픽된 스타일로 A-2~A-4 (기술 검증 트랙 가동: 내가 Spine 리깅/배경제거/슬라이스 진행)
3. B-1~B-4 (슬라이스 비주얼), C/D는 짬짬이
- 회신은 원본 PNG 그대로 + 어떤 프롬프트·스타일·몇 번째 변형인지 파일명에 기록
- 마음에 안 드는 컷도 "왜 별로인지" 한 줄 메모와 함께 주면 프롬프트 보정에 큼

### 생성 팁 (nano banana 기준)
- 캐릭터 후속 생성엔 **항상 시트 이미지를 첨부**하고 "same character as reference" 명시 — 일관성의 핵심
- 한 이미지에 한 에셋 원칙 (시트류 제외). 모델이 멋대로 배경 깔면 `plain white background` 를 프롬프트 맨 끝에 한 번 더
- 손가락/무기 잡은 손이 깨지면: 포즈를 단순화하거나 `weapon held firmly in two hands` 식으로 구체화
- 업스케일은 우리 쪽에서 처리하니 재생성으로 시간 쓰지 말 것
