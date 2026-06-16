# -*- coding: utf-8 -*-
"""포즈 시트 → 베이크 프레임 컷 (CLAUDE.md §4: v1 비주얼 = 완성형 베이크 포즈 프레임).

에셋 보드 「베이크 포즈시트」 탭의 📤 시트 넘기기가 저장한
  apps/web/public/assets/sprites/{spriteId}/_posesheet.png
를 읽어 가로로 나열된 포즈들을 **투명 X축 간격**으로 분리·크롭해
  front_idle.png / front_move.png / front_attack.png
로 저장하고 manifest.json에 등록한다. (좌→우 = idle, move, attack 순)

사용: python cut_posesheet.py <spriteId> [pose1 pose2 ...]
  예: python cut_posesheet.py guanyu
"""
import sys, os, json
from PIL import Image

ROOT = r"C:\project\threekingdoms"
SPRITES = os.path.join(ROOT, "apps", "web", "public", "assets", "sprites")
DEFAULT_POSES = ["idle", "move", "attack"]


def column_filled(im, alpha_min=20):
    W, H = im.size
    px = im.load()
    cols = []
    for x in range(W):
        filled = False
        for y in range(0, H, 2):  # 2픽셀 샘플(속도)
            if px[x, y][3] > alpha_min:
                filled = True
                break
        cols.append(filled)
    return cols


def split_bands(cols, min_gap):
    """채워진 열 구간(run)들을 [x0,x1)로. min_gap 미만의 빈틈은 같은 밴드로 잇는다."""
    bands = []
    x0 = None
    gap = 0
    for x, f in enumerate(cols):
        if f:
            if x0 is None:
                x0 = x
            gap = 0
            x1 = x + 1
        else:
            if x0 is not None:
                gap += 1
                if gap >= min_gap:
                    bands.append((x0, x1))
                    x0 = None
                    gap = 0
    if x0 is not None:
        bands.append((x0, x1))
    return bands


def y_bounds(im, x0, x1, alpha_min=20):
    px = im.load(); H = im.size[1]
    ymin, ymax = H, 0
    for y in range(H):
        for x in range(x0, x1):
            if px[x, y][3] > alpha_min:
                ymin = min(ymin, y); ymax = max(ymax, y); break
    return ymin, ymax + 1


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        print("사용: python cut_posesheet.py <spriteId> [poses...]"); sys.exit(1)
    sid = sys.argv[1]
    poses = sys.argv[2:] or DEFAULT_POSES
    d = os.path.join(SPRITES, sid)
    sheet = os.path.join(d, "_posesheet.png")
    if not os.path.exists(sheet):
        print(f"포즈 시트 없음: {sheet} (보드에서 📤 시트 넘기기 먼저)"); sys.exit(1)

    im = Image.open(sheet).convert("RGBA")
    W, H = im.size
    cols = column_filled(im)
    # 포즈 간 큰 간격만 분할(글자폭의 ~3% 이상 빈틈). 너무 잘게 쪼개지면 min_gap을 키운다.
    min_gap = max(8, W // 40)
    bands = split_bands(cols, min_gap)
    # 너비 너무 작은 밴드(노이즈) 제거
    bands = [b for b in bands if (b[1] - b[0]) > W * 0.04]
    print(f"{sid}: {W}x{H}, 검출 밴드 {len(bands)}개 (min_gap={min_gap})")
    for i, (x0, x1) in enumerate(bands):
        print(f"  band{i}: x{x0}-{x1} (w{x1-x0})")

    n = min(len(bands), len(poses))
    if len(bands) != len(poses):
        print(f"  ⚠ 밴드 {len(bands)} ≠ 포즈 {len(poses)} — 앞에서부터 {n}개만 매핑")

    saved = []
    for i in range(n):
        x0, x1 = bands[i]
        y0, y1 = y_bounds(im, x0, x1)
        crop = im.crop((x0, y0, x1, y1))
        name = f"front_{poses[i]}.png"
        crop.save(os.path.join(d, name))
        saved.append(f"front_{poses[i]}")
        print(f"  → {name}  {crop.size}")

    # manifest 등록
    man_path = os.path.join(SPRITES, "manifest.json")
    man = json.load(open(man_path, encoding="utf-8")) if os.path.exists(man_path) else {}
    entry = man.get(sid, {})
    existing = set(entry.get("poses", []))
    existing.update(saved)
    entry["poses"] = sorted(existing)
    entry["source"] = "_posesheet.png"
    entry["method"] = "cut_posesheet.py"
    man[sid] = entry
    json.dump(man, open(man_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"manifest 등록: {sid} → {entry['poses']}")
    print("게임 새로고침 시 반영. 배포본 반영은 python tools/upload-assets.py")


if __name__ == "__main__":
    main()
