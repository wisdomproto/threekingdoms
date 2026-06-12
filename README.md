# 삼국지 턴제 전술 SRPG (가칭)

영걸전 문법을 계승한 웹 기반 턴제 전술 SRPG. 기획 SSOT는 [CLAUDE.md](./CLAUDE.md).

## 구조

| 패키지 | 역할 |
|---|---|
| `packages/data` | zod 스키마 + 게임 데이터 JSON — 원작(영걸전) 수치 기반 — docs/reference 참조 |
| `packages/engine` | 헤드리스 전투 엔진 — 순수 함수, 시드 RNG 결정론 |
| `packages/sim` | 자동 플레이 시뮬레이션 CLI (밸런스 튜닝 루프) |
| `apps/web` | Next.js 클라이언트 (렌더링은 차기 작업) |
| `docs/asset-pipeline` | AI 에셋 생성 가이드 (Gemini/Seedance/Spine) |

## 명령어

```bash
pnpm install        # 의존성 설치
pnpm test           # 전체 테스트
pnpm sim            # 사수관 200판 시뮬레이션 리포트
pnpm sim -- --stage 05-sishuiguan --runs 500 --seed 1
pnpm import-hero  # C:\HERO 원본에서 데이터 JSON 재생성
```

## 개발 규칙

- 전투 룰 변경은 CLAUDE.md(기획 문서) 먼저 업데이트
- 스테이지/밸런스 수치는 코드가 아니라 `packages/data/json/`에서
- engine은 React/DOM을 모른다 — 렌더링 의존성 추가 금지
