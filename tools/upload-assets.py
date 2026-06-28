# -*- coding: utf-8 -*-
"""apps/web/public/assets → Cloudflare R2 동기화 업로더.

CLAUDE.md §3 "배포/CDN = Vercel + Cloudflare R2(이그레스 무료)" — 물량 큰 생성 에셋을
R2에서 서빙해 Vercel 대역폭과 git 비대화를 피한다. 코드(apps/web/src/assetUrl.ts)는
NEXT_PUBLIC_ASSET_BASE 만 보고 호스트를 바꾸므로, 이 스크립트로 같은 트리를 R2에 올리면 끝.

R2는 S3 호환이라 boto3로 붙는다(설치: pip install boto3). 자격증명은 환경변수 또는
저장소 루트의 .env.r2(추적 안 됨) 에서 읽는다. 버킷은 길중이 직접 생성:
  - R2_ACCOUNT_ID         : Cloudflare 계정 ID
  - R2_ACCESS_KEY_ID      : R2 API 토큰의 Access Key
  - R2_SECRET_ACCESS_KEY  : R2 API 토큰의 Secret
  - R2_BUCKET             : 버킷 이름

로컬 apps/web/public/assets/<rel> → 버킷 키 assets/<rel> (assetUrl 규약과 1:1).
크기+ETag(MD5) 비교로 변경분만 올린다(드롭-인 업그레이드 = 바뀐 파일만 전송).

사용:
  python tools/upload-assets.py            # 변경분만 업로드
  python tools/upload-assets.py --dry-run  # 무엇이 올라갈지만 출력
  python tools/upload-assets.py --delete   # 로컬에 없는 원격 키도 삭제(오펀 정리)

버킷 CORS·커스텀 도메인·캐시 설정은 docs/asset-pipeline/03-r2-asset-hosting.md 참조.
"""
import sys, os, hashlib, mimetypes, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSET_DIR = os.path.join(ROOT, "apps", "web", "public", "assets")
KEY_PREFIX = "assets"  # assetUrl이 "/assets/..."를 붙이므로 버킷 키도 같은 접두사

# 재생성 가능한 정적 산출물 — 1시간 브라우저 캐시 + 1일 엣지 캐시.
# 드롭-인 교체 시 너무 길면 갱신이 안 보여서 보수적으로. (Cloudflare 퍼지로 즉시 무효화 가능)
CACHE_CONTROL = "public, max-age=3600, s-maxage=86400"


def load_dotenv():
    """저장소 루트 .env.r2 를 환경변수로(이미 설정된 값은 덮지 않음). 의존성 없이 최소 파서."""
    path = os.path.join(ROOT, ".env.r2")
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        os.environ.setdefault(k, v)


def md5_hex(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv
    do_delete = "--delete" in sys.argv

    load_dotenv()
    acct = os.environ.get("R2_ACCOUNT_ID")
    akey = os.environ.get("R2_ACCESS_KEY_ID")
    skey = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket = os.environ.get("R2_BUCKET")
    missing = [n for n, v in [("R2_ACCOUNT_ID", acct), ("R2_ACCESS_KEY_ID", akey),
                              ("R2_SECRET_ACCESS_KEY", skey), ("R2_BUCKET", bucket)] if not v]
    if missing:
        print("환경변수 누락:", ", ".join(missing))
        print("저장소 루트 .env.r2(예시: tools/.env.r2.example) 또는 셸 환경변수로 설정하세요.")
        sys.exit(1)

    if not os.path.isdir(ASSET_DIR):
        print(f"에셋 디렉터리 없음: {ASSET_DIR}")
        sys.exit(1)

    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        print("boto3 가 필요합니다:  pip install boto3")
        sys.exit(1)

    endpoint = f"https://{acct}.r2.cloudflarestorage.com"
    s3 = boto3.client(
        "s3", endpoint_url=endpoint,
        aws_access_key_id=akey, aws_secret_access_key=skey,
        config=Config(signature_version="s3v4", region_name="auto"),
    )

    # 원격 목록(키 → ETag) 수집 — 변경분 판정용.
    remote = {}
    token = None
    while True:
        kw = {"Bucket": bucket, "Prefix": KEY_PREFIX + "/"}
        if token:
            kw["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kw)
        for o in resp.get("Contents", []):
            remote[o["Key"]] = o["ETag"].strip('"')
        if resp.get("IsTruncated"):
            token = resp.get("NextContinuationToken")
        else:
            break

    # 게임이 안 쓰는 원본(보드 IndexedDB 덤프)은 R2에 올리지 않는다 — --delete 시 R2 오펀으로 정리됨.
    EXCLUDE = os.sep + "_board_dump" + os.sep
    local_files = [p for p in glob.glob(os.path.join(ASSET_DIR, "**", "*"), recursive=True)
                   if os.path.isfile(p) and EXCLUDE not in p]

    up = skip = 0
    local_keys = set()
    for path in sorted(local_files):
        rel = os.path.relpath(path, ASSET_DIR).replace(os.sep, "/")
        key = f"{KEY_PREFIX}/{rel}"
        local_keys.add(key)
        digest = md5_hex(path)
        # 멀티파트가 아닌 단일 업로드의 ETag = MD5. 같으면 스킵.
        if remote.get(key) == digest:
            skip += 1
            continue
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        if path.endswith(".webp"):
            ctype = "image/webp"  # 일부 환경에서 webp 미인식 보정
        print(f"{'[dry] ' if dry else ''}↑ {key}  ({ctype})")
        if not dry:
            s3.upload_file(path, bucket, key,
                           ExtraArgs={"ContentType": ctype, "CacheControl": CACHE_CONTROL})
        up += 1

    deleted = 0
    if do_delete:
        orphans = [k for k in remote if k not in local_keys]
        for k in sorted(orphans):
            print(f"{'[dry] ' if dry else ''}✗ {k}")
            if not dry:
                s3.delete_object(Bucket=bucket, Key=k)
            deleted += 1

    print(f"\n{'(dry-run) ' if dry else ''}업로드 {up} · 스킵 {skip}"
          + (f" · 삭제 {deleted}" if do_delete else "")
          + f"  → r2://{bucket}/{KEY_PREFIX}/")
    if not dry and up:
        print("Cloudflare 캐시가 남아 있으면 대시보드에서 퍼지하세요(드롭-인 교체 즉시 반영).")


if __name__ == "__main__":
    main()
