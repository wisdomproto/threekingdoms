# -*- coding: utf-8 -*-
"""청크 painted 조각 → 고해상 배경 한 장으로 stitch (오버랩 페더 블렌딩).

export_chunks.py 가 만든 manifest + 조각별 생성 결과(painted_r{r}_c{c}.png)를 읽어,
각 조각을 타일 범위에 맞춰 TARGET_TILE 밀도로 리사이즈하고, 이웃과 겹치는 변을
페더(선형 알파 램프)로 가중 합성한다 → seam이 부드럽게 사라진다.

조각 생성 규약: docs/art/chunks/painted_{mapId}_r{r}_c{c}.png (블록아웃과 같은 종횡비로 생성).
산출: apps/web/public/assets/maps/{mapId}.webp (기존 배경 교체).

사용: python stitch_chunks.py [mapId] [target_tile_px]   기본: sishuiguan 96
"""
import sys, json, os, glob
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
mapId = sys.argv[1] if len(sys.argv) > 1 else "sishuiguan"
TARGET = int(sys.argv[2]) if len(sys.argv) > 2 else 96  # 출력 px/타일 (96 → 사수관 5376×3072)

CHUNKDIR = rf"{ROOT}\docs\art\chunks"
man = json.load(open(rf"{CHUNKDIR}\{mapId}_manifest.json", encoding="utf-8"))
W, H = man["width"], man["height"]
COLS, ROWS, OV = man["cols"], man["rows"], man["overlap"]
outW, outH = W * TARGET, H * TARGET
feather = OV * TARGET  # 페더 폭 = 겹침 타일 × 출력밀도

# float 누적 버퍼 (numpy 없이 PIL만)
try:
    import numpy as np
except ImportError:
    print("numpy 필요: pip install numpy"); sys.exit(1)

acc = np.zeros((outH, outW, 3), dtype=np.float64)
wsum = np.zeros((outH, outW, 1), dtype=np.float64)

def ramp(n, lo, hi):
    """길이 n 의 1D 가중치: 왼쪽 lo px·오른쪽 hi px 선형 램프(0→1), 가운데 1."""
    v = np.ones(n)
    if lo > 0:
        lo = min(lo, n); v[:lo] = np.linspace(0, 1, lo, endpoint=False)
    if hi > 0:
        hi = min(hi, n); v[n - hi:] = np.linspace(1, 0, hi, endpoint=False)
    return v

missing = []
for ch in man["chunks"]:
    r, c = ch["row"], ch["col"]
    cands = glob.glob(rf"{CHUNKDIR}\painted_{mapId}_r{r}_c{c}.*")
    if not cands:
        missing.append(f"painted_{mapId}_r{r}_c{c}.*"); continue
    path = cands[0]
    x0, y0, x1, y1 = ch["x0"], ch["y0"], ch["x1"], ch["y1"]
    tw, th = (x1 - x0) * TARGET, (y1 - y0) * TARGET
    img = Image.open(path).convert("RGB").resize((tw, th), Image.LANCZOS)
    arr = np.asarray(img, dtype=np.float64)
    # 이웃 있는 변에만 페더 (맵 가장자리는 풀 불투명)
    wx = ramp(tw, feather if c > 0 else 0, feather if c < COLS - 1 else 0)
    wy = ramp(th, feather if r > 0 else 0, feather if r < ROWS - 1 else 0)
    w = (wy[:, None] * wx[None, :])[:, :, None]  # (th,tw,1)
    px0, py0 = x0 * TARGET, y0 * TARGET
    acc[py0:py0 + th, px0:px0 + tw] += arr * w
    wsum[py0:py0 + th, px0:px0 + tw] += w
    print(f"  painted_r{r}_c{c}  -> 월드 [{px0}:{px0+tw}]×[{py0}:{py0+th}]")

if missing:
    print("\n⚠ 누락 조각:", ", ".join(missing))
    print("  (모든 조각이 있어야 합쳐집니다 — docs/art/chunks/ 에 painted_r{r}_c{c}.png 채우기)")
    sys.exit(1)

wsum[wsum == 0] = 1
out = (acc / wsum).clip(0, 255).astype("uint8")
res = Image.fromarray(out, "RGB")
outpath = rf"{ROOT}\apps\web\public\assets\maps\{mapId}.webp"
res.save(outpath, "WEBP", quality=88, method=6)
print(f"\n합쳐짐: {outpath}  {outW}×{outH}px  ({os.path.getsize(outpath)//1024}KB)")
