"""Membuat dataset kalimat guru berlabel BIO dari templat.

Setiap contoh: konteks adegan ("kelinci 3" atau "kosong"), daftar kata, dan
label per kata. Konteks ikut dilatih supaya model bisa membedakan
"lima burung terbang" (adegan baru) dari "dua balon terbang" (balon yang sudah
ada pergi).

Pakai:  .venv\\Scripts\\python buat_dataset.py   →  data/latih.jsonl, data/validasi.jsonl, data/uji_templat.jsonl
"""
import json
import random
from pathlib import Path

from bahasa import angka_ke_kata, tokenisasi

ACAK = random.Random(2026)
KELUAR = Path(__file__).parent / "data"

# benda: (penggolong, kelompok)
BENDA = {
    "kelinci": ("ekor", "darat"), "kucing": ("ekor", "darat"), "anjing": ("ekor", "darat"), "ayam": ("ekor", "darat"),
    "bebek": ("ekor", "air"), "sapi": ("ekor", "darat"), "kambing": ("ekor", "darat"), "katak": ("ekor", "air"),
    "monyet": ("ekor", "darat"), "gajah": ("ekor", "darat"), "kura-kura": ("ekor", "air"), "semut": ("ekor", "darat"),
    "burung": ("ekor", "udara"), "kupu-kupu": ("ekor", "udara"), "lebah": ("ekor", "udara"),
    "ikan": ("ekor", "air"),
    "apel": ("buah", "benda"), "jeruk": ("buah", "benda"), "pisang": ("buah", "benda"), "mangga": ("buah", "benda"),
    "semangka": ("buah", "benda"), "bola": ("buah", "benda"), "mobil": ("buah", "darat"), "buku": ("buah", "benda"),
    "kue": ("potong", "benda"), "permen": ("biji", "benda"), "telur": ("butir", "benda"), "pensil": ("batang", "benda"),
    "bunga": ("tangkai", "benda"), "bintang": ("buah", "langit"), "balon": ("buah", "udara"), "kelereng": ("butir", "benda"),
    "perahu": ("buah", "air"), "pesawat": ("buah", "udara"), "daun": ("lembar", "jatuh"),
}
MAKANAN = {"apel", "jeruk", "pisang", "mangga", "semangka", "kue", "permen", "telur"}
AKSI = {
    "darat": ["berlari", "melompat", "berjalan", "bermain", "tidur", "duduk", "berlarian"],
    "air": ["berenang"],
    "udara": ["terbang", "beterbangan", "melayang"],
    "benda": [],
    "langit": [],
    "jatuh": ["jatuh", "berjatuhan"],
}
TEMPAT = {
    "darat": ["rumput", "taman", "kebun", "halaman", "lapangan", "sawah", "hutan", "jalan"],
    "air": ["kolam", "sungai", "laut", "danau"],
    "udara": ["langit", "taman", "udara"],
    "benda": ["meja", "piring", "keranjang", "kotak", "lemari", "tas"],
    "langit": ["langit"],
    "jatuh": ["halaman", "tanah", "jalan"],
}
POSISI_DEPAN = ["di bawah", "di atas", "di samping", "di depan", "di belakang", "di dalam", "di dekat"]
POSISI_BENDA = ["meja", "kursi", "pohon", "rumah", "kotak", "lemari", "tempat tidur", "jendela"]
SUBJEK = ["budi", "siti", "ani", "rina", "dodi", "ibu", "ayah", "kakak", "adik", "nenek", "pak tani", "bu guru", "pak guru", "dayu", "made", "ucok", "asep"]
PENGISI = ["", "", "", "nah ", "nah , ", "coba lihat , ", "anak-anak , ", "perhatikan , ", "oke , ", "sekarang ", "ayo lihat , ",
           "jadi ", "eh ", "nah anak-anak , ", "coba perhatikan , ", "baik , ", "lihat ya , "]
