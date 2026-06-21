# -*- coding: utf-8 -*-
import unittest, sys, os, tempfile, shutil
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cut_fx_sheet as F

def make_glow_sheet(rows, cols, cell=60, gap=40):
    """검은 배경 + 밝은(발광) 사각형 요소 격자. 실제 fx 시트(검정+발광) 모사."""
    W = cols*cell + (cols+1)*gap; H = rows*cell + (rows+1)*gap
    im = Image.new("RGB", (W, H), (0, 0, 0)); d = ImageDraw.Draw(im)
    for r in range(rows):
        for c in range(cols):
            x = gap + c*(cell+gap); y = gap + r*(cell+gap)
            d.rectangle([x, y, x+cell-1, y+cell-1], fill=(255, 220, 120))  # 밝은 금빛
    return im

class TestFxCut(unittest.TestCase):
    def test_luminance_proxy_alpha_from_brightness(self):
        # 검정 픽셀→alpha 0, 밝은 픽셀→alpha 큼
        im = make_glow_sheet(1, 1)
        proxy = F.luminance_alpha(im)
        self.assertEqual(proxy.mode, "RGBA")
        px = proxy.load()
        self.assertEqual(px[0, 0][3], 0)                 # 모서리=검정 배경
        cx, cy = proxy.size[0]//2, proxy.size[1]//2
        self.assertGreater(px[cx, cy][3], 200)           # 중앙=밝은 요소

    def test_cut_2x3_keys(self):
        keys = ["slash", "sparkle", "flash", "smoke", "coin", "pierce"]
        cells = F.cut_cells(make_glow_sheet(2, 3), keys)
        self.assertEqual(len(cells), 6)
        self.assertEqual([k for k, _ in cells], keys)    # 행-우선 매핑
        for _, img in cells:
            self.assertEqual(img.mode, "RGB")            # 검정 유지(투명화 안 함)

    def test_main_writes_fx_pngs(self):
        tmp = tempfile.mkdtemp()
        try:
            F.FX_DIR = tmp
            sheet = os.path.join(tmp, "_sheet.png"); make_glow_sheet(2, 3).save(sheet)
            argv = sys.argv; sys.argv = ["cut", sheet, "--keys", "slash,sparkle,flash,smoke,coin,pierce"]
            try: F.main()
            finally: sys.argv = argv
            for k in ("slash", "coin", "flash"):
                self.assertTrue(os.path.exists(os.path.join(tmp, f"{k}.png")))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    unittest.main()
