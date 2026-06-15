# 03 · Cloudflare R2 에셋 호스팅

> CLAUDE.md §3 "배포/CDN = Vercel + Cloudflare R2(이그레스 무료)" + §2-7 "모든 에셋은 재생성
> 가능한 생성 산출물"의 실배선. 생성 에셋(씬 배경·초상·맵 배경·스프라이트·지형 타일·VFX·영상)을
> R2에서 서빙해 **Vercel 대역폭**과 **git 비대화**를 동시에 피한다.

## 그림

```
apps/web/src/*  ──assetUrl("/assets/..")──►  NEXT_PUBLIC_ASSET_BASE + "/assets/.."
                                              │
                          ┌───────────────────┴───────────────────┐
                  (미설정, dev)                              (설정, prod)
              apps/web/public/assets/..                 https://cdn.도메인/assets/..  ← R2
```

- **코드는 항상 `/assets/...` 절대경로만 안다.** 호스트 전환은 `apps/web/src/assetUrl.ts` 한 곳.
- **dev/로컬**: `NEXT_PUBLIC_ASSET_BASE` 미설정 → 기존처럼 `apps/web/public`에서 동일출처 로드. 아무것도 안 바뀐다.
- **prod**: `NEXT_PUBLIC_ASSET_BASE=https://cdn.도메인` → 전부 R2/CDN. 호출부 코드 무변경.

## 1. 버킷 생성 (길중)

1. Cloudflare 대시보드 → R2 → **Create bucket** (예: `tk-assets`).
2. **커스텀 도메인 연결**(권장): 버킷 → Settings → Public access → *Connect Domain* → `cdn.도메인`.
   - 커스텀 도메인은 Cloudflare CDN 캐시 + 무료 이그레스 + CORS 제어가 깔끔하다. `r2.dev` 공개 URL은 임시용.
3. **CORS** (버킷 → Settings → CORS policy): 웹 오리진에 GET/HEAD 허용. `manifest.json` fetch와 맵 배경 HEAD 요청이 크로스오리진이기 때문.
   ```json
   [
     {
       "AllowedOrigins": ["https://게임도메인", "http://localhost:3000"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```
4. **API 토큰**: R2 → Manage API Tokens → *Object Read & Write* 토큰 발급 → Access Key / Secret 확보.

## 2. 자격증명 설정 (업로드용)

`tools/.env.r2.example` 를 저장소 루트 `.env.r2` 로 복사해 채운다(`.env.r2`는 gitignore — 커밋 안 됨):

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=tk-assets
```

## 3. 업로드

```bash
pip install boto3                      # 최초 1회
python tools/upload-assets.py --dry-run   # 무엇이 올라갈지 확인
python tools/upload-assets.py             # 변경분만 업로드 (size+MD5 비교)
python tools/upload-assets.py --delete    # 로컬에 없는 원격 키도 정리(선택)
```

- 로컬 `apps/web/public/assets/<rel>` → 버킷 키 `assets/<rel>` (assetUrl 규약과 1:1).
- 변경분만 전송(드롭-인 교체 = 바뀐 파일만). `manifest.json`류도 함께 올라가 리졸버가 R2에서 읽는다.
- 캐시가 남으면 Cloudflare 대시보드에서 퍼지 → 교체 즉시 반영.

## 4. 프론트 전환

- 로컬 검증: `apps/web/.env.local.example` → `.env.local`, `NEXT_PUBLIC_ASSET_BASE=https://cdn.도메인` 넣고 dev 재기동.
- 배포: **Vercel 프로젝트 → Environment Variables** 에 `NEXT_PUBLIC_ASSET_BASE` 동일 설정(NEXT_PUBLIC_ 은 빌드 타임 인라인이라 빌드 전에 있어야 함).

## 5. git에서 에셋 빼기 (선택 · 후속)

현재 `apps/web/public/assets/**` 에는 이미 커밋된 에셋(sprites/tiles/vfx/ui/maps)이 있다. R2 서빙이
확인되면 git에서 빼 레포를 가볍게 할 수 있다 — **비가역이라 별도 결정**:

```bash
git rm -r --cached apps/web/public/assets   # 워킹트리는 유지, 추적만 해제
# .gitignore 에 apps/web/public/assets/ 추가 후 커밋
```

그 전까지는 git(로컬 폴백)과 R2(prod 서빙)가 공존한다 — dev는 NEXT_PUBLIC_ASSET_BASE 없이 public에서 그대로 본다.

## 6. 에디터에서 게임 바로 적용 (`serve.py` `POST /save-asset`)

에디터에서 만든 이미지를 손으로 옮기지 않고 **즉시 게임에 반영**한다. `tools/serve.py`(:8080)에
업로드 엔드포인트가 있고, R2 시크릿은 이 서버에만 둔다(에디터엔 노출 안 됨).

```
에디터(브라우저)  ──POST /save-asset (이미지 base64)──►  serve.py(:8080)
                                                         ├─► apps/web/public/assets/<path>  (dev 즉시)
                                                         └─► R2 버킷 key=<path>             (배포본 동기화)
```

- 요청: `{ path: "assets/scenes/05-sishuiguan-intro.webp", b64, contentType }` — `path`는 `assets/` 하위만 허용(상위 탈출 차단).
- 한 번의 적용으로 **로컬 public + R2 양쪽**에 기록 → dev는 새로고침 즉시, 배포본은 R2로 자동 동기화.
- R2 캐시는 짧게(max-age 300s) — 드롭-인 교체가 빨리 보이도록.

연결된 에디터:
- **에셋 보드 → 시나리오 씬 탭**: 카드에 이미지 붙여넣기/드롭 → `assets/scenes/{bgId}.webp` **자동 적용**.
- **맵 청크 보드**: 전체 미리보기 → **🎮 게임에 적용** → `assets/maps/{mapId}.webp` 적용(🧵는 다운로드).

전제: 보드를 `:8080`(serve.py)에서 열 것(대시보드 기본). 서버가 꺼져 있으면 적용 실패 토스트 → 다운로드로 폴백.
