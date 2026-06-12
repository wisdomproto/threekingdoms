#!/usr/bin/env python3
"""
스프라이트 시트 슬라이스 파이프라인 (멱등 재실행 가능)
설계: docs/superpowers/specs/2026-06-12-renderer-v0-design.md §2.2 (TextureResolver 교체점)

입력: docs/art/*.png (선정된 스프라이트 시트만)
출력: apps/web/public/assets/sprites/{spriteId}/{front|back}_{idle|move|attack}.png
      apps/web/public/assets/sprites/manifest.json

알고리즘:
  1) 흰 배경 → 알파 (near-white threshold + 엣지 알파 그라데이션)
  2) 연결 성분 기반 6개 블롭 클러스터 검출
     실패 시 → 2×3 균등 격자 폴백
  3) crop + 192px 높이 다운스케일 (발 기준 앵커)
  4) 파일 출력 + manifest.json 갱신

실행: python3 tools/sprite-pipeline/slice_sheets.py
      (PYTHON_PATH 변수가 맞지 않으면 직접 경로로 실행)
"""

import sys
import json
import os
import math
from pathlib import Path

from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage  # type: ignore[import]

# ── 경로 설정 ────────────────────────────────────────────────────────────────
REPO = Path(__file__).resolve().parent.parent.parent  # C:/project/threekingdoms
ART_DIR = REPO / "docs" / "art"
OUT_BASE = REPO / "apps" / "web" / "public" / "assets" / "sprites"
MANIFEST_PATH = OUT_BASE / "manifest.json"

# 출력 높이 (렌더러에서 축소 — 고해상도 보존)
TARGET_HEIGHT = 192

# 흰 배경 제거 threshold (0~255, 높을수록 더 많이 제거)
WHITE_THRESHOLD = 245
# 엣지 알파 그라데이션 폭 (픽셀)
EDGE_FADE = 4

# ── 시트 카탈로그 ─────────────────────────────────────────────────────────────
# spriteId: (source_file, grid_cols, grid_rows, pose_order)
# pose_order: 6원소 리스트 — 격자 상단 행부터 좌→우, 하단 행 좌→우 순
#   각 원소: (view, pose)  view="front"|"back", pose="idle"|"move"|"attack"
#
# 네임드 시트: 1536×1024, 상단=front 3포즈, 하단=back 3포즈
# B-2 시트: 1024×1536, 행별로 병종(footman/archer/lightCavalry) × 열(idle/attack)
#   → B-2는 단일 파일에서 3병종을 동시 추출하는 특수 처리

NAMED_POSE_ORDER = [
    ("front", "idle"),
    ("front", "move"),
    ("front", "attack"),
    ("back",  "idle"),
    ("back",  "move"),
    ("back",  "attack"),
]

# B-2 시트: 2열×3행. 행=병종(footman/archer/lightCavalry), 열=idle/attack
# move 포즈는 미생성이므로 idle을 move로도 사용
B2_GRID_ROWS = 3
B2_GRID_COLS = 2
B2_ROW_CLASSES = ["footman", "archer", "lightCavalry"]
B2_COL_POSES   = ["idle", "attack"]   # move 없음 → idle 복사

SHEETS: list[dict] = [
    # ── 네임드 캐릭터 ──────────────────────────────────────────────────────
    {
        "spriteId": "guanyu",
        "source":   "A-3_ink_01.png",
        "cols": 3, "rows": 2,
        "pose_order": NAMED_POSE_ORDER,
        "type": "named",
    },
    {
        "spriteId": "liubei",
        "source":   "B-5a_ink_02.png",
        "cols": 3, "rows": 2,
        "pose_order": NAMED_POSE_ORDER,
        "type": "named",
    },
    {
        "spriteId": "zhangfei",
        "source":   "B-5b_ink_01.png",
        "cols": 3, "rows": 2,
        "pose_order": NAMED_POSE_ORDER,
        "type": "named",
    },
    {
        "spriteId": "lvbu",
        "source":   "B-5c_ink_02.png",
        "cols": 3, "rows": 2,
        "pose_order": NAMED_POSE_ORDER,
        "type": "named",
    },
    {
        "spriteId": "huaxiong",
        "source":   "B-5d_ink_01.png",
        "cols": 3, "rows": 2,
        "pose_order": NAMED_POSE_ORDER,
        "type": "named",
    },
    # ── 병종 템플릿 — 아군(player) ───────────────────────────────────────
    {
        "spriteId": "_multi_player",   # 내부 태그 — 아래서 3종 spriteId로 분해
        "source":   "B-2_ink_01.png",
        "cols": B2_GRID_COLS, "rows": B2_GRID_ROWS,
        "type": "template_player",
        "faction": "player",
    },
    # ── 병종 템플릿 — 동탁군(enemy) ──────────────────────────────────────
    {
        "spriteId": "_multi_enemy",
        "source":   "B-2_ink_03.png",
        "cols": B2_GRID_COLS, "rows": B2_GRID_ROWS,
        "type": "template_enemy",
        "faction": "enemy",
    },
]


