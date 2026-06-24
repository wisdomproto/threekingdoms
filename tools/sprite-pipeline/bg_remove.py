# -*- coding: utf-8 -*-
"""흰 배경(불투명) 제거 — 가장자리에서 연결된 near-white 픽셀만 투명화.

AI 이미지 모델이 "투명 배경" 지시를 무시하고 *흰색* 배경으로 생성하는 경우가 잦다
(guanyu·zhangfei·간옹·미축 등). 그대로 컷하면 인게임에서 흰 박스가 보이고, 알파 기반
격자 감지도 실패한다. 이 모듈이 컷 *전에* 흰배경을 투명화한다.

핵심: **가장자리에서 연결된** near-white만 지운다(scipy 연결성분 라벨링) → 캐릭터 내부의
흰색(은빛 갑옷·흰 도포 등)은 배경과 연결 안 돼 보존된다.
"""
from PIL import Image
import numpy as np
from scipy import ndimage

BLACK_THRESH = 48  # near-black 판정 — 가장자리 연결 검정배경만 제거(내부 검정 보존)


def has_opaque_white_bg(im, thresh=235):
    """좌상단 코너가 불투명 near-white면 True (배경 제거 대상)."""
    im = im.convert("RGBA")
    c = im.load()[0, 0]
    return c[3] > thresh and c[0] >= thresh and c[1] >= thresh and c[2] >= thresh


def remove_white_bg(im, thresh=235):
    """가장자리 연결 near-white → 투명. 이미 투명 배경이면 원본 그대로 반환."""
    im = im.convert("RGBA")
    if not has_opaque_white_bg(im, thresh):
        return im
    arr = np.array(im)
    near_white = (
        (arr[:, :, 0] >= thresh) & (arr[:, :, 1] >= thresh)
        & (arr[:, :, 2] >= thresh) & (arr[:, :, 3] > 0)
    )
    labels, n = ndimage.label(near_white)
    if n == 0:
        return im
    # 가장자리(상/하/좌/우)에 닿는 연결성분만 배경으로 간주
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    if border:
        arr[np.isin(labels, list(border)), 3] = 0
    return Image.fromarray(arr, "RGBA")


def remove_checker_bg(im, sat_max=40, bright_min=160):
    """가장자리에서 연결된 '무채색·밝은·불투명' 픽셀(체커보드·흰/회색 카드)을 투명화.

    AI가 투명 대신 *체커보드 패턴*(흰+회색 교차)이나 흰 카드를 그려 넣는 경우가 잦은데,
    near-white(remove_white_bg)는 회색 칸을 못 잡아 인게임에 흰 박스로 남는다(Read 도구의
    투명 표시와 똑같이 생겨 육안 검수도 속는다). 채도 낮고(sat<sat_max) 밝은(min RGB>bright_min)
    불투명 픽셀을 대상으로, **가장자리 연결 성분만** 제거 → 캐릭터 내부 무채색(은갑옷)은 보존.
    """
    im = im.convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(int)
    al = arr[:, :, 3]
    sat = rgb.max(2) - rgb.min(2)
    bright = rgb.min(2)
    bg_like = (sat < sat_max) & (bright > bright_min) & (al > 120)
    labels, n = ndimage.label(bg_like)
    if n == 0:
        return im
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    if border:
        arr[np.isin(labels, list(border)), 3] = 0
    return Image.fromarray(arr, "RGBA")


def remove_glow(im, bright_min=185, sat_max=55):
    """가장자리에서 '투명 또는 흰~밝은회색'을 통과하는 flood로 닿는 *흰끼 픽셀*만 투명화.

    AI가 오브젝트 둘레에 소프트 흰 글로우/그림자를 그려 넣는 경우, 그게 *투명에 둘러싸인
    불투명 흰 섬*이라 가장자리 비연결 → remove_white_bg가 못 잡는다(인게임에서 지저분한
    흰 헤일로). 여기선 *투명까지 통과*하는 flood라 그 섬에 도달해 제거. 객체 내부의 흰색
    (수레 자루·은갑옷)은 채도 높은/어두운 몸체에 *둘러싸여* flood가 못 들어가므로 보존.
    """
    im = im.convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(int)
    al = arr[:, :, 3]
    sat = rgb.max(2) - rgb.min(2)
    bright = rgb.min(2)
    whitish = (sat < sat_max) & (bright > bright_min)
    passable = (al == 0) | whitish
    labels, n = ndimage.label(passable)
    if n == 0:
        return im
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    if border:
        bg = np.isin(labels, list(border))
        arr[bg & whitish & (al > 0), 3] = 0
    return Image.fromarray(arr, "RGBA")


