# -*- coding: utf-8 -*-
"""Gemini 2.5 Flash Image (nano banana) 이미지 생성 래퍼.

CLAUDE.md §3 일러스트 = Gemini 2.5 Flash Image. 텍스트→이미지 + 선택적 레퍼런스 이미지(img2img,
캐릭터 일관성). 자격증명은 루트 .env.gemini (gitignored):
  GEMINI_API_KEY=...
  GEMINI_IMAGE_MODEL=gemini-2.5-flash-image   # 선택(기본값 이거)

설치:  pip install google-genai pillow
"""
import os, io, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
# nano-banana2 = Nano Banana Pro = Gemini 3 Pro Image (GA). .env 의 GEMINI_IMAGE_MODEL 로 오버라이드 가능.
DEFAULT_MODEL = "gemini-3-pro-image"


def load_env():
    """루트 .env.gemini + .env.r2 → os.environ(미설정만). 키를 어디 넣어두든 잡히게 둘 다 읽는다."""
    for fname in (".env.gemini", ".env.r2"):
        path = os.path.join(ROOT, fname)
        if not os.path.exists(path):
            continue
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_client = None


def get_client():
    global _client
    if _client is not None:
        return _client
    load_env()
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY 없음 — 루트 .env.gemini 에 넣으세요")
    try:
        from google import genai
    except ImportError as e:
        raise RuntimeError("google-genai 미설치:  pip install google-genai pillow") from e
    _client = genai.Client(api_key=key)
    return _client


def _extract_image_bytes(resp):
    """generate_content 응답에서 첫 inline 이미지 바이트를 뽑는다. 없으면 None + 텍스트(거부사유)."""
    text_bits = []
    for cand in getattr(resp, "candidates", []) or []:
        content = getattr(cand, "content", None)
        for part in (getattr(content, "parts", None) or []):
            inline = getattr(part, "inline_data", None)
            if inline and getattr(inline, "data", None):
                return inline.data, None
            if getattr(part, "text", None):
                text_bits.append(part.text)
    return None, " ".join(text_bits)[:300]


def generate_image(prompt, out_path, ref_paths=None, model=None, retries=3, backoff=6):
    """프롬프트(+선택 ref 이미지들)로 이미지 1장 생성 → out_path(PNG)에 저장. 성공 True.

    ref_paths: 캐릭터 일관성용 참조 PNG 경로 리스트(img2img). 없으면 순수 text2img.
    너무 빠른 연속 호출은 레이트리밋 에러 → retries회 재시도, 점증 백오프(backoff*attempt초).
    레이트리밋(429/quota/rate)으로 보이면 더 길게 쉰다.
    """
    from PIL import Image
    client = get_client()
    model = model or os.environ.get("GEMINI_IMAGE_MODEL", DEFAULT_MODEL)

    contents = [prompt]
    for rp in (ref_paths or []):
        if os.path.exists(rp):
            contents.append(Image.open(rp))

    last_err = None
    for attempt in range(1, retries + 1):
        try:
            resp = client.models.generate_content(model=model, contents=contents)
            data, refusal = _extract_image_bytes(resp)
            if data is None:
                last_err = f"이미지 없음(거부/텍스트): {refusal}"
            else:
                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                Image.open(io.BytesIO(data)).save(out_path, "PNG")  # PNG 정규화(투명 보존)
                return True
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
        if attempt < retries:
            es = (last_err or "").lower()
            rate = any(t in es for t in ("429", "rate", "quota", "resource_exhausted", "exhausted"))
            wait = backoff * attempt * (3 if rate else 1)
            print(f"  [재시도 {attempt}/{retries - 1}] {os.path.basename(out_path)} — {wait}s 대기 ({last_err[:80]})")
            time.sleep(wait)
    print(f"  [실패] {os.path.basename(out_path)}: {last_err}")
    return False
