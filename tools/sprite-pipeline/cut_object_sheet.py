# -*- coding: utf-8 -*-
"""맵 오브젝트 시트(K-4 성곽 등) → /assets/objects/{key}.png 고정격자 컷.

설계: docs/superpowers/specs/2026-06-21-hybrid-map-rendering-design.md (Chunk 3 컷 도구).
에셋보드 「K. 지형」의 오브젝트 시트(top-down, 한 장 N조각)를 고정 RxC 격자로 잘라
ObjectLayer가 읽는 키(`wall_*`, `gate_*`, …)별 PNG로 저장한다. 각 칸은 알파 bbox로 투명 테두리 트림.

⚠ 격자 배열(행×열)은 생성 결과에 따라 다르므로 --grid 로 조정. 기본 K-4 = 3행×4열(12칸).
   생성된 실제 시트를 보고 --grid 와 키 순서를 맞춘다(cut_posesheet 의 grid 교훈 — 실물에 맞춰 튜닝).

키 매핑(시트별, 행-우선 = 좌→우, 위→아래):
  k4 (성곽, 3×4): wall_straight, wall_corner, wall_tee, wall_cross,
                  wall_end, wall_battlement, wall_breached, gate_closed,
                  gate_open, gate_destroyed, fort_tower, fort_gatehouse
   + wall_single 폴백 = wall_end 복사(고립 벽). ObjectLayer 요청 키(wall_single/end/straight/corner/
   tee/cross + gate_closed/open/destroyed)를 전부 충족. 나머지(battlement/breached/fort_*)는 후속용 보관.

사용: python cut_object_sheet.py <시트이미지경로> [--sheet k4] [--grid 3x4]
  예: python cut_object_sheet.py downloads/k4.png            (기본 k4, 3x4)
      python cut_object_sheet.py downloads/k4.png --grid 4x3 (모델이 4행3열로 냈을 때)
"""
import sys, os
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OBJECTS = os.path.join(ROOT, "apps", "web", "public", "assets", "objects")

KEYMAPS = {
    # K-4 성곽 — ObjectLayer 요청 키(wall_*, gate_*) + 후속 보관(battlement/breached/fort_*)
    "k4": [
        "wall_straight", "wall_corner", "wall_tee", "wall_cross",
        "wall_end", "wall_battlement", "wall_breached", "gate_closed",
        "gate_open", "gate_destroyed", "fort_tower", "fort_gatehouse",
    ],
    # K-5 진영(데코) — 후속(ObjectLayer 데코 경로/decorations 에서 사용)
    "k5": [
        "palisade_straight", "palisade_corner", "abatis", "bamboo_fence",
        "camp_gate", "banner_command", "pennants", "signal_flag",
        "sandbags", "supply_cart", "campfire", "brazier",
    ],
}
# 고립 벽(mask 0)용 wall_single 은 시트에 없음 → wall_end 복사로 폴백
FALLBACK_COPY = {"wall_single": "wall_end"}


def cut(sheet_path, keys, rows, cols):
    im = Image.open(sheet_path).convert("RGBA")
    W, H = im.size
    cw, ch = W // cols, H // rows
    print(f"{os.path.basename(sheet_path)}: {W}x{H} → 격자 {rows}x{cols} (칸 {cw}x{ch})")
    os.makedirs(OBJECTS, exist_ok=True)
    saved = []
    for i, key in enumerate(keys):
        if i >= rows * cols:
            break
        r, c = divmod(i, cols)
        cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        bbox = cell.split()[3].getbbox()  # 알파 bbox → 투명 테두리 트림
        if bbox:
            cell = cell.crop(bbox)
        out = os.path.join(OBJECTS, f"{key}.png")
        cell.save(out)
        saved.append((key, cell.size))
        print(f"  → {key}.png  {cell.size}")
    # 폴백 복사
    for dst, src in FALLBACK_COPY.items():
        src_path = os.path.join(OBJECTS, f"{src}.png")
        if os.path.exists(src_path):
            Image.open(src_path).save(os.path.join(OBJECTS, f"{dst}.png"))
            saved.append((f"{dst}(={src})", None))
            print(f"  → {dst}.png  (폴백: {src} 복사)")
    return saved


def main():
    args = sys.argv[1:]
    sheet = "k4"
    grid = None
    pos = []
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--sheet":
            sheet = args[i + 1]; i += 2
        elif a == "--grid":
            grid = args[i + 1]; i += 2
        elif a.startswith("--grid="):
            grid = a.split("=", 1)[1]; i += 1
        else:
            pos.append(a); i += 1
    if not pos:
        print("사용: python cut_object_sheet.py <시트이미지> [--sheet k4|k5] [--grid 3x4]"); sys.exit(1)
    path = pos[0]
    if not os.path.exists(path):
        print(f"시트 이미지 없음: {path}"); sys.exit(1)
    keys = KEYMAPS.get(sheet)
    if not keys:
        print(f"알 수 없는 --sheet: {sheet} (가능: {', '.join(KEYMAPS)})"); sys.exit(1)
    if grid:
        rows, cols = (int(x) for x in grid.lower().split("x"))
    else:
        # 기본: 키 수에 맞춘 3행 × ceil(n/3)열
        n = len(keys); cols = (n + 2) // 3; rows = (n + cols - 1) // cols
    cut(path, keys, rows, cols)
    print(f"\n저장 위치: {OBJECTS}")
    print("게임 하드리프레시 시 ObjectLayer 가 wall_*/gate_* 를 자동 로드해 표시.")


if __name__ == "__main__":
    main()
