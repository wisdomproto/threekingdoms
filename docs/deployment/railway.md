# Railway 운영 준비

## 구성과 주소

저장소 루트에서 Dockerfile로 빌드한다. Root Directory는 `/`로 유지한다 (`apps/web`로 바꾸면 workspace 패키지와 기존 에디터가 빠진다).

처음에는 서비스 하나와 `/data` 볼륨 하나로 운영한다. 같은 서비스의 모든 프로젝트가 에셋 라이브러리를 공유한다.

| 용도 | 주소 |
| --- | --- |
| 삼국지 게임 | `https://<서비스 도메인>/` |
| 트로이 게임 | `https://<서비스 도메인>/troia` |
| 관리자 저작도구 | `https://<서비스 도메인>/studio` |

서비스 이름은 `samgukji`, 프로젝트별 독립 서비스는 `troia`처럼 내용이 드러나는 이름을 쓴다. Railway 자동 도메인은 실제 사용 가능 여부를 확인한 뒤 정한다. 소유한 도메인이 있다면 `samgukji.<도메인>`, `troia.<도메인>`을 연결한다. UUID, `__lab`, `preview`, 임시 브랜치명을 공개 게임 주소로 쓰지 않는다.

트로이 전용 서비스는 `TK_GAME_ENTRY=troia`로 설정하면 `/`에서 트로이가 열린다. 미설정은 삼국지다. 서비스별 볼륨은 독립적이다. 별도 서비스끼리 에셋 편집이 실시간 동기화되는 구성은 아니므로, 초기에는 한 서비스 안에서 프로젝트를 관리하는 구성을 권장한다.

## Railway 설정

1. GitHub 저장소를 연결하고 Dockerfile 빌드를 사용한다. `railway.json`이 헬스 체크 `/api/health`를 지정한다.
2. Volume을 만들고 **`/data`** 에 마운트한다. 프로젝트, 게시 게임 버전, 업로드 에셋, 편집 백업이 여기에 저장된다. replica는 1개로 둔다.
3. 아래 환경변수를 설정한다. 비밀번호는 Railway Variables에만 입력하고 Git에 넣지 않는다.

| 변수 | 값 / 의미 |
| --- | --- |
| `TK_STUDIO_ENABLED` | `1` |
| `TK_STUDIO_USER` | 관리자 이름, 기본 `admin` |
| `TK_STUDIO_PASSWORD` | 충분히 긴 임의의 관리자 비밀번호, 필수 |
| `TK_GAME_ENTRY` | 삼국지는 미설정, 트로이 전용 서비스는 `troia` |
| `NEXT_PUBLIC_ASSET_BASE` | 기존 R2/CDN의 origin. 로컬 파일이 없는 경우에만 대체 경로로 사용 |
| `NEXT_PUBLIC_AD_PROVIDER` | 기본 `stub`, 포털 연동 시 공급자 지정 |

`PORT`는 Railway가 제공한다. 서버는 `0.0.0.0:$PORT`로 실행한다. `TK_STUDIO_DATA_DIR=/data/studio`, `TK_STUDIO_ASSET_DIR=/data/assets`는 Dockerfile 기본값이다. `NEXT_PUBLIC_HOSTED_STUDIO=1`도 빌드에 포함된다. `NEXT_PUBLIC_*` 변경 후에는 재빌드한다. `NODE_ENV=development`로 운영하지 않는다.

관리자 화면/API/플레이테스트는 HTTPS에서 브라우저 기본 인증으로 보호한다. 게임, 공개 게임 스냅샷과 미디어는 로그인 없이 접근한다. 현재는 운영자 공용 계정이며, 사용자별 계정·권한·비밀번호 재설정 기능은 포함하지 않는다.

## 로컬 프로젝트와 에셋 이관

GitHub 배포에는 `.studio`와 Git 미추적 에셋이 포함되지 않는다. 현재 로컬 프로젝트와 새 초상들을 그대로 쓰려면 최초 볼륨 이관이 필요하다.

로컬에서:

```powershell
python tools/deploy/export-railway-seed.py
```

결과는 `.studio/railway-seed.tar.gz`. 프로젝트와 게시 버전, public 에셋, 트로이의 기존 런타임 그림을 담고 `.env` 및 자격증명은 포함하지 않는다. 이 파일은 커밋하지 않는다.

Railway CLI에서 대상 프로젝트·환경·서비스를 정확히 선택한 후 최초 빈 볼륨에 업로드한다:

```text
railway volume files upload .studio/railway-seed.tar.gz /railway-seed.tar.gz
railway ssh
```

원격 셸에서 `/data/studio/projects`에 기존 작업물이 없는지 확인한 뒤 초기 이관한다. 운영 중인 볼륨에 덮어쓰지 않는다.

```sh
tar -xzf /data/railway-seed.tar.gz -C /data
```

재시작 후 `/studio`에서 프로젝트 목록을 확인한다. 공개할 프로젝트를 열고 **게임 실행**을 눌러 게시 스냅샷을 지정한다. 공개 게임은 활성화된 저장본을 사용하며, 편집 중인 초안을 자동으로 공개하지 않는다. 새 버전을 공개하려면 다시 게임 실행을 누른다. 기존 전투 이어하기에는 이전 게시 버전을 사용한다.

시작 스크립트는 이미지에 포함된 에셋 중 볼륨에 없는 파일만 보충한다. 이미 편집한 파일은 덮어쓰지 않는다. 같은 이름의 기본 에셋을 새 버전으로 바꾸려면 저작도구에서 교체한다. Railway 볼륨 백업을 활성화한다.

## 검증 및 한계

- 로컬 개발 서버와 별도 디렉터리에서 production 빌드를 통과했다. 운영 서버에서 공개 게임·에셋 조회, 관리자 인증, 프로젝트 생성·게임 게시, 외부 Origin 쓰기 차단을 확인했다.
- Docker가 설치되지 않은 개발 PC에서는 Linux 이미지 자체의 실행 검증은 Railway 첫 빌드 때 필요하다.
- 아직 Railway 리소스 생성, 도메인 예약, 볼륨 업로드, 실제 배포는 수행하지 않았다.
- 게임 진행 저장은 브라우저 저장소다. 도메인이 달라지면 기존 localhost 진행이 자동 이전되지 않는다.

공식 참고: [Dockerfile 배포](https://docs.railway.com/guides/dockerfiles), [헬스 체크](https://docs.railway.com/deployments/healthchecks), [볼륨 파일 이관](https://docs.railway.com/cli/volume), [볼륨 백업](https://docs.railway.com/volumes/backups).
