#!/usr/bin/env python3
"""
아이소메트릭 타일/오브젝트 시트 슬라이스 (멱등 재실행 가능)
설계: docs/superpowers/specs/2026-06-12-renderer-v0-design.md §1 쿼터뷰 전환

입력: docs/art/B-3b_ink_01.png — 흰 배경, 12조각, 4×3 배치
  행1: 초지(지면) / 흙길_직선(지면) / 흙길_커브(지면) / 암산(오브젝트)
  행2: 소나무(오브젝트) / 수면(지면) / 목교(오브젝트) / 석벽(오브젝트)
  행3: 관문 요새(대형오브젝트) / 군막(오브젝트) / 초가(오브젝트) / 창고(오브젝트)

출력:
  apps/web/public/assets/iso/{name}.png
  apps/web/public/assets/iso/iso-manifest.json
    { name: { kind: "ground"|"object", w, h, footprint? } }

타겟 크기:
  지면 4종 (grass/road_straight/road_curve/river):
    다이아몬드 바닥만. 표준 2:1 아이소 비율로 정규화 → TILE_W=128, TILE_H=64
  오브젝트 8종 (mountain/tree/bridge/wall/gate/camp/hut/storehouse):
    바닥 다이아 포함 전체 크롭. 바닥 다이아 폭을 TILE_W 기준으로 정규화.
    gate는 ~2타일 폭 → footprint=2, 다른 것은 footprint=1.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from slice_sheets import remove_white_bg  # 흰 배경 키잉 재사용

# ── 경로 ──────────────────────────────────────────────────────────────────────
REPO = Path(__file__).resolve().parent.parent.parent
ART  = REPO / "docs" / "art"
OUT  = REPO / "apps" / "web" / "public" / "assets" / "iso"
SRC  = ART / "B-3b_ink_01.png"

# ── 렌더러 타겟 크기 (설계 §B 아이소 전환) ────────────────────────────────────
TILE_W = 128   # 에셋 해상도 — 렌더러는 64px(화면)로 표시
TILE_H = 64    # 2:1 다이아몬드 비율

# 흰 배경 threshold — remove_white_bg와 동일
WHITE_THRESHOLD = 245

# 오브젝트 crop 여백 (원본 px)
PAD = 8


# ── 알파 마스크 ───────────────────────────────────────────────────────────────
def get_alpha_mask(rgba: Image.Image, threshold: int = 20) -> np.ndarray:
    """RGBA 이미지에서 bool 마스크 (H×W). alpha > threshold = 전경."""
    return np.array(rgba.split()[3]) > threshold


# ── 존 내 전경 bbox (최대 연결 성분만) ──────────────────────────────────────
def crop_zone_bbox(
    mask: np.ndarray,
    zone: tuple[float, float, float, float],
    img_size: tuple[int, int],
    pad: int = PAD,
    dilation_iters: int = 6,
) -> tuple[int, int, int, int] | None:
    """
    mask(H×W bool), zone(상대좌표 x0,y0,x1,y1) 내에서 **최대 연결 성분**의 bbox를 반환.
    이웃 존에서 삐져나온 소형 조각을 자동 배제한다.
    없으면 None.
    """
    W, H = img_size
    x0 = int(zone[0] * W)
    y0 = int(zone[1] * H)
    x1 = int(zone[2] * W)
    y1 = int(zone[3] * H)
    sub = mask[y0:y1, x0:x1].copy()

    if not sub.any():
        return None

    # 팽창으로 가까운 픽셀을 연결한 뒤 라벨링 — 이웃 소형 블롭은 별도 성분으로 남는다
    struct = ndimage.generate_binary_structure(2, 2)
    dilated = ndimage.binary_dilation(sub, structure=struct, iterations=dilation_iters)
    labeled, num = ndimage.label(dilated)
    if num == 0:
        return None

    # 각 성분에서 원본 마스크 픽셀 수 기준으로 최대 성분 선택
    sizes = ndimage.sum(sub, labeled, range(1, num + 1))
    lbl = int(np.argmax(sizes)) + 1

    ys, xs = np.where((labeled == lbl) & sub)
    if len(ys) == 0:
        return None

    left   = max(0, x0 + int(xs.min()) - pad)
    top    = max(0, y0 + int(ys.min()) - pad)
    right  = min(W,  x0 + int(xs.max()) + pad)
    bottom = min(H,  y0 + int(ys.max()) + pad)
    return (left, top, right, bottom)


# ── 다이아몬드 폭 측정 ─────────────────────────────────────────────────────────
def measure_diamond_width(mask: np.ndarray) -> float:
    """
    2:1 아이소 다이아몬드의 실제 픽셀 폭을 측정.
    전략: 수평 row별 픽셀 수의 최댓값 = 다이아 최대 폭 (중간 row에서).
    """
    row_widths = []
    for row in mask:
        xs = np.where(row)[0]
        if len(xs) >= 2:
            row_widths.append(int(xs[-1]) - int(xs[0]) + 1)
    if not row_widths:
        return 1.0
    return float(max(row_widths))


# ── 지면 타일 정규화: TILE_W×TILE_H ──────────────────────────────────────────
def normalize_ground(cut: Image.Image) -> Image.Image:
    """
    지면 다이아몬드를 TILE_W×TILE_H로 정규화.
    다이아 폭 기준 스케일 → LANCZOS 리사이즈 후 TILE_W×TILE_H 캔버스에 중앙 배치.
    """
    alpha = np.array(cut.split()[3])
    mask  = alpha > 20

    dw = measure_diamond_width(mask)
    if dw < 1:
        dw = cut.width

    scale = TILE_W / dw
    new_w = max(1, round(cut.width  * scale))
    new_h = max(1, round(cut.height * scale))
    resized = cut.resize((new_w, new_h), Image.LANCZOS)

    # TILE_W×TILE_H 캔버스에 중앙(수평) / 하단(수직) 배치
    canvas = Image.new("RGBA", (TILE_W, TILE_H), (0, 0, 0, 0))
    ox = max(0, (TILE_W - new_w) // 2)
    oy = max(0, TILE_H - new_h)  # 아이소 다이아가 약간 위에 뜨는 경우 하단 정렬
    # 실제로 new_h가 TILE_H를 초과할 때는 상단에서 자름
    if new_h > TILE_H:
        # crop 중앙 수직 (다이아는 대개 넓이 > 높이 — TILE_H = TILE_W/2이므로 수직 초과는 거의 없음)
        src_y = (new_h - TILE_H) // 2
        resized = resized.crop((0, src_y, new_w, src_y + TILE_H))
        new_h = TILE_H
        oy = 0
    if new_w > TILE_W:
        src_x = (new_w - TILE_W) // 2
        resized = resized.crop((src_x, 0, src_x + TILE_W, new_h))
        new_w = TILE_W
        ox = 0
    canvas.paste(resized, (ox, oy), resized)
    return canvas


# ── 오브젝트 정규화: 바닥 다이아 폭 → footprint × TILE_W ─────────────────────
def normalize_object(cut: Image.Image, footprint: int = 1) -> Image.Image:
    """
    오브젝트(바닥 다이아 포함 전체)를 정규화.
    바닥 다이아 폭을 footprint×TILE_W에 맞게 스케일 → 결과 w,h는 가변.
    바닥 다이아 폭은 하단 25% 픽셀에서 측정 (오브젝트 본체가 위에 있고, 바닥이 아래).
    """
    alpha = np.array(cut.split()[3])
    mask  = alpha > 20

    H, W = mask.shape
    # 바닥 다이아 영역 = 하단 30% (오브젝트가 위에 있으므로)
    bottom_mask = mask[int(H * 0.70):, :]
    dw = measure_diamond_width(bottom_mask)
    if dw < 1:
        # 폴백: 전체 mask로 측정
        dw = measure_diamond_width(mask)
    if dw < 1:
        dw = W

    target_w = footprint * TILE_W
    scale = target_w / dw
    new_w = max(1, round(W * scale))
    new_h = max(1, round(H * scale))
    return cut.resize((new_w, new_h), Image.LANCZOS)


# ── 존 정의 ───────────────────────────────────────────────────────────────────
# (name, zone_rel, kind, footprint)
# zone_rel: (x0, y0, x1, y1) 0~1 상대좌표
# 이미지 실제 레이아웃 (4열 × 3행):
#   행1 (y: 0~0.33):  grass | road_straight | road_curve | mountain
#   행2 (y: 0.33~0.66): tree | river | bridge | wall
#   행3 (y: 0.66~1.0):  gate(넓음) | camp | hut | storehouse
#
# gate는 행3 좌측에서 약 1/3을 차지함 (약 33% 폭, 실물은 2타일 너비)
PIECES: list[dict] = [
    # ── 지면 4종 (ground) ──────────────────────────────────────────────────────
    {"name": "grass",         "zone": (0.00, 0.00, 0.25, 0.35), "kind": "ground"},
    {"name": "road_straight", "zone": (0.25, 0.00, 0.50, 0.35), "kind": "ground"},
    {"name": "road_curve",    "zone": (0.50, 0.00, 0.75, 0.35), "kind": "ground"},
    # ── 오브젝트 8종 (object) ──────────────────────────────────────────────────
    {"name": "mountain",      "zone": (0.75, 0.00, 1.00, 0.40), "kind": "object", "footprint": 1},
    {"name": "tree",          "zone": (0.00, 0.32, 0.25, 0.68), "kind": "object", "footprint": 1},
    {"name": "river",         "zone": (0.25, 0.30, 0.50, 0.68), "kind": "ground"},
    {"name": "bridge",        "zone": (0.50, 0.30, 0.75, 0.68), "kind": "object", "footprint": 1},
    {"name": "wall",          "zone": (0.75, 0.30, 1.00, 0.68), "kind": "object", "footprint": 1},
    # gate: 행3 좌측 ~36% — 시각적으로 약 2타일 폭이므로 footprint=2
    # camp/hut/storehouse 경계: 실측 갭 x=0.547~0.553(0.55), 0.739~0.742(0.741) 기반 (2026-06-13 재조정)
    {"name": "gate",          "zone": (0.00, 0.64, 0.38, 1.00), "kind": "object", "footprint": 2},
    {"name": "camp",          "zone": (0.36, 0.64, 0.545, 1.00), "kind": "object", "footprint": 1},
    {"name": "hut",           "zone": (0.555, 0.64, 0.738, 1.00), "kind": "object", "footprint": 1},
    {"name": "storehouse",    "zone": (0.745, 0.64, 1.00, 1.00), "kind": "object", "footprint": 1},
]


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    print(f"[iso-slice] 입력: {SRC.relative_to(REPO)}")
    img_rgb = Image.open(SRC).convert("RGB")
    rgba    = remove_white_bg(img_rgb)
    mask    = get_alpha_mask(rgba, threshold=20)
    W, H    = rgba.size
    print(f"  이미지 크기: {W}×{H}")

    manifest: dict[str, dict] = {}
    failures: list[str] = []

    for piece in PIECES:
        name      = piece["name"]
        zone      = piece["zone"]
        kind      = piece["kind"]
        footprint = piece.get("footprint", 1)

        bbox = crop_zone_bbox(mask, zone, (W, H))
        if bbox is None:
            print(f"  경고: {name} 존({zone}) 비어있음 — 스킵")
            failures.append(name)
            continue

        left, top, right, bottom = bbox
        cut = rgba.crop((left, top, right, bottom))
        raw_w, raw_h = cut.size

        # 정규화
        if kind == "ground":
            out_img = normalize_ground(cut)
        else:
            out_img = normalize_object(cut, footprint)

        out_path = OUT / f"{name}.png"
        out_img.save(out_path, "PNG")

        entry: dict = {"kind": kind, "w": out_img.width, "h": out_img.height}
        if footprint != 1:
            entry["footprint"] = footprint
        manifest[name] = entry

        fp_str = f" footprint={footprint}" if footprint != 1 else ""
        print(f"  {name}: raw={raw_w}×{raw_h} → {out_img.width}×{out_img.height} [{kind}]{fp_str}")

    # iso-manifest.json 저장
    manifest_path = OUT / "iso-manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"\n[iso-slice] 완료: {len(manifest)}조각 → {OUT.relative_to(REPO)}")
    print(f"  iso-manifest.json 저장: {manifest_path.relative_to(REPO)}")
    if failures:
        print(f"\n경고: 슬라이스 실패 {len(failures)}건: {failures}")
        sys.exit(1)

    print("\n=== 슬라이스 결과 ===")
    for n, e in manifest.items():
        fp = f"  footprint={e['footprint']}" if 'footprint' in e else ""
        print(f"  {n}: {e['w']}×{e['h']} [{e['kind']}]{fp}")


if __name__ == "__main__":
    main()
