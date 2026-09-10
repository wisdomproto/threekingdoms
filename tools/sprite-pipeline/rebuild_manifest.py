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
 - poses = 그 dir 루트에 실제 존재하는 {front,back}_{idle,move,attack}.png.
   loadSprites는 per-file 내성이라(없는 포즈 404는 스킵) 실재 파일만 나열하면 안전.
 - **티어 코스메틱(§7 승급, 2026-07-03)**: sprites/{id}/t2·t3/에 포즈가 있으면 `{id}/t2` 키로
   추가 — loadSprites 경로 규약(`{spriteId}/{pose}.png`)이 그대로 하위 폴더를 탄다.
   spriteCandidates가 tier≥2 유닛에서 `{id}/t{n}`을 우선 시도(미보유 폴백).

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
POSE_ORDER = ["front_idle", "front_move", "front_attack", "back_idle", "back_move", "back_attack",
              "front_kneel"]  # kneel = 막간 v4 도보 씬 의식 포즈(sprites/{key}-foot/)


def poses_in(dirpath):
    return [p for p in POSE_ORDER
            if os.path.isfile(os.path.join(dirpath, p + ".webp")) or os.path.isfile(os.path.join(dirpath, p + ".png"))]


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
        if name not in manifest:
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
        # 티어 코스메틱(t2/t3) — 루트 등록 여부와 무관하게 스캔(기존 엔트리도 티어 키는 추가).
        for t in ("t2", "t3"):
            key = f"{name}/{t}"
            if key in manifest:
                continue
            tposes = poses_in(os.path.join(d, t))
            if not tposes:
                continue
            manifest[key] = {"poses": tposes, "source": "", "method": "rebuild_manifest.py(tier)"}
            added.append((key, tposes))

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
