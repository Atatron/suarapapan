"""Membandingkan akurasi dan kecepatan beberapa model Ollama pada kalimat uji.

Pakai:  .venv\\Scripts\\python bandingkan_llm.py qwen2.5:7b-instruct llama3.2:latest
Yang dinilai hanya inti adegan: (jenis, jumlah) untuk entitas dan
(tipe, target, jumlah) untuk peristiwa. Aksi dan latar belum dinilai.
"""
import asyncio
import statistics
import sys

from serve import tanya_llm

UJI = [
    ("kosong", "ada tiga kelinci berlari di rumput", {("kelinci", 3)}, set()),
    ("kelinci: 3", "lalu dua kelinci pergi", set(), {("hapus", "kelinci", 2)}),
    ("kosong", "Budi punya lima apel", {("apel", 5)}, set()),
    ("apel: 5", "ibu memberi tiga apel lagi", set(), {("tambah", "apel", 3)}),
    ("kosong", "ada tujuh ikan berenang di kolam", {("ikan", 7)}, set()),
    ("kosong", "nah coba lihat, ada empat ekor burung terbang di langit", {("burung", 4)}, set()),
    ("burung: 4", "satu burung terbang pergi", set(), {("hapus", "burung", 1)}),
    ("kosong", "kucing tidur di bawah meja", {("kucing", 1)}, set()),
    ("kosong", "selamat pagi anak-anak", set(), set()),
    ("kosong", "ada lima belas bintang di langit", {("bintang", 15)}, set()),
    ("kelinci: 3", "eh, satu kelinci lagi datang", set(), {("tambah", "kelinci", 1)}),
    ("kosong", "coba hitung, ada dua puluh tujuh semut", {("semut", 20)}, set()),  # dibatasi 20
    ("ikan: 7", "tiga ikan dimakan kucing", set(), {("hapus", "ikan", 3)}),
    ("kosong", "anak-anak, perhatikan papan ya", set(), set()),
]


async def nilai(model: str):
    benar, waktu = 0, []
    for konteks, kalimat, ent_harap, per_harap in UJI:
        try:
            r = await tanya_llm(kalimat, konteks, model)
        except Exception as e:  # noqa: BLE001 — laporkan lalu lanjut ke kalimat berikutnya
            print(f"  GALAT  {kalimat}: {e}")
            continue
        h = r["hasil"]
        ent = {(e["jenis"], e["jumlah"]) for e in h["entitas"]}
        per = {(p["tipe"], p["target"], p["jumlah"]) for p in h["peristiwa"]}
        ok = ent == ent_harap and per == per_harap
        benar += ok
        waktu.append(r["ms"])
        if not ok:
            print(f"  SALAH  {kalimat!r}: dapat {ent or ''}{per or ''}, harusnya {ent_harap or ''}{per_harap or ''}")
    median = statistics.median(waktu) if waktu else float("nan")
    print(f"{model}: {benar}/{len(UJI)} benar · median {median:.0f} ms\n")


async def main():
    for model in sys.argv[1:] or ["qwen2.5:7b-instruct"]:
        print(f"== {model}")
        await tanya_llm("pemanasan", "kosong", model)  # muat model dulu, jangan dihitung
        await nilai(model)


asyncio.run(main())
