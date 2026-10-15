"""Menjalankan model IndoBERT dan mengubah labelnya menjadi JSON adegan.

Model hanya menandai peran setiap kata (JUMLAH, BENDA, …). Aturan di sini
merangkai label itu menjadi JSON yang sama dengan keluaran LLM, sehingga
mesin adegan tidak perlu tahu sumbernya.
"""
import time
from pathlib import Path

import torch
from transformers import AutoModelForTokenClassification, AutoTokenizer

KATA_BAGI = {"dibagi", "membagi", "dibelah", "membelah", "dipotong", "memotong", "bagi"}

from bahasa import AKSI_KE_ENUM, kata_ke_angka, normalkan_benda, tipe_peristiwa, tokenisasi

MODEL_DEFAULT = Path(__file__).parent / "model" / "indobert-suarapapan"
BATAS = 20
PERTANYAAN_AWAL = {"berapa", "apakah", "siapa", "mana"}
PENGISI = {"nah", "coba", "lihat", "anak-anak", "eh", "oke", "jadi", "ayo", "sekarang", "perhatikan", ",", "ya", "baik"}


def rentang(kata, label, prob):
    """Label BIO → daftar (jenis, kata-kata, posisi awal, keyakinan terendah)."""
    hasil, aktif = [], None
    for i, (k, l, p) in enumerate(zip(kata, label, prob)):
        if l == "O":
            aktif = None
            continue
        awal, jenis = l.split("-", 1)
        if awal == "B" or aktif is None or aktif[0] != jenis:
            aktif = [jenis, [k], i, p]
            hasil.append(aktif)
        else:
            aktif[1].append(k)
            aktif[3] = min(aktif[3], p)
    return [tuple(r) for r in hasil]


def susun_json(kata, label, prob, konteks: str) -> dict:
    r = rentang(kata, label, prob)
    benda = [x for x in r if x[0] == "BENDA"]
    peristiwa = [x for x in r if x[0] == "PERISTIWA"]
    aksi = next((x for x in r if x[0] == "AKSI"), None)
    tempat = next((x for x in r if x[0] == "TEMPAT"), None)
    posisi = next((x for x in r if x[0] == "POSISI"), None)

    # Setiap BENDA mengambil JUMLAH terdekat di depannya (sejak BENDA sebelumnya).
    # Potongan JUMLAH yang bersebelahan digabung: "dua puluh" + "tujuh" = 27.
    pasangan, jumlah_tunggu, kata_jumlah, akhir_jumlah = [], None, [], -2
    for x in r:
        if x[0] == "JUMLAH":
            kata_jumlah = kata_jumlah + x[1] if x[2] == akhir_jumlah + 1 else list(x[1])
            akhir_jumlah = x[2] + len(x[1]) - 1
            jumlah_tunggu = kata_ke_angka(kata_jumlah)
        elif x[0] == "BENDA":
            jenis = normalkan_benda(" ".join(x[1]))
            pasangan.append((jenis, jumlah_tunggu))
            jumlah_tunggu = None

    awal = next((k for k in kata if k not in PENGISI), "")
    if awal in PERTANYAAN_AWAL or (kata and kata[-1] == "?" and not peristiwa):
        return kosong()

    papan_kosong = konteks.strip() in ("", "kosong")
    # Benda yang belum ada di papan tidak bisa pergi atau ditambah, jadi kalimat
    # seperti "Siti membawa 8 kue" ke papan kosong adalah adegan baru.
    if peristiwa and papan_kosong and pasangan:
        peristiwa = []

    # Pecahan ("kue itu dibagi menjadi empat", "dibelah"): bukan tambah/hapus. Banyak potongan = bilangan
    # terakhir di kalimat (dua jika tidak disebut). Model tidak dilatih untuk ini, jadi memakai kata kunci.
    if any(k in KATA_BAGI for k in kata):
        potongan = 2
        for i, k in enumerate(kata):
            if k in KATA_BAGI:
                n = next((kata_ke_angka([x]) for x in kata[i + 1:] if kata_ke_angka([x])), None)
                potongan = n if n and n >= 2 else 2
        sasaran = [j for j, _ in pasangan] or [b.strip().rsplit(" ", 1)[0].replace(":", "").strip()
                                               for b in konteks.split(",") if b.strip() and b.strip() != "kosong"][:1]
        if sasaran and not papan_kosong:
            return {"entitas": [], "latar": "", "posisi": "", "konsep": "pecahan",
                    "peristiwa": [{"tipe": "bagi", "target": sasaran[0], "jumlah": min(potongan, 12)}], "pertanyaan": ""}

    if peristiwa:
        tipe = tipe_peristiwa([k for p in peristiwa for k in p[1]])
        if not pasangan:
            # "lalu dua pergi": benda diambil dari konteks jika hanya ada satu jenis
            # konteks dari web: "kelinci: 3, apel: 2"; dari dataset: "kelinci 3"
            jenis_konteks = [b.strip().rsplit(" ", 1)[0].replace(":", "").strip()
                             for b in konteks.split(",") if b.strip() and b.strip() != "kosong"]
            jml = next((kata_ke_angka(x[1]) for x in r if x[0] == "JUMLAH"), None)
            if len(jenis_konteks) == 1:
                pasangan = [(jenis_konteks[0], jml)]
        return {
            "entitas": [], "latar": "", "posisi": "",
            "konsep": "penjumlahan" if tipe == "tambah" else "pengurangan",
            "peristiwa": [{"tipe": tipe, "target": j, "jumlah": max(1, min(n or 1, BATAS))} for j, n in pasangan],
            "pertanyaan": "",
        }

    if not pasangan:
        return kosong()
    aksi_enum = AKSI_KE_ENUM.get(aksi[1][0], "diam") if aksi else "diam"
    teks_posisi = " ".join(posisi[1]) if posisi else ""
    entitas = [{"jenis": j, "jumlah": max(1, min(n or 1, BATAS)), "aksi": aksi_enum, "posisi": teks_posisi} for j, n in pasangan]
    return {
        "entitas": entitas,
        "latar": tempat[1][-1] if tempat else "",
        "konsep": "posisi" if teks_posisi else "membilang",
        "peristiwa": [], "pertanyaan": "",
    }