LALU = ["lalu ", "kemudian ", "terus ", "setelah itu ", "", "nah ", "tiba-tiba "]
HAPUS_AKTIF = {"darat": ["pergi", "lari pergi", "pulang", "hilang", "berlari pergi", "pergi ke hutan", "masuk ke kandang"],
               "air": ["berenang pergi", "pergi", "hilang"], "udara": ["terbang pergi", "terbang", "pergi", "hilang", "meletus"],
               "benda": ["hilang", "jatuh", "pecah", "habis"], "langit": ["hilang", "redup"], "jatuh": ["terbang", "hilang"]}
HAPUS_PASIF = ["diambil", "dibawa pergi", "diambil oleh", "disembunyikan"]
HAPUS_PASIF_MAKANAN = ["dimakan", "dimakan oleh", "habis dimakan"]
PELAKU = ["kucing", "adik", "budi", "kakak", "angin", "monyet", "ibu", "burung"]
DATANG = ["datang", "datang lagi", "ikut bergabung", "menyusul", "muncul", "datang bermain"]
BERI = ["memberi", "memberikan", "membeli", "membawa", "menaruh"]
TANPA_ADEGAN = [
    "selamat pagi anak-anak", "ayo kita hitung bersama", "bagus sekali", "siapa yang bisa menjawab ?", "coba hitung lagi ya",
    "sekarang kita belajar pengurangan", "hari ini kita belajar membilang", "tepuk tangan untuk budi", "perhatikan papan ya",
    "berapa jumlahnya ?", "siapa yang mau maju ke depan ?", "pintar sekali", "ayo duduk yang rapi", "dengarkan baik-baik ya",
    "sekarang giliran siti", "coba ulangi sekali lagi", "benar sekali", "masih salah , coba lagi", "kita lanjut ke soal berikutnya",
    "berapa yang tersisa ?", "ada yang tahu jawabannya ?", "ayo semua lihat ke depan", "terima kasih anak-anak", "kita istirahat dulu",
]
TANYA_BENDA = ["berapa {b} yang tersisa ?", "ada berapa {b} sekarang ?", "jadi berapa jumlah {b} semuanya ?", "coba hitung {b} nya ada berapa ?",
               "berapa {b} yang pergi ?", "sekarang {b} nya tinggal berapa ?"]


def angka(n: int) -> str:
    # Web Speech API sering menulis angka sebagai digit, jadi keduanya dilatih.
    return str(n) if ACAK.random() < 0.35 else angka_ke_kata(n)


class Kalimat:
    def __init__(self):
        self.kata, self.label = [], []

    def tambah(self, teks: str, jenis: str | None = None):
        for i, k in enumerate(tokenisasi(teks)):
            self.kata.append(k)
            self.label.append("O" if jenis is None else f"{'B' if i == 0 else 'I'}-{jenis}")
        return self


def pilih_benda(kelompok_boleh=None):
    pilihan = [b for b, (_, k) in BENDA.items() if not kelompok_boleh or k in kelompok_boleh]
    b = ACAK.choice(pilihan)
    return b, BENDA[b][0], BENDA[b][1]


def jumlah_benda(k: Kalimat, n: int, benda: str, penggolong: str):
    """'tiga ekor kelinci', 'seekor kelinci', '3 kelinci'."""
    if n == 1 and ACAK.random() < 0.4:
        k.tambah(f"se{penggolong}", "JUMLAH")
    else:
        k.tambah(angka(n), "JUMLAH")
        if ACAK.random() < 0.25:
            k.tambah(penggolong)
    benda_teks = f"{benda}-{benda}" if ACAK.random() < 0.05 and "-" not in benda else benda
    k.tambah(benda_teks, "BENDA")


def konteks_acak(kecuali=None):
    if ACAK.random() < 0.6:
        return "kosong"
    b = ACAK.choice([x for x in BENDA if x != kecuali])
    return f"{b} {ACAK.randint(1, 9)}"


