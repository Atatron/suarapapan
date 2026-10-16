"""Server ML SuaraPapan: mengubah kalimat guru menjadi JSON adegan.

Jalankan:  .venv\\Scripts\\python -m uvicorn serve:app --port 8000   (dari folder ml)
"""
import json
import os
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from validasi import amankan, KATALOG

MODEL_NER = Path(__file__).parent / "model" / "indobert-suarapapan"
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
OLLAMA_MODEL = os.environ.get("SUARAPAPAN_LLM", "qwen2.5:7b-instruct")

AKSI = ["diam", "lari", "lompat", "terbang", "berenang", "jatuh"]
KONSEP = ["membilang", "penjumlahan", "pengurangan", "pecahan", "posisi", "tidak_ada"]

# Skema ini dipaksakan ke Ollama (structured output), jadi model tidak bisa
# mengembalikan JSON dengan bentuk lain.
SKEMA = {
    "type": "object",
    "properties": {
        "entitas": {"type": "array", "items": {"type": "object", "properties": {
            "jenis": {"type": "string"},
            "jumlah": {"type": "integer"},
            "aksi": {"type": "string", "enum": AKSI},
            "posisi": {"type": "string"},
        }, "required": ["jenis", "jumlah", "aksi", "posisi"]}},
        "latar": {"type": "string"},
        "konsep": {"type": "string", "enum": KONSEP},
        "peristiwa": {"type": "array", "items": {"type": "object", "properties": {
            "tipe": {"type": "string", "enum": ["hapus", "tambah"]},
            "target": {"type": "string"},
            "jumlah": {"type": "integer"},
        }, "required": ["tipe", "target", "jumlah"]}},
        "pertanyaan": {"type": "string"},
    },
    "required": ["entitas", "latar", "konsep", "peristiwa", "pertanyaan"],
}

SISTEM = """Kamu adalah pengurai kalimat guru SD untuk aplikasi SuaraPapan.
Ubah SATU kalimat guru menjadi JSON adegan. Aturan:
- "entitas": benda yang DIPERKENALKAN di kalimat ini, misalnya "ada tiga kelinci".
  "jenis" = kata benda tunggal, huruf kecil, tanpa kata penggolong (ekor, buah, biji, batang, lembar).
  "jumlah" = angka. Jika jumlah tidak disebut, pakai 1.
  "aksi" = diam, lari, lompat, terbang, berenang, atau jatuh. "posisi" = letak relatif ("di bawah meja") atau "".
- "peristiwa": perubahan pada benda yang SUDAH ADA di adegan saat ini.
  "hapus" untuk pergi, terbang pergi, dimakan, hilang, diambil, pecah.
  "tambah" untuk datang, diberi lagi, dibeli lagi, bertambah.
  Jika kalimat mengubah benda yang sudah ada, isi "peristiwa" dan biarkan "entitas" kosong.
- "latar" = tempat adegan (rumput, kolam, taman, langit, meja, kelas) atau "".
- Jika kalimat tidak menggambarkan benda (salam, instruksi, pujian), kembalikan entitas dan peristiwa kosong dan konsep "tidak_ada".
- "pertanyaan" = soal jika guru bertanya, selain itu "".
- Jangan mengarang benda yang tidak disebut guru."""

# ID dan sinonim berasal dari file yang sama dengan browser dan Gemini.
SISTEM += "\nPilih ID kanonik dari katalog ini. Jangan ganti benda asing dengan yang mirip.\n" + "\n".join(
    f"{a['id']}: {' | '.join(a['aliases'])}" for a in KATALOG if a['kind'] != 'latar')
SISTEM += "\nLarangan, kutipan, syarat, dan koreksi yang belum jelas harus diperiksa guru. Jangan mengarang subjek/aksi."

CONTOH = [
    ("kosong", "Nah anak-anak, ada tiga kelinci berlari di rumput.",
     '{"entitas":[{"jenis":"kelinci","jumlah":3,"aksi":"lari","posisi":""}],"latar":"rumput","konsep":"membilang","peristiwa":[],"pertanyaan":""}'),
    ("kelinci: 3", "Lalu dua kelinci pergi.",
     '{"entitas":[],"latar":"","konsep":"pengurangan","peristiwa":[{"tipe":"hapus","target":"kelinci","jumlah":2}],"pertanyaan":""}'),
    ("apel: 3", "Ibu memberi dua buah apel lagi.",
     '{"entitas":[],"latar":"","konsep":"penjumlahan","peristiwa":[{"tipe":"tambah","target":"apel","jumlah":2}],"pertanyaan":""}'),
    ("kosong", "Selamat pagi, anak-anak. Ayo duduk yang rapi.",
     '{"entitas":[],"latar":"","konsep":"tidak_ada","peristiwa":[],"pertanyaan":""}'),
]


def rapikan(h: dict, konteks: str = "", kalimat: str = "") -> dict:
    return amankan(h, kalimat, konteks)


