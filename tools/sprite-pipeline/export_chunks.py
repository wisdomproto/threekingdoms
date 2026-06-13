# -*- coding: utf-8 -*-
"""대형맵 청크 분할 블록아웃 export (CLAUDE.md §3-1 "청크 분할 + 오버랩 img2img").

한 장 생성은 큰 맵에서 디테일 한계(업스케일=뭉갬)가 명확하다. 대신 맵을 격자로 쪼개
각 조각의 블록아웃(색 블록 레이아웃)을 따로 export → 조각별로 Gemini img2img 풀해상도
생성 → stitch_chunks.py 로 오버랩 블렌딩해 고해상 배경 한 장으로 합친다.

각 조각은 이웃과 OVERLAP(겹침) 영역을 공유한다 — 그 겹침을 페더 블렌딩해 seam을 숨긴다.
manifest(JSON)에 각 조각의 타일 범위를 기록 → 스티처가 월드 좌표로 정확히 배치한다.

사용: python export_chunks.py [stageMapId] [cols] [rows] [overlap_tiles] [cell_px]
기본: sishuiguan 3 2 3 48
"""
import sys, json, os, glob
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")

# 지형 char → 블록아웃 색 (build_sishuiguan.py와 동일 규약)
COLOR = {
    ".": (217, 207, 157), "g": (168, 198, 134), "f": (74, 110, 70), "m": (140, 122, 94),
    "w": (199, 181, 143), "r": (106, 158, 201), "b": (176, 138, 90), "#": (110, 110, 118),
    "c": (90, 80, 72), "F": (158, 142, 122), "G": (122, 106, 82), "v": (224, 184, 122),
    "B": (207, 158, 106), "d": (201, 168, 110),
}
DEFAULT = (217, 207, 157)
TILE = 48  # 런타임 월드 픽셀/타일 (projection.TILE_SIZE) — 스티처 월드좌표 기준

ROOT = r"C:\project\threekingdoms"
mapId = sys.argv[1] if len(sys.argv) > 1 else "sishuiguan"
COLS = int(sys.argv[2]) if len(sys.argv) > 2 else 3
ROWS = int(sys.argv[3]) if len(sys.argv) > 3 else 2
OV = int(sys.argv[4]) if len(sys.argv) > 4 else 3      # 겹침 타일 수
CELL = int(sys.argv[5]) if len(sys.argv) > 5 else 48   # 블록아웃 px/타일

mp = json.load(open(rf"{ROOT}\packages\data\json\maps\{mapId}.json", encoding="utf-8"))
W, H, tiles = mp["width"], mp["height"], mp["tiles"]
mapName = mp.get("name", mapId)

def split_bounds(total, n, ov):
    """[0,total)를 n등분하되 각 조각을 양쪽으로 ov 타일 확장 (경계 클램프)."""
    edges = [round(i * total / n) for i in range(n + 1)]
    out = []
    for i in range(n):
        a = max(0, edges[i] - (ov if i > 0 else 0))
        b = min(total, edges[i + 1] + (ov if i < n - 1 else 0))
        out.append((a, b))
    return out

xb = split_bounds(W, COLS, OV)
yb = split_bounds(H, ROWS, OV)

OUTDIR = rf"{ROOT}\docs\art\chunks"
os.makedirs(OUTDIR, exist_ok=True)
manifest = {"mapId": mapId, "name": mapName, "width": W, "height": H, "tilePx": TILE,
            "cols": COLS, "rows": ROWS, "overlap": OV, "chunks": []}

for r, (y0, y1) in enumerate(yb):
    for c, (x0, x1) in enumerate(xb):
        cw, ch = x1 - x0, y1 - y0
        img = Image.new("RGB", (cw * CELL, ch * CELL))
        px = img.load()
        for ty in range(y0, y1):
            row = tiles[ty]
            for tx in range(x0, x1):
                col = COLOR.get(row[tx], DEFAULT)
                ox, oy = (tx - x0) * CELL, (ty - y0) * CELL
                for dy in range(CELL):
                    for dx in range(CELL):
                        px[ox + dx, oy + dy] = col
        name = f"{mapId}_r{r}_c{c}.png"
        img.save(rf"{OUTDIR}\{name}")
        manifest["chunks"].append({
            "name": name, "row": r, "col": c,
            "x0": x0, "y0": y0, "x1": x1, "y1": y1,        # 타일 범위 [x0,x1)×[y0,y1)
            "worldPx": [x0 * TILE, y0 * TILE, x1 * TILE, y1 * TILE],
            "size": [cw * CELL, ch * CELL],
        })
        print(f"  {name}  타일 [{x0}:{x1}]×[{y0}:{y1}]  {cw}×{ch}  -> {cw*CELL}×{ch*CELL}px")

json.dump(manifest, open(rf"{OUTDIR}\{mapId}_manifest.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)

# 청크 보드(map-chunk-board.html)용 통합 인덱스 — 모든 스테이지 manifest 취합 (file:// fetch 차단 회피)
allm = {}
for f in sorted(glob.glob(os.path.join(OUTDIR, "*_manifest.json"))):
    m = json.load(open(f, encoding="utf-8"))
    allm[m["mapId"]] = m
with open(os.path.join(OUTDIR, "index.js"), "w", encoding="utf-8") as fp:
    fp.write("window.CHUNK_STAGES = " + json.dumps(allm, ensure_ascii=False) + ";\n")

print(f"\n{COLS}×{ROWS} = {COLS*ROWS}조각, 겹침 {OV}타일. manifest: docs/art/chunks/{mapId}_manifest.json")
print(f"보드 인덱스: docs/art/chunks/index.js ({len(allm)}스테이지)")
print(f"월드 크기(런타임): {W*TILE}×{H*TILE}px")
