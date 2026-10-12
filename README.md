# SuaraPapan

Guru bicara, papan bercerita. Ucapan guru diubah menjadi caption dan adegan
interaktif di proyektor, untuk siswa penyandang disabilitas di kelas inklusi.

## Menjalankan di laptop (Windows)

Butuh: Python 3.12, Node.js, [Ollama](https://ollama.com) dengan model `qwen2.5:7b-instruct`, dan Google Chrome.

**1. Server ML** (terminal pertama)

```bash
cd ml
python -m venv .venv
.venv\Scripts\pip install fastapi==0.115.6 "uvicorn[standard]==0.34.0" httpx==0.28.1
.venv\Scripts\python -m uvicorn serve:app --port 8000
```

**2. Aplikasi web** (terminal kedua)

```bash
cd web
npm install
npm run dev
```

**3. Di kelas**

1. Sambungkan proyektor, tekan `Win + P`, pilih **Perluas (Extend)**.
2. Buka `http://127.0.0.1:5173/guru` di laptop.
3. Klik **Buka papan**, seret jendelanya ke proyektor, klik **Layar penuh**.
4. Tahan tombol **Spasi** (atau clicker presentasi), ucapkan kalimat, lalu lepaskan.

## Model IndoBERT (pemahaman kalimat)

Bobot model (±500 MB) tidak disimpan di GitHub. Buat ulang dalam ±2 menit dengan GPU:

```bash
cd ml
.venv\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cu128
.venv\Scripts\pip install transformers datasets seqeval accelerate matplotlib
.venv\Scripts\python buat_dataset.py      # 3.200 kalimat berlabel → data/
.venv\Scripts\python latih_ner.py         # → model/indobert-suarapapan, hasil/metrik_latih.json
.venv\Scripts\python evaluasi.py          # IndoBERT vs LLM vs gabungan → hasil/perbandingan.md
```

Server memakai IndoBERT lebih dulu. Jika keyakinannya di bawah 85%, kalimat diteruskan ke LLM (Ollama).

## Struktur

| Folder | Isi |
|---|---|
| `web/src/guru` | Panel guru: mikrofon, pratinjau, tombol kendali |
| `web/src/papan` | Tampilan proyektor: adegan, soal, caption |
| `web/src/scene` | Mesin adegan (`engine.js`, ada tesnya) dan gambar benda (`aset.jsx`) |
| `ml/serve.py` | Server `/api/parse`: kalimat → JSON adegan |
| `ml/bandingkan_llm.py` | Uji akurasi dan kecepatan model pada kalimat uji |

## Tes

```bash
cd web && npm test
cd ml && .venv\Scripts\python bandingkan_llm.py qwen2.5:7b-instruct
```
