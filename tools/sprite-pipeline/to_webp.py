# -*- coding: utf-8 -*-
"""게임이 fetch하는 PNG 에셋을 webp로 일괄 전환 (Poki 초기 로드 8MB 다이어트).

대상 = 런타임이 읽는 것만:
  sprites/**/front_*.png, back_*.png   → 손실 q=90   (SD 채색, 외곽선 유지 확인 후 조정)
  tiles/*.png                          → 무손실      (시임리스 바닥·오토타일 이음새)
  objects/**/*.png                     → 무손실
원본 시트(`_posesheet.png`·`_sheet_*.png`·`_source.png`)·fx(additive 휘도)·bg·skeletons·scene-motions는 건드리지 않는다.

성공 변환 후 PNG 삭제(--keep-png 로 보존). 이미 webp 가 있으면 건너뜀(멱등).
사용: python tools/sprite-pipeline/to_webp.py [--dry-run] [--keep-png]
"""
import os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "apps", "web", "public", "assets")
SPRITE_Q = 90


def targets():
    for d, _, files in os.walk(os.path.join(ROOT, "sprites")):
        for f in files:
            if f.endswith(".png") and (f.startswith("front_") or f.startswith("back_")):
                yield os.path.join(d, f), dict(quality=SPRITE_Q, method=6)
    for sub in ("tiles", "objects"):
        for d, _, files in os.walk(os.path.join(ROOT, sub)):
            for f in files:
                if f.endswith(".png") and not f.startswith("_"):
                    yield os.path.join(d, f), dict(lossless=True, method=6)


def convert(src, opts, dry, keep):
    dst = src[:-4] + ".webp"
    if os.path.exists(dst):
        return "skip", 0, 0
    before = os.path.getsize(src)
    if dry:
        return "dry", before, 0
    Image.open(src).save(dst, "WEBP", **opts)
    after = os.path.getsize(dst)
    if not keep:
        os.remove(src)
    return "ok", before, after


def main():
    dry, keep = "--dry-run" in sys.argv, "--keep-png" in sys.argv
    n = skip = 0; b = a = 0
    for src, opts in targets():
        st, before, after = convert(src, opts, dry, keep)
        if st == "skip":
            skip += 1; continue
        n += 1; b += before; a += after
    print(f"{'(dry-run) ' if dry else ''}변환 {n} · 스킵(webp 있음) {skip} · {b/1e6:.1f} MB → {a/1e6:.1f} MB")


if __name__ == "__main__":
    # self-check: RGBA 왕복 시 알파·크기 보존
    im = Image.new("RGBA", (8, 8), (0, 0, 0, 0)); im.putpixel((3, 3), (255, 0, 0, 255))
    p = os.path.join(os.path.dirname(__file__), "_sc.png"); im.save(p)
    convert(p, dict(lossless=True), dry=False, keep=False)
    w = Image.open(p[:-4] + ".webp"); assert w.size == (8, 8) and w.getpixel((3, 3))[3] == 255 and w.getpixel((0, 0))[3] == 0
    os.remove(p[:-4] + ".webp")
    main()
