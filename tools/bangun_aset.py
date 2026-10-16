"""Memotong sprite sheet hasil generate menjadi satu file per benda/tempat.

Jalankan (dari folder suarapapan):
  python -I tools/bangun_aset.py --sprites <folder sprite-sheets-16> --places <folder imagegen> --out web/public/aset

Masukan: atlas.json + manifest.json (sprite 4x3 per kategori) dan dua sheet
tempat (ikon + diorama). Keluaran: web/public/aset/obj/*.webp, tempat/*.webp,
dan web/src/scene/pustaka.json (daftar yang dibaca aplikasi).

Atlas 39-sheet baru (menggabungkan pustaka, ukuran, dan pasangan latar):
  python tools/bangun_aset.py --sprites <folder sprite-sheets-39-2026-10-16> --mapping tools/aset_tampilan_39.json --out web/public/aset --qa <folder pemeriksaan>

Latar putih dibuang dengan flood-fill dari tepi sel (bagian putih di dalam
gambar, mis. bercak sapi, tetap karena dikelilingi garis tepi). Piksel tepi
yang bercampur putih di-"unmix" ke warna garis aslinya, supaya tidak ada
halo putih di atas papan hijau tua.
"""
import argparse
import hashlib
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

# Celah tertutup yang diperiksa pada koleksi 39 sheet (tidak mengubah jalur lama).
KANTONG_TAMPILAN_39 = {
    "ketapel", "yoyo", "raket-tenis", "kacamata-renang", "gergaji", "tangga",
    "donat-jajanan", "troli-belanja", "keranjang-belanja", "tas-belanja", "cincin",
    "gelang", "kalung", "ikat-pinggang", "sepeda-roda-tiga", "becak", "delman", "gerobak",
    "bajaj", "balon-udara", "ketel", "jaring-laba-laba", "anak-lompat-tali",
    "kakek-memakai-walker", "anak-tidur", "pantai", "tenda-pasar-malam", "bianglala",
    "kincir-angin", "pos-ronda", "jembatan", "jembatan-gantung", "gapura-candi",
    "menara-pengawas", "piala", "kunci-inggris", "jepit-rambut", "harpa", "panci", "termos", "spatula",
}

TEMPAT_IKON = ["rumput", "hutan", "kebun", "sawah", "peternakan", "gunung",
               "sungai", "danau", "kolam", "laut", "bawah-laut", "pantai"]
TEMPAT_DIORAMA = ["dapur", "kamar", "kelas", "sekolah", "pasar", "kota",
                  "jalan-desa", "gurun", "salju", "kebun-binatang", None, None]  # 2 terakhir ganda dengan ikon


def slug(teks: str) -> str:
    if teks in SLUG_KHUSUS:
        return SLUG_KHUSUS[teks]
    t = unicodedata.normalize("NFKD", teks).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def potong_latar(rgb: np.ndarray, ambang: int, buang_kantong: bool = False, biji_kantong=(),
                 kantong_min=KANTONG_MIN, kantong_putih=KANTONG_PUTIH) -> np.ndarray:
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
            if n >= kantong_min and not bg[m].any() and putih255[m].mean() >= kantong_putih:
                bg |= m
    # Titik terpilih untuk gambar yang juga mempunyai isi putih murni (mutiara,
    # pantulan logam, pakaian). Hanya komponen latar pada titik ini yang dibuang.
    for x, y in biji_kantong:
        identitas = label[y, x]
        if not identitas:
            raise ValueError(f"Titik kantong bukan latar putih: {(x, y)}")
        bg |= label == identitas

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


