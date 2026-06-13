#!/usr/bin/env python3
"""
이펙트(C)·타일(B-3b)·UI(D-1)·배경(B-4) 슬라이스 — slice_sheets.py(유닛)의 자매 스크립트.
멱등 재실행 가능.

입력: docs/art/{C-1,C-2,B-3b,D-1,B-4}_ink_01.png
출력: apps/web/public/assets/{vfx,tiles,ui,bg}/... + 각 manifest.json

존(zone) 기반 슬라이스: 시트를 상대좌표 존으로 나누고, 존 안의 전경 픽셀 bbox를 crop.
  - vfx (검정 배경): alpha = max(R,G,B) — additive 블렌딩용 luminance 알파
  - tiles (흰 배경): slice_sheets.remove_white_bg 재사용
  - ui (어두운 단색 배경): 코너 색 키잉 (distance threshold)
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

import sys
sys.path.insert(0, str(Path(__file__).parent))
from slice_sheets import remove_white_bg  # 흰 배경 키잉 재사용
from scipy import ndimage


def crop_zone_largest(arr_mask: np.ndarray, zone: tuple[float, float, float, float], size: tuple[int, int]):
    """존 내 최대 연결 성분의 bbox만 반환 — 이웃 요소가 존 경계에 걸쳐도 배제."""
    W, H = size
    x0, y0, x1, y1 = (int(zone[0] * W), int(zone[1] * H), int(zone[2] * W), int(zone[3] * H))
    sub = arr_mask[y0:y1, x0:x1]
    # 근접 픽셀 연결(장식 분리 방지) 후 라벨링
    dilated = ndimage.binary_dilation(sub, iterations=8)
    labeled, num = ndimage.label(dilated)
    if num == 0:
        return None
    sizes = ndimage.sum(sub, labeled, range(1, num + 1))
    lbl = int(np.argmax(sizes)) + 1
    ys, xs = np.where((labeled == lbl) & sub)
    if len(ys) == 0:
        return None
    left = max(0, x0 + int(xs.min()) - PAD)
    top = max(0, y0 + int(ys.min()) - PAD)
    right = min(W, x0 + int(xs.max()) + PAD)
    bottom = min(H, y0 + int(ys.max()) + PAD)
    return (left, top, right, bottom)

REPO = Path(__file__).resolve().parent.parent.parent
ART = REPO / "docs" / "art"
PUB = REPO / "apps" / "web" / "public" / "assets"

PAD = 10  # crop 여백(px)


def crop_zone(arr_mask: np.ndarray, zone: tuple[float, float, float, float], size: tuple[int, int]):
    """존(상대좌표 x0,y0,x1,y1) 내 전경 픽셀의 절대 bbox 반환. 없으면 None."""
    W, H = size
    x0, y0, x1, y1 = (int(zone[0] * W), int(zone[1] * H), int(zone[2] * W), int(zone[3] * H))
    sub = arr_mask[y0:y1, x0:x1]
    ys, xs = np.where(sub)
    if len(ys) == 0:
        return None
    left = max(0, x0 + int(xs.min()) - PAD)
    top = max(0, y0 + int(ys.min()) - PAD)
    right = min(W, x0 + int(xs.max()) + PAD)
    bottom = min(H, y0 + int(ys.max()) + PAD)
    return (left, top, right, bottom)


def save(img: Image.Image, path: Path, manifest: dict, key: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    manifest[key] = {"file": path.name, "w": img.width, "h": img.height}
    print(f"  {key}: {path.name} ({img.width}x{img.height})")


# ── VFX (검정 배경 → luminance 알파) ────────────────────────────────────────
def slice_vfx():
    jobs = [
        ("C-1_ink_01.png", {
            "slash":      (0.00, 0.00, 0.34, 0.46),
            "crit":       (0.34, 0.00, 0.66, 0.46),
            "duel_clash": (0.66, 0.00, 1.00, 0.46),
            "dust_1":     (0.00, 0.46, 0.30, 0.70),
            "dust_2":     (0.30, 0.46, 0.62, 0.70),
            "dust_3":     (0.62, 0.46, 1.00, 0.70),
            "coins":      (0.00, 0.70, 0.34, 1.00),
            "pouch":      (0.34, 0.70, 0.66, 1.00),
            "impact":     (0.66, 0.70, 1.00, 1.00),
        }),
        ("C-2_ink_01.png", {
            "fire":   (0.00, 0.00, 0.50, 0.50),
            "water":  (0.50, 0.00, 1.00, 0.50),
            "rock":   (0.00, 0.50, 0.36, 1.00),
            "heal":   (0.36, 0.50, 0.66, 1.00),
            "debuff": (0.66, 0.50, 1.00, 1.00),
        }),
    ]
    out_dir = PUB / "vfx"
    manifest: dict = {}
    for src, zones in jobs:
        print(f"\n[vfx] {src}")
        img = Image.open(ART / src).convert("RGB")
        arr = np.array(img, dtype=np.uint8)
        lum = arr.max(axis=2)                       # luminance ≈ max channel
        mask = lum > 18                             # 검정 배경 제거 threshold
        rgba = np.dstack([arr, lum]).astype(np.uint8)  # alpha = luminance (additive 친화)
        full = Image.fromarray(rgba, "RGBA")
        for name, zone in zones.items():
            bbox = crop_zone(mask, zone, img.size)
            if bbox is None:
                print(f"  경고: {name} 존이 비어있음 — 스킵")
                continue
            save(full.crop(bbox), out_dir / f"{name}.png", manifest, name)
    with open(out_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"[vfx] manifest: {len(manifest)}개")


# ── 타일 (흰 배경) ───────────────────────────────────────────────────────────
def slice_tiles():
    # 4열 × 3행 — 렌더러 terrain id와의 대응은 manifest의 terrain 필드로 표기
    zones = {
        # name: (zone, terrain_id 매핑 후보)
        "grass":         ((0.00, 0.00, 0.25, 0.33), "grass"),
        "road_straight": ((0.25, 0.00, 0.50, 0.33), "plain"),
        "road_curve":    ((0.50, 0.00, 0.75, 0.33), "plain"),
        "mountain":      ((0.75, 0.00, 1.00, 0.33), "mountain"),
        "tree":          ((0.00, 0.33, 0.25, 0.66), "forest"),
        "river":         ((0.25, 0.33, 0.50, 0.66), "river"),
        "bridge":        ((0.50, 0.33, 0.75, 0.66), "bridge"),
        "wall":          ((0.75, 0.33, 1.00, 0.66), "wall"),
        "gate":          ((0.00, 0.66, 0.34, 1.00), "gate"),
        "camp":          ((0.34, 0.66, 0.58, 1.00), "barracks"),
        "hut":           ((0.58, 0.66, 0.79, 1.00), "village"),
        "storehouse":    ((0.79, 0.66, 1.00, 1.00), "depot"),
    }
    out_dir = PUB / "tiles"
    manifest: dict = {}
    src = "B-3b_ink_01.png"
    print(f"\n[tiles] {src}")
    img = Image.open(ART / src).convert("RGB")
    rgba = remove_white_bg(img)
    alpha = np.array(rgba.split()[3])
    mask = alpha > 24
    for name, (zone, terrain) in zones.items():
        bbox = crop_zone(mask, zone, img.size)
        if bbox is None:
            print(f"  경고: {name} 존이 비어있음 — 스킵")
            continue
        cut = rgba.crop(bbox)
        out_path = out_dir / f"{name}.png"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        cut.save(out_path, "PNG")
        manifest[name] = {"file": out_path.name, "w": cut.width, "h": cut.height, "terrain": terrain}
        print(f"  {name}: {out_path.name} ({cut.width}x{cut.height}) → terrain:{terrain}")
    with open(out_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"[tiles] manifest: {len(manifest)}개")


# ── UI (어두운 단색 배경 — 코너 색 키잉) ────────────────────────────────────
def slice_ui():
    zones = {
        "portrait_frame": (0.00, 0.00, 0.42, 0.62),
        "gauge_green":    (0.42, 0.00, 1.00, 0.34),
        "gauge_red":      (0.42, 0.34, 1.00, 0.62),
        "seal_button":    (0.00, 0.62, 0.38, 1.00),
        "banner_ribbon":  (0.38, 0.62, 1.00, 1.00),
    }
    out_dir = PUB / "ui"
    manifest: dict = {}
    src = "D-1_ink_01.png"
    print(f"\n[ui] {src}")
    img = Image.open(ART / src).convert("RGB")
    arr = np.array(img, dtype=np.float32)
    # 네 코너 평균색 = 배경색
    H, W = arr.shape[:2]
    corners = np.concatenate([
        arr[:24, :24].reshape(-1, 3), arr[:24, -24:].reshape(-1, 3),
        arr[-24:, :24].reshape(-1, 3), arr[-24:, -24:].reshape(-1, 3)])
    bg = corners.mean(axis=0)
    dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))
    # 거리 → 알파 (배경 ≈ 0, 요소 = 255). 18~60 구간 그라데이션
    alpha = np.clip((dist - 18) / (60 - 18) * 255, 0, 255).astype(np.uint8)
    mask = alpha > 32
    rgba = np.dstack([arr.astype(np.uint8), alpha])
    full = Image.fromarray(rgba, "RGBA")
    for name, zone in zones.items():
        bbox = crop_zone_largest(mask, zone, img.size)
        if bbox is None:
            print(f"  경고: {name} 존이 비어있음 — 스킵")
            continue
        save(full.crop(bbox), out_dir / f"{name}.png", manifest, name)
    with open(out_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"[ui] manifest: {len(manifest)}개")


# ── 배경 (그대로, 폭 2048 제한) ──────────────────────────────────────────────
def copy_bg():
    src = ART / "B-4_ink_01.png"
    out_dir = PUB / "bg"
    out_dir.mkdir(parents=True, exist_ok=True)
    img = Image.open(src).convert("RGB")
    if img.width > 2048:
        h = round(img.height * 2048 / img.width)
        img = img.resize((2048, h), Image.LANCZOS)
    out = out_dir / "battle_dawn.png"
    img.save(out, "PNG")
    print(f"\n[bg] battle_dawn.png ({img.width}x{img.height})")


# ── 시임리스 바닥 (E-*) — 48 배수로 리사이즈해 wrap-sub-rect 가능하게 ───────────
def slice_ground():
    # (src, terrainId) — 시임리스 바닥.
    # 평지/초원/황무지=E-1, 산악=E-2(바위), 숲=E-3(캐노피, 나무 데코 대체).
    jobs = [
        ("E-1_ink_01.png", "plain"),
        ("E-1_ink_02.png", "grass"),
        ("E-1_ink_03.png", "waste"),
        ("E-2_ink_01.png", "mountain"),
        ("E-3_ink_01.png", "forest"),
    ]
    out_dir = PUB / "tiles"
    manifest = {}
    SIZE = 576  # 48 × 12 — sub-rect 48px가 깔끔히 wrap
    for src, terrain in jobs:
        p = ART / src
        if not p.exists():
            print(f"  경고: {src} 없음 — 스킵")
            continue
        img = Image.open(p).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        out = out_dir / f"ground_{terrain}.png"
        img.save(out, "PNG")
        manifest[terrain] = {"file": out.name, "size": SIZE}
        print(f"\n[ground] {terrain}: {out.name} ({SIZE}x{SIZE}, seamless)")
    with open(out_dir / "ground-manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    slice_vfx()
    slice_tiles()
    slice_ui()
    slice_ground()
    copy_bg()
    print("\ndone: apps/web/public/assets/{vfx,tiles,ui,bg}/")
