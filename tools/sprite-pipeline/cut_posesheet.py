# -*- coding: utf-8 -*-
"""포즈 시트 → 베이크 프레임 컷 (CLAUDE.md §4: v1 비주얼 = 완성형 베이크 포즈 프레임).

에셋 보드 「베이크 포즈시트」 탭의 📤 시트 넘기기가 저장한
  apps/web/public/assets/sprites/{spriteId}/_posesheet.png
를 읽어 3행(승급 등급) × 3열(포즈) 격자를 분리·크롭해
  tier1: front_idle.png / front_move.png / front_attack.png  (루트, 하위호환)
  tier2: t2/front_idle.png / t2/front_move.png / t2/front_attack.png
  tier3: t3/front_idle.png / t3/front_move.png / t3/front_attack.png
로 저장하고 manifest.json에 tier1(루트) 포즈만 등록한다.
단일 행 시트(구형 1×3)는 전부 tier1/루트로 저장(하위호환).

방향: SD 스프라이트는 facing=screen-left 고정(CLAUDE.md §4/§7, 코드 미러링 기준).
  이미지 모델이 좌/우를 자주 반전하므로 시트가 오른쪽 바라보기로 나오면 --flip 으로
  셀별 좌우 반전해 왼쪽 기준에 맞춘다(칸 위치로 포즈를 판정하므로 매핑은 불변).

격자: 기본은 간격 감지(detect_grid). 9칸 시트가 빽빽해(말·전차) 칸 사이 투명 간격을
  못 찾으면 통짜 1칸이 되는데, 정사각 대형 시트면 자동으로 3×3 고정 격자로 폴백한다.
  `--grid=3x3` 으로 감지를 건너뛰고 고정 균등 분할(+칸별 투명 트림)을 강제할 수도 있다.

사용: python cut_posesheet.py <spriteId> [pose1 pose2 ...] [--flip] [--grid=3x3]
  예: python cut_posesheet.py guanyu                 (왼쪽 바라보기 시트, 감지)
      python cut_posesheet.py guanyu --flip          (오른쪽 바라보기 시트를 뒤집어 컷)
      python cut_posesheet.py guanyu --grid=3x3 --flip  (3×3 고정 격자 강제 + 뒤집기)
"""
import sys, os, json
from PIL import Image

# Derive ROOT from this file's location: sprite-pipeline → tools → repo root
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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


def row_filled(im, alpha_min=20):
    """Y축 방향: 각 행(y)에 불투명 픽셀이 있으면 True."""
    W, H = im.size
    px = im.load()
    rows = []
    for y in range(H):
        filled = False
        for x in range(0, W, 2):  # 2픽셀 샘플(속도)
            if px[x, y][3] > alpha_min:
                filled = True
                break
        rows.append(filled)
    return rows


