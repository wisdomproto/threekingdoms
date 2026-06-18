# -*- coding: utf-8 -*-
"""에셋 생성 오케스트레이터 — prompts.json(보드 추출) → Gemini 생성 → 컷/슬라이스 → public/ + R2.

흐름:
  1) tools/sprite-pipeline/gen/export_prompts.mjs 로 prompts.json 갱신(보드=SSOT)
  2) 이 스크립트로 카테고리별 생성:
       scene    : 텍스트→이미지 → webp → public/assets/scenes/{bg}.webp
       portrait : 텍스트→이미지(그리드 시트) → 멤버 슬라이스 → public/assets/ui/portraits/{이름}.webp
       sd       : 레퍼런스 첨부 img2img(시트) → cut_posesheet → public/assets/sprites/{id}/front_*.png
  3) public/ 에 쓰고 .env.r2 있으면 R2 업로드(배포 원천)
  4) 비전 QA = Claude가 결과 이미지를 Read로 보고 이상하면 --id 로 재생성(이 스크립트 밖 루프)

사용:
  python gen_assets.py --only scene --limit 3 --dry-run     # 무엇이 생성될지만
  python gen_assets.py --only scene                          # 씬 54장 전부
  python gen_assets.py --only portrait --id I-shu-core       # 특정 그룹만
  python gen_assets.py --id N-05o --force                    # 재생성(QA 반려분)
플래그: --only scene|portrait|sd  --id <jobId>  --limit N  --force(기존 덮어쓰기)  --dry-run  --no-r2
설치: pip install google-genai pillow boto3
"""
import os, sys, json, argparse, mimetypes

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
PUBLIC = os.path.join(ROOT, "apps", "web", "public")
RAW = os.path.join(HERE, "_raw")          # 중간 시트(gitignored)
REFS = os.path.join(HERE, "refs")         # SD 레퍼런스 시트(spriteId.png) — 있으면 img2img
PROMPTS = os.path.join(HERE, "prompts.json")

sys.path.insert(0, HERE)


# ---------- R2 업로드(.env.r2 재사용) ----------
def _r2_client():
    env = {}
    p = os.path.join(ROOT, ".env.r2")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    need = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
    if not all(env.get(k) for k in need):
        return None, None
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        return None, None
    s3 = boto3.client(
        "s3", endpoint_url=f"https://{env['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=env["R2_ACCESS_KEY_ID"], aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4", region_name="auto"))
    return s3, env["R2_BUCKET"]


def r2_put(s3, bucket, rel_key, local_path):
    ctype = "image/webp" if local_path.endswith(".webp") else (mimetypes.guess_type(local_path)[0] or "image/png")
    s3.upload_file(local_path, bucket, rel_key,
                   ExtraArgs={"ContentType": ctype, "CacheControl": "public, max-age=300, s-maxage=3600"})


# ---------- 카테고리별 처리 ----------
def do_scene(job, gen, dry):
    final = os.path.join(PUBLIC, *job["savePath"].split("/"))  # .../scenes/{bg}.webp
    if dry:
        print(f"  [dry] scene → {job['savePath']}"); return [job["savePath"]]
    raw_png = os.path.join(RAW, "scene", os.path.basename(job["savePath"]).replace(".webp", ".png"))
    if not gen(job["prompt"], raw_png, None):
        return []
    from PIL import Image
    os.makedirs(os.path.dirname(final), exist_ok=True)
    Image.open(raw_png).convert("RGB").save(final, "WEBP", quality=90)
    return [job["savePath"]]


def do_portrait(job, gen, dry):
    if dry:
        print(f"  [dry] portrait {job['group']} → {len(job['members'])}명: {','.join(job['members'])}")
        return [f"assets/ui/portraits/{m}.webp" for m in job["members"]]
    sheet = os.path.join(RAW, "portrait", f"_sheet_{job['group']}.png")
    if not gen(job["prompt"], sheet, None):
        return []
    from slice_portraits import slice_sheet
    out_dir = os.path.join(PUBLIC, "assets", "ui", "portraits")
    res = slice_sheet(sheet, job["members"], out_dir, grid=job.get("grid"))
    saved = []
    for name, path, ok in res:
        if ok:
            saved.append(f"assets/ui/portraits/{name}.webp")
        else:
            print(f"    [경고] 슬라이스 누락: {name}")
    return saved


