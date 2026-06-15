# -*- coding: utf-8 -*-
"""리그 프리뷰 렌더러 — skeleton.json + 파트 PNG를 한 장의 이미지로 합성.

목적: Claude가 게임 스크린샷 없이도 리그 조립 상태를 "눈으로" 확인하고 본 오프셋을
자동 보정하기 위함. apps/web/src/pixi/skeleton.ts 의 affine 수식을 그대로 이식한다.

사용: python rig_render.py <spriteId> [clip] [t]
  예: python rig_render.py guanyu idle 0
출력: tools/sprite-pipeline/out/rig_<spriteId>_<clip>_<t>.png
"""
import sys, os, json, math
from PIL import Image

ROOT = r"C:\project\threekingdoms"
PX = 6           # 프리뷰 픽셀/유닛
DEG = math.pi / 180

def localToMat(x, y, rot, sx, sy):
    r = rot * DEG; c = math.cos(r); s = math.sin(r)
    return (c * sx, s * sx, -s * sy, c * sy, x, y)  # a,b,c,d,tx,ty

def mul(p, q):
    pa, pb, pc, pd, ptx, pty = p; qa, qb, qc, qd, qtx, qty = q
    return (pa*qa + pc*qb, pb*qa + pd*qb, pa*qc + pc*qd, pb*qc + pd*qd,
            pa*qtx + pc*qty + ptx, pb*qtx + pd*qty + pty)

def sample(track, t):
    if not track: return (0, 0, 0, 1, 1)
    if t <= track[0]["time"]: k = track[0]
    elif t >= track[-1]["time"]: k = track[-1]
    else:
        k = track[-1]
        for i in range(1, len(track)):
            k1 = track[i]
            if t <= k1["time"]:
                k0 = track[i-1]; span = k1["time"] - k0["time"]; u = (t - k0["time"]) / span if span else 0
                def lp(a, b): return a + (b - a) * u
                k = {"x": lp(k0["x"], k1["x"]), "y": lp(k0["y"], k1["y"]), "rotation": lp(k0["rotation"], k1["rotation"]),
                     "scaleX": lp(k0["scaleX"], k1["scaleX"]), "scaleY": lp(k0["scaleY"], k1["scaleY"])}
                break
    return (k["x"], k["y"], k["rotation"], k["scaleX"], k["scaleY"])

def render(spriteId, clipName="idle", t=0.0):
    d = os.path.join(ROOT, "apps", "web", "public", "assets", "skeletons", spriteId)
    skel = json.load(open(os.path.join(d, f"{spriteId}.skeleton.json"), encoding="utf-8"))
    bones = {b["name"]: b for b in skel["bones"]}
    clip = skel.get("clips", {}).get(clipName)
    time = (t * clip["duration"]) if clip else 0
    timelines = clip["timelines"] if clip else {}

    worlds = {}
    def world(name):
        if name in worlds: return worlds[name]
        b = bones[name]
        dx, dy, drot, dsx, dsy = sample(timelines.get(name), time)
        local = localToMat(b["x"] + dx, b["y"] + dy, b["rotation"] + drot, b["scaleX"] * dsx, b["scaleY"] * dsy)
        w = mul(world(b["parent"]), local) if b.get("parent") else local
        worlds[name] = w; return w
    for n in bones: world(n)

    W, H = 320, 460
    ox, oy = W // 2, H - 40   # 발 원점(바닥)
    canvas = Image.new("RGBA", (W, H), (26, 30, 38, 255))
    # 지면선
    for x in range(W): canvas.putpixel((x, oy), (90, 130, 90, 255))

    slots = sorted(skel["slots"], key=lambda s: s["z"])
    for slot in slots:
        att = skel["attachments"].get(slot["name"], {}).get(slot["attachment"])
        if not att: continue
        path = os.path.join(d, att["image"])
        if not os.path.exists(path): continue
        part = Image.open(path).convert("RGBA")
        bw = worlds[slot["bone"]]
        am = mul(bw, localToMat(att["x"], att["y"], att["rotation"], att["scaleX"], att["scaleY"]))
        a, b_, c, dd, tx, ty = am
        sx = math.hypot(a, b_); sy = math.hypot(c, dd)
        pw = max(1, round(att["width"] * sx * PX)); ph = max(1, round(att["height"] * sy * PX))
        part = part.resize((pw, ph), Image.LANCZOS)
        ang = math.degrees(math.atan2(b_, a))
        if abs(ang) > 0.5:
            part = part.rotate(-ang, expand=True, resample=Image.BICUBIC)
        cx = ox + tx * PX; cy = oy + ty * PX
        canvas.alpha_composite(part, (int(cx - part.width / 2), int(cy - part.height / 2)))

    outdir = os.path.join(ROOT, "tools", "sprite-pipeline", "out"); os.makedirs(outdir, exist_ok=True)
    outp = os.path.join(outdir, f"rig_{spriteId}_{clipName}_{t}.png")
    canvas.save(outp)
    print(outp)

if __name__ == "__main__":
    sid = sys.argv[1] if len(sys.argv) > 1 else "guanyu"
    clip = sys.argv[2] if len(sys.argv) > 2 else "idle"
    t = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    render(sid, clip, t)
