# -*- coding: utf-8 -*-
"""개발용 정적 서버 — 프로젝트 루트를 :8080에 서빙하되 모든 응답에 no-store.
에디터/대시보드(정적 HTML)가 브라우저 캐시로 옛 버전에 붙드는 문제를 원천 차단한다.
실행: python tools/serve.py  (launch.json 의 'tools' 설정이 이 파일을 띄운다)

추가: POST /save-asset — 에디터가 만든 이미지를 게임에 "바로 적용".
  body(JSON): { "path": "assets/scenes/05-sishuiguan-intro.webp", "b64": "<base64>", "contentType": "image/webp" }
  ① apps/web/public/<path> 에 쓰고(= dev 게임이 /public에서 즉시 서빙)
  ② .env.r2 가 있으면 R2 버킷 key=<path> 로도 업로드(= 배포본 자동 동기화).
  시크릿(R2 키)은 이 서버에만 있고 에디터엔 노출되지 않는다.
"""
import sys, os, json, base64, mimetypes, subprocess, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "apps", "web", "public")
CUT_SCRIPT = os.path.join(ROOT, "tools", "sprite-pipeline", "cut_posesheet.py")
PORT = 8080

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# R2 캐시(드롭-인 교체 즉시 반영되도록 dev 친화적으로 짧게).
R2_CACHE_CONTROL = "public, max-age=300, s-maxage=3600"


def _load_r2_env():
    """루트 .env.r2 를 dict로. 없으면 빈 dict(→ R2 업로드 건너뜀)."""
    path = os.path.join(ROOT, ".env.r2")
    env = {}
    if not os.path.exists(path):
        return env
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def _r2_upload(key, data, content_type):
    """R2에 단일 객체 업로드. 성공 True / 미설정·실패 False(+사유 반환)."""
    env = _load_r2_env()
    need = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
    if not all(env.get(k) for k in need):
        return False, "R2 미설정(.env.r2)"
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        return False, "boto3 미설치"
    try:
        s3 = boto3.client(
            "s3", endpoint_url=f"https://{env['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=env["R2_ACCESS_KEY_ID"], aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
            config=Config(signature_version="s3v4", region_name="auto"),
        )
        s3.put_object(Bucket=env["R2_BUCKET"], Key=key, Body=data,
                      ContentType=content_type, CacheControl=R2_CACHE_CONTROL)
        return True, env["R2_BUCKET"]
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def _run_cut(sid, flip):
    """저장된 _posesheet.png 를 cut_posesheet.py 로 자동 컷(고정 3×3 + 선택 flip).

    9칸 시트를 front_{idle,move,attack}.png(등급1 루트) + t2/t3 로 잘라 게임에 즉시 반영한다.
    flip=True 면 좌우 반전(screen-right→left). 결과 {ok, cells, flip, output} 반환.
    """
    cmd = [sys.executable, CUT_SCRIPT, sid, "--grid=3x3"] + (["--flip"] if flip else [])
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                           env=env, cwd=ROOT, timeout=60)
        out = (p.stdout or "") + (p.stderr or "")
        m = re.search(r"(\d+)\s*칸", out) or re.search(r"검출 셀 (\d+)", out)
        return {"ok": p.returncode == 0, "cells": int(m.group(1)) if m else None,
                "flip": flip, "output": out[-800:]}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _asset_status(self):
        """게임에 실제로 들어가 있는 에셋 목록 — 보드 드롭다운의 ✓/⬜ 표시용.
          sprites:  assets/sprites/<id>/ 중 front_*.png 또는 manifest.json 보유한 id
          portraits: assets/ui/portraits/<id>.webp 의 id
          scenes:   assets/scenes/<bgId>.webp 의 bgId
        """
        sprites, portraits, scenes = [], [], []
        sp_dir = os.path.join(PUBLIC, "assets", "sprites")
        if os.path.isdir(sp_dir):
            for name in os.listdir(sp_dir):
                d = os.path.join(sp_dir, name)
                if not os.path.isdir(d):
                    continue
                files = os.listdir(d)
                if any(f.startswith("front_") and f.endswith(".png") for f in files) \
                        or "manifest.json" in files:
                    sprites.append(name)
        po_dir = os.path.join(PUBLIC, "assets", "ui", "portraits")
        if os.path.isdir(po_dir):
            portraits = [os.path.splitext(f)[0] for f in os.listdir(po_dir)
                         if f.lower().endswith(".webp")]
        sc_dir = os.path.join(PUBLIC, "assets", "scenes")
        if os.path.isdir(sc_dir):
            scenes = [os.path.splitext(f)[0] for f in os.listdir(sc_dir)
                      if f.lower().endswith(".webp")]
        return {"sprites": sorted(sprites), "portraits": sorted(portraits), "scenes": sorted(scenes)}

    def do_GET(self):  # noqa: N802
        if self.path.split("?")[0] == "/asset-status":
            self._json(200, self._asset_status())
            return
        super().do_GET()

    def do_OPTIONS(self):  # noqa: N802 — CORS 프리플라이트
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):  # noqa: N802
        if self.path.split("?")[0] != "/save-asset":
            self._json(404, {"ok": False, "error": "unknown endpoint"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            rel = (payload.get("path") or "").replace("\\", "/").lstrip("/")
            b64 = payload.get("b64") or ""
            ctype = payload.get("contentType") or mimetypes.guess_type(rel)[0] or "application/octet-stream"
        except Exception as e:  # noqa: BLE001
            self._json(400, {"ok": False, "error": f"잘못된 요청: {e}"})
            return

        # 경로 안전성: assets/ 하위만, 상위 탈출 금지.
        if not rel.startswith("assets/") or ".." in rel.split("/"):
            self._json(400, {"ok": False, "error": f"허용되지 않은 경로: {rel}"})
            return

        try:
            data = base64.b64decode(b64)
        except Exception as e:  # noqa: BLE001
            self._json(400, {"ok": False, "error": f"base64 디코드 실패: {e}"})
            return

        # ① 로컬 public/ 에 쓰기 (dev 즉시 반영)
        dest = os.path.join(PUBLIC, *rel.split("/"))
        try:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as f:
                f.write(data)
        except Exception as e:  # noqa: BLE001
            self._json(500, {"ok": False, "error": f"로컬 쓰기 실패: {e}"})
            return

        # ② R2 업로드 (설정돼 있으면)
        r2_ok, r2_info = _r2_upload(rel, data, ctype)

        msg = f"public/{rel} 저장"
        msg += f" + R2 업로드({r2_info})" if r2_ok else f" (R2 건너뜀: {r2_info})"
        sys.stdout.write("[save-asset] " + msg + "\n")

        # ③ 포즈 시트 자동 컷 (payload.cut) — _posesheet.png 저장 직후 cut_posesheet.py 실행
        resp = {"ok": True, "local": rel, "r2": r2_ok, "r2info": r2_info, "bytes": len(data)}
        if payload.get("cut") and rel.startswith("assets/sprites/") and rel.endswith("/_posesheet.png"):
            parts = rel.split("/")
            sid = parts[2] if len(parts) >= 4 else None
            if sid:
                cut = _run_cut(sid, bool(payload.get("flip")))
                resp["cut"] = cut
                sys.stdout.write(f"[save-asset] cut {sid} flip={bool(payload.get('flip'))} → ok={cut.get('ok')} cells={cut.get('cells')}\n")

        self._json(200, resp)


if __name__ == "__main__":
    print(f"serving {ROOT} on http://localhost:{PORT}  (no-store, POST /save-asset 활성)")
    ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
