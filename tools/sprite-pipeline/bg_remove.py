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


def trim_alpha(im):
    """알파 bbox로 투명 테두리 트림 (배경 제거 후 타이트하게)."""
    bbox = im.convert("RGBA").split()[3].getbbox()
    return im.crop(bbox) if bbox else im
