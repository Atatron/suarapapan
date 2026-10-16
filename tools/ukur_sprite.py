"""Mengukur kotak isi setiap sprite (bagian yang tidak transparan) dan menggabungkannya dengan
tinggi nyata benda, lalu menulis web/src/scene/ukuran.json.

Semua sprite berukuran sel sama (400x320) dan subjeknya memenuhi sel hampir sama besar, jadi seekor
semut dan seekor gajah terlihat sama besar. Papan memakai file ini supaya ukuran di layar mengikuti
ukuran nyata: tinggi nyata (meter, perkiraan kasar) dan kotak isi (pecahan sel).

Pakai:  python tools/ukur_sprite.py
"""
import json
from pathlib import Path

from PIL import Image

AKAR = Path(__file__).resolve().parent.parent
OBJ = AKAR / "web" / "public" / "aset" / "obj"
KELUAR = AKAR / "web" / "src" / "scene" / "ukuran.json"

# Tinggi nyata saat berdiri/utuh, dalam meter (perkiraan kasar; yang penting urutan besar-kecilnya).
TINGGI = {
    # hewan ternak dan peliharaan
    "ayam": .35, "bebek": .35, "sapi": 1.4, "kambing": .75, "domba": .75, "kuda": 1.6, "babi": .9, "kerbau": 1.4,
    "angsa": .6, "anjing": .55, "kucing": .3, "kelinci": .25,
    # hewan hutan
    "harimau": 1.0, "singa": 1.1, "gajah": 3.0, "monyet": .6, "gorila": 1.5, "jerapah": 5.0, "zebra": 1.4,
    "beruang": 1.1, "ular": .3, "buaya": .5, "badak": 1.7, "kuda-nil": 1.5,
    # hewan laut
    "ikan": .3, "lumba-lumba": 1.8, "paus": 4.0, "hiu": 2.0, "gurita": .5, "kepiting": .2, "udang": .12,
    "penyu": .4, "ubur-ubur": .4, "bintang-laut": .2, "kuda-laut": .2, "cumi-cumi": .5,
    # burung
    "burung": .15, "elang": .7, "burung-hantu": .5, "merpati": .3, "merak": 1.0, "kakatua": .5, "penguin": .8,
    "flamingo": 1.2, "pelikan": 1.3, "anak-bebek": .15, "burung-unta": 2.2, "camar": .5,
    # serangga dan hewan kecil
    "kupu-kupu": .08, "lebah": .05, "semut": .03, "kumbang": .06, "kepik": .04, "belalang": .08, "capung": .08,
    "laba-laba": .06, "siput": .06, "cacing": .05, "katak": .12, "kura-kura": .25,
    # orang
    "anak-laki-laki": 1.2, "anak-perempuan": 1.2, "bayi": .6, "ibu": 1.6, "ayah": 1.75, "nenek": 1.5, "kakek": 1.6,
    "guru": 1.65, "siswa-berhijab": 1.2, "dokter": 1.7, "polisi": 1.75, "petani": 1.65,
    "nelayan": 1.7, "koki": 1.7, "pak-pos": 1.7, "pemadam-kebakaran": 1.75, "pilot": 1.75, "sopir": 1.7,
    "penjual": 1.65, "anak-kursi-roda": 1.2, "anak-dengan-alat-bantu-dengar": 1.2,
    "anak-tunanetra-dengan-tongkat": 1.2, "anak-bermain-bola": 1.2, "anak-membaca": 1.2,
    # buah dan sayur
    "apel": .08, "pisang": .2, "jeruk": .08, "mangga": .12, "anggur": .1, "semangka": .25, "stroberi": .04,
    "nanas": .3, "kelapa": .25, "pir": .1, "ceri": .03, "alpukat": .12,
    "wortel": .2, "jagung": .25, "tomat": .08, "terong": .2, "cabai": .1, "timun": .2, "brokoli": .15,
    "kentang": .1, "bawang": .08, "jamur": .1, "kacang": .05, "bayam": .2,
    # makanan
    "nasi": .15, "roti": .15, "kue": .15, "pizza": .3, "donat": .1, "telur": .06, "es-krim": .2, "permen": .05,
    "susu": .2, "air": .25, "bakso": .15, "sate": .25,
    # alat sekolah dan rumah
    "pensil": .18, "buku": .25, "tas": .4, "penghapus": .05, "penggaris": .3, "gunting": .18, "kertas": .3,
    "krayon": .1, "jam": .3, "globe": .4, "papan-tulis-kecil": .5, "pulpen": .15,
    "meja": .75, "kursi": .9, "lampu": .5, "pintu": 2.0, "jendela": 1.2, "tempat-tidur": .6, "sofa": .85,
    "piring": .25, "gelas": .12, "sendok": .18, "ember": .3, "keranjang": .35,
    # kendaraan
    "mobil": 1.5, "bus": 3.0, "motor": 1.1, "sepeda": 1.0, "kereta": 3.5, "pesawat": 4.0, "helikopter": 3.0,
    "kapal": 4.0, "perahu": 1.2, "truk": 3.0, "ambulans": 2.2, "roket": 4.0,
    # alam
    "pohon": 4.0, "bunga": .4, "matahari": 1.2, "bulan": 1.0, "awan": 1.5, "hujan": 1.5, "pelangi": 3.0,
    "bintang": .6, "batu": .4, "gunung-kecil": 2.0, "api": .5, "daun": .1,
    # pakaian
    "baju": .5, "celana": .6, "rok": .5, "topi": .2, "sepatu": .15, "sandal": .1, "kaus-kaki": .15,
    "kacamata": .06, "tas-kecil": .25, "payung": .8, "syal": .2, "jaket": .6,
    # mainan dan bentuk
    "bola": .22, "balon": .4, "boneka": .4, "layang-layang": .8, "kotak": .3, "lingkaran": .3, "segitiga": .3,
    "persegi": .3, "hati": .25, "koin": .03, "kado": .3, "bendera": 1.0,
}


def kotak_isi(f):
    gambar = Image.open(f).convert("RGBA")
    # Abaikan bayangan tipis: hanya piksel yang cukup tidak transparan.
    alfa = gambar.getchannel("A").point(lambda v: 255 if v > 40 else 0)
    k = alfa.getbbox()
    w, h = gambar.size
    if not k:
        return {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
    return {"x": round(k[0] / w, 4), "y": round(k[1] / h, 4), "w": round((k[2] - k[0]) / w, 4), "h": round((k[3] - k[1]) / h, 4)}


def main():
    hasil, tanpa = {}, []
    lama = json.loads(KELUAR.read_text(encoding="utf-8")) if KELUAR.exists() else {}
    for f in sorted(OBJ.glob("*.webp")):
        nama = f.stem
        tinggi = TINGGI.get(nama, lama.get(nama, {}).get("t"))
        if tinggi is None:
            tanpa.append(nama)
        hasil[nama] = {"t": tinggi if tinggi is not None else .3, **kotak_isi(f)}
    KELUAR.write_text(json.dumps(hasil, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(hasil)} sprite ditulis ke {KELUAR}")
    if tanpa:
        print("TANPA tinggi nyata (memakai 0,3 m):", tanpa)
    kecil = sorted(hasil.items(), key=lambda kv: kv[1]["h"])[:5]
    print("isi tinggi sel terkecil:", [(n, v["h"]) for n, v in kecil])


if __name__ == "__main__":
    main()
