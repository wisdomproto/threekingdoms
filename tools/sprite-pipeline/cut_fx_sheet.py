# -*- coding: utf-8 -*-
"""발광 이펙트 시트(검은 배경) → /assets/fx/{key}.png 휘도 컷.

검은배경 = additive 렌더에서 무가산이라 알파 제거 안 함(검정 유지). 요소 경계 검출은
'알파=휘도' 프록시로 만들어 cut_posesheet.detect_grid(알파>20 기반)를 재사용한 뒤,
박스를 *원본*(검정 유지)에서 크롭한다. 격자 감지 실패 시 --grid RxC 고정 폴백.

사용: python cut_fx_sheet.py <시트경로> --keys slash,sparkle,flash,smoke,coin[,pierce] [--grid 2x3]
"""
import sys, os
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_posesheet import detect_grid

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FX_DIR = os.path.join(ROOT, "apps", "web", "public", "assets", "fx")


def luminance_alpha(im):
    """검은배경 RGB → RGBA, alpha=max(r,g,b)(휘도). detect_grid가 쓰는 알파 채널 생성용."""
    rgb = im.convert("RGB")
    W, H = rgb.size
    out = Image.new("RGBA", (W, H))
    sp = rgb.load(); dp = out.load()
    for y in range(H):
        for x in range(W):
            r, g, b = sp[x, y]
            dp[x, y] = (r, g, b, max(r, g, b))
    return out


def cut_cells(im, keys, grid=None):
    """(key, RGB크롭) 리스트(행-우선). grid=(rows,cols)면 고정분할, 아니면 휘도 감지."""
    rgb = im.convert("RGB")
    if grid:
        rows, cols = grid
        W, H = rgb.size; cw, ch = W // cols, H // rows
        boxes = [(c*cw, r*ch, (c+1)*cw, (r+1)*ch) for r in range(rows) for c in range(cols)]
    else:
        proxy = luminance_alpha(rgb)
        boxes = [b for row in detect_grid(proxy) for b in row]  # 행-우선
    out = []
    for i, key in enumerate(keys):
        if i >= len(boxes):
            break
        out.append((key, rgb.crop(boxes[i])))
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    keys, grid, path = None, None, None
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--keys": keys = args[i+1].split(","); i += 2
        elif a == "--grid": grid = tuple(int(x) for x in args[i+1].lower().split("x")); i += 2
        else: path = a; i += 1
    if not path or not keys:
        print("사용: python cut_fx_sheet.py <시트> --keys slash,sparkle,flash,smoke,coin [--grid 2x3]"); sys.exit(1)
    if not os.path.exists(path):
        print(f"시트 없음: {path}"); sys.exit(1)
    im = Image.open(path)
    cells = cut_cells(im, keys, grid)
    os.makedirs(FX_DIR, exist_ok=True)
    for key, crop in cells:
        crop.save(os.path.join(FX_DIR, f"{key}.png"))
        print(f"  → {key}.png  {crop.size}")
    print(f"\n저장: {FX_DIR}  ({len(cells)}/{len(keys)})")
    print("게임 하드리프레시 시 FxLayer가 additive로 표시(미보유 키는 절차적 폴백).")


if __name__ == "__main__":
    main()
