"""Mengubah tests/kalimat_guru_asli.csv (diisi tim) menjadi tests/kalimat_uji_asli.json.

Pakai:  .venv\\Scripts\\python impor_kalimat_asli.py
Lalu:   .venv\\Scripts\\python evaluasi.py --uji tests/kalimat_uji_asli.json
"""
import csv
import json
from pathlib import Path

AKAR = Path(__file__).parent.parent
SUMBER = AKAR / "tests" / "kalimat_guru_asli.csv"
TUJUAN = AKAR / "tests" / "kalimat_uji_asli.json"
CONTOH = {"ada tiga kelinci berlari di rumput", "lalu dua kelinci pergi", "ibu memberi dua apel lagi", "selamat pagi anak-anak"}


def main():
    hasil, masalah = [], []
    # utf-8-sig: Excel menyimpan CSV dengan BOM di awal file
    with open(SUMBER, encoding="utf-8-sig", newline="") as f:
        for no, b in enumerate(csv.DictReader(f), start=2):
            kalimat = (b.get("kalimat") or "").strip()
            if not kalimat or kalimat in CONTOH:
                continue
            terjadi = (b.get("apa_yang_terjadi") or "").strip().lower()
            benda = (b.get("benda") or "").strip().lower()
            jumlah = (b.get("jumlah") or "").strip()
            konteks = (b.get("isi_papan_sebelumnya") or "kosong").strip().lower() or "kosong"
            if terjadi not in {"baru", "tambah", "hapus", "tidak ada"}:
                masalah.append(f"baris {no}: kolom apa_yang_terjadi harus baru/tambah/hapus/tidak ada, tertulis {terjadi!r}")
                continue
            if terjadi != "tidak ada" and (not benda or not jumlah.isdigit()):
                masalah.append(f"baris {no}: benda dan jumlah (angka) wajib diisi untuk {terjadi!r}")
                continue
            n = min(int(jumlah), 20) if jumlah.isdigit() else 0
            hasil.append({
                "konteks": konteks, "kalimat": kalimat,
                "entitas": [[benda, n]] if terjadi == "baru" else [],
                "peristiwa": [[terjadi, benda, n]] if terjadi in {"tambah", "hapus"} else [],
            })
    TUJUAN.write_text(json.dumps(hasil, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(hasil)} kalimat disimpan ke {TUJUAN}")
    for m in masalah:
        print("  PERIKSA", m)


if __name__ == "__main__":
    main()
