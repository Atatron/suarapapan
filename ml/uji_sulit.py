"""Uji independen kecil: kalimat bebas yang TIDAK dibuat dari templat pelatihan.

Pakai:  .venv\\Scripts\\python uji_sulit.py [jalur_model]
Mencetak akurasi dan setiap kalimat yang salah (jenis, jumlah) / (tipe, target, jumlah).
"""
import json
import sys
from pathlib import Path

from ner import PengenalNER

AKAR = Path(__file__).parent
BERKAS = sys.argv[2] if len(sys.argv) > 2 else "kalimat_uji_sulit.json"
UJI = json.loads((AKAR.parent / "tests" / BERKAS).read_text(encoding="utf-8"))

ner = PengenalNER(Path(sys.argv[1])) if len(sys.argv) > 1 and sys.argv[1] != "-" else PengenalNER()
salah = 0
for u in UJI:
    h = ner.urai(u["kalimat"], u["konteks"])["hasil"]
    dapat = ({(e["jenis"], e["jumlah"]) for e in h["entitas"]}, {(p["tipe"], p["target"], p["jumlah"]) for p in h["peristiwa"]})
    harus = ({tuple(e) for e in u["entitas"]}, {tuple(p) for p in u["peristiwa"]})
    if dapat != harus:
        salah += 1
        print(f"SALAH [{u['konteks']}] {u['kalimat']!r}\n   dapat={[sorted(x) for x in dapat]}\n   harus={[sorted(x) for x in harus]}")
print(f"\n{len(UJI) - salah}/{len(UJI)} benar")
