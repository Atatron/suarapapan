"""Memotong sprite sheet hasil generate menjadi satu file per benda/tempat.

Jalankan (dari folder suarapapan):
  python -I tools/bangun_aset.py --sprites <folder sprite-sheets-16> --places <folder imagegen> --out web/public/aset

Masukan: atlas.json + manifest.json (sprite 4x3 per kategori) dan dua sheet
tempat (ikon + diorama). Keluaran: web/public/aset/obj/*.webp, tempat/*.webp,
dan web/src/scene/pustaka.json (daftar yang dibaca aplikasi).

Latar putih dibuang dengan flood-fill dari tepi sel (bagian putih di dalam
gambar, mis. bercak sapi, tetap karena dikelilingi garis tepi). Piksel tepi
yang bercampur putih di-"unmix" ke warna garis aslinya, supaya tidak ada
halo putih di atas papan hijau tua.
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

KANVAS = (400, 320)       # benda: 5:4 seperti gambar SVG lama
ISI = (372, 296)          # area gambar di dalam kanvas, rata bawah
MAKS_PERBESAR = 1.35
PAPAN = (22, 48, 42)      # #16302A, untuk contact sheet

SLUG_KHUSUS = {"bebek kecil (anak ayam)": "anak-bebek"}

# Benda yang punya celah latar tertutup (sela kaki, gagang, jeruji, lubang).
# Flood-fill dari tepi tidak bisa mencapainya, jadi kantong putih murni yang
# besar di benda-benda ini dibuang juga. Benda lain (awan, nasi, piring, susu,
# roket, bola, ...) memang berisi warna putih, jadi tidak dimasukkan. Daftar
# ini hasil memeriksa gambar satu per satu; benda baru perlu diperiksa dulu.
KANTONG_LATAR = {
    "ayam", "bebek", "angsa", "burung", "elang", "flamingo", "pelikan", "anak-bebek", "camar", "laba-laba",
    "petani", "pilot", "anak-kursi-roda", "ceri", "donat", "gunting", "kursi", "keranjang", "sepeda",
    "helikopter", "kacamata", "tas-kecil",
}
KANTONG_MIN = 200     # piksel
KANTONG_PUTIH = 0.8   # bagian yang tepat #FFFFFF

TEMPAT_IKON = ["rumput", "hutan", "kebun", "sawah", "peternakan", "gunung",
               "sungai", "danau", "kolam", "laut", "bawah-laut", "pantai"]
TEMPAT_DIORAMA = ["dapur", "kamar", "kelas", "sekolah", "pasar", "kota",
                  "jalan-desa", "gurun", "salju", "kebun-binatang", None, None]  # 2 terakhir ganda dengan ikon


def slug(teks: str) -> str:
    if teks in SLUG_KHUSUS:
        return SLUG_KHUSUS[teks]
    t = unicodedata.normalize("NFKD", teks).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def potong_latar(rgb: np.ndarray, ambang: int, buang_kantong: bool = False) -> np.ndarray:
    """RGB (h,w,3) uint8 → RGBA dengan latar putih dibuang tanpa halo."""
    h, w, _ = rgb.shape
    terang = rgb.min(axis=2) >= ambang
    # Beri bingkai putih 1 piksel supaya semua latar saling tersambung lewat tepi.
    padded = np.pad(terang, 1, constant_values=True)
    label, _ = ndi.label(padded)
    id_latar = label[0, 0]            # sudut bingkai putih = latar
    label = label[1:-1, 1:-1]
    bg = label == id_latar
    if buang_kantong:
        putih255 = (rgb == 255).all(axis=2)
        for i in range(1, label.max() + 1):
            m = label == i
            n = int(m.sum())
            if n >= KANTONG_MIN and not bg[m].any() and putih255[m].mean() >= KANTONG_PUTIH:
                bg |= m

    inti = ~ndi.binary_dilation(bg, iterations=3)           # jelas bagian gambar
    tepi = ~bg & ~inti                                        # 1–3 piksel dekat latar
    # Untuk tiap piksel tepi: warna "asli" = piksel inti terdekat.
    _, (iy, ix) = ndi.distance_transform_edt(~inti, return_indices=True)
    fg = rgb[iy, ix].astype(np.float32)
    c = rgb.astype(np.float32)

    pembagi = 255.0 - fg
    kuat = pembagi > 30
    rasio = np.where(kuat, (255.0 - c) / np.maximum(pembagi, 1), 0)
    jumlah = kuat.sum(axis=2)
    a = np.where(jumlah > 0, (rasio * kuat).sum(axis=2) / np.maximum(jumlah, 1), 1.0)
    a = np.clip(a, 0, 1)
    alpha = np.full((h, w), 255, np.float32)
    alpha[bg] = 0
    pakai = tepi & (jumlah > 0)
    alpha[pakai] = a[pakai] * 255
    # Warna piksel tepi diganti warna asli supaya tidak berbau putih.
    out = rgb.copy()
    out[pakai] = fg[pakai].astype(np.uint8)
    return np.dstack([out, alpha.astype(np.uint8)])


def pangkas(rgba: np.ndarray, pad: int = 1):
    ys, xs = np.nonzero(rgba[..., 3] > 8)
    if not len(ys):
        return None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return rgba[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad], (x0, y0, x1, y1)


def simpan(im: Image.Image, jalur: Path):
    jalur.parent.mkdir(parents=True, exist_ok=True)
    im.save(jalur, "WEBP", quality=90, method=4, alpha_quality=100)


def sprite_ke_kanvas(art: Image.Image) -> Image.Image:
    w, h = art.size
    s = min(ISI[0] / w, ISI[1] / h, MAKS_PERBESAR)
    art = art.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    k = Image.new("RGBA", KANVAS, (0, 0, 0, 0))
    k.alpha_composite(art, ((KANVAS[0] - art.width) // 2, KANVAS[1] - art.height - 6))
    return k


def contact_sheet(daftar, jalur: Path, kolom=8):
    sel_w, sel_h = 200, 180
    baris = (len(daftar) + kolom - 1) // kolom
    cs = Image.new("RGB", (kolom * sel_w, baris * sel_h), PAPAN)
    d = ImageDraw.Draw(cs)
    for i, (nama, im) in enumerate(daftar):
        x, y = (i % kolom) * sel_w, (i // kolom) * sel_h
        t = im.copy()
        t.thumbnail((sel_w - 16, sel_h - 34))
        cs.paste(t, (x + (sel_w - t.width) // 2, y + 6), t)
        d.text((x + 6, y + sel_h - 22), nama, fill=(243, 244, 238))
    cs.save(jalur)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sprites", required=True)
    ap.add_argument("--places", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--qa", default=None, help="folder untuk contact sheet pemeriksaan")
    a = ap.parse_args()
    sprites, places, out = Path(a.sprites), Path(a.places), Path(a.out)
    qa = Path(a.qa) if a.qa else None

    atlas = json.loads((sprites / "atlas.json").read_text(encoding="utf-8"))
    manifest = {m["number"]: m for m in json.loads((sprites / "manifest.json").read_text(encoding="utf-8"))}
    pustaka = {"obj": {}, "tempat": {}}
    semua_obj, masalah = [], []

    for sheet in atlas:
        nomor = int(sheet["File"].split("-")[0])
        kategori = manifest[nomor]["slug"]
        rgb = np.array(Image.open(sprites / "final" / sheet["File"]).convert("RGB"))
        for c in sheet["Cells"]:
            label = manifest[nomor]["items"][c["Number"] - 1]
            assert label == c["Label"] or slug(label) == slug(c["Label"]), (label, c["Label"])
            nama = slug(label)
            if nama in pustaka["obj"]:
                masalah.append(f"slug ganda: {nama} ({kategori})")
                continue
            sel = rgb[c["CellY"]:c["CellY"] + c["CellHeight"], c["CellX"]:c["CellX"] + c["CellWidth"]]
            hasil = pangkas(potong_latar(sel, 253, buang_kantong=nama in KANTONG_LATAR))
            if hasil is None:
                masalah.append(f"kosong: {nama}")
                continue
            art, (x0, y0, x1, y1) = hasil
            if x0 == 0 or y0 == 0 or x1 >= sel.shape[1] or y1 >= sel.shape[0]:
                masalah.append(f"menyentuh tepi sel: {nama}")
            im = sprite_ke_kanvas(Image.fromarray(art, "RGBA"))
            simpan(im, out / "obj" / f"{nama}.webp")
            pustaka["obj"][nama] = {"k": kategori, "n": label}
            semua_obj.append((nama, im))

    def baca_tempat(file, daftar):
        rgb = np.array(Image.open(places / file).convert("RGB"))
        H, W, _ = rgb.shape
        xs = [round(W * i / 4) for i in range(5)]
        ys = [round(H * i / 3) for i in range(4)]
        hasil_t = []
        for i, nama in enumerate(daftar):
            if nama is None:
                continue
            r, c = divmod(i, 4)
            sel = rgb[ys[r]:ys[r + 1], xs[c]:xs[c + 1]]
            h = pangkas(potong_latar(sel, 240), pad=2)
            if h is None:
                masalah.append(f"tempat kosong: {nama}")
                continue
            art, (x0, y0, x1, y1) = h
            if x0 == 0 or y0 == 0 or x1 >= sel.shape[1] or y1 >= sel.shape[0]:
                masalah.append(f"tempat menyentuh tepi sel: {nama}")
            im = Image.fromarray(art, "RGBA")
            im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)  # sumber kecil; datar sehingga aman diperbesar
            simpan(im, out / "tempat" / f"{nama}.webp")
            pustaka["tempat"][nama] = {"w": im.width, "h": im.height}
            hasil_t.append((nama, im))
        return hasil_t

    tempat = baca_tempat("place-icons-4x3.png", TEMPAT_IKON) + baca_tempat("diorama-12-sprite-sheet-final.png", TEMPAT_DIORAMA)

    pust = Path(__file__).resolve().parent.parent / "web" / "src" / "scene" / "pustaka.json"
    pust.write_text(json.dumps(pustaka, ensure_ascii=False, indent=1), encoding="utf-8")

    if qa:
        qa.mkdir(parents=True, exist_ok=True)
        for i in range(0, len(semua_obj), 48):
            contact_sheet(semua_obj[i:i + 48], qa / f"obj-{i // 48 + 1}.png")
        contact_sheet(tempat, qa / "tempat.png", kolom=6)

    print(f"benda: {len(pustaka['obj'])}, tempat: {len(pustaka['tempat'])}")
    for m in masalah:
        print("MASALAH:", m)
    return 1 if masalah else 0


if __name__ == "__main__":
    sys.exit(main())