# ── 알파 변환 ─────────────────────────────────────────────────────────────────
def remove_white_bg(img_rgb: Image.Image) -> Image.Image:
    """흰 배경 제거 + 엣지 알파 그라데이션 softening.
    반환: RGBA 이미지
    """
    arr = np.array(img_rgb, dtype=np.float32)   # H×W×3
    # 각 픽셀이 white에 얼마나 가까운지: max(R,G,B) ≥ threshold면 배경
    whiteness = arr.min(axis=2)                  # min channel
    # alpha: whiteness < threshold → 불투명, 그 이상 → 투명
    raw_alpha = np.clip((WHITE_THRESHOLD - whiteness) / WHITE_THRESHOLD * 255, 0, 255).astype(np.uint8)

    # 엣지 그라데이션: 알파 채널을 살짝 blur해서 프린지 완화
    alpha_img = Image.fromarray(raw_alpha, mode="L")
    blurred   = alpha_img.filter(ImageFilter.GaussianBlur(radius=EDGE_FADE / 2))
    # 원본 알파와 blurred를 혼합 (안쪽 픽셀은 original 우선, 가장자리는 blur)
    alpha_arr = np.array(alpha_img, dtype=np.float32)
    blur_arr  = np.array(blurred,   dtype=np.float32)
    # 소프트 마스크: alpha가 낮은 곳(경계)에 blur 적용
    weight = alpha_arr / 255.0
    final_alpha = (alpha_arr * weight + blur_arr * (1 - weight)).clip(0, 255).astype(np.uint8)

    rgba = Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")
    rgba.putalpha(Image.fromarray(final_alpha, "L"))
    return rgba


# ── 블롭 검출 ─────────────────────────────────────────────────────────────────
def detect_blobs(rgba: Image.Image, n_expected: int) -> list[tuple[int,int,int,int]] | None:
    """알파 마스크에서 연결 성분 기반 n_expected개 블롭의 bounding box를 반환.
    실패(개수 불일치) 시 None 반환 → 균등 격자 폴백.
    반환 순서: 행 우선(top→bottom, left→right) — 시트 포즈 순서와 일치.
    """
    alpha = np.array(rgba.split()[3])            # H×W
    binary = (alpha > 20).astype(np.uint8)

    # 소형 노이즈 제거: erosion 1px
    struct = ndimage.generate_binary_structure(2, 2)
    cleaned = ndimage.binary_erosion(binary, structure=struct, iterations=1)
    # 팽창으로 근접 픽셀 연결
    dilated = ndimage.binary_dilation(cleaned, structure=struct, iterations=6)

    labeled, num = ndimage.label(dilated)
    if num < n_expected:
        return None  # 검출 실패

    # 각 레이블의 bounding box 및 넓이
    sizes = ndimage.sum(binary, labeled, range(1, num + 1))
    # 상위 n_expected개 (크기 내림차순)
    top_labels = sorted(range(1, num + 1), key=lambda i: -sizes[i - 1])[:n_expected]

    bboxes = []
    for lbl in top_labels:
        rows, cols = np.where(labeled == lbl)
        r0, r1 = int(rows.min()), int(rows.max())
        c0, c1 = int(cols.min()), int(cols.max())
        bboxes.append((c0, r0, c1, r1))   # (left, top, right, bottom)

    # 행 우선 정렬
    bboxes.sort(key=lambda b: (round(b[1] / 100) * 10000 + b[0]))   # coarse row then col
    return bboxes


def uniform_grid_bboxes(img: Image.Image, cols: int, rows: int) -> list[tuple[int,int,int,int]]:
    """균등 격자 폴백. 반환 순서: 행 우선 (상→하, 좌→우)."""
    W, H = img.size
    cell_w = W // cols
    cell_h = H // rows
    boxes = []
    for r in range(rows):
        for c in range(cols):
            boxes.append((c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h))
    return boxes


