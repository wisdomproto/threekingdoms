# -*- coding: utf-8 -*-
"""개발용 정적 서버 — 프로젝트 루트를 :8080에 서빙하되 모든 응답에 no-store.
에디터/대시보드(정적 HTML)가 브라우저 캐시로 옛 버전에 붙드는 문제를 원천 차단한다.
실행: python tools/serve.py  (launch.json 의 'tools' 설정이 이 파일을 띄운다)
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = r"C:\project\threekingdoms"
PORT = 8080


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    print(f"serving {ROOT} on http://localhost:{PORT}  (no-store)")
    ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
