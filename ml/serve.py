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
from pydantic import BaseModel

from bahasa import AKSI_KE_ENUM, normalkan_benda, tokenisasi

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


def normalkan_jenis(teks: str) -> str:
    t = teks.strip().lower()
    t = re.sub(r"^(ekor|buah|biji|batang|lembar|orang)\s+", "", t)
    return normalkan_benda(t)  # kelinci-kelinci → kelinci, tetapi kupu-kupu tetap kupu-kupu


def rapikan(h: dict) -> dict:
    for e in h.get("entitas", []):
        e["jenis"] = normalkan_jenis(e["jenis"])
        # "di rumput" adalah latar, bukan posisi relatif seperti "di bawah meja"
        if h.get("latar") and e.get("posisi", "").strip() in (h["latar"], f"di {h['latar']}"):
            e["posisi"] = ""
        e["jumlah"] = max(1, min(int(e.get("jumlah") or 1), 20))
    for p in h.get("peristiwa", []):
        p["target"] = normalkan_jenis(p["target"])
        p["jumlah"] = max(1, min(int(p.get("jumlah") or 1), 20))
    # Model kecil sering menulis benda yang berubah di "entitas" juga
    # ("satu kelinci lagi datang"). Benda itu bukan benda baru, jadi dibuang.
    target = {p["target"] for p in h.get("peristiwa", [])}
    h["entitas"] = [e for e in h.get("entitas", []) if e["jenis"] not in target]
    # "kucing di bawah meja" adalah pelajaran posisi, bukan membilang
    if h.get("konsep") == "membilang" and any(e.get("posisi", "").startswith(("di ", "ke ")) and e["jumlah"] == 1 for e in h["entitas"]):
        h["konsep"] = "posisi"
    return h


class Permintaan(BaseModel):
    kalimat: str
    konteks: str = "kosong"


http = httpx.AsyncClient(timeout=180)
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
        await http.post(OLLAMA_URL, json={"model": OLLAMA_MODEL, "messages": [], "keep_alive": "30m"})
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
        if r["yakin"] >= AMBANG_YAKIN:
            return {"hasil": r["hasil"], "sumber": "indobert", "ms": r["ms"], "yakin": r["yakin"]}
        try:
            llm = await tanya_llm(kalimat, konteks, OLLAMA_MODEL)
        except HTTPException:
            # LLM mati: lebih baik jawaban IndoBERT yang ragu daripada tidak ada apa-apa
            return {"hasil": r["hasil"], "sumber": "indobert (LLM tidak tersedia)", "ms": r["ms"], "yakin": r["yakin"]}
        llm["ms"] = round(llm["ms"] + r["ms"])
        llm["yakin"] = r["yakin"]
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
        hasil = rapikan(json.loads(r.json()["message"]["content"]))
    except (KeyError, ValueError) as e:
        raise HTTPException(502, f"Jawaban model tidak bisa dibaca: {e}")
    # LLM kadang mengarang aksi ("kue berenang"). Aksi hanya dipakai jika kata
    # kerjanya memang diucapkan guru.
    kata = set(tokenisasi(kalimat))
    for e in hasil["entitas"]:
        if not any(AKSI_KE_ENUM.get(k) == e["aksi"] for k in kata):
            e["aksi"] = "diam"
    return {"hasil": hasil, "sumber": model, "ms": round((time.perf_counter() - mulai) * 1000)}