# ── 컷 crop + 리사이즈 ───────────────────────────────────────────────────────
def crop_and_scale(rgba: Image.Image, bbox: tuple[int,int,int,int], target_h: int) -> Image.Image:
    """bbox 영역을 crop하고 높이=target_h로 aspect-ratio 유지 다운스케일."""
    left, top, right, bottom = bbox
    # 여백 10%
    pw = int((right - left) * 0.05)
    ph = int((bottom - top) * 0.05)
    left   = max(0, left   - pw)
    top    = max(0, top    - ph)
    right  = min(rgba.width,  right  + pw)
    bottom = min(rgba.height, bottom + ph)

    cropped = rgba.crop((left, top, right, bottom))
    cw, ch = cropped.size
    if ch == 0:
        return rgba.crop((0, 0, 1, 1))  # 방어

    scale = target_h / ch
    new_w = max(1, round(cw * scale))
    return cropped.resize((new_w, target_h), Image.LANCZOS)


# ── 단일 네임드 시트 처리 ────────────────────────────────────────────────────
def process_named_sheet(sheet: dict, out_dir: Path) -> dict:
    """네임드 캐릭터 시트를 6포즈로 슬라이스하고 파일 저장.
    manifest entry를 반환.
    """
    src_path = ART_DIR / sheet["source"]
    sprite_id = sheet["spriteId"]
    cols, rows = sheet["cols"], sheet["rows"]
    pose_order: list[tuple[str, str]] = sheet["pose_order"]
    n_cuts = cols * rows

    print(f"\n[{sprite_id}] 처리 중: {sheet['source']}")

    img_rgb = Image.open(src_path).convert("RGB")
    rgba = remove_white_bg(img_rgb)

    # 블롭 검출 시도
    bboxes = detect_blobs(rgba, n_cuts)
    method = "blob"
    if bboxes is None or len(bboxes) != n_cuts:
        print(f"  경고: 블롭 검출 실패 ({len(bboxes) if bboxes else 0}개) → 균등 격자 폴백")
        bboxes = uniform_grid_bboxes(rgba, cols, rows)
        method = "grid_fallback"

    sprite_dir = out_dir / sprite_id
    sprite_dir.mkdir(parents=True, exist_ok=True)

    saved_poses = []
    for i, (bbox, (view, pose)) in enumerate(zip(bboxes, pose_order)):
        cut = crop_and_scale(rgba, bbox, TARGET_HEIGHT)
        fname = f"{view}_{pose}.png"
        cut.save(sprite_dir / fname, "PNG")
        saved_poses.append(f"{view}_{pose}")
        print(f"  [{i+1}/{n_cuts}] {fname}  ({cut.size[0]}×{cut.size[1]}px)")

    print(f"  방법: {method}  →  {n_cuts}컷 저장 완료")
    return {
        "spriteId": sprite_id,
        "source": sheet["source"],
        "method": method,
        "poses": saved_poses,
    }


