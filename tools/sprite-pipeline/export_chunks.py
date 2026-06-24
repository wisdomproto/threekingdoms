# -*- coding: utf-8 -*-
"""대형맵 청크 분할 블록아웃 export (CLAUDE.md §3-1 "청크 분할 + 오버랩 img2img").

한 장 생성은 큰 맵에서 디테일 한계(업스케일=뭉갬)가 명확하다. 맵을 격자로 쪼개 각 조각의
블록아웃(색 블록 레이아웃)을 따로 export → 조각별 Gemini img2img 풀해상도 생성 →
stitch_chunks.py 로 오버랩 블렌딩해 고해상 배경 한 장으로 합친다.

⚠ 청크 타일 박스를 **일반 비율**(1:1·5:4·4:3·16:9 중 맵에 낭비 최소)로 골라 **균일**하게
타일링한다 — 임의 비율(등분 잔여, 예 1.16/1.26)은 Gemini가 구도를 못 잡기 때문(2026-06-24
전환, 종전 split_bounds 단순 등분 대체). 청크 시작은 [0, total-box]에 균등 배치(겹침 균일),
manifest에 축별 겹침 ovx/ovy 기록 → stitch가 그 폭으로 페더 블렌딩(seam 정합).

사용: python export_chunks.py [stageMapId|all] [overlap_tiles] [cell_px]
기본: sishuiguan 3 48   (비율·격자는 맵 크기에서 자동 선택)
"""
import sys, json, os, glob, math
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")

# 지형 char → 블록아웃 색 (build_sishuiguan.py와 동일 규약).
# ⚠ 이 RGB는 map-chunk-board.html CHUNK_PROMPT의 hex 색 매핑과 동기화 — 색을 바꾸면 양쪽 다 수정.
COLOR = {
    ".": (217, 207, 157), "g": (168, 198, 134), "f": (74, 110, 70), "m": (140, 122, 94),
    "w": (199, 181, 143), "r": (106, 158, 201), "b": (176, 138, 90), "#": (110, 110, 118),
    "c": (90, 80, 72), "F": (158, 142, 122), "G": (122, 106, 82), "v": (224, 184, 122),
    "B": (207, 158, 106), "d": (201, 168, 110),
}
DEFAULT = (217, 207, 157)
TILE = 48  # 런타임 월드 px/타일 (projection.TILE_SIZE) — 스티처 월드좌표 기준

# 일반 비율 후보 (w:h) — 가로/정사각. Gemini 학습이 쏠린 비율.
RATIOS = [(1, 1), (5, 4), (4, 3), (16, 9)]
MIN_SIDE, MAX_SIDE = 12, 24  # 청크 타일 변 범위 (디테일·생성 한계 절충)
GRID_DARK = 0.85  # 블록아웃 타일 격자선 농도(배경 색×) — Gemini 위치 정렬 앵커. 옅을수록 painted 잔존↓

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def choose_box(W, H, ov):
    """맵을 덮는 데 낭비(겹침+여백) 최소인 일반 비율 박스 → (cw, ch, cols, rows, (rw, rh)).
    cw≤W·ch≤H 보장(맵 밖 패딩 없음). 후보 없으면(아주 작은 맵) 통짜 1청크(맵 크기)."""
    best = None
    for rw, rh in RATIOS:
        for k in range(1, MAX_SIDE + 1):
            cw, ch = rw * k, rh * k
            if not (MIN_SIDE <= max(cw, ch) <= MAX_SIDE):
                continue
            if cw > W or ch > H:
                continue
            cols = max(1, math.ceil((W - ov) / (cw - ov)))
            rows = max(1, math.ceil((H - ov) / (ch - ov)))
            waste = cols * rows * cw * ch - W * H  # 겹침+여백 면적
            key = (waste, cols * rows, abs(cw - ch))  # 낭비↓ → 청크수↓ → 정사각 선호
            if best is None or key < best[0]:
                best = (key, (cw, ch, cols, rows, (rw, rh)))
    if best is None:
        return (W, H, 1, 1, (W, H))  # 초소형 맵 → 통짜(비율 자동 불가)
    return best[1]


def starts(total, box, n):
    """[0, total-box]에 n개 시작점 균등 배치(겹침 균일). n≤1 또는 박스≥맵 → [0]."""
    if n <= 1 or total <= box:
        return [0]
    return [round(i * (total - box) / (n - 1)) for i in range(n)]


mapId = sys.argv[1] if len(sys.argv) > 1 else "sishuiguan"
OV = int(sys.argv[2]) if len(sys.argv) > 2 else 3   # 겹침 타일(상한 — 균등배치 실제 겹침은 ovx/ovy)
CELL = int(sys.argv[3]) if len(sys.argv) > 3 else 48  # 블록아웃 px/타일

