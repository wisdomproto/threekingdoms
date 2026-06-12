#!/usr/bin/env python3
"""
무드보드 질감 패치 추출 파이프라인 (멱등 재실행 가능)
설계: docs/superpowers/specs/2026-06-12-renderer-v0-design.md §2.2

소스: docs/art/B-3a_ink_01.png (사수관 수묵 담채 씬, 1672×941)
출력:
  apps/web/public/assets/tiles/{terrainId}_{n}.png  (96×96, 이음매 완화 처리)
  apps/web/public/assets/tiles/tiles-manifest.json  { terrainId: variantCount }

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

TARGET_SIZE = 96  # 출력 타일 크기 (px)
EDGE_BLEND_PCT = 0.12  # 가장자리 셀프 미러 블렌드 비율 (10~15%)

# ── 소스 좌표 테이블 ───────────────────────────────────────────────────────────
# 이미지 크기: 1672 × 941
# (left, upper, right, lower) — PIL crop box
#
# plain: 중앙 황갈색 들판. 도로/경로는 피하고 균질 흙바닥 영역을 노린다.
#   변형 0: 중앙 오른쪽 넓은 들판 (도로와 강 사이 개활지)
#   변형 1: 중앙 상단 — 성문 앞 평지, 약간 다른 명도
#   변형 2: 하단 중앙 — 좀 더 밝은 황갈색 초지
PATCH_SOURCES: dict[str, list[tuple[int, int, int, int]]] = {
    # plain: 개활 황갈색 지면. 수묵채색화 특성상 완전한 빈 평지는 없으므로
    #        흙 질감이 주가 되는 가장 균질한 영역을 선정.
    "plain": [
        (1200, 680, 1400, 820), # 우측 하단 — 성긴 잡초와 황갈 흙
        (900, 760, 1100, 870),  # 중앙 하단 — 황토 지면+잔석
        (1100, 800, 1300, 920), # 하단 중우측 — 바위+황갈 지면
    ],
    # forest: 소나무 군락 질감 (수묵화 소나무+안개)
    "forest": [
        (430, 540, 620, 700),   # 좌측 소나무+안개 — 수묵 소나무 질감
        (480, 610, 660, 770),   # 집중된 소나무 — 초록+황갈 혼합
        (350, 650, 550, 810),   # 좌하단 소나무 군 — 어두운 초록
    ],
    # mountain: 암릉 바위+소나무 질감 (수묵화 산 = 바위+소나무의 조합)
    "mountain": [
        (1440, 100, 1620, 280), # 우측 수직 암릉 — 소나무+절벽 수묵 질감
        (1160, 50, 1360, 250),  # 상단 암릉 — 밝은 회갈색 바위면
        (1250, 170, 1430, 350), # 중우측 암릉 — 깊은 협곡+바위
    ],
    # river: 개울 수면+암석 질감
    "river": [
        (1090, 510, 1200, 610), # 강 중심부 — 수면+암석
        (1110, 560, 1210, 650), # 강 하단부 — 흰 물결+돌
        (1070, 460, 1180, 550), # 강 상단부 — 짙은 수면
    ],
    # wall: 석성 벽면 질감
    "wall": [
        (130, 330, 310, 490),   # 성루 하단 석벽 — 회갈색 석재
        (100, 420, 280, 580),   # 성벽 하부 — 짙은 석재 음영
        (310, 360, 490, 510),   # 성벽 우측 — 중간 석재
    ],
    # bridge: 목교 상판 질감
    "bridge": [
        (1030, 570, 1150, 660), # 목교 상판+난간 — 나무 결
        (1010, 600, 1130, 680), # 교각 측면 — 나무+돌 혼합
    ],
    # waste = plain 색조 조정 (별도 패치 없음 — 코드에서 처리)
    # grass = plain 색조 조정 (별도 패치 없음 — 코드에서 처리)
}

# waste/grass는 plain 변형 0에서 색조 이동으로 생성
COLOR_SHIFT_VARIANTS: dict[str, dict[str, float]] = {
    "waste": {
        "saturation": 0.65,   # 채도 낮춤 (황무지 느낌)
        "brightness": 0.92,
        "hue_shift_r": 1.04,  # 약간 더 붉게
        "hue_shift_g": 0.95,
        "hue_shift_b": 0.85,
    },
    "grass": {
        "saturation": 1.15,   # 채도 높임 (초지 느낌)
        "brightness": 1.06,
        "hue_shift_r": 0.90,
        "hue_shift_g": 1.08,
        "hue_shift_b": 0.82,
    },
}


def apply_edge_blend(patch: Image.Image, blend_pct: float = EDGE_BLEND_PCT) -> Image.Image:
    """
    셀프 미러 블렌드: 가장자리 영역을 반대쪽 미러와 알파 합성해 이음매를 완화.
    완전 seamless는 불필요 — 톤만 맞으면 됨.
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
    img = patch.convert("RGB")
    # 채도/명도 먼저
    img = ImageEnhance.Color(img).enhance(params.get("saturation", 1.0))
    img = ImageEnhance.Brightness(img).enhance(params.get("brightness", 1.0))
    # 채널별 곱셈 (hue shift 근사)
    r_mult = params.get("hue_shift_r", 1.0)
    g_mult = params.get("hue_shift_g", 1.0)
    b_mult = params.get("hue_shift_b", 1.0)
    r, g, b = img.split()

    def clamp_channel(ch: Image.Image, mult: float) -> Image.Image:
        import numpy as np
        arr = __import__("numpy").array(ch, dtype="float32") * mult
        return Image.fromarray(arr.clip(0, 255).astype("uint8"), "L")

    r = clamp_channel(r, r_mult)
    g = clamp_channel(g, g_mult)
    b = clamp_channel(b, b_mult)
    return Image.merge("RGB", (r, g, b))


