"""Membandingkan IndoBERT, LLM, dan gabungan keduanya pada set uji tulisan tangan.

Yang dinilai: apakah adegan yang dihasilkan benar, yaitu (jenis, jumlah) untuk
entitas dan (tipe, target, jumlah) untuk peristiwa. Satu kalimat dihitung benar
hanya jika semuanya tepat.

Pakai:  .venv\\Scripts\\python evaluasi.py [model_llm ...]
Hasil:  hasil/perbandingan.json dan hasil/perbandingan.md
"""
import asyncio
import json
import statistics
import sys
from pathlib import Path

import serve
from ner import PengenalNER

AKAR = Path(__file__).parent
UJI = json.loads((AKAR.parent / "tests" / "kalimat_uji.json").read_text(encoding="utf-8"))


def inti(h):
    ent = {(e["jenis"], e["jumlah"]) for e in h["entitas"]}
    per = {(p["tipe"], p["target"], p["jumlah"]) for p in h["peristiwa"]}
    return ent, per


def harapan(u):
    return {tuple(e) for e in u["entitas"]}, {tuple(p) for p in u["peristiwa"]}


async def jalankan(nama, fungsi):
    benar, waktu, salah, sumber = 0, [], [], {}
    for u in UJI:
        r = await fungsi(u["kalimat"], u["konteks"])
        waktu.append(r["ms"])
        sumber[r["sumber"]] = sumber.get(r["sumber"], 0) + 1
        ok = inti(r["hasil"]) == harapan(u)
        benar += ok
        if not ok:
            salah.append({"kalimat": u["kalimat"], "konteks": u["konteks"], "dapat": [sorted(x) for x in inti(r["hasil"])],
                          "harusnya": [sorted(x) for x in harapan(u)], "sumber": r["sumber"]})
    return {
        "nama": nama, "benar": benar, "total": len(UJI), "akurasi": round(benar / len(UJI), 4),
        "latensi_median_ms": round(statistics.median(waktu), 1),
        "latensi_p90_ms": round(sorted(waktu)[int(0.9 * (len(waktu) - 1))], 1),
        "sumber": sumber, "salah": salah,
    }


async def main():
    llm = sys.argv[1:] or [serve.OLLAMA_MODEL]
    ner = PengenalNER(serve.MODEL_NER)
    ner.urai("pemanasan", "kosong")
    serve.ner = ner

    async def hanya_indobert(k, c):
        return ner.urai(k, c)

    hasil = [await jalankan("IndoBERT (model kami)", hanya_indobert)]
    for m in llm:
        await serve.tanya_llm("pemanasan", "kosong", m)

        async def hanya_llm(k, c, m=m):
            return await serve.tanya_llm(k, c, m)
        hasil.append(await jalankan(f"LLM {m}", hanya_llm))
    hasil.append(await jalankan(f"Gabungan (IndoBERT, cadangan {serve.OLLAMA_MODEL})", serve.urai_gabungan))

    (AKAR / "hasil").mkdir(exist_ok=True)
    (AKAR / "hasil" / "perbandingan.json").write_text(json.dumps(hasil, ensure_ascii=False, indent=2), encoding="utf-8")
    baris = ["| Pendekatan | Benar | Akurasi | Latensi median | Latensi p90 |", "|---|---|---|---|---|"]
    for h in hasil:
        baris.append(f"| {h['nama']} | {h['benar']}/{h['total']} | {h['akurasi']:.0%} | {h['latensi_median_ms']} ms | {h['latensi_p90_ms']} ms |")
    (AKAR / "hasil" / "perbandingan.md").write_text("\n".join(baris) + "\n", encoding="utf-8")
    print("\n".join(baris))
    for h in hasil:
        print(f"\n{h['nama']} — sumber: {h['sumber']}")
        for s in h["salah"]:
            print(f"  SALAH [{s['konteks']}] {s['kalimat']!r}: dapat {s['dapat']}, harusnya {s['harusnya']} ({s['sumber']})")


if __name__ == "__main__":
    asyncio.run(main())