def jawaban(hasil, sumber, ms, yakin=None, wajib_tinjau=False):
    kurang_yakin = yakin is not None and yakin < AMBANG_YAKIN
    review = bool(hasil.get("needsConfirmation") or kurang_yakin or wajib_tinjau)
    notice = hasil.get("notice")
    if review and not notice:
        notice = {"code": "LOW_PROVIDER_CONFIDENCE", "message": "Tafsiran lokal belum pasti. Periksa pratinjau.", "unresolvedSpans": []}
    return {"hasil": hasil, "sumber": sumber, "ms": ms, "yakin": yakin if yakin is not None else ("rendah" if review else "tinggi"),
            "needsConfirmation": review, "notice": notice}


class Permintaan(BaseModel):
    kalimat: str = Field(min_length=1, max_length=2000)
    konteks: str = Field(default="kosong", max_length=20000)


http = httpx.AsyncClient(timeout=18)
AMBANG_YAKIN = float(os.environ.get("SUARAPAPAN_AMBANG", "0.85"))
ner = None  # PengenalNER, dimuat saat server menyala jika model sudah dilatih


@asynccontextmanager
async def lifespan(_app):
    global ner
    if MODEL_NER.exists():
        from ner import PengenalNER
        ner = PengenalNER(MODEL_NER)
        ner.urai("pemanasan model", "kosong")
        print(f"IndoBERT dimuat dari {MODEL_NER} ({ner.perangkat}).")
    else:
        print("Model IndoBERT belum ada; semua kalimat memakai LLM. Jalankan latih_ner.py dulu.")
    # Memuat LLM ke GPU sekali di awal (bisa 30–60 detik), supaya kalimat
    # pertama guru di kelas tidak gagal karena menunggu model dimuat.
    try:
        await http.post(OLLAMA_URL, json={"model": OLLAMA_MODEL, "messages": [], "keep_alive": "30m"}, timeout=60)
    except httpx.HTTPError as e:
        print(f"Peringatan: Ollama belum bisa dihubungi saat server menyala ({e!r}).")
    yield


app = FastAPI(title="SuaraPapan ML", lifespan=lifespan)


@app.get("/api/kesehatan")
async def kesehatan():
    try:
        r = await http.get("http://127.0.0.1:11434/api/tags", timeout=3)
        ollama = OLLAMA_MODEL in r.text
    except httpx.HTTPError:
        ollama = False
    return {"server": True, "ollama": ollama, "model": OLLAMA_MODEL, "indobert": ner is not None}


@app.post("/api/parse")
async def parse(req: Permintaan):
    kalimat = req.kalimat.strip()
    if not kalimat:
        raise HTTPException(400, "Kalimat kosong.")
    return await urai_gabungan(kalimat, req.konteks)


async def urai_gabungan(kalimat: str, konteks: str) -> dict:
    """IndoBERT dulu (±50 ms). LLM hanya untuk kalimat yang membuat IndoBERT ragu."""
    if ner is not None:
        r = ner.urai(kalimat, konteks)
        try:
            r["hasil"] = rapikan(r["hasil"], konteks, kalimat)
        except (ValueError, TypeError, KeyError) as e:
            raise HTTPException(502, f"Format hasil IndoBERT tidak valid: {e}")
        if r["yakin"] >= AMBANG_YAKIN:
            return jawaban(r["hasil"], "indobert", r["ms"], r["yakin"])
        try:
            llm = await tanya_llm(kalimat, konteks, OLLAMA_MODEL)
        except HTTPException:
            # Kewajiban tinjau tetap utuh ketika LLM cadangan tidak tersedia.
            return jawaban(r["hasil"], "indobert (LLM tidak tersedia)", r["ms"], r["yakin"], wajib_tinjau=True)
        llm["ms"] = round(llm["ms"] + r["ms"])
        # Keluaran LLM sudah melewati batas runtime sendiri.
        return llm
    return await tanya_llm(kalimat, konteks, OLLAMA_MODEL)


async def tanya_llm(kalimat: str, konteks: str, model: str) -> dict:
    pesan = [{"role": "system", "content": SISTEM}]
    for konteks_contoh, k, jawab in CONTOH:
        pesan.append({"role": "user", "content": f"Adegan saat ini: {konteks_contoh}\nKalimat: {k}"})
        pesan.append({"role": "assistant", "content": jawab})
    pesan.append({"role": "user", "content": f"Adegan saat ini: {konteks}\nKalimat: {kalimat}"})

    mulai = time.perf_counter()
    try:
        r = await http.post(OLLAMA_URL, json={
            "model": model, "messages": pesan, "format": SKEMA, "stream": False,
            "keep_alive": "30m", "options": {"temperature": 0},
        })
        r.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(503, f"Ollama tidak bisa dihubungi. Pastikan aplikasi Ollama berjalan. ({e!r})")
    try:
        hasil = rapikan(json.loads(r.json()["message"]["content"]), konteks, kalimat)
    except (KeyError, ValueError, TypeError) as e:
        raise HTTPException(502, f"Jawaban model tidak bisa dibaca: {e}")
    return jawaban(hasil, model, round((time.perf_counter() - mulai) * 1000))