def t_perkenalan():
    b, gol, kel = pilih_benda()
    # Sebagian kecil angka di atas 20 ("dua puluh tujuh") supaya model mengenal
    # bentuk puluhan; papan tetap membatasi 20 benda.
    n = ACAK.randint(1, 20) if ACAK.random() < 0.85 else ACAK.randint(21, 99)
    k = Kalimat().tambah(ACAK.choice(PENGISI))
    pola = ACAK.random()
    aksi = ACAK.choice(AKSI[kel]) if AKSI[kel] and ACAK.random() < 0.7 else None
    tempat = ACAK.choice(TEMPAT[kel]) if ACAK.random() < 0.65 else None
    if pola < 0.45:
        k.tambah(ACAK.choice(["ada", "terdapat", "ini ada", "di sini ada", "lihat , ada"]))
        jumlah_benda(k, n, b, gol)
        if aksi:
            if ACAK.random() < 0.3:
                k.tambah("sedang")
            k.tambah(aksi, "AKSI")
        if tempat:
            k.tambah(ACAK.choice(["di", "di", "di dalam"]) if kel != "udara" else "di").tambah(tempat, "TEMPAT")
    elif pola < 0.65:
        k.tambah("di").tambah(tempat or ACAK.choice(TEMPAT[kel]), "TEMPAT").tambah(ACAK.choice(["ada", "terdapat", ","]))
        jumlah_benda(k, n, b, gol)
        if aksi:
            k.tambah(aksi, "AKSI")
    elif pola < 0.85:
        k.tambah(ACAK.choice(SUBJEK)).tambah(ACAK.choice(["punya", "mempunyai", "memiliki", "membawa", "melihat", "menggambar"]))
        jumlah_benda(k, n, b, gol)
        if tempat and kel in ("benda",) and ACAK.random() < 0.5:
            k.tambah("di").tambah(tempat, "TEMPAT")
    else:
        jumlah_benda(k, n, b, gol)
        if aksi:
            k.tambah(ACAK.choice(["sedang", ""])).tambah(aksi, "AKSI")
        else:
            k.tambah(ACAK.choice(["ada", "terletak"]))
        k.tambah("di").tambah(tempat or ACAK.choice(TEMPAT[kel]), "TEMPAT")
    return konteks_acak(kecuali=b), k


def t_posisi():
    b, gol, kel = pilih_benda(["darat", "benda"])
    k = Kalimat().tambah(ACAK.choice(PENGISI))
    if ACAK.random() < 0.5:
        k.tambah(f"se{gol}", "JUMLAH") if ACAK.random() < 0.5 else None
        k.tambah(b, "BENDA")
    else:
        k.tambah("ada")
        jumlah_benda(k, ACAK.choice([1, 1, 2, 3]), b, gol)
    if kel == "darat" and ACAK.random() < 0.6:
        k.tambah(ACAK.choice(["tidur", "duduk", "bersembunyi", "berdiri", "bermain"]), "AKSI")
    else:
        k.tambah(ACAK.choice(["ada", "terletak", "diletakkan", ""]))
    k.tambah(f"{ACAK.choice(POSISI_DEPAN)} {ACAK.choice(POSISI_BENDA)}", "POSISI")
    return konteks_acak(kecuali=b), k


def t_hapus():
    b, gol, kel = pilih_benda()
    ada = ACAK.randint(2, 15)
    n = ACAK.randint(1, ada)
    k = Kalimat().tambah(ACAK.choice(PENGISI)).tambah(ACAK.choice(LALU))
    if ACAK.random() < 0.7:
        jumlah_benda(k, n, b, gol)
        if ACAK.random() < 0.6:
            k.tambah(ACAK.choice(HAPUS_AKTIF[kel]), "PERISTIWA")
        else:
            # ikan dan makanan bisa dimakan; benda lain hanya diambil atau dibawa pergi
            pasif = HAPUS_PASIF + (HAPUS_PASIF_MAKANAN if b in MAKANAN or b == "ikan" else [])
            k.tambah(ACAK.choice(pasif), "PERISTIWA").tambah(ACAK.choice(PELAKU))
    else:
        kerja = ["makan", "memakan", "menghabiskan", "mengambil"] if b in MAKANAN else ["mengambil", "membuang", "menyembunyikan"]
        k.tambah(ACAK.choice(SUBJEK)).tambah(ACAK.choice(kerja), "PERISTIWA")
        jumlah_benda(k, n, b, gol)
    return f"{b} {ada}", k


