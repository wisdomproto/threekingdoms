# 조조전 → v1 이식 현황 (working status)

> **이 문서는 조조전 분석·이식의 진행 상태 추적용 living doc이다.**
> 설계 결정(SSOT)은 CLAUDE.md(§2-9 맵=영걸전/시스템=조조전, §7 병종 체계)에 있고,
> 휘발성 진행 노트는 여기에만 쓴다 — CLAUDE.md 편집 충돌(병렬 세션)을 피하기 위함.
> 갱신 시 CLAUDE.md는 건드리지 말고 이 파일만 고친다.

최종 갱신: 2026-06-14

---

## 문서 인덱스 (조조전 관련 전체)

| 문서 | 내용 |
|---|---|
| [sosoden-source-analysis.md](sosoden-source-analysis.md) | 원본 포맷(Ls12·DATA.E5·EEX) 리버싱 + 추출 산출물 |
| [sosoden-combat-formula.md](sosoden-combat-formula.md) | 전투/성장 공식 (데미지·능력치 파생·성장·등급) |
| [sosoden-class-grades.md](sosoden-class-grades.md) | 병과 5스탯 등급표·등급계수·책략 계열할당·일기토 조건 (2026-06-14 확보) |
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
- **통상전 공식·병력 스케일 이식**: combat.ts 조조전식(데미지=(공−방×상성)/2+Lv+25, 부대능력=floor(장수능력/2)+LV_GROWTH×Lv 잠정). 병력 ~100~150. (ac3921d)
- **병과 5스탯 등급표 확정** ✅ (구 미완 #1 해소, 2026-06-14): `classes.json terrain_c2_6` = 병과 등급표임을 우만위키(tcatmon) 미러로 교차검증 → **인코딩 4=S/3=A/2=B/1=C, 열 순서 [공·방·정·순·사]** 확정(combat-formula §4 가설이 전 병과에서 일치). 등급계수도 원작 구간표(S:0~48→+2/50~68→+3/70~88→+4 등) 확보. 책략 계열 할당(책사=화계/도사=디버프/풍수사=회복/기마책사=사신/무희=매혹/군주=패기). → **sosoden-class-grades.md**.

---

## ⏳ 미완 (= 이전의 ①②③④ + 추가)

1. ~~병과 등급표 확정~~ ✅ **완료**(위 참조, sosoden-class-grades.md). 남은 것: 병과별 "레벨 N에 책략 X 해금" 상세표(EXE 책략-병과 테이블 추출 필요 — namu/더위키 해당 페이지 봇차단).
2. ~~등급계수 성장 이식~~ ✅ **완료(W3, 2026-06-14)**: `unitClasses.json` 20병종에 5스탯 등급 부여, 성장을 증분형 구간표 룩업으로 교체(packages/engine/src/growth.ts, corpsStat). 결정론 유지, 339 테스트 green. 순발/사기 등급은 데이터로 보존(명중·사기 공식 미구현 입력). **밸런스 재보정 = 진행 중**: 사수관은 스크립트 일기토 즉승(즉승 유지 결정)이라 데미지 공식이 안 돌아 검증 불능 → **일기토 없는 합성 교전 픽스처(packages/sim)로 측정**(balance-report.md). 책략 데미지·반격에도 성장 자동 반영.
3. **③ EEX opcode 디컴파일** → 이벤트/일기토 트리거를 stage `events[]` 스키마로. 조조전 이벤트 에디터 커뮤니티 문서로 단축 가능.
4. **④ 정밀 라벨** — growthProfiles `statGain`, 책략 `effectMatrix`, rangeShape `head`. (성장은 등급계수 모델로 대체될 수 있음.)
5. **그래픽 미해독** — HM00~57.E5(전투맵 추정)·MCALL00~08·IMSG.E5 컨테이너 포맷.
6. **엔진 잠재버그** — testMap에서 `getMovableTiles` ↔ applyAction 이동검증 불일치(시뮬 AI가 일부 맵서 불법 이동 제안 가능). 사수관선 미발현.

---

## 막힌 지점 / 외부 도움 필요
- namu·thewiki는 r.jina.ai 경유에도 **Cloudflare 403**. 단 **우만위키(tcatmon.com) 미러는 통과** → 병과 등급표 이렇게 확보. naver블로그는 **m.blog 모바일 URL**을 r.jina.ai로 받아야 본문 추출됨.
- 남은 봇차단 항목: 병과별 책략 **레벨 해금 상세표**(namu/더위키 「조조전/책략」) — EXE 책략-병과 테이블 추출이 대안.
