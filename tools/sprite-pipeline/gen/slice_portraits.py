# -*- coding: utf-8 -*-
"""초상 그룹 시트 → 멤버별 {이름}.webp 슬라이스.

입력: 투명배경 그리드 시트(여러 흉상). 행우선(좌→우, 위→아래) 순서 = members 순서.
방법: 알파(투명배경) 투영으로 행 밴드 → 각 행의 열 밴드 검출 → 셀 크롭·여백 트림 → webp.
폴백: 알파가 거의 없으면(불투명 배경) 균등 그리드(cols×rows)로 분할.
"""
import os
from PIL import Image

ALPHA_THRESH = 16
MIN_RUN = 8  # 밴드로 인정할 최소 픽셀 길이


def _content_mask_cols(im):
    """열별 콘텐츠 존재 여부(불리언 리스트). 알파 우선, 없으면 비백색."""
    w, h = im.size
    px = im.load()
    has_alpha = im.mode == "RGBA"
    cols = []
    for x in range(w):
        filled = False
        for y in range(0, h, 2):  # 2px 스텝(속도)
            p = px[x, y]
            if has_alpha:
                if p[3] > ALPHA_THRESH:
                    filled = True; break
            else:
                if not (p[0] > 240 and p[1] > 240 and p[2] > 240):
                    filled = True; break
        cols.append(filled)
    return cols


def _content_mask_rows(im):
    w, h = im.size
    px = im.load()
    has_alpha = im.mode == "RGBA"
    rows = []
    for y in range(h):
        filled = False
        for x in range(0, w, 2):
            p = px[x, y]
            if has_alpha:
                if p[3] > ALPHA_THRESH:
                    filled = True; break
            else:
                if not (p[0] > 240 and p[1] > 240 and p[2] > 240):
                    filled = True; break
        rows.append(filled)
    return rows


def _bands(mask):
    """불리언 마스크 → [(start,end)] 콘텐츠 구간 목록(MIN_RUN 이상)."""
    bands, s = [], None
    for i, v in enumerate(mask):
        if v and s is None:
            s = i
        elif not v and s is not None:
            if i - s >= MIN_RUN:
                bands.append((s, i))
            s = None
    if s is not None and len(mask) - s >= MIN_RUN:
        bands.append((s, len(mask)))
    return bands


def _trim(cell):
    bbox = cell.getbbox()
    return cell.crop(bbox) if bbox else cell


def slice_sheet(sheet_path, members, out_dir, grid=None):
    """sheet → out_dir/{member}.webp 들. 반환: [(member, out_path, ok)]."""
    im = Image.open(sheet_path).convert("RGBA")
    os.makedirs(out_dir, exist_ok=True)
    results = []

    row_bands = _bands(_content_mask_rows(im))
    cells = []  # 행우선 (x0,y0,x1,y1)
    if row_bands:
        for (ry0, ry1) in row_bands:
            strip = im.crop((0, ry0, im.width, ry1))
            for (cx0, cx1) in _bands(_content_mask_cols(strip)):
                cells.append((cx0, ry0, cx1, ry1))
    # 폴백: 검출 실패 → 균등 그리드
    if len(cells) < len(members) and grid:
        cells = []
        cw, ch = im.width // grid["cols"], im.height // grid["rows"]
        for r in range(grid["rows"]):
            for c in range(grid["cols"]):
                cells.append((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))

    for i, name in enumerate(members):
        if i >= len(cells):
            results.append((name, None, False))
            continue
        cell = _trim(im.crop(cells[i]))
        out = os.path.join(out_dir, f"{name}.webp")
        cell.save(out, "WEBP", quality=92)
        results.append((name, out, True))
    return results


if __name__ == "__main__":
    import sys, json
    # 단독 실행: python slice_portraits.py <sheet.png> <member1,member2,...> <out_dir>
    sheet, members_csv, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    res = slice_sheet(sheet, members_csv.split(","), out_dir)
    print(json.dumps([{"name": n, "ok": ok} for n, _, ok in res], ensure_ascii=False))
