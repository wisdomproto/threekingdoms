# -*- coding: utf-8 -*-
"""sprites/manifest.json 재빌드 — 디스크의 sprites/{id}/front_*.png를 스캔해 매니페스트를 채운다.

문제(2026-07-03 발견): cut_posesheet.py는 시트를 컷할 때 매니페스트를 갱신하지만, 매니페스트가
어느 시점에 되돌아가면(git checkout·수동 편집 등) sprites/{id}/ dir은 남고 매니페스트 등록만
사라진다 → loadSprites(textures.ts)가 매니페스트에 없는 스프라이트를 모르므로 게임에서 안 보인다
(빨간 사각 폴백). 실제로 41명(장각·조운·제갈량·동탁 등)이 dir은 있는데 등록 누락돼 있었다.
이 도구가 **디스크를 진실**로 삼아 매니페스트를 재구성한다.

정책:
 - 기존 엔트리는 **보존**(source/method/note 유지) — 검증된 항목을 건드리지 않는다.
 - 디스크에 sprites/{id}/{pose}.png가 있는데 매니페스트에 없는 dir만 **추가**.
 - poses = 그 dir 루트에 실제 존재하는 {front,back}_{idle,move,attack}.png (tier1만; t2/t3 제외).
   loadSprites는 per-file 내성이라(없는 포즈 404는 스킵) 실재 파일만 나열하면 안전.

사용:
  python tools/sprite-pipeline/rebuild_manifest.py            # 재빌드 후 저장
  python tools/sprite-pipeline/rebuild_manifest.py --dry-run  # 추가될 항목만 출력

⚠️ 저장 후 R2 반영은 별도: python tools/upload-assets.py (dev는 R2에서 읽음).
"""
import os, sys, json

# 이 파일은 tools/sprite-pipeline/ (repo 루트 2단계 아래) → dirname 3회.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPRITES = os.path.join(ROOT, "apps", "web", "public", "assets", "sprites")
MANIFEST = os.path.join(SPRITES, "manifest.json")
POSE_ORDER = ["front_idle", "front_move", "front_attack", "back_idle", "back_move", "back_attack"]


def poses_in(dirpath):
    return [p for p in POSE_ORDER if os.path.isfile(os.path.join(dirpath, p + ".png"))]


def main():
    dry = "--dry-run" in sys.argv
    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)
    kept = len(manifest)
    added = []
    for name in sorted(os.listdir(SPRITES)):
        d = os.path.join(SPRITES, name)
        if not os.path.isdir(d):
            continue
        if name in manifest:
            continue  # 기존 보존
        poses = poses_in(d)
        if not poses:
            continue  # 루트에 로드할 포즈 없음(시트만 있는 경우 등)
        has_sheet = os.path.isfile(os.path.join(d, "_posesheet.png"))
        manifest[name] = {
            "poses": poses,
            "source": "_posesheet.png" if has_sheet else "",
            "method": "rebuild_manifest.py",
        }
        added.append((name, poses))

    print(f"기존 보존 {kept} · 추가 {len(added)}  → 총 {len(manifest)}")
    for n, p in added:
        print(f"  + {n}: {','.join(p)}")
    if dry:
        print("[dry-run] 저장 안 함")
        return
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"저장: {MANIFEST}")


if __name__ == "__main__":
    main()
