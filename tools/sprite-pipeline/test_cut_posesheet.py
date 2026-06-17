# -*- coding: utf-8 -*-
import unittest, sys, os
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cut_posesheet as C

def make_sheet(rows, cols, cell=60, gap=30):
    W = cols*cell + (cols+1)*gap; H = rows*cell + (rows+1)*gap
    im = Image.new("RGBA", (W, H), (0,0,0,0)); d = ImageDraw.Draw(im)
    for r in range(rows):
        for c in range(cols):
            x = gap + c*(cell+gap); y = gap + r*(cell+gap)
            d.rectangle([x, y, x+cell-1, y+cell-1], fill=(200, 60+r*60, 60+c*60, 255))
    return im

class TestCut(unittest.TestCase):
    def test_grid_3x3(self):
        grid = C.detect_grid(make_sheet(3, 3))
        self.assertEqual(len(grid), 3)
        for row in grid: self.assertEqual(len(row), 3)
    def test_cut_3x3_tiers(self):
        res = C.cut_sheet(make_sheet(3, 3), ["idle","move","attack"])
        self.assertEqual(len(res), 9)
        self.assertEqual(sorted(set(t for t,_,_ in res)), [0,1,2])
        row0 = [p for t,p,_ in res if t==0]; self.assertEqual(sorted(row0), ["attack","idle","move"])
    def test_cut_1x3_backcompat(self):
        res = C.cut_sheet(make_sheet(1, 3), ["idle","move","attack"])
        self.assertEqual(len(res), 3)
        self.assertTrue(all(t==0 for t,_,_ in res))
    def test_main_tier_paths(self):
        import tempfile, json, shutil
        tmp = tempfile.mkdtemp()
        try:
            C.SPRITES = tmp
            d = os.path.join(tmp, "_tiertest"); os.makedirs(d)
            make_sheet(3, 3).save(os.path.join(d, "_posesheet.png"))
            argv = sys.argv; sys.argv = ["cut", "_tiertest"]
            try: C.main()
            finally: sys.argv = argv
            for pose in ("idle", "move", "attack"):
                self.assertTrue(os.path.exists(os.path.join(d, f"front_{pose}.png")))
                self.assertTrue(os.path.exists(os.path.join(d, "t2", f"front_{pose}.png")))
                self.assertTrue(os.path.exists(os.path.join(d, "t3", f"front_{pose}.png")))
            man = json.load(open(os.path.join(tmp, "manifest.json"), encoding="utf-8"))
            self.assertEqual(sorted(man["_tiertest"]["poses"]), ["front_attack", "front_idle", "front_move"])
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    unittest.main()
