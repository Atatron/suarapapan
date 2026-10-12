"""Kosakata dan aturan bahasa yang dipakai bersama oleh pembuat dataset dan model.

Satu sumber ini memastikan kata yang dilatih sama dengan kata yang dikenali
saat aplikasi berjalan.
"""
import re

LABEL_JENIS = ["JUMLAH", "BENDA", "AKSI", "TEMPAT", "POSISI", "PERISTIWA"]
LABEL = ["O"] + [f"{p}-{j}" for j in LABEL_JENIS for p in ("B", "I")]
LABEL2ID = {l: i for i, l in enumerate(LABEL)}


def tokenisasi(teks: str) -> list[str]:
    """Memecah kalimat menjadi kata. Tanda baca jadi token sendiri; kata ulang tetap utuh."""
    return re.findall(r"\w+(?:-\w+)*|[^\w\s]", teks.lower())


# ---------- angka ----------
SATUAN = {"nol": 0, "satu": 1, "dua": 2, "tiga": 3, "empat": 4, "lima": 5, "enam": 6,
          "tujuh": 7, "delapan": 8, "sembilan": 9}
KHUSUS = {"sepuluh": 10, "sebelas": 11, "seratus": 100}
# "seekor kucing", "sebuah apel" = satu
SE_PENGGOLONG = {"seekor", "sebuah", "sebiji", "sebutir", "sepotong", "sebatang", "setangkai", "selembar", "seorang"}


def kata_ke_angka(kata: list[str]) -> int | None:
    """['dua', 'puluh', 'tujuh'] → 27, ['lima', 'belas'] → 15, ['12'] → 12, ['seekor'] → 1."""
    kata = [k for k in kata if k not in {"ekor", "buah", "biji", "butir", "potong", "batang", "tangkai", "lembar", "orang"}]
    if not kata:
        return None
    if len(kata) == 1 and kata[0].isdigit():
        return int(kata[0])
    total, sekarang = 0, 0
    for k in kata:
        if k.isdigit():
            sekarang += int(k)
        elif k in SATUAN:
            sekarang += SATUAN[k]
        elif k in KHUSUS:
            sekarang += KHUSUS[k]
        elif k in SE_PENGGOLONG:
            sekarang += 1
        elif k == "belas":
            sekarang = (sekarang or 1) + 10
        elif k == "puluh":
            sekarang = (sekarang or 1) * 10
        elif k == "ratus":
            sekarang = (sekarang or 1) * 100
        else:
            return None
    total += sekarang
    return total if total > 0 else None


def angka_ke_kata(n: int) -> str:
    if n <= 9:
        return [k for k, v in SATUAN.items() if v == n][0]
    if n == 10:
        return "sepuluh"
    if n == 11:
        return "sebelas"
    if n < 20:
        return f"{angka_ke_kata(n - 10)} belas"
    puluh, sisa = divmod(n, 10)
    depan = "dua" if puluh == 2 else angka_ke_kata(puluh)
    return f"{depan} puluh" + (f" {angka_ke_kata(sisa)}" if sisa else "")


# ---------- aksi ----------
AKSI_KE_ENUM = {
    "berlari": "lari", "lari": "lari", "berjalan": "lari", "berlarian": "lari", "berkejaran": "lari",
    "melompat": "lompat", "lompat": "lompat", "meloncat": "lompat", "bermain": "lompat", "melompat-lompat": "lompat",
    "terbang": "terbang", "beterbangan": "terbang", "melayang": "terbang",
    "berenang": "berenang",
    "jatuh": "jatuh", "berjatuhan": "jatuh",
    "tidur": "diam", "duduk": "diam", "diam": "diam", "berdiri": "diam", "bersembunyi": "diam", "makan": "diam",
}

# ---------- peristiwa ----------
KATA_TAMBAH = {"datang", "memberi", "diberi", "memberikan", "membeli", "dibeli", "bertambah", "menyusul",
               "bergabung", "muncul", "tambah", "ditambah", "menambah", "dikasih", "kasih", "membawa", "dibawa", "menaruh", "lahir"}


KATA_PASTI_HAPUS = {"pergi", "hilang", "habis", "pulang", "meletus", "pecah"}


def tipe_peristiwa(kata: list[str]) -> str:
    # "dibawa pergi" mengandung kata tambah (dibawa) tetapi maknanya berkurang.
    if any(k in KATA_PASTI_HAPUS for k in kata):
        return "hapus"
    return "tambah" if any(k in KATA_TAMBAH for k in kata) else "hapus"


# ---------- latar ----------
# Kata ulang yang memang nama satu benda, bukan bentuk jamak.
KATA_ULANG_TETAP = {"kupu-kupu", "kura-kura", "laba-laba", "biri-biri", "undur-undur", "ubur-ubur", "lumba-lumba"}


def normalkan_benda(kata: str) -> str:
    m = re.fullmatch(r"(\w+)-\1", kata)  # kelinci-kelinci → kelinci
    return m.group(1) if m and kata not in KATA_ULANG_TETAP else kata