def bangun_koleksi(sprites: Path, out: Path, qa: Path | None, mapping: Path, *, scene_dir: Path | None = None):
    """Impor atlas baru dengan ID Indonesia eksplisit, sambil mempertahankan aset lama."""
    from ukur_sprite import TINGGI, kotak_isi

    atlas = json.loads((sprites / "atlas.json").read_text(encoding="utf-8"))
    manifest = json.loads((sprites / "manifest.json").read_text(encoding="utf-8"))
    peta = json.loads(mapping.read_text(encoding="utf-8"))["sheets"]
    checksums = json.loads((sprites / "checksums.json").read_text(encoding="utf-8"))
    checksum_tetap = mapping.with_name(f"{mapping.stem}_checksums.json")
    if checksum_tetap.exists() and checksums != json.loads(checksum_tetap.read_text(encoding="utf-8")):
        raise ValueError("Checksum sumber berbeda dari koleksi yang didaftarkan")
    if not isinstance(manifest, dict) or len(atlas) != len(peta) or len(atlas) != manifest["sheetCount"]:
        raise ValueError("Jumlah sheet atlas, manifest, dan pemetaan berbeda")
    akar = Path(__file__).resolve().parent.parent
    scene = scene_dir or akar / "web" / "src" / "scene"
    pustaka = json.loads((scene / "pustaka.json").read_text(encoding="utf-8"))
    ukuran = json.loads((scene / "ukuran.json").read_text(encoding="utf-8"))
    latar = json.loads((scene / "latar.json").read_text(encoding="utf-8"))
    # Semua memakai latar 16:9 yang sudah ada; paket ini hanya berisi sprite.
    latar_kategori = {
        "hewan-ternak": "farm", "hewan-hutan": "jungle", "hewan-laut": "underwater",
        "burung": "woodland", "serangga": "flower-garden", "buah": "fruit-market",
        "sayur": "vegetable-garden", "makanan-minuman": "kitchen", "mainan": "playroom",
        "alat-kebersihan": "homeyard", "elektronik": "living-room", "alat-musik": "classroom",
        "alat-olahraga": "playground", "perkakas": "homeyard", "jajanan": "kitchen",
        "uang-belanja": "fruit-market", "aksesoris": "dressing-room",
        "kendaraan-ekstra": "city-road", "alat-dapur": "kitchen", "benda-kelas": "classroom",
        "alam-ekstra": "nature", "infrastruktur": "city-road", "tempat-ibadah": "community",
        "alam-struktur": "nature",
    }
    for kategori, lid in latar_kategori.items():
        if lid not in latar["latar"]:
            raise ValueError(f"Latar kategori tidak ada: {kategori} -> {lid}")

    # Validasi semua masukan sebelum menulis gambar/config apa pun.
    pekerjaan, terdaftar, hash_sumber = [], set(), {}
    for sheet, sumber, m in zip(atlas, manifest["sheets"], peta, strict=True):
        if (sheet["number"], sheet["slug"]) != (m["number"], m["slug"]) or sumber["number"] != m["number"]:
            raise ValueError("Urutan/kategori sheet tidak cocok")
        file = Path(sheet["file"])
        if file.as_posix() != f"final/{sumber['file']}" or len(file.parts) != 2:
            raise ValueError(f"Jalur sheet tidak sah: {file}")
        digest = hashlib.sha256((sprites / file).read_bytes()).hexdigest()
        if checksums[file.as_posix()] != digest:
            raise ValueError(f"Checksum salah: {file}")
        hash_sumber[file.as_posix()] = digest
        with Image.open(sprites / file) as gambar:
            if gambar.size != (sheet["width"], sheet["height"]):
                raise ValueError(f"Dimensi sheet salah: {file}")
        if len(sheet["items"]) != 12 or len(m["items"]) != 12:
            raise ValueError(f"Harus ada 12 item: {file}")
        for i, (c, item) in enumerate(zip(sheet["items"], m["items"], strict=True)):
            nama = item["id"]
            jenis = item.get("kind", m["kind"])
            if jenis not in ("obj", "tempat") or not nama or slug(nama) != nama:
                raise ValueError(f"ID/jenis tidak sah: {nama}")
            if not isinstance(item["name"], str) or not item["name"].strip():
                raise ValueError(f"Nama tampilan kosong: {nama}")
            if "height" in item and (not isinstance(item["height"], (int, float)) or item["height"] <= 0):
                raise ValueError(f"Tinggi tidak sah: {nama}")
            if "background" in item and item["background"] not in latar["latar"]:
                raise ValueError(f"Latar item tidak ada: {nama}")
            for key, minimum, maximum in (("backgroundThreshold", 1, 255), ("pocketMin", 1, 1000000)):
                if key in item and (type(item[key]) is not int or not minimum <= item[key] <= maximum):
                    raise ValueError(f"Pengaturan latar tidak sah: {nama}/{key}")
            if "pocketWhite" in item and not 0 <= item["pocketWhite"] <= 1:
                raise ValueError(f"Ambang putih tidak sah: {nama}")
            if (jenis, nama) in terdaftar:
                raise ValueError(f"ID ganda: {jenis}/{nama}")
            terdaftar.add((jenis, nama))
            if c["index"] != i or c["name"] != item["source"] or sumber["items"][i] != item["source"]:
                raise ValueError(f"Label/urutan item tidak cocok: {nama}")
            x, y, w, h = c["cell"]
            sx, sy, sw, sh = c["spriteBounds"]
            for titik in item.get("backgroundSeeds", []):
                if (len(titik) != 2 or any(type(v) is not int for v in titik)
                        or not (0 <= titik[0] < w and 0 <= titik[1] < h)):
                    raise ValueError(f"Titik kantong di luar sel: {nama}")
            sel_seharusnya = [(i % 4) * manifest["cellWidth"], (i // 4) * manifest["cellHeight"],
                             manifest["cellWidth"], manifest["cellHeight"]]
            if (any(type(v) is not int for v in [x, y, w, h, sx, sy, sw, sh])
                    or c["cell"] != sel_seharusnya or (c["column"], c["row"]) != (i % 4, i // 4)):
                raise ValueError(f"Grid/koordinat sel salah: {nama}")
            if not (0 <= x < x + w <= sheet["width"] and 0 <= y < y + h <= sheet["height"]
                    and x < sx < sx + sw < x + w and y < sy < sy + sh < y + h):
                raise ValueError(f"Kotak item keluar sel: {nama}")
            pekerjaan.append((sheet, c, item, jenis))
    if len(pekerjaan) != manifest["spriteCount"]:
        raise ValueError("Jumlah sprite tidak cocok")

    daftar = {"obj": [], "tempat": []}
    jumlah = {k: {"new": 0, "replaced": 0} for k in daftar}
    sheet_aktif, rgb = None, None
    for sheet, c, item, jenis in pekerjaan:
        if sheet_aktif != sheet["file"]:
            sheet_aktif = sheet["file"]
            with Image.open(sprites / sheet_aktif) as gambar:
                rgb = np.array(gambar.convert("RGB"))
        x, y, w, h = c["cell"]
        nama = item["id"]
        biji = item.get("backgroundSeeds", [])
        hasil = pangkas(potong_latar(rgb[y:y + h, x:x + w], item.get("backgroundThreshold", 253),
                                   buang_kantong=not biji and nama in KANTONG_LATAR | KANTONG_TAMPILAN_39,
                                   biji_kantong=biji, kantong_min=item.get("pocketMin", KANTONG_MIN),
                                   kantong_putih=item.get("pocketWhite", KANTONG_PUTIH)))
        if hasil is None:
            raise ValueError(f"Sprite kosong: {nama}")
        art, (x0, y0, x1, y1) = hasil
        if x0 == 0 or y0 == 0 or x1 >= w or y1 >= h:
            raise ValueError(f"Sprite menyentuh tepi sel: {nama}")
        im = Image.fromarray(art)
        if jenis == "obj":
            im = sprite_ke_kanvas(im)
        jalur = out / jenis / f"{nama}.webp"
        simpan(im, jalur)
        with Image.open(jalur) as tersimpan:
            if tersimpan.mode != "RGBA" or tersimpan.getchannel("A").getextrema() != (0, 255):
                raise ValueError(f"Transparansi sprite tidak lengkap: {nama}")
        jumlah[jenis]["replaced" if nama in pustaka[jenis] else "new"] += 1
        if jenis == "tempat":
            pustaka[jenis][nama] = {"w": im.width, "h": im.height}
        else:
            pustaka[jenis][nama] = {"k": sheet["slug"], "n": item["name"]}
            # Tinggi baru adalah perkiraan; kotak isi selalu diukur dari WebP hasil akhir.
            tinggi = ukuran.get(nama, {}).get("t", TINGGI.get(nama, 0.3))
            if sheet["slug"].startswith("orang") and nama not in ukuran:
                sumber_nama = item["source"].lower()
                tinggi = 0.6 if "baby" in sumber_nama else 0.85 if "toddler" in sumber_nama else 1.2 if any(
                    kata in sumber_nama for kata in ("child", "boy", "girl")) else 1.7
            ukuran[nama] = {"t": item.get("height", tinggi), **kotak_isi(jalur)}
            if nama not in latar["benda"] or "background" in item:
                lid = item.get("background", latar_kategori.get(sheet["slug"], "community"))
                b = latar["latar"][lid]
                latar["benda"][nama] = {"latar": lid, "permukaan": b["permukaan"], "jangkar": "bottom-center",
                                         "x": b["x"], "y": b["y"]}
        daftar[jenis].append((nama, im))

    for nama, data in (("pustaka", pustaka), ("ukuran", ukuran), ("latar", latar)):
        (scene / f"{nama}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1 if nama != "ukuran" else 0), encoding="utf-8")
    report = {"source": sprites.name, "sheets": len(atlas), "items": len(pekerjaan),
              "imported": {k: len(v) for k, v in daftar.items()}, "changes": jumlah,
              "registry": {k: len(v) for k, v in pustaka.items()}, "sha256": hash_sumber}
    if qa:
        qa.mkdir(parents=True, exist_ok=True)
        for jenis, gambar in daftar.items():
            for i in range(0, len(gambar), 48):
                contact_sheet(gambar[i:i + 48], qa / f"{jenis}-{i // 48 + 1}.png")
        (qa / "import-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "sha256"}, ensure_ascii=False))
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sprites", required=True)
    ap.add_argument("--places", help="dua sheet tempat format lama")
    ap.add_argument("--mapping", type=Path, help="pemetaan ID Indonesia untuk atlas format baru (impor gabungan)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--qa", default=None, help="folder untuk contact sheet pemeriksaan")
    a = ap.parse_args()
    sprites, out = Path(a.sprites), Path(a.out)
    qa = Path(a.qa) if a.qa else None
    if a.mapping:
        return bangun_koleksi(sprites, out, qa, a.mapping)
    if not a.places:
        ap.error("--places diperlukan untuk atlas lama; gunakan --mapping untuk atlas baru")
    places = Path(a.places)

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