# "all" → 전체 맵 일괄(각 맵 자동 선택). 자식이 매번 index.js 취합 → 보드에 전 맵 탭.
if mapId == "all":
    import subprocess
    maps = sorted(glob.glob(rf"{ROOT}\packages\data\json\maps\*.json"))
    for f in maps:
        mid = os.path.splitext(os.path.basename(f))[0]
        subprocess.run([sys.executable, os.path.abspath(__file__), mid, str(OV), str(CELL)], check=True)
    print(f"\n전체 {len(maps)}개 맵 청크 생성 완료 → docs/art/chunks/index.js")
    sys.exit(0)

mp = json.load(open(rf"{ROOT}\packages\data\json\maps\{mapId}.json", encoding="utf-8"))
W, H, tiles = mp["width"], mp["height"], mp["tiles"]
mapName = mp.get("name", mapId)

cw, ch, COLS, ROWS, (rw, rh) = choose_box(W, H, OV)
xs = starts(W, cw, COLS)
ys = starts(H, ch, ROWS)
ovx = cw - (xs[1] - xs[0]) if COLS > 1 else 0  # 균등배치 실제 겹침(타일)
ovy = ch - (ys[1] - ys[0]) if ROWS > 1 else 0

OUTDIR = rf"{ROOT}\docs\art\chunks"
os.makedirs(OUTDIR, exist_ok=True)
manifest = {"mapId": mapId, "name": mapName, "width": W, "height": H, "tilePx": TILE,
            "cols": COLS, "rows": ROWS, "overlap": max(ovx, ovy), "ovx": ovx, "ovy": ovy,
            "ratio": f"{rw}:{rh}", "box": [cw, ch], "chunks": []}

for r, sy in enumerate(ys):
    y0, y1 = sy, min(H, sy + ch)
    for c, sx in enumerate(xs):
        x0, x1 = sx, min(W, sx + cw)
        bw, bh = x1 - x0, y1 - y0  # 균일 박스(cw×ch, 맵 안 보장)
        img = Image.new("RGB", (bw * CELL, bh * CELL))
        px = img.load()
        for ty in range(y0, y1):
            row = tiles[ty]
            for tx in range(x0, x1):
                col = COLOR.get(row[tx], DEFAULT)
                edge = (int(col[0] * GRID_DARK), int(col[1] * GRID_DARK), int(col[2] * GRID_DARK))
                ox, oy = (tx - x0) * CELL, (ty - y0) * CELL
                for dy in range(CELL):
                    for dx in range(CELL):
                        # 타일 좌/상 경계 = 옅은 격자선 (Gemini 정렬 앵커, 프롬프트가 출력 렌더 금지)
                        px[ox + dx, oy + dy] = edge if (dx == 0 or dy == 0) else col
        name = f"{mapId}_r{r}_c{c}.png"
        img.save(rf"{OUTDIR}\{name}")
        manifest["chunks"].append({
            "name": name, "row": r, "col": c,
            "x0": x0, "y0": y0, "x1": x1, "y1": y1,        # 타일 범위 [x0,x1)×[y0,y1)
            "worldPx": [x0 * TILE, y0 * TILE, x1 * TILE, y1 * TILE],
            "size": [bw * CELL, bh * CELL],
        })
        print(f"  {name}  타일 [{x0}:{x1}]×[{y0}:{y1}]  {bw}×{bh}  -> {bw*CELL}×{bh*CELL}px")

json.dump(manifest, open(rf"{OUTDIR}\{mapId}_manifest.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)

# 청크 보드용 통합 인덱스 — 모든 스테이지 manifest 취합 (file:// fetch 차단 회피)
allm = {}
for f in sorted(glob.glob(os.path.join(OUTDIR, "*_manifest.json"))):
    m = json.load(open(f, encoding="utf-8"))
    allm[m["mapId"]] = m
with open(os.path.join(OUTDIR, "index.js"), "w", encoding="utf-8") as fp:
    fp.write("window.CHUNK_STAGES = " + json.dumps(allm, ensure_ascii=False) + ";\n")

aspect = (cw / ch) if ch else 0
print(f"\n{mapName}: {W}×{H} → {rw}:{rh} 박스 {cw}×{ch}타일, {COLS}×{ROWS}={COLS*ROWS}조각, 겹침 {ovx}/{ovy}타일")
print(f"  블록아웃 {cw*CELL}×{ch*CELL}px (비율 {aspect:.3f})")
print(f"  manifest: docs/art/chunks/{mapId}_manifest.json | 보드 인덱스: index.js ({len(allm)}스테이지)")
print(f"  월드 크기(런타임): {W*TILE}×{H*TILE}px")