# ── 병종 템플릿 시트 처리 ────────────────────────────────────────────────────
def process_template_sheet(sheet: dict, out_dir: Path) -> list[dict]:
    """B-2 형식: 3행(병종) × 2열(포즈) — 3개의 spriteId({class}_{faction})로 분해.
    move 포즈는 idle로 복사.
    """
    src_path = ART_DIR / sheet["source"]
    faction = sheet["faction"]
    cols, rows = sheet["cols"], sheet["rows"]   # 2, 3
    n_cuts = cols * rows   # 6

    print(f"\n[template_{faction}] 처리 중: {sheet['source']}")

    img_rgb = Image.open(src_path).convert("RGB")
    rgba = remove_white_bg(img_rgb)

    # 균등 격자 폴백 우선 — 각 행이 독립 병종이라 블롭 검출이 행 경계를 정확히 못 자름
    bboxes = uniform_grid_bboxes(rgba, cols, rows)
    method = "grid"

    # 블롭 검출 시도 후 결과가 정확히 6개면 교체
    blobs = detect_blobs(rgba, n_cuts)
    if blobs and len(blobs) == n_cuts:
        bboxes = blobs
        method = "blob"

    results = []
    for row_idx, class_id in enumerate(B2_ROW_CLASSES):
        sprite_id = f"{class_id}_{faction}"
        sprite_dir = out_dir / sprite_id
        sprite_dir.mkdir(parents=True, exist_ok=True)

        saved_poses = []
        for col_idx, pose_name in enumerate(B2_COL_POSES):
            flat_idx = row_idx * cols + col_idx
            bbox = bboxes[flat_idx]
            for view in ("front", "back"):
                # B-2는 front 방향만 생성됨 — back은 미러링으로 처리 (파일 저장은 front만)
                # 렌더러에서 scale.x 미러링으로 back을 구현하므로 front만 저장
                pass

            bbox = bboxes[flat_idx]
            cut = crop_and_scale(rgba, bbox, TARGET_HEIGHT)

            # front 포즈 저장
            fname_front = f"front_{pose_name}.png"
            cut.save(sprite_dir / fname_front, "PNG")
            saved_poses.append(f"front_{pose_name}")
            print(f"  {sprite_id} [{pose_name}] front  ({cut.size[0]}×{cut.size[1]}px)")

        # move 포즈 = idle 복사 (front만)
        idle_path = sprite_dir / "front_idle.png"
        if idle_path.exists():
            import shutil
            shutil.copy(idle_path, sprite_dir / "front_move.png")
            saved_poses.append("front_move")
            print(f"  {sprite_id} move → idle 복사")

        print(f"  방법: {method}")
        results.append({
            "spriteId": sprite_id,
            "source": sheet["source"],
            "method": method,
            "poses": saved_poses,
            "note": "back_view=front_mirror (scale.x flip in renderer)",
        })

    return results


# ── 메인 ─────────────────────────────────────────────────────────────────────
def main() -> None:
    # scipy 필요 여부 체크
    try:
        from scipy import ndimage as _  # noqa: F401
    except ImportError:
        print("scipy 없음 — 균등 격자 폴백만 사용합니다.")
        print("  설치: pip install scipy")

    OUT_BASE.mkdir(parents=True, exist_ok=True)

    manifest_entries: list[dict] = []
    failures: list[str] = []

    for sheet in SHEETS:
        try:
            if sheet["type"] == "named":
                entry = process_named_sheet(sheet, OUT_BASE)
                manifest_entries.append(entry)
            elif sheet["type"] in ("template_player", "template_enemy"):
                entries = process_template_sheet(sheet, OUT_BASE)
                manifest_entries.extend(entries)
        except Exception as e:
            print(f"  오류: {sheet['source']} — {e}")
            failures.append(f"{sheet['source']}: {e}")

    # manifest.json 갱신
    manifest: dict[str, dict] = {}
    for entry in manifest_entries:
        sid = entry["spriteId"]
        manifest[sid] = {
            "poses": entry["poses"],
            "source": entry["source"],
            "method": entry.get("method", "unknown"),
        }
        if "note" in entry:
            manifest[sid]["note"] = entry["note"]

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\nmanifest.json 갱신: {MANIFEST_PATH}")
    print(f"  등록된 spriteId: {len(manifest)}개")

    if failures:
        print("\n=== 슬라이스 실패 목록 ===")
        for f in failures:
            print(f"  FAIL: {f}")
    else:
        print("\n모든 시트 슬라이스 완료 (실패 없음)")

    print("\n=== spriteId 목록 ===")
    for sid in manifest:
        poses = manifest[sid]["poses"]
        print(f"  {sid}: {poses}")


if __name__ == "__main__":
    # scipy 없을 경우 더미 대체
    try:
        from scipy import ndimage
    except ImportError:
        import types
        ndimage = types.ModuleType("ndimage")  # type: ignore[assignment]

        def _label_fallback(arr):
            return arr, 0
        def _sum_fallback(input, labels, index):
            return []
        def _erosion_fallback(arr, structure=None, iterations=1):
            return arr
        def _dilation_fallback(arr, structure=None, iterations=1):
            return arr
        def _structure_fallback(rank, connectivity):
            return np.ones((3,3), dtype=bool)

        ndimage.label = _label_fallback               # type: ignore[attr-defined]
        ndimage.sum = _sum_fallback                   # type: ignore[attr-defined]
        ndimage.binary_erosion = _erosion_fallback    # type: ignore[attr-defined]
        ndimage.binary_dilation = _dilation_fallback  # type: ignore[attr-defined]
        ndimage.generate_binary_structure = _structure_fallback  # type: ignore[attr-defined]

    main()
