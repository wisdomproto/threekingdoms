# BM·광고 (기획 문서 v1.0 §13)

> **문서 이관 안내(2026-09-11)**: 이 문서는 구 루트 `CLAUDE.md`(기획 문서 v1.0)의 해당 절을 **원문 그대로** 옮긴 것이다. 절 번호(§)는 구 문서 번호를 보존한다 — 코드 주석·memory·스펙의 `§n` 참조가 그대로 통한다. 제품 방향의 상위 문서는 `docs/design/master-plan.md`, UX 규칙은 `design-guide.md`, 루트 `CLAUDE.md`가 지도다.

## 13. BM (광고 기반 F2P + IAP·코스메틱) — 2026-06-14 광고모델 확정

> 1차 수익 = 광고(무료 진입장벽 0 = 웹 접근성 차별화와 정합). 2차 = 광고제거/본편 IAP + 코스메틱.

- **본편**: 챕터 판매 (1~2장 무료 → 이후) 또는 통구매 — 출시 시점 결정. **통구매에 광고제거 포함**.
- **코스메틱**: 캐릭터 스킨 + 무기 스킨. 현금은 **지정 구매만** (확률 상품 금지). 게임 내 재화로는 가챠 가능
- 스킨 노출 설계: 리더보드(스킨 적용 초상화), 리플레이(그 유저 스킨으로 재생 — 기록 자랑+스킨 자랑 동시), 일기토(무기 스킨 메인 무대), 클리어 기록 공유 이미지
- 테마 스킨팩 (수묵화 모드, 도트 레트로 모드 등 — 프롬프트 변형 재생성으로 생산비 ≈ 0)

### 광고 모델 (2026-06-14 확정 — "절제형")
- **리워드 광고(자발적, 도파민 순간에만 — 주력)** 4곳, 전부 opt-in·거부해도 진행 무손실:
  1. **결산 보상 2배** — 별평가→상자→골드 시퀀스 끝에 "광고 보고 골드·기연P 2배" (§12 카지노 결산이 그 자리)
  2. **기연 뽑기 +1회** (§12)
  3. **떠돌이 상인 재입고** (§12)
  4. **상점 골드 충전** — "광고 보고 +골드" (소액·일일 캡). 무기 등 *확정* 장비 구매용
- **전면 광고(로딩) — 절제형(보조)**: 2~3스테이지마다/보스 전만. **막간 스토리 카드(intro/outro)로 번들** = "다음 화 예고", 순수 인터럽트 금지. 빈도 캡 필수. **로딩 전환=에셋 프리로드 게이지(2026-06-28, `LoadingTransition`)**: "다음 화 예고" 카드 + 전투 에셋(맵 배경·등장 스프라이트) fetch 진행률 게이지(8초 timeout 안전장치 — §13 무손실) → 광고+에셋 완료 시 「전장으로」 활성. 부가로 게임 진입 시 색사각 지연도 줄임(HTTP 캐시 히트). ⚠️ 광고 useEffect의 StrictMode `cancelled` 가드가 광고 완료 콜백을 막아 dev에서 무한로딩되던 버그 수정(가드 제거, `adStarted`로 1회 보장 — prod은 원래 정상이라 dev 전용 버그였음).
- **기술**: `AdService` 추상 인터페이스(showRewarded()→Promise<bool> / showInterstitial()) — 우선 stub, 실 SDK는 어댑터로 스왑. **1순위 = 웹게임 포털 SDK(2026-07-02 전환)**: Poki(직접 유입 100%/포털 유입 50:50, 기술요건 초기 로드<8MB·30fps — 우리 R2 지연로드 구조라 유리)·CrazyGames(셀프서브+QA)·GameDistribution(Net 33%, 진입 최저) — **광고와 유통(유저 유입)을 세트로**, 트래픽 0 출발인 우리에게 정합. 전환 사유: **애드센스 반복 탈락**(게임 단독 페이지 = "콘텐츠 부족" 판정이 국룰) → H5 Games Ads(Ad Placement API, 전면+리워드 지원하나 애드센스 승인 선행)는 **후일 재도전**(공략/도감 텍스트 페이지 + 자체 트래픽 생긴 뒤). 포털은 "그쪽 광고만" 규칙이라 어댑터 스왑으로 자연 해결. 애드핏(일반 웹배너)은 **폐기**(2026-07-03 "돈 안 됨" — 코드도 revert). 메타스토어 `adFree` 플래그 + 일일 광고 캡.
- ✅ **광고 코드 완비(2026-07-03) — 남은 건 배포·계정, 코드 아님**: 포털 어댑터 3종(`apps/web/src/meta/adProviders/{poki,crazygames,gd}.ts`, `PortalDeps` 주입·`withTimeout`·음소거·무손실 폴백) + `NEXT_PUBLIC_AD_PROVIDER=stub|poki|crazygames|gd` 빌드별 스왑(미설정=DevMock, `AdHost.tsx` 가짜 모달로 dev/자체도메인 동작). **리워드 4지점 전부 배선**: result_double(결산)·shop_gold(상점·일일캡)·merchant_restock(상인)·qiyuan_extra(기연 무료뽑기 `pullSerendipityFree`) + 전면(LoadingTransition). 라이프사이클 라우터(`adProviders/lifecycle.ts` `adLifecycle`): boot(SDK 프리로드, AdHost 마운트)·loadingFinished(TitleScreen)·gameplayStart/Stop(BattleScreen)·**happytime(승리 시, CrazyGames/Poki)**. adFree면 버튼 미표시·즉시 폴백(§13 무손실). **CrazyGames v3 표면 완성**: init·loadingStart↔loadingStop·gameplayStart/Stop·requestAd(rewarded/midgame)+음소거·happytime. iframe 임베딩 차단 없음(next.config에 X-Frame 미설정 — 확인됨). env 문서=`.env.local.example`. 제출 순서 = 에셋 게이트 → Vercel 배포 → CrazyGames 계정·제출(→ GD → Poki 8MB 다이어트 후). 테스트=adProviders/adService.test.ts.

### 불가침선
- 현금 확률 상품 금지
- **전투력에 영향 주는 *현금·장비* 랜덤 옵션 금지**(확률 강화·장비 랜덤스탯·현금 가챠). ⚠️ *전투 내* 시드확률(명중/상태이상 등)은 별개 — 밸런스 sim·리더보드가 시드 재현으로 유지되므로 BM 가드와 무관(2026-06-16)
- 스태미나/강제 출석/시즌패스 금지
- **광고 동일 원칙**: ①광고로 전투력 랜덤/우위 직접 지급 금지(골드→*확정* 장비만, 밸런스 시뮬 유지) ②광고로 진행 인질 금지(스태미나식 "광고 봐야 계속" 금지) ③강제 전면광고 빈도 캡(절제형) — "떠나는 걸 막는 게 아니라 돌아오고 싶은 게임"(§2-8)

---
