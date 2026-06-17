# -*- coding: utf-8 -*-
"""Cloudflare R2 → 로컬 apps/web/public/assets 동기화 다운로더 (upload-assets.py 의 역방향).

R2가 source of truth일 때(다른 환경에서 작업한 최신 에셋이 R2에 있음) 로컬을 R2 기준으로 맞춘다.
안전 원칙: 로컬→R2 업로드 안 함, R2 객체 삭제 안 함. 로컬에만 있는 파일은 건드리지 않고 보고만 한다.

키 규약은 upload-assets.py 와 1:1: R2 키 assets/<rel>  ↔  로컬 apps/web/public/assets/<rel>.
크기 + ETag(MD5) 비교로 변경분만 받는다(멀티파트 ETag는 '-' 포함 → 크기만 비교).

사용:
  python tools/sync-from-r2.py            # 누락/변경분 다운로드
  python tools/sync-from-r2.py --dry-run  # 무엇을 받을지만 출력
자격증명: 저장소 루트 .env.r2 (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET).
"""
import sys, os, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "apps", "web", "public")
KEY_PREFIX = "assets"  # upload-assets.py 와 동일 — assetUrl이 "/assets/..."를 붙인다.


def load_dotenv():
    """저장소 루트 .env.r2 를 환경변수로(이미 설정된 값은 덮지 않음)."""
    path = os.path.join(ROOT, ".env.r2")
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def md5_hex(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv

    load_dotenv()
    acct = os.environ.get("R2_ACCOUNT_ID")
    akey = os.environ.get("R2_ACCESS_KEY_ID")
    skey = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket = os.environ.get("R2_BUCKET")
    miss = [n for n, v in [("R2_ACCOUNT_ID", acct), ("R2_ACCESS_KEY_ID", akey),
                           ("R2_SECRET_ACCESS_KEY", skey), ("R2_BUCKET", bucket)] if not v]
    if miss:
        print("환경변수 누락:", ", ".join(miss))
        print("저장소 루트 .env.r2(예시: tools/.env.r2.example) 에 설정하세요.")
        sys.exit(1)

    import boto3
    from botocore.config import Config
    s3 = boto3.client(
        "s3", endpoint_url=f"https://{acct}.r2.cloudflarestorage.com",
        aws_access_key_id=akey, aws_secret_access_key=skey,
        config=Config(signature_version="s3v4", region_name="auto"),
    )

    downloaded = skipped = 0
    remote_keys = set()
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=KEY_PREFIX + "/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith("/"):  # 디렉터리 플레이스홀더 스킵
                continue
            remote_keys.add(key)
            size = obj["Size"]
            etag = obj["ETag"].strip('"')
            dest = os.path.join(PUBLIC, *key.split("/"))

            need, reason = False, ""
            if not os.path.exists(dest):
                need, reason = True, "신규"
            elif os.path.getsize(dest) != size:
                need, reason = True, "크기변경"
            elif "-" not in etag and md5_hex(dest) != etag:  # 단일파트 ETag == MD5
                need, reason = True, "내용변경"
            # 멀티파트(ETag에 '-')는 크기 일치 시 스킵

            if need:
                print(f"  {'(dry) ' if dry else ''}↓ {key}  [{reason}]")
                if not dry:
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    s3.download_file(bucket, key, dest)
                downloaded += 1
            else:
                skipped += 1

    # 로컬에만 있는 파일(R2 기준 오펀) — 삭제하지 않고 보고만 한다.
    local_only = []
    asset_dir = os.path.join(PUBLIC, KEY_PREFIX)
    if os.path.isdir(asset_dir):
        for root, _, files in os.walk(asset_dir):
            for fn in files:
                rel = os.path.relpath(os.path.join(root, fn), PUBLIC).replace(os.sep, "/")
                if rel not in remote_keys:
                    local_only.append(rel)

    print(f"\n{'(dry-run) ' if dry else ''}다운로드 {downloaded} · 스킵 {skipped}  ← r2://{bucket}/{KEY_PREFIX}/")
    if local_only:
        print(f"로컬에만 있는 파일 {len(local_only)}개 (R2엔 없음 — 삭제하지 않고 보존):")
        for r in local_only[:20]:
            print("  ·", r)
        if len(local_only) > 20:
            print(f"  ... 외 {len(local_only) - 20}개")


if __name__ == "__main__":
    main()