def t_tambah():
    b, gol, kel = pilih_benda()
    ada = ACAK.randint(1, 10)
    n = ACAK.randint(1, 9)
    k = Kalimat().tambah(ACAK.choice(PENGISI)).tambah(ACAK.choice(LALU))
    pola = ACAK.random()
    if pola < 0.45:
        jumlah_benda(k, n, b, gol)
        k.tambah(ACAK.choice(["lagi", ""])).tambah(ACAK.choice(DATANG), "PERISTIWA")
    elif pola < 0.60:
        # "sekarang ditambah dengan 3 kucing": benda yang ditambahkan (sering jenis baru di papan)
        k.tambah(ACAK.choice(["ditambah", "ditambah dengan", "ditambah lagi dengan", "bertambah"]), "PERISTIWA")
        jumlah_benda(k, n, b, gol)
    elif pola < 0.85:
        k.tambah(ACAK.choice(SUBJEK)).tambah(ACAK.choice(BERI), "PERISTIWA")
        jumlah_benda(k, n, b, gol)
        k.tambah(ACAK.choice(["lagi", "lagi", "", "tambahan"]))
    else:
        k.tambah(ACAK.choice(["datang lagi", "muncul lagi", "bertambah"]), "PERISTIWA")
        jumlah_benda(k, n, b, gol)
    return f"{b} {ada}", k


def t_terbang_ganda():
    """Kata yang sama, makna berbeda tergantung konteks."""
    b = ACAK.choice(["balon", "burung", "kupu-kupu", "lebah"])
    gol = BENDA[b][0]
    k = Kalimat().tambah(ACAK.choice(PENGISI))
    if ACAK.random() < 0.5:  # adegan baru
        jumlah_benda(k, ACAK.randint(2, 12), b, gol)
        k.tambah("terbang", "AKSI")
        if ACAK.random() < 0.6:
            k.tambah("di").tambah("langit", "TEMPAT")
        return "kosong", k
    ada = ACAK.randint(3, 12)
    k.tambah(ACAK.choice(LALU))
    jumlah_benda(k, ACAK.randint(1, ada - 1), b, gol)
    k.tambah("terbang", "PERISTIWA")
    return f"{b} {ada}", k


def t_tanpa_adegan():
    k = Kalimat()
    if ACAK.random() < 0.6:
        k.tambah(ACAK.choice(PENGISI)).tambah(ACAK.choice(TANPA_ADEGAN))
        return konteks_acak(), k
    b = ACAK.choice(list(BENDA))
    # pertanyaan tentang benda yang sudah ada: bukan adegan baru, semua O
    k.tambah(ACAK.choice(PENGISI)).tambah(ACAK.choice(TANYA_BENDA).format(b=b))
    return f"{b} {ACAK.randint(1, 9)}", k


TEMPLAT = [(t_perkenalan, 34), (t_posisi, 10), (t_hapus, 20), (t_tambah, 16), (t_terbang_ganda, 8), (t_tanpa_adegan, 12)]


def main(jumlah=3200):
    fungsi, bobot = zip(*TEMPLAT)
    contoh, sudah = [], set()
    while len(contoh) < jumlah:
        konteks, k = ACAK.choices(fungsi, bobot)[0]()
        kunci = (konteks, " ".join(k.kata))
        if not k.kata or kunci in sudah:
            continue
        sudah.add(kunci)
        contoh.append({"konteks": konteks, "kata": k.kata, "label": k.label})
    ACAK.shuffle(contoh)
    a, b = int(0.8 * len(contoh)), int(0.9 * len(contoh))
    KELUAR.mkdir(exist_ok=True)
    for nama, bagian in [("latih", contoh[:a]), ("validasi", contoh[a:b]), ("uji_templat", contoh[b:])]:
        with open(KELUAR / f"{nama}.jsonl", "w", encoding="utf-8") as f:
            for c in bagian:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
        print(f"{nama}: {len(bagian)} kalimat")
    for c in contoh[:8]:
        print(c["konteks"], "|", " ".join(f"{w}/{l}" for w, l in zip(c["kata"], c["label"])))


if __name__ == "__main__":
    main()
