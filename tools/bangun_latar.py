"""Mengubah paket "subject-matched-backgrounds" menjadi aset aplikasi.

Jalankan (dari folder suarapapan):
  python -I tools/bangun_latar.py --src <folder subject-matched-backgrounds> --out web/public/aset/latar [--qa <folder>]

Keluaran:
  web/public/aset/latar/<id>.webp   32 latar 1280×720 (dari 1672×941)
  web/src/scene/latar.json          latar + pasangan benda → latar + area penempatan
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bangun_aset import slug  # noqa: E402  (aturan nama file yang sama dengan pustaka benda)

UKURAN = (1280, 720)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--qa", default=None)
    a = ap.parse_args()
    src, out = Path(a.src), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    peta = json.loads((src / "sprite-background-map.json").read_text(encoding="utf-8"))

    latar = {}
    kecil = []
    for b in peta["backgrounds"]:
        im = Image.open(src / b["file"]).convert("RGB")
        im = im.resize(UKURAN, Image.LANCZOS)
        im.save(out / f"{b['id']}.webp", "WEBP", quality=82, method=4)
        latar[b["id"]] = {"nama": b["name"], "jenis": b["type"], "kategori": b.get("category"), "permukaan": b["defaultSurface"]}
        kecil.append((b["id"], im))

    benda = {}
    per_latar = {}
    for cat in peta["categories"]:
        for it in cat["items"]:
            nama = slug(it["spriteName"])
            if nama in benda:
                print("slug ganda:", nama)
                continue
            p = it["placement"]
            r = p["recommendedNormalizedRegion"]
            benda[nama] = {
                "latar": it["backgroundId"],
                "permukaan": p["surface"],
                "jangkar": p["anchor"],
                "x": r["x"],
                "y": r["y"],
            }
            per_latar.setdefault(it["backgroundId"], []).append((p["surface"], tuple(r["x"]), tuple(r["y"])))

    # Area bawaan tiap latar = penempatan yang paling sering dipakai bendanya.
    for lid, daftar in per_latar.items():
        (perm, x, y), _ = Counter(daftar).most_common(1)[0]
        latar[lid].update({"permukaan": perm, "x": list(x), "y": list(y)})
    for lid, v in latar.items():
        v.setdefault("x", [0.1, 0.9])
        v.setdefault("y", [0.58, 0.9])

    jalur = Path(__file__).resolve().parent.parent / "web" / "src" / "scene" / "latar.json"
    jalur.write_text(json.dumps({"latar": latar, "benda": benda}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"latar: {len(latar)}, benda: {len(benda)}, dipakai per latar: " + ", ".join(f"{k}={len(v)}" for k, v in sorted(per_latar.items())))

    if a.qa:
        qa = Path(a.qa)
        qa.mkdir(parents=True, exist_ok=True)
        w, h = 480, 270 + 22
        for bagian in range(2):
            lembar = Image.new("RGB", (4 * w, 4 * h), (255, 255, 255))
            d = ImageDraw.Draw(lembar)
            for i, (lid, im) in enumerate(kecil[bagian * 16:(bagian + 1) * 16]):
                t = im.resize((480, 270), Image.LANCZOS)
                x, y = (i % 4) * w, (i // 4) * h
                lembar.paste(t, (x, y))
                # tandai area penempatan bawaan
                v = latar[lid]
                d.rectangle([x + v["x"][0] * 480, y + v["y"][0] * 270, x + v["x"][1] * 480, y + v["y"][1] * 270], outline=(255, 0, 255), width=2)
                d.text((x + 4, y + 272), f"{lid} [{v['permukaan']}]", fill=(0, 0, 0))
            lembar.save(qa / f"latar-{bagian + 1}.png")


if __name__ == "__main__":
    main()
