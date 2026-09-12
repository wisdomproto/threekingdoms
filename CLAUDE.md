# 삼국지 웹 SRPG — 프로젝트 가이드 (SSOT 지도)

> **한 문장**: 고퀄 스토리로 삼국지를 보고, 중요한 전투는 직접 플레이하며, 같은 도구로 누구나 자신의 SRPG를 만들어 웹에 공개하는 플랫폼.
> **지금 단계**: 삼국지 = 첫 완성작 · 엔진 대표작 · 저작도구 실전 검증작. 플랫폼(도구 공개·UGC)은 그 다음.
> 이 파일은 **지도**다. 결정·근거·이력은 아래 문서에 있고, 문서와 충돌하는 구현은 하지 않는다 — 변경은 문서 먼저.

## 문서 지도

| 문서 | 내용 | 언제 |
|---|---|---|
| [docs/design/master-plan.md](docs/design/master-plan.md) | 제품 방향·플랫폼 로드맵·구현 우선순위 P0~P3 + **Character Presentation System**(리그·장비 비주얼·스킨, v2) + 구 SSOT 충돌 정리 부록 | 방향·우선순위 판단 |
| [docs/design/design-guide.md](docs/design/design-guide.md) | UX 원칙·디자인 토큰·HUD·Creator·Story 규칙 + **Character Studio/Skin/Rig 가이드**(v2)·QA 체크리스트 | UI 작업 전 |
| [docs/design/game-design.md](docs/design/game-design.md) | 게임 설계 결정 §1·2·7~12·14~16 (철학·병종·일기토·성장·난이도·밸런스·도파민·범위·금지 목록) | 규칙·시스템 작업 |
| [docs/design/scenario.md](docs/design/scenario.md) | §5 27스테이지 + 캠페인 루프·막간 씬 이력, §6 로스터 | 콘텐츠 작업 |
| [docs/design/bm.md](docs/design/bm.md) | §13 광고·IAP·불가침선 | 수익·광고 |
| [docs/design/oss-editor-benchmark.md](docs/design/oss-editor-benchmark.md) | 오픈소스 저작도구 벤치마크(LT-Maker·RPGAtlas·LDtk·Sulis) + 우선순위 §15 + 라이선스 체크리스트 | 저작도구 설계 시 |
| [apps/web/CLAUDE.md](apps/web/CLAUDE.md) | §3 스택·렌더링 3레이어·오디오·배포 + 앱 배선 규칙 | apps/web 작업 시 자동 로드 |
| [tools/CLAUDE.md](tools/CLAUDE.md) | §4 에셋 파이프라인·보드·serve.py·webp 규약 | tools 작업 시 |
| [packages/CLAUDE.md](packages/CLAUDE.md) | engine/data/sim 계약(시드 RNG·이벤트 자기서술·밸런스 게이트) | packages 작업 시 |
| docs/reference/ · docs/superpowers/ | 원작 추출·경쟁작·UX 분석 · 스펙/플랜 | 근거 확인 |

`§n` 참조: 코드·memory·스펙의 "CLAUDE.md §n"은 위 문서들의 **같은 절 번호**를 뜻한다(구 기획 문서 v1.0 번호 보존).

## 기술 스택
Next.js/React + PixiJS 전투 · `@tk/engine` 헤드리스(결정론 + 시드확률) · `@tk/data` JSON SSOT(zod) · `@tk/sim` 밸런스 · Supabase(v1.5) · Vercel + Cloudflare R2(에셋) · 생성: Gemini 이미지 / Seedance 영상 / ElevenLabs / Web Audio 신스. pnpm 모노레포.

## 커맨드
```bash
pnpm --filter @tk/web dev                 # 게임 :3000 (launch: web)
pnpm test && pnpm typecheck               # 전 패키지 게이트 — 커밋 전 green
pnpm --filter @tk/web build               # 라우트별 First Load JS 확인
pnpm --filter @tk/sim report-card         # 밸런스 라벨 게이트 (generate-stage / generate-map / asset-manifest)
python tools/serve.py 8081                # 에셋보드·에디터 정적 서버 (launch: tools)
python tools/upload-assets.py [--dry-run|--delete]   # 로컬 assets → R2
```

## 컨벤션
- 대화 한국어 / 코드·커밋 영어(`type(scope): …`). 커밋 전 test+typecheck green, 규칙·데이터 변경 후 report-card.
- 데이터가 진실: 규칙·스테이지·로스터는 `packages/data/json`. 병종 진실은 rosters/stages(§6 표는 구상).
- 에셋 원본은 git이 아니라 **R2**(`NEXT_PUBLIC_ASSET_BASE`). 런타임 이미지는 **webp**(fx·bg만 png), 스프라이트 폴더는 gitignore, 원본 시트·샘플 미추적. 올리기 = `upload-assets.py`.
- 새 연출 이벤트는 3곳 세트(BattleRenderer + eventPlayer + PresenterDelegate). troops를 바꾸는 효과는 서술 이벤트 emit 필수.
- 전투 확률은 시드 고정만 — 순수 RNG·세이브스컴 금지. 전투 결과의 메타 영속은 결산(ResultSequence) 책임.
- 법적 라인: 원작 명칭·그래픽 모방 금지, 퍼블릭도메인·자체 에셋만(master-plan §21, game-design §1).

## 핵심 원칙 (요약 — 근거는 game-design §2, master-plan §1~9)
1. 시나리오·맵은 원작 재현, 전투 게임성은 격상(시드확률 + 결정론).
2. 표현은 2026 풀스택 — STORY = 고퀄 카툰/모션코믹, 키 모먼트 = 명화풍 일러스트.
3. 캐주얼 우선(막힘 없이 완주), 깊이는 S랭크·Classic/Hard 레이어로.
4. 내정·파밍 없음 — 막간은 STORY와 출진 준비뿐.
5. 랜덤은 재미로, 돈은 확정으로, 전투력은 기댓값 실력으로.
6. 모든 에셋은 재생성 가능한 파이프라인 출력물.
7. 리텐션 강제 장치(스태미나·출석·시즌패스) 금지.
8. **삼국지를 만드는 도구 = 유저에게 공개할 도구** — 운영자 하드코딩·내부 전용 파이프라인 최소화.

## 현재 트랙 (2026-09-11)
- **출시(삼국지)**: 에셋 게이트 닫힘(painted 27/27 · 씬 54/54 · 초상 122). Poki 8MB 다이어트 반영(webp · 전투 스프라이트 스코핑 · BGM 지연). 잔여 = `sorcerer_enemy` 제네릭 1장 → Vercel 배포 → CrazyGames 제출(포털 순서는 bm.md).
- **P0 (master-plan §22)**: 에디터 round-trip 무손실 → P1 Project Store · Autosave · Undo/Redo · Playtest 왕복.
- **막간 STORY**: 출시는 현행(VN 27편 + v4 맵씬 01). 모션코믹 전환은 Story Editor(P2~P3)와 함께 — 결정 근거는 master-plan 부록.
