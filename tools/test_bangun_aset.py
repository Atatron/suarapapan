"""Regresi impor koleksi: seluruh berkas uji berada di direktori sementara."""
import contextlib
import copy
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from bangun_aset import bangun_koleksi, potong_latar


class ImporKoleksiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.src, self.out, self.scene = root / "source", root / "assets", root / "scene"
        (self.src / "final").mkdir(parents=True)
        self.scene.mkdir()
        self.mapping = root / "mapping.json"
        for kind, name in (("obj", "objek-lama"), ("tempat", "tempat-lama")):
            folder = self.out / kind
            folder.mkdir(parents=True)
            Image.new("RGBA", (10, 10), (30, 70, 90, 255)).save(folder / f"{name}.webp", "WEBP")

        ids = ("farm jungle underwater woodland flower-garden homeyard community fruit-market "
               "vegetable-garden kitchen classroom living-room city-road nature dressing-room playroom "
               "savanna river deep-ocean beach wetland polar night-forest rice-fields clinic harbor "
               "airport railway space playground open-sky mountains").split()
        backgrounds = {lid: {"nama": lid, "permukaan": "ground", "x": [0.1, 0.9], "y": [0.6, 0.9]}
                       for lid in ids}
        backgrounds["farm"].update(x=[0.2, 0.8], y=[0.55, 0.88])
        self.legacy = {
            "pustaka": {"obj": {"objek-lama": {"k": "mainan", "n": "objek lama"}},
                        "tempat": {"tempat-lama": {"w": 10, "h": 10}}},
            "ukuran": {"objek-lama": {"t": 0.7, "x": 0, "y": 0, "w": 1, "h": 1}},
            "latar": {"latar": backgrounds,
                      "benda": {"objek-lama": {"latar": "farm", "permukaan": "ground",
                                                "jangkar": "bottom-center", "x": [0.2, 0.8], "y": [0.55, 0.88]}}},
        }
        for name, data in self.legacy.items():
            self.write_json(self.scene / f"{name}.json", data)

        image = Image.new("RGB", (320, 240), "white")
        draw = ImageDraw.Draw(image)
        cells, names, items = [], [], []
        for i in range(12):
            x, y = (i % 4) * 80, (i // 4) * 80
            draw.rectangle((x + 20, y + 20, x + 59, y + 59), fill=(30 + i * 10, 70, 120))
            name = f"source {i}"
            names.append(name)
            cells.append({"index": i, "name": name, "column": i % 4, "row": i // 4,
                          "cell": [x, y, 80, 80], "spriteBounds": [x + 20, y + 20, 40, 40]})
            items.append({"source": name, "id": f"benda-{i}", "name": f"benda {i}", "height": 0.4})
        items[0]["background"] = "playroom"
        items[-1]["kind"] = "tempat"
        file = "final/01-mainan.png"
        image.save(self.src / file)
        self.atlas = [{"number": 1, "slug": "mainan", "file": file, "width": 320, "height": 240,
                       "items": cells}]
        self.peta = {"sheets": [{"number": 1, "slug": "mainan", "kind": "obj", "items": items}]}
        self.write_json(self.src / "atlas.json", self.atlas)
        self.write_json(self.src / "manifest.json", {
            "sheetCount": 1, "spriteCount": 12, "cellWidth": 80, "cellHeight": 80,
            "sheets": [{"number": 1, "slug": "mainan", "file": "01-mainan.png", "items": names}],
        })
        checksums = {file: hashlib.sha256((self.src / file).read_bytes()).hexdigest()}
        self.write_json(self.src / "checksums.json", checksums)
        self.write_json(self.mapping.with_name("mapping_checksums.json"), checksums)
        self.write_json(self.mapping, self.peta)

    @staticmethod
    def write_json(path, data):
        path.write_text(json.dumps(data), encoding="utf-8")

    def read_scene(self, name):
        return json.loads((self.scene / f"{name}.json").read_text(encoding="utf-8"))

    def build(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return bangun_koleksi(self.src, self.out, None, self.mapping, scene_dir=self.scene)

    def snapshot(self):
        return {f"{folder.name}/{path.relative_to(folder).as_posix()}": hashlib.sha256(path.read_bytes()).hexdigest()
                for folder in (self.out, self.scene) for path in folder.rglob("*") if path.is_file()}

    def test_merge_preserves_legacy_and_rerun_is_idempotent(self):
        before = self.snapshot()
        self.assertEqual(self.build(), 0)
        pustaka, ukuran, latar = (self.read_scene(name) for name in ("pustaka", "ukuran", "latar"))
        self.assertEqual(pustaka["obj"]["objek-lama"], self.legacy["pustaka"]["obj"]["objek-lama"])
        self.assertEqual(pustaka["tempat"]["tempat-lama"], self.legacy["pustaka"]["tempat"]["tempat-lama"])
        self.assertEqual(ukuran["objek-lama"], self.legacy["ukuran"]["objek-lama"])
        self.assertEqual(latar["benda"]["objek-lama"], self.legacy["latar"]["benda"]["objek-lama"])
        self.assertEqual(latar["latar"], self.legacy["latar"]["latar"])
        self.assertEqual(len(pustaka["obj"]), 12)
        self.assertEqual(len(pustaka["tempat"]), 2)
        self.assertEqual(set(ukuran), set(pustaka["obj"]))
        self.assertEqual(set(latar["benda"]), set(pustaka["obj"]))
        first = self.snapshot()
        for name in ("obj/objek-lama.webp", "tempat/tempat-lama.webp"):
            self.assertEqual(first[f"assets/{name}"], before[f"assets/{name}"])
        self.assertEqual(self.build(), 0)
        self.assertEqual(self.snapshot(), first, "rerun must preserve image and config bytes")

    def test_background_override_can_change_after_first_import(self):
        self.build()
        self.assertEqual(self.read_scene("latar")["benda"]["benda-0"]["latar"], "playroom")
        self.peta["sheets"][0]["items"][0]["background"] = "farm"
        self.write_json(self.mapping, self.peta)
        self.build()
        actual = self.read_scene("latar")["benda"]["benda-0"]
        expected = self.legacy["latar"]["latar"]["farm"]
        self.assertEqual(actual["latar"], "farm")
        for key in ("permukaan", "x", "y"):
            self.assertEqual(actual[key], expected[key])

    def test_bad_cells_are_rejected_before_assets_or_configs_change(self):
        before = self.snapshot()
        for bad in ("duplicate", "fractional"):
            with self.subTest(cell=bad):
                atlas = copy.deepcopy(self.atlas)
                last = atlas[0]["items"][-1]
                if bad == "duplicate":
                    last["cell"] = atlas[0]["items"][-2]["cell"][:]
                    last["spriteBounds"] = atlas[0]["items"][-2]["spriteBounds"][:]
                else:
                    last["cell"][0] += 0.5
                    last["spriteBounds"][0] += 0.5
                self.write_json(self.src / "atlas.json", atlas)
                with self.assertRaisesRegex(ValueError, "Grid/koordinat sel salah"):
                    self.build()
                self.assertEqual(self.snapshot(), before)

    def test_selected_white_pocket_preserves_white_object_details(self):
        image = Image.new("RGB", (64, 64), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((8, 8, 55, 55), fill="black")
        draw.rectangle((12, 12, 28, 51), fill="white")  # celah yang dipilih
        draw.rectangle((35, 12, 51, 51), fill="white")  # isi benda, tetap putih
        result = potong_latar(np.array(image), 253, biji_kantong=[(20, 30)])
        self.assertEqual(result[0, 0, 3], 0)
        self.assertEqual(result[30, 20, 3], 0)
        self.assertEqual(result[30, 43].tolist(), [255, 255, 255, 255])

    def test_small_off_white_mesh_pocket_uses_item_settings(self):
        image = Image.new("RGB", (64, 64), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((8, 8, 55, 55), fill=(80, 80, 80))
        draw.rectangle((20, 20, 26, 26), fill=(245, 245, 245))
        original = potong_latar(np.array(image), 253, True)
        mesh = potong_latar(np.array(image), 240, True, kantong_min=5, kantong_putih=0)
        self.assertEqual(original[23, 23, 3], 255)
        self.assertEqual(mesh[23, 23, 3], 0)
        self.assertEqual(mesh[40, 40, 3], 255)


if __name__ == "__main__":
    unittest.main()