def detect_grid(im):
    """2D 격자 감지. 반환: rows(위→아래) 리스트, 각 row = [(x0,y0,x1,y1), ...] 절대좌표."""
    W, H = im.size
    min_row_gap = max(8, H // 40)
    row_bands = split_bands(row_filled(im), min_row_gap)
    row_bands = [b for b in row_bands if (b[1] - b[0]) > H * 0.04]

    grid = []
    for ry0, ry1 in row_bands:
        strip = im.crop((0, ry0, W, ry1))
        min_col_gap = max(8, W // 40)
        col_bands = split_bands(column_filled(strip), min_col_gap)
        col_bands = [b for b in col_bands if (b[1] - b[0]) > W * 0.04]
        row_cells = []
        for cx0, cx1 in col_bands:
            # y_bounds 적용해 셀 내 실제 불투명 y범위 구하기 (strip 기준)
            local_y0, local_y1 = y_bounds(strip, cx0, cx1)
            abs_y0 = ry0 + local_y0
            abs_y1 = ry0 + local_y1
            row_cells.append((cx0, abs_y0, cx1, abs_y1))
        if row_cells:
            grid.append(row_cells)
    return grid


def cut_sheet(im, poses, flip=False):
    """포즈 시트를 격자로 잘라 (tier_index, pose_name, crop_image) 리스트 반환.

    tier_index: 0=tier1(루트), 1=tier2, 2=tier3 (행 순서)
    단일 행이면 전부 tier_index=0 (하위호환).
    flip=True 면 각 셀을 좌우 반전(screen-right → screen-left). 셀 위치로 포즈를
      판정하므로 칸 안 그림만 미러되고 idle/move/attack 매핑은 불변.
    """
    grid = detect_grid(im)
    result = []
    for row_idx, row_cells in enumerate(grid):
        tier_idx = row_idx  # 0-based: 행0→tier1, 행1→tier2, 행2→tier3
        n = min(len(row_cells), len(poses))
        for col_idx in range(n):
            x0, y0, x1, y1 = row_cells[col_idx]
            crop = im.crop((x0, y0, x1, y1))
            if flip:
                crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
            result.append((tier_idx, poses[col_idx], crop))
    return result


def cut_fixed_grid(im, poses, rows, cols, flip=False):
    """고정 균등 격자(rows×cols)로 분할 + 칸별 투명여백 트림.

    9칸 시트는 항상 3×3 균등 격자(프롬프트 보장)라, 칸이 빽빽해 간격 감지(detect_grid)가
    실패할 때(말·전차 등) 이 고정 분할이 안정적이다. 각 칸을 W/cols × H/rows 로 나눈 뒤
    알파 bbox 로 투명 테두리를 잘라낸다. flip=True 면 칸별 좌우 반전(포즈 매핑 불변).
    """
    W, H = im.size
    cw, ch = W // cols, H // rows
    result = []
    for r in range(rows):
        for c in range(min(cols, len(poses))):
            cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            bbox = cell.split()[3].getbbox()  # 알파 채널 bbox → 투명 테두리 트림
            if bbox:
                cell = cell.crop(bbox)
            if flip:
                cell = cell.transpose(Image.FLIP_LEFT_RIGHT)
            result.append((r, poses[c], cell))
    return result


TIER_SUBDIR = {0: "", 1: "t2", 2: "t3"}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    raw = sys.argv[1:]
    flip = "--flip" in raw
    grid = None
    for a in raw:
        if a.startswith("--grid="):
            gv = a.split("=", 1)[1].lower()
            try:
                rr, cc = (int(x) for x in gv.split("x"))
                grid = (rr, cc)
            except ValueError:
                print(f"--grid 형식 오류: {a} (예: --grid=3x3)"); sys.exit(1)
    args = [a for a in raw if not a.startswith("--")]
    if not args:
        print("사용: python cut_posesheet.py <spriteId> [poses...] [--flip] [--grid=3x3]"); sys.exit(1)
    sid = args[0]
    poses = args[1:] or DEFAULT_POSES
    d = os.path.join(SPRITES, sid)
    sheet = os.path.join(d, "_posesheet.png")
    if not os.path.exists(sheet):
        print(f"포즈 시트 없음: {sheet} (보드에서 📤 시트 넘기기 먼저)"); sys.exit(1)

    im = Image.open(sheet).convert("RGBA")
    W, H = im.size
    print(f"{sid}: {W}x{H}{'  [--flip 좌우반전→screen-left]' if flip else ''}")

    if grid:
        cells = cut_fixed_grid(im, poses, grid[0], grid[1], flip)
        print(f"  고정 격자 {grid[0]}x{grid[1]} → {len(cells)}칸")
    else:
        cells = cut_sheet(im, poses, flip)
        # 빽빽한 9칸 시트는 간격 감지가 실패해 통짜 1칸이 되곤 한다 → 정사각 대형 시트면 3×3 폴백
        if len(cells) == 1 and min(W, H) >= 512 and 0.9 <= W / H <= 1.1:
            print("  ⚠ 간격 감지 1칸(통짜) — 정사각 대형 시트라 3x3 고정 격자로 폴백")
            cells = cut_fixed_grid(im, poses, 3, 3, flip)
        print(f"  검출 셀 {len(cells)}개")

    tier1_poses = []
    for tier_idx, pose, crop in cells:
        subdir = TIER_SUBDIR.get(tier_idx, f"t{tier_idx + 1}")
        if subdir:
            outdir = os.path.join(d, subdir)
            os.makedirs(outdir, exist_ok=True)
        else:
            outdir = d
        name = f"front_{pose}.png"
        crop.save(os.path.join(outdir, name))
        tier_label = f"tier{tier_idx + 1}" if subdir else "tier1(root)"
        print(f"  → [{tier_label}] {os.path.join(subdir, name) if subdir else name}  {crop.size}")
        if tier_idx == 0:
            tier1_poses.append(f"front_{pose}")

    # manifest 등록 — tier1(루트) 포즈만
    man_path = os.path.join(SPRITES, "manifest.json")
    man = {}
    if os.path.exists(man_path):
        with open(man_path, encoding="utf-8") as f:
            man = json.load(f)
    entry = man.get(sid, {})
    existing = set(entry.get("poses", []))
    existing.update(tier1_poses)
    entry["poses"] = sorted(existing)
    entry["source"] = "_posesheet.png"
    entry["method"] = "cut_posesheet.py"
    man[sid] = entry
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=2)
    print(f"manifest 등록: {sid} → {entry['poses']}")
    print("게임 새로고침 시 반영. 배포본 반영은 python tools/upload-assets.py")


if __name__ == "__main__":
    main()