def extract_patch(src: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """크롭 → 96×96 리사이즈 → 이음매 완화 → 색조 통일."""
    cropped = src.crop(box)
    resized = cropped.resize((TARGET_SIZE, TARGET_SIZE), Image.LANCZOS)
    blended = apply_edge_blend(resized)
    normalized = normalize_tone(blended)
    return normalized


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[tiles_from_moodboard] 소스: {MOODBOARD}")
    if not MOODBOARD.exists():
        print(f"  ✗ 무드보드 파일 없음: {MOODBOARD}", file=sys.stderr)
        sys.exit(1)

    src = Image.open(MOODBOARD).convert("RGB")
    print(f"  이미지 크기: {src.size}")

    manifest: dict[str, int] = {}

    # ── 직접 추출 지형 ────────────────────────────────────────────────────────
    for terrain_id, patches in PATCH_SOURCES.items():
        count = 0
        for i, box in enumerate(patches):
            out_path = OUT_DIR / f"{terrain_id}_{i}.png"
            patch = extract_patch(src, box)
            patch.save(out_path, "PNG")
            count += 1
            print(f"  {terrain_id}_{i}.png  ← 크롭 {box}")
        manifest[terrain_id] = count

    # ── waste/grass: plain_0 기반 색조 이동 ──────────────────────────────────
    plain_base_path = OUT_DIR / "plain_0.png"
    plain_base = Image.open(plain_base_path).convert("RGB")

    for terrain_id, params in COLOR_SHIFT_VARIANTS.items():
        shifted = apply_color_shift(plain_base, params)
        # 변형 1~2도 plain_1, plain_2 기반으로 만들어 다양성 추가
        out_path_0 = OUT_DIR / f"{terrain_id}_0.png"
        shifted.save(out_path_0, "PNG")
        print(f"  {terrain_id}_0.png  ← plain_0 색조 이동")

        # 변형 1: plain_1 기반
        plain_base_1 = Image.open(OUT_DIR / "plain_1.png").convert("RGB")
        shifted_1 = apply_color_shift(plain_base_1, params)
        out_path_1 = OUT_DIR / f"{terrain_id}_1.png"
        shifted_1.save(out_path_1, "PNG")
        print(f"  {terrain_id}_1.png  ← plain_1 색조 이동")

        manifest[terrain_id] = 2

    # ── tiles-manifest.json ───────────────────────────────────────────────────
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[tiles_from_moodboard] 완료: {sum(manifest.values())}장 추출")
    print(f"  manifest: {MANIFEST_PATH}")
    for k, v in manifest.items():
        print(f"    {k}: {v}변형")


if __name__ == "__main__":
    main()