def kosong():
    return {"entitas": [], "latar": "", "konsep": "tidak_ada", "peristiwa": [], "pertanyaan": ""}


class PengenalNER:
    def __init__(self, jalur: Path = MODEL_DEFAULT):
        self.perangkat = "cuda" if torch.cuda.is_available() else "cpu"
        self.tok = AutoTokenizer.from_pretrained(jalur)
        self.model = AutoModelForTokenClassification.from_pretrained(jalur).to(self.perangkat).eval()
        self.id2label = self.model.config.id2label

    @torch.no_grad()
    def label_kata(self, kalimat: str, konteks: str):
        kata = tokenisasi(kalimat)
        if not kata:
            return [], [], []
        enc = self.tok([kata], [tokenisasi(konteks.replace(":", " "))], is_split_into_words=True,
                       truncation=True, max_length=96, return_tensors="pt")
        seq, wid = enc.sequence_ids(0), enc.word_ids(0)
        prob = torch.softmax(self.model(**enc.to(self.perangkat)).logits[0], -1)
        label, yakin = ["O"] * len(kata), [1.0] * len(kata)
        sebelum = None
        for t, (s, w) in enumerate(zip(seq, wid)):
            if s == 0 and w is not None and w != sebelum:
                p, idx = prob[t].max(-1)
                label[w], yakin[w] = self.id2label[int(idx)], float(p)
            sebelum = w if s == 0 else None
        return kata, label, yakin

    def urai(self, kalimat: str, konteks: str = "kosong") -> dict:
        mulai = time.perf_counter()
        kata, label, yakin = self.label_kata(kalimat, konteks)
        hasil = susun_json(kata, label, yakin, konteks)
        return {
            "hasil": hasil,
            "sumber": "indobert",
            # Keyakinan kalimat = kata yang paling diragukan model.
            "yakin": round(min(yakin) if yakin else 1.0, 4),
            "label": list(zip(kata, label)),
            "ms": round((time.perf_counter() - mulai) * 1000, 1),
        }