def remove_black_bg(im, thresh=BLACK_THRESH):
    """가장자리에서 '투명 또는 near-black'을 통과하는 flood로 닿는 near-black만 투명화.

    AI가 투명 대신 *검정* 배경으로 시트를 내는 경우(전차 유비 등) near-white/checker가
    못 잡아 인게임에 검정 박스로 남는다. near-black(max RGB<thresh) 불투명 픽셀 중
    **가장자리 연결 성분만** 제거 → 캐릭터 내부 어두운 색(검은 머리·갑옷 그림자)은 보존.
    """
    im = im.convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(int)
    al = arr[:, :, 3]
    nearblack = rgb.max(2) < thresh
    if not nearblack.any():
        return im
    passable = nearblack | (al == 0)
    labels, n = ndimage.label(passable)
    if n == 0:
        return im
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    if border:
        arr[np.isin(labels, list(border)) & nearblack & (al > 0), 3] = 0
    return Image.fromarray(arr, "RGBA")


def drop_small_components(im, frac=0.10):
    """불투명 연결성분 중 최대(캐릭터)만 남기고, 그보다 frac 미만이며 *가장자리에 닿는*
    소형 고립 성분(격자 좌표 라벨 'C1/C2' 등)을 제거. 무기는 손에 연결돼 최대 성분에
    포함되므로 보존, 캐릭터 파편(보통 중앙)은 가장자리 비접촉이라 안전."""
    im = im.convert("RGBA")
    arr = np.array(im)
    opaque = arr[:, :, 3] > 40
    labels, n = ndimage.label(opaque)
    if n <= 1:
        return im
    sizes = ndimage.sum(opaque, labels, range(1, n + 1))
    largest = int(np.argmax(sizes)) + 1
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    for i in range(1, n + 1):
        if i != largest and sizes[i - 1] < sizes[largest - 1] * frac and i in border:
            arr[labels == i, 3] = 0
    return Image.fromarray(arr, "RGBA")


def needs_bg_cleanup(im, gray_frac=0.20):
    """배경 정리 필요 여부 — 흰 코너 OR 무채색·밝은 불투명 픽셀이 많음(체커보드/카드).
    체커보드는 코너가 투명일 수 있어 has_opaque_white_bg만으론 놓친다."""
    if has_opaque_white_bg(im):
        return True
    arr = np.array(im.convert("RGBA"))
    rgb = arr[:, :, :3].astype(int)
    al = arr[:, :, 3]
    sat = rgb.max(2) - rgb.min(2)
    bright = rgb.min(2)
    bg_like = (sat < 40) & (bright > 160) & (al > 120)
    if float(bg_like.mean()) > gray_frac:
        return True
    # 검정 배경(불투명 near-black 다수)도 정리 대상
    dark_bg = (rgb.max(2) < BLACK_THRESH) & (al > 120)
    return float(dark_bg.mean()) > gray_frac


def clean_bg(im, trim=True):
    """배경 종합 정리: 흰 flood + 체커보드/회색카드 제거. **시트-안전**(가장자리 연결
    배경만 지움 → 다중 셀 시트에 써도 셀이 안 지워짐). 이미 깨끗한 시트엔 무해.
    ⚠ 라벨(소형 고립 성분) 제거는 `drop_small_components`로 *셀별*(컷 후)에 한다 — 시트에
    drop을 쓰면 최대 셀 하나만 남으니 금지. trim=False면 트림 생략(시트 크기 유지)."""
    im = remove_white_bg(im)
    im = remove_checker_bg(im)
    im = remove_glow(im)
    im = remove_black_bg(im)
    return trim_alpha(im) if trim else im


def trim_alpha(im):
    """알파 bbox로 투명 테두리 트림 (배경 제거 후 타이트하게)."""
    bbox = im.convert("RGBA").split()[3].getbbox()
    return im.crop(bbox) if bbox else im
