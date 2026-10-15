# SuaraPapan

Guru bicara, papan bercerita. Ucapan guru diubah menjadi caption dan adegan
interaktif di proyektor, untuk siswa penyandang disabilitas di kelas inklusi.

## Versi online (tanpa instalasi)

Buka **https://suarapapan.vercel.app/guru** di Google Chrome. Versi online memakai
Gemini (`web/api/parse.js`) untuk memahami kalimat, dengan skema JSON yang sama
dengan IndoBERT. Kunci disimpan di Vercel sebagai `GEMINI_API_KEY`
(Settings → Environment Variables), tidak pernah di kode.

Untuk mencoba versi online di laptop: buat `web/.env.local` berisi
`GEMINI_API_KEY=...`, lalu `npm run dev`. Tanpa kunci itu, `/api` diteruskan ke
server Python seperti di bawah.

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

## Pengenalan suara

Dua jalur berjalan bersamaan ketika guru menahan tombol bicara:

| Jalur | Fungsi | Kelebihan | Kekurangan |
|---|---|---|---|
| Web Speech (Chrome) | caption langsung di papan saat guru bicara | langsung, tanpa tunggu | tidak bisa diberi kosakata, hanya di Chrome |
| Rekaman → Gemini (`/api/transkripsi`) | teks akhir yang diuraikan menjadi adegan | tepat pada nama benda, bilangan, dan konteks adegan; jalan di browser mana pun | ±3–7 detik setelah tombol dilepas, memakai kuota |

Satu panggilan Gemini sekaligus menuliskan ucapan dan mengurai kalimatnya
(`urai: true`). Jika ucapan terdiri dari beberapa kalimat, tiap kalimat diurai
satu per satu karena pada uji model kadang mengurai kalimat yang salah.

Pengaman terhadap kalimat karangan: (1) rekaman yang tidak punya ledakan energi
ucapan ditolak di klien dan server (`adaUcapan` di `web/src/lib/wav.js`);
(2) model mengisi `ada_ucapan` sebelum menulis; (3) jika Gemini gagal, hasil
Chrome dipakai. Mode ini bisa dimatikan di panel guru ("Pengenalan suara akurat").

Mencoba UI lokal dengan server online tanpa kunci di laptop:
`SUARAPAPAN_API=https://suarapapan.vercel.app npm run dev` (di Windows, tambahkan
`NODE_OPTIONS=--use-system-ca` bila sertifikat jaringan tidak dikenali Node).

## Gambar

192 benda + 22 tempat kartun ada di `web/public/aset/` (hasil generate, dipotong per
benda). Dibuat ulang dari sprite sheet dengan `tools/bangun_aset.py`; pencarian
kata → gambar ada di `web/src/scene/pustaka.js`. Benda tanpa gambar memakai
emoji pilihan Gemini.

## Tes

```bash
cd web && npm test
cd ml && .venv\Scripts\python bandingkan_llm.py qwen2.5:7b-instruct
```
