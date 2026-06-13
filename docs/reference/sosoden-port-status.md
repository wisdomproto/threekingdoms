# 조조전 → v1 이식 현황 (working status)

> **이 문서는 조조전 분석·이식의 진행 상태 추적용 living doc이다.**
> 설계 결정(SSOT)은 CLAUDE.md(§2-9 맵=영걸전/시스템=조조전, §7 병종 체계)에 있고,
> 휘발성 진행 노트는 여기에만 쓴다 — CLAUDE.md 편집 충돌(병렬 세션)을 피하기 위함.
> 갱신 시 CLAUDE.md는 건드리지 말고 이 파일만 고친다.

최종 갱신: 2026-06-13

---

## 문서 인덱스 (조조전 관련 전체)

| 문서 | 내용 |
|---|---|
| [sosoden-source-analysis.md](sosoden-source-analysis.md) | 원본 포맷(Ls12·DATA.E5·EEX) 리버싱 + 추출 산출물 |
| [sosoden-combat-formula.md](sosoden-combat-formula.md) | 전투/성장 공식 (데미지·능력치 파생·성장·등급) |
| [sosoden-battle-ux-analysis.md](sosoden-battle-ux-analysis.md) | 전투 화면 UX 차원별 해부 + 그래픽 포맷 |
| [sosoden-outbattle-ux-analysis.md](sosoden-outbattle-ux-analysis.md) | 막간(상점/편성/장비) UX |
| `packages/data/json/sosoden/` (+ README) | 추출 데이터 셋 (generals/classes/weapons/strategies/growthProfiles/rangeShapes) |
| `tools/hero-extract/` | 추출·분석 스크립트 (sosoden_*.py, extract_sosoden_data.py, eex_*.py, port_commanders.py) |

⚠️ `sosoden/scripts/`·`sosoden/events/`(대사·이벤트 원문)는 코에이 저작이라 **gitignore** — 로컬 레퍼런스만.

---

## ✅ 완료

- **포맷 크래킹**: Ls12 = 영걸전 Ls11 동일 알고리즘. E5 21/90 byte-exact 해제.
- **DATA.E5 6청크 전부 해독** → sosoden/: 장수 512 · 병종 53 · 무기 104 · 책략 73 · 성장 프로파일 27 · 범위 셰이프 58.
  - 능력치 순서 확정(무력/통솔/지력/민첩/운 + hp/mp; 허저·곽가 원형 삼각측량).
  - 무기 power, 책략 category 28종·power 확정.
- **EEX 117 → 이벤트 블록 469개** 분절(events/, 제목으로 스토리 구조 노출). 대사 39,725줄(scripts/).
- **전투 공식 확보**(EXE 디스어셈블 없이 커뮤니티 문서): combat-formula.md. 데미지=`(공×지형−방×지형)/2+Lv+25`, 부대능력=`장수능력/2 + 등급계수×Lv`, 공←무력·방←통솔·정신←지력·순발←민첩. **우리 추출 능력치가 표시치의 절반인 이유 확증.**
- **런타임 1차 이식(실용 스탯)**: commanders 118명 조조전 능력치(×2)로 갱신. 캐릭터=조조전, 엔진/공식/병종/스테이지/맵=영걸전 유지. 공식 검증 테스트는 fixtures에 영걸전 레퍼런스 합성주입으로 디커플. 전 테스트·타입체크 green. (main 푸시 42e257f)

---

## ⏳ 미완 (= 이전의 ①②③④ + 추가)

1. **병과 등급표 확정** — combat-formula §4. `classes.json terrain_c2_6`(5값)이 병과 5등급(공/정/방/순/사)일 가능성(서량기병 검증, 인코딩 미확정). namu "조조전/병과" 등급표 + 등급별 상승치표 필요 → **봇차단(403)이라 이미지 대조로 보완**.
2. **② combat.ts 조조전 공식 재작성 + 밸런스 재보정(§11)** — schemas(baseAtk/baseDef 제거, 등급/정신/순발/사기 추가)·UnitState·combat.ts 재설계. 1 확정이 전제. 영걸전 튜닝 스테이지가 조조전 스탯과 부정합(사수관 그리디 퇴화 관측).
3. **③ EEX opcode 디컴파일** → 이벤트/일기토 트리거를 stage `events[]` 스키마로. 조조전 이벤트 에디터 커뮤니티 문서로 단축 가능.
4. **④ 정밀 라벨** — growthProfiles `statGain`, 책략 `effectMatrix`, rangeShape `head`. (성장은 등급계수 모델로 대체될 수 있음.)
5. **그래픽 미해독** — HM00~57.E5(전투맵 추정)·MCALL00~08·IMSG.E5 컨테이너 포맷.
6. **엔진 잠재버그** — testMap에서 `getMovableTiles` ↔ applyAction 이동검증 불일치(시뮬 AI가 일부 맵서 불법 이동 제안 가능). 사수관선 미발현.

---

## 막힌 지점 / 외부 도움 필요
- namu·GameFAQs·StrategyWiki·thewiki·dnotewiki 전부 **봇차단**(WebFetch 403/refused). WebSearch 스니펫은 작동.
- **병과 등급표·등급별 상승치표 이미지**를 받으면 1·2를 바로 진행 가능.
