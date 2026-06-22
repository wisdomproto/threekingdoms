# -*- coding: utf-8 -*-
"""복구용: 보드에서 _board_dump/I-{gid}/ 로 raw 덤프된 초상 그룹 시트를 멤버별로 슬라이스.

배경:
  asset-board.html 「② 초상시트」에서 그룹 시트를 붙여넣고 "전부 디스크로"(dumpAllToDisk)를 누르면,
  그 함수에 portraitSheet 분기가 없어 시트가 통째로 _board_dump/I-{gid}/ 에 저장되고 슬라이스가 안 된다
  → 게임이 읽는 /assets/ui/portraits/{id}.webp 가 안 생겨 초상이 placeholder로 뜬다.

이 스크립트가 그 덤프 시트들을 멤버 순서(그리드 행우선)대로 잘라 portraits 폴더에 넣는다.
  - AI가 투명 대신 검정 배경으로 낸 시트가 많아 균등 그리드 분할 + 검정 가장자리 flood 제거.
  - 멤버 id·순서·그리드는 보드 GROUPS 정의(asset-board.html §I)와 1:1. (영구 자동화는 serve.py 배선으로 별도.)

사용: python tools/sprite-pipeline/slice_dumped_portraits.py [--dry]
"""
import os
import sys
import glob
import numpy as np
from PIL import Image
from scipy import ndimage

# Windows 콘솔(cp949)에 한글 파일명 print 시 UnicodeEncodeError 방지.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DUMP = os.path.join(ROOT, "apps", "web", "public", "assets", "_board_dump")
OUT = os.path.join(ROOT, "apps", "web", "public", "assets", "ui", "portraits")

# 보드 §I GROUPS 의 멤버 id(설명 제거). 순서 = 시트 그리드 행우선 순서.
GROUPS = {
    "shu-core": ["유비", "관우", "장비", "조운", "제갈량", "간옹", "미축", "손건"],
    "shu-ret": ["관평", "유봉", "주창", "미방", "진등", "요화", "유선", "여건"],
    "dongzhuo": ["동탁", "여포", "이유", "이각", "곽사", "화웅", "호진", "서영"],
    "enemy-early": ["장요", "이숙", "송겸", "정원지", "정덕", "조성", "조잠", "곽적"],
    "caocao-core": ["조조", "하후돈", "하후연", "조인", "조홍", "허저", "서황", "장합"],
    "caocao-2": ["우금", "악진", "이전", "채양", "왕충", "유대", "조순", "하후걸"],
    "misc-han": ["공융", "관해", "두습", "왕보", "조루", "학맹", "하후란", "하후상"],
    "turban": ["장각", "장보", "장연", "요술사", "유벽", "공손찬", "도겸", "하후은"],
    "banhe": ["경무", "관순", "국의", "봉기", "엄강", "한맹"],
    "yuanshu": ["원술", "기령", "악취", "원윤", "이풍", "한섬"],
    "lvbu-lt": ["고순", "위속", "진궁", "후성"],
    "wu-core": ["손권", "주유", "노숙", "황개", "정보", "한당", "감녕", "능통"],
    "wu-navy": ["정봉", "반장", "진무", "채모", "채중", "장윤", "양앙", "왕개", "장무", "진손"],
    "jing-misc": ["문빙", "이적", "진응", "진진", "공지"],
    "generic": ["보병대", "궁병대", "기병대", "적병"],
}


def grid_for(n):
    """보드 buildPortraitPrompt 와 동일: cols = n<=4 ? n : ceil(n/2), rows = ceil(n/cols)."""
    cols = n if n <= 4 else (n + 1) // 2
    rows = (n + cols - 1) // cols
    return cols, rows


def remove_black_bg(cell, thresh=48):
    """가장자리에 연결된 근-검정(near-black)만 투명화. 내부 어두운 부분(머리/갑옷)은 보존."""
    im = cell.convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(int)
    al = arr[:, :, 3]
    nearblack = rgb.max(2) < thresh
    passable = nearblack | (al == 0)
    lbl, n = ndimage.label(passable)
    if n == 0:
        return im
    border = set(lbl[0, :]) | set(lbl[-1, :]) | set(lbl[:, 0]) | set(lbl[:, -1])
    border.discard(0)
    if border:
        mask = np.isin(lbl, list(border)) & nearblack & (al > 0)
        arr[mask, 3] = 0
    return Image.fromarray(arr, "RGBA")


def trim(im):
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def find_sheet(gid):
    d = os.path.join(DUMP, f"I-{gid}")
    if not os.path.isdir(d):
        return None
    pngs = sorted(glob.glob(os.path.join(d, "*.png")))
    return pngs[-1] if pngs else None


def main():
    dry = "--dry" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    total, saved, missing = 0, 0, []
    for gid, members in GROUPS.items():
        sheet = find_sheet(gid)
        if not sheet:
            missing.append(gid)
            continue
        im = Image.open(sheet).convert("RGBA")
        cols, rows = grid_for(len(members))
        cw, ch = im.width // cols, im.height // rows
        print(f"[{gid}] {os.path.basename(sheet)} {im.width}x{im.height} → {cols}x{rows}, {len(members)}명")
        for i, name in enumerate(members):
            total += 1
            r, c = divmod(i, cols)
            cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            cell = trim(remove_black_bg(cell))
            out = os.path.join(OUT, f"{name}.webp")
            if not dry:
                cell.save(out, "WEBP", quality=92)
            saved += 1
            print(f"    {'(dry) ' if dry else ''}{name}.webp  {cell.width}x{cell.height}")
    print(f"\n총 {saved}/{total} 저장{' (dry)' if dry else ''}. 시트 없는 그룹: {missing or '없음'}")


if __name__ == "__main__":
    main()
