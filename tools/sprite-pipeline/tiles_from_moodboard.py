#!/usr/bin/env python3
"""
무드보드 질감 패치 추출 파이프라인 v2 (멱등 재실행 가능)
설계: docs/superpowers/specs/2026-06-12-renderer-v0-design.md §2.2

소스: docs/art/B-3a_ink_01.png (사수관 수묵 담채 씬, 1672×941)
출력:
  면(面) 지형 (plain/forest/mountain/waste/grass):
    apps/web/public/assets/tiles/{terrainId}_macro_{n}.png  (288×288, 6×6타일 분량)
  선(線)/점 지형 (river/wall/bridge):
    apps/web/public/assets/tiles/{terrainId}_{n}.png        (96×96, 기존 방식)
  apps/web/public/assets/tiles/tiles-manifest.json
    v2 형식: { terrainId: { kind: "macro"|"tile", size: 6|1, count: N } }

제외 지형 (기존 단색 유지):
  gate, village, barracks, depot, fort, cliff

실행: python tools/sprite-pipeline/tiles_from_moodboard.py
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

# ── 경로 ─────────────────────────────────────────────────────────────────────
REPO = Path(__file__).resolve().parent.parent.parent
MOODBOARD = REPO / "docs" / "art" / "B-3a_ink_01.png"
OUT_DIR = REPO / "apps" / "web" / "public" / "assets" / "tiles"
MANIFEST_PATH = OUT_DIR / "tiles-manifest.json"

TILE_SIZE = 96         # 단일 타일 출력 크기 (px)
MACRO_TILES = 6        # 매크로 텍스처가 커버하는 타일 수 (6×6)
MACRO_SIZE = TILE_SIZE * MACRO_TILES  # 288px
EDGE_BLEND_PCT = 0.10  # 가장자리 셀프 미러 블렌드 비율

# ── 면(面) 지형: 288×288 매크로 텍스처 ────────────────────────────────────────
# (left, upper, right, lower) — PIL crop box, 무드보드 1672×941 기준
# 목표: 절벽 통경관이 아닌 바위/흙/수목의 '질감' 균질 영역
MACRO_SOURCES: dict[str, list[tuple[int, int, int, int]]] = {
    # plain: 개활 황갈색 지면 — 흙 질감이 주가 되는 균질 영역
    #   영역 크기 최소 300×300 이상 확보해야 매크로 크롭 품질이 좋다
    "plain": [
        (900, 650, 1400, 941),   # 하단 넓은 개활지 — 황갈 흙+잡석 (500×291)
        (1100, 700, 1672, 941),  # 우하단 평지 — 밝은 황토 (572×241 → 패딩 허용)
    ],
    # forest: 소나무 군락의 수묵 질감 (나무 개체 아닌 전체 수림 분위기)
    "forest": [
        (350, 500, 750, 820),    # 좌측 소나무+안개 군 (400×320)
        (430, 580, 720, 810),    # 집중된 소나무 군 (290×230)
    ],
    # mountain: 암릉 바위+소나무 수묵 질감
    "mountain": [
        (1100,  20, 1560, 400),  # 상단 암릉 전체 (460×380)
        (1350,  80, 1672, 430),  # 우측 수직 암릉 (322×350)
    ],
}

# ── 선(線)/점 지형: 96×96 단일 타일 (기존 방식 유지) ────────────────────────
TILE_SOURCES: dict[str, list[tuple[int, int, int, int]]] = {
    # river: 개울 수면+암석 질감
    "river": [
        (1090, 510, 1200, 610),
        (1110, 560, 1210, 650),
        (1070, 460, 1180, 550),
    ],
    # wall: 석성 벽면 질감
    "wall": [
        (130, 330, 310, 490),
        (100, 420, 280, 580),
        (310, 360, 490, 510),
    ],
    # bridge: 목교 상판 질감
    "bridge": [
        (1030, 570, 1150, 660),
        (1010, 600, 1130, 680),
    ],
}

# waste/grass는 plain 매크로 0에서 색조 이동으로 생성
COLOR_SHIFT_VARIANTS: dict[str, dict[str, float]] = {
    "waste": {
        "saturation": 0.65,
        "brightness": 0.92,
        "hue_shift_r": 1.04,
        "hue_shift_g": 0.95,
        "hue_shift_b": 0.85,
    },
    "grass": {
        "saturation": 1.15,
        "brightness": 1.06,
        "hue_shift_r": 0.90,
        "hue_shift_g": 1.08,
        "hue_shift_b": 0.82,
    },
}


def apply_edge_blend(patch: Image.Image, blend_pct: float = EDGE_BLEND_PCT) -> Image.Image:
    """
    셀프 미러 블렌드: 가장자리 영역을 반대쪽 미러와 알파 합성해 이음매를 완화.
    반복 주기 6타일이라 완전 seamless는 불필요 — 톤만 맞으면 됨.
    """
    w, h = patch.size
    border = int(min(w, h) * blend_pct)
    if border < 2:
        return patch

    img = patch.convert("RGBA")
    # 좌우 미러 블렌드
    mirror_h = img.transpose(Image.FLIP_LEFT_RIGHT)
    for x in range(border):
        alpha = x / border  # 0(가장자리)→1(안쪽)
        col_left = img.crop((x, 0, x + 1, h))
        col_mirror = mirror_h.crop((x, 0, x + 1, h))
        blended = Image.blend(col_mirror, col_left, alpha)
        img.paste(blended, (x, 0))

        col_right = img.crop((w - 1 - x, 0, w - x, h))
        col_mirror_r = mirror_h.crop((w - 1 - x, 0, w - x, h))
        blended_r = Image.blend(col_mirror_r, col_right, alpha)
        img.paste(blended_r, (w - 1 - x, 0))

    # 상하 미러 블렌드
    mirror_v = img.transpose(Image.FLIP_TOP_BOTTOM)
    for y in range(border):
        alpha = y / border
        row_top = img.crop((0, y, w, y + 1))
        row_mirror = mirror_v.crop((0, y, w, y + 1))
        blended = Image.blend(row_mirror, row_top, alpha)
        img.paste(blended, (0, y))

        row_bot = img.crop((0, h - 1 - y, w, h - y))
        row_mirror_b = mirror_v.crop((0, h - 1 - y, w, h - y))
        blended_b = Image.blend(row_mirror_b, row_bot, alpha)
        img.paste(blended_b, (0, h - 1 - y))

    return img.convert("RGB")


def normalize_tone(patch: Image.Image,
                   target_sat: float = 0.95,
                   target_bright: float = 1.0) -> Image.Image:
    """채도·명도 살짝 통일 — 타일 간 위화감 방지."""
    img = ImageEnhance.Color(patch).enhance(target_sat)
    img = ImageEnhance.Brightness(img).enhance(target_bright)
    return img


def apply_color_shift(patch: Image.Image, params: dict[str, float]) -> Image.Image:
    """RGB 채널별 색조 이동 (waste/grass 변형용)."""
    import numpy as np
    img = patch.convert("RGB")
    img = ImageEnhance.Color(img).enhance(params.get("saturation", 1.0))
    img = ImageEnhance.Brightness(img).enhance(params.get("brightness", 1.0))
    r_mult = params.get("hue_shift_r", 1.0)
    g_mult = params.get("hue_shift_g", 1.0)
    b_mult = params.get("hue_shift_b", 1.0)
    r, g, b = img.split()

    def clamp_ch(ch: Image.Image, mult: float) -> Image.Image:
        arr = np.array(ch, dtype="float32") * mult
        return Image.fromarray(arr.clip(0, 255).astype("uint8"), "L")

    return Image.merge("RGB", (clamp_ch(r, r_mult), clamp_ch(g, g_mult), clamp_ch(b, b_mult)))


def extract_macro(src: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """크롭 → 288×288 리사이즈 → 가장자리 블렌드 → 색조 통일 (매크로 텍스처)."""
    cropped = src.crop(box)
    resized = cropped.resize((MACRO_SIZE, MACRO_SIZE), Image.LANCZOS)
    blended = apply_edge_blend(resized)
    normalized = normalize_tone(blended)
    return normalized


def extract_tile(src: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """크롭 → 96×96 리사이즈 → 이음매 완화 → 색조 통일 (단일 타일)."""
    cropped = src.crop(box)
    resized = cropped.resize((TILE_SIZE, TILE_SIZE), Image.LANCZOS)
    blended = apply_edge_blend(resized)
    normalized = normalize_tone(blended)
    return normalized


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[tiles_from_moodboard v2] 소스: {MOODBOARD}")
    if not MOODBOARD.exists():
        print(f"  ✗ 무드보드 파일 없음: {MOODBOARD}", file=sys.stderr)
        sys.exit(1)

    src = Image.open(MOODBOARD).convert("RGB")
    print(f"  이미지 크기: {src.size}")

    # manifest v2: { terrainId: { kind, size, count } }
    manifest: dict[str, dict] = {}

    # ── 면(面) 지형: 288×288 매크로 텍스처 ──────────────────────────────────
    print("\n  [macro texture 288x288]")
    for terrain_id, patches in MACRO_SOURCES.items():
        count = 0
        for i, box in enumerate(patches):
            out_path = OUT_DIR / f"{terrain_id}_macro_{i}.png"
            patch = extract_macro(src, box)
            patch.save(out_path, "PNG")
            count += 1
            src_w = box[2] - box[0]
            src_h = box[3] - box[1]
            print(f"  {terrain_id}_macro_{i}.png  ← 크롭 {box}  ({src_w}×{src_h}→288×288)")
        manifest[terrain_id] = {"kind": "macro", "size": MACRO_TILES, "count": count}

    # ── waste/grass: plain 매크로 0 기반 색조 이동 ──────────────────────────
    print("\n  [color shift macro waste/grass]")
    plain_macro_0_path = OUT_DIR / "plain_macro_0.png"
    plain_macro_0 = Image.open(plain_macro_0_path).convert("RGB")
    plain_macro_1_path = OUT_DIR / "plain_macro_1.png"
    plain_macro_1 = Image.open(plain_macro_1_path).convert("RGB") if (OUT_DIR / "plain_macro_1.png").exists() else plain_macro_0

    for terrain_id, params in COLOR_SHIFT_VARIANTS.items():
        shifted_0 = apply_color_shift(plain_macro_0, params)
        out_0 = OUT_DIR / f"{terrain_id}_macro_0.png"
        shifted_0.save(out_0, "PNG")
        print(f"  {terrain_id}_macro_0.png  ← plain_macro_0 색조 이동")

        shifted_1 = apply_color_shift(plain_macro_1, params)
        out_1 = OUT_DIR / f"{terrain_id}_macro_1.png"
        shifted_1.save(out_1, "PNG")
        print(f"  {terrain_id}_macro_1.png  ← plain_macro_1 색조 이동")

        manifest[terrain_id] = {"kind": "macro", "size": MACRO_TILES, "count": 2}

    # ── 선(線)/점 지형: 96×96 단일 타일 (기존 방식) ─────────────────────────
    print("\n  [single tile 96x96]")
    for terrain_id, patches in TILE_SOURCES.items():
        count = 0
        for i, box in enumerate(patches):
            out_path = OUT_DIR / f"{terrain_id}_{i}.png"
            patch = extract_tile(src, box)
            patch.save(out_path, "PNG")
            count += 1
            print(f"  {terrain_id}_{i}.png  ← 크롭 {box}")
        manifest[terrain_id] = {"kind": "tile", "size": 1, "count": count}

    # ── tiles-manifest.json v2 ────────────────────────────────────────────────
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    total = sum(v["count"] for v in manifest.values())
    print(f"\n[tiles_from_moodboard v2] 완료: {total}장 추출")
    print(f"  manifest: {MANIFEST_PATH}")
    for k, v in manifest.items():
        kind_label = f"macro {v['size']}x{v['size']}" if v["kind"] == "macro" else "tile"
        print(f"    {k}: {v['count']}장 ({kind_label})")


if __name__ == "__main__":
    main()