def do_sd(job, gen, dry):
    ref = os.path.join(REFS, f"{job['spriteId']}.png")
    refs = [ref] if os.path.exists(ref) else None
    if dry:
        tag = "ref있음" if refs else "ref없음(텍스트만→품질주의)"
        print(f"  [dry] sd {job['name']}({job['spriteId']}) {tag} → {job['savePath']}")
        return [job["savePath"]]
    sheet = os.path.join(PUBLIC, *job["savePath"].split("/"))  # _posesheet.png
    if not gen(job["prompt"], sheet, refs):
        return []
    # 2D 그리드 컷(등급/뷰 행 × 포즈 열) — 기존 파이프라인 재사용
    try:
        import subprocess
        subprocess.run([sys.executable, os.path.join(os.path.dirname(HERE), "cut_posesheet.py"), sheet],
                       check=True)
    except Exception as e:  # noqa: BLE001
        print(f"    [경고] cut 실패({job['spriteId']}): {e}")
    return [job["savePath"]]


HANDLERS = {"scene": do_scene, "portrait": do_portrait, "sd": do_sd}


def already_done(job):
    """이미 결과물이 있으면 True(스킵 판정). scene/sd=savePath, portrait=멤버 전부."""
    if job["kind"] == "portrait":
        return all(os.path.exists(os.path.join(PUBLIC, "assets", "ui", "portraits", f"{m}.webp"))
                   for m in job["members"])
    if job["kind"] == "sd":  # front 컷이 있으면 완료로 간주
        d = os.path.join(PUBLIC, "assets", "sprites", job["spriteId"])
        return os.path.isdir(d) and any(f.startswith("front_") for f in os.listdir(d))
    return os.path.exists(os.path.join(PUBLIC, *job["savePath"].split("/")))


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # Windows 콘솔 한글 로그
    except Exception:  # noqa: BLE001
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["scene", "portrait", "sd"])
    ap.add_argument("--id")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-r2", action="store_true")
    args = ap.parse_args()

    if not os.path.exists(PROMPTS):
        print("prompts.json 없음 — 먼저: node tools/sprite-pipeline/gen/export_prompts.mjs"); sys.exit(1)
    catalog = json.load(open(PROMPTS, encoding="utf-8"))
    jobs = catalog["jobs"]
    if args.only:
        jobs = [j for j in jobs if j["kind"] == args.only]
    if args.id:
        jobs = [j for j in jobs if j["id"] == args.id]
    if not args.force:
        jobs = [j for j in jobs if not already_done(j)]
    if args.limit:
        jobs = jobs[: args.limit]

    if not jobs:
        print("처리할 잡 없음(이미 완료됐거나 필터 결과 0). --force 로 재생성 가능."); return

    print(f"대상 {len(jobs)}잡  (only={args.only or 'all'} id={args.id or '-'} "
          f"force={args.force} dry={args.dry_run})")

    gen = None
    if not args.dry_run:
        from gemini_client import generate_image
        gen = generate_image

    s3 = bucket = None
    if not args.dry_run and not args.no_r2:
        s3, bucket = _r2_client()

    import time
    delay = float(os.environ.get("GEN_DELAY", "7"))  # 호출 간 텀(레이트리밋 방지)
    done = 0
    for idx, j in enumerate(jobs):
        if not args.dry_run and idx > 0:
            time.sleep(delay)  # 연속 호출 사이 텀
        print(f"[{j['kind']}] {j['id']}")
        saved = HANDLERS[j["kind"]](j, gen, args.dry_run)
        if not args.dry_run and saved and s3:
            for rel in saved:
                local = os.path.join(PUBLIC, *rel.split("/"))
                if os.path.exists(local):
                    try:
                        r2_put(s3, bucket, rel, local)
                    except Exception as e:  # noqa: BLE001
                        print(f"    [R2 경고] {rel}: {e}")
        done += 1 if saved else 0
    print(f"\n완료 {done}/{len(jobs)}  (R2={'on' if s3 else 'off'})")


if __name__ == "__main__":
    main()
