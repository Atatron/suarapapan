"""Uji cepat parser terhadap server yang sedang berjalan (port 8000)."""
import json
import sys

import httpx

KASUS = [
    ("kosong", "ada tiga kelinci berlari di rumput"),
    ("kelinci: 3", "lalu dua kelinci pergi"),
    ("kosong", "Budi punya lima apel"),
    ("apel: 5", "ibu memberi tiga apel lagi"),
    ("kosong", "ada tujuh ikan berenang di kolam"),
    ("kosong", "nah coba lihat, ada empat ekor burung terbang di langit"),
    ("burung: 4", "satu burung terbang pergi"),
    ("kosong", "kucing tidur di bawah meja"),
    ("kosong", "selamat pagi anak-anak"),
    ("kosong", "ada lima belas bintang di langit"),
]

for konteks, k in KASUS:
    r = httpx.post("http://127.0.0.1:8000/api/parse", json={"kalimat": k, "konteks": konteks}, timeout=120)
    d = r.json()
    print(f"[{d.get('ms', '-')} ms] {k}\n   {json.dumps(d.get('hasil', d), ensure_ascii=False)}", flush=True)
sys.exit(0)
