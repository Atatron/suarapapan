# SUARA PAPAN — Naskah Video Kartun (1:58)

**Judul kerja:** *"Kelas yang Sunyi"*
**Durasi:** 1 menit 58 detik (aman di bawah batas 2 menit)
**Sudut pandang:** Raka, 7 tahun, siswa kelas 2 SD inklusi, memakai alat bantu dengar
**Gaya:** kartun 2D flat, hangat, seperti buku cerita anak
**Cara produksi:** gambar diam dari AI (GPT / Gemini) → dianimasikan di CapCut/Canva (zoom, geser, pop-in, efek suara)

---

## 1. Ide besar dalam satu kalimat

> Penonton **merasakan** dulu kelas dari telinga Raka (suara teredam, sunyi, bingung), lalu **melihat** kelas yang sama berubah saat ucapan guru menjadi teks dan cerita bergambar.

**Kenapa hook ini kuat:** 10 detik pertama memakai trik *switch* audio. Kelas terdengar normal dan ceria, lalu tiba-tiba suara teredam saat kamera pindah ke Raka. Juri tidak *diberi tahu* masalahnya; mereka *mengalaminya*. Adegan pembuka yang sama diulang di akhir (*callback*), jadi perubahannya terasa tanpa penjelasan panjang.

### Peta naskah ↔ rubrik juri

| Rubrik | Bobot | Ditunjukkan di |
|---|---|---|
| Teknis | 30 | S10: suara → teks → AI mengenali jumlah/benda/aksi/tempat → adegan |
| Inovasi | 25 | S8: papan *mengingat* cerita; kalimat baru mengubah adegan yang sama |
| Fungsionalitas & Desain | 20 | S7–S9, S11: caption, objek, interaksi siswa, kontrol guru |
| Dampak | 15 | S4–S5 (data masalah), S12 (biaya rendah), kartu akhir (rencana pilot) |
| Presentasi | 10 | Seluruh video: satu tokoh, satu cerita, satu callback |

---

## 2. Tokoh

| Tokoh | Deskripsi visual (salin persis ke setiap prompt) | Suara |
|---|---|---|
| **Raka** (narator) | Anak laki-laki Indonesia, 7 tahun, rambut hitam pendek berantakan, mata bulat besar, kulit sawo matang, seragam SD putih–merah, **alat bantu dengar biru muda di telinga kanan**, tas punggung kuning | Suara anak (rekam adik/keponakan, atau teman tim dengan pitch +2 di CapCut). Pelan, jujur, sedikit lucu. |
| **Bu Sari** (guru) | Guru perempuan Indonesia, 30-an, hijab hijau zaitun, blus krem bermotif bunga kecil, rok panjang cokelat, senyum hangat, **mikrofon jepit kecil** di kerah (mulai S6) | Suara perempuan dewasa, ceria, jelas. |
| **Teman sekelas** | 4–5 anak SD seragam putih–merah: anak perempuan berkepang dua, anak laki-laki berkacamata, dll. | Tawa/sorak saja. |
| **Kelinci** | **Pakai `kelinci.webp` dari aplikasi** (`suarapapan/web/public/aset/obj/kelinci.webp`), PNG transparan, jadi kelinci di video **sama persis** dengan di aplikasi. | Efek "boing" lucu. |

---

## 3. Panduan gaya (tempel di awal setiap prompt gambar)

```
Flat 2D children's storybook cartoon, soft rounded shapes, thick clean outlines,
warm afternoon light, Indonesian elementary classroom, 16:9 widescreen.
Color palette: deep chalkboard green #16302A, warm yellow #E8B931, cream #F3F1EA,
soft sage #A8CBB7, accents of brick red. No text in the image unless specified.
Consistent characters (see reference sheet).
```

**Trik konsistensi:** buat **lembar karakter** dulu (prompt R1 di bawah), lalu lampirkan gambar itu di setiap prompt berikutnya dengan kalimat *"Use the attached character sheet for Raka and Bu Sari, keep them identical."*

**Warna emosi (penting untuk cerita):**
- Dunia Raka **sebelum** SuaraPapan: abu-abu kebiruan, saturasi rendah (atur di CapCut: *Adjust → Saturation −60*).
- Dunia Raka **sesudah**: warna penuh, kuning hangat.

---

## 4. Naskah per adegan

> **VO** = voice-over. **SFX** = efek suara. **Teks** = tulisan di layar. Hitungan kata VO sudah dicek terhadap durasi (lihat bagian 6).

### BABAK 1 — HOOK (0:00–0:15)

**S1 · 0:00–0:05 · Kelas ceria**
- **Visual:** Kelas cerah. Bu Sari di depan papan tulis hijau, tersenyum, menunjuk papan. Anak-anak duduk, bersemangat.
- **Animasi:** zoom in pelan (100% → 108%).
- **Bu Sari (suara jernih):** *"Anak-anak, di rumput ada tiga kelinci!"*
- **SFX:** suasana kelas, tawa kecil anak.
- **Musik:** ukulele ceria mulai.

**S2 · 0:05–0:10 · SWITCH: telinga Raka**
- **Visual:** *Whip pan* cepat ke close-up Raka. Alat bantu dengarnya terlihat jelas. Wajahnya bingung.
- **Animasi:** transisi *whip pan*; warna turun ke abu-abu kebiruan dalam 0,5 detik.
- **Audio:** **musik berhenti mendadak.** Suara Bu Sari yang sama diputar ulang dengan efek **teredam** (CapCut: *Voice effects → Low-pass / "Underwater"*, volume 40%). Ditambah dengung pelan.
- **Teks (tengah, putih, muncul per kata):** **"Tapi Raka mendengarnya seperti ini."**

**S3 · 0:10–0:15 · POV Raka**
- **Visual:** Sudut pandang Raka dari bangku belakang. Mulut Bu Sari bergerak, buram. Di papan hanya terbaca **"3 − 2 = ?"**. Semua teman mengangkat tangan. Raka mengecil di kursinya.
- **Animasi:** tangan teman muncul satu per satu (*pop*), kamera sedikit goyang.
- **VO Raka (jernih, suara batin):** *"Semua sudah tahu jawabannya. Aku… belum tahu soalnya."*
- **SFX:** suara kelas tetap teredam.

### BABAK 2 — MASALAH (0:15–0:40)

**S4 · 0:15–0:27 · Raka tidak sendirian**
- **Visual:** Kamera keluar lewat jendela kelas → atap sekolah → peta Indonesia kartun. Titik-titik kuning menyala di seluruh pulau.
- **Animasi:** zoom out panjang (gabungkan 3 gambar dengan transisi *zoom*). Angka besar menghitung naik **0 → 82%**.
- **VO Raka:** *"Aku tidak sendirian. Di Indonesia, delapan puluh dua dari seratus anak usia lima belas tahun belum mencapai kemampuan dasar matematika."*
- **Teks:** **82%** belum mencapai Level 2 · *Sumber: OECD, PISA 2022*

**S5 · 0:27–0:40 · Bu Sari kewalahan**
- **Visual:** Bu Sari sendirian di depan 30 anak. Ia memegang kapur, menggambar kelinci, membagikan lembar kerja, dan ada anak menarik bajunya, semuanya sekaligus. Jam dinding berputar cepat.
- **Animasi:** gaya *juggling*: 4 potongan aksi bergantian cepat (0,5 detik masing-masing), lalu kembali ke wajah lelah Bu Sari.
- **VO Raka:** *"Dan Bu Sari harus mengajar kami semua sendirian. Delapan puluh lima dari seratus sekolah seperti sekolahku belum punya guru pendamping khusus."*
- **Teks:** **85,2%** sekolah belum memiliki GPK · *Sumber: Dapodik, Des 2023*
- **SFX:** detak jam makin cepat.

### BABAK 3 — SOLUSI (0:40–1:36)

**S6 · 0:40–0:46 · Titik balik**
- **Visual:** Bu Sari berhenti, menarik napas, lalu tersenyum. Ia menjepit mikrofon kecil di kerah dan membuka laptop yang tersambung ke proyektor.
- **Animasi:** ikon bola lampu *pop* di atas kepalanya. Logo **SUARA PAPAN** muncul dengan efek *bounce*, tagline di bawahnya: *Guru bicara, papan bercerita.*
- **VO Raka:** *"Sampai suatu hari, Bu Sari mencoba sesuatu yang baru."*
- **Musik:** ukulele masuk lagi, lebih hangat.

**S7 · 0:46–0:56 · Kata-kata muncul**
- **Visual:** Proyektor menyorot papan hijau gelap (#16302A). Bu Sari berbicara. **Caption besar muncul kata per kata** di bagian atas papan: *"di rumput ada tiga kelinci"*. Lalu rumput hijau muncul dan **3 kelinci** melompat masuk satu per satu.
- **Animasi:** caption pakai CapCut *Text → Typewriter*. Kelinci (`kelinci.webp`) masuk dengan animasi *Bounce in*, beri jeda 0,3 detik di antaranya.
- **Bu Sari:** *"Di rumput ada tiga kelinci."*
- **Cut ke Raka:** **warna kembali** ke wajahnya (saturasi naik), matanya membesar. Audio di sisi Raka *tetap teredam*, tetapi kali ini ia **membaca** caption.
- **VO Raka:** *"Kata-kata Bu Sari muncul di papan. Dan kelincinya… muncul juga!"*
- **SFX:** "boing" kecil setiap kelinci masuk.

**S8 · 0:56–1:06 · Papan mengingat cerita (INOVASI)**
- **Visual:** Adegan yang sama. Caption baru: *"lalu dua kelinci pergi"*. **Dua kelinci melompat keluar** dari bingkai; satu tetap tinggal. Persamaan tersusun di atas: **3 − 2 = ?**
- **Animasi:** 2 kelinci *slide out* ke kanan. Angka persamaan muncul satu per satu.
- **Bu Sari:** *"Lalu dua kelinci pergi."*
- **VO Raka:** *"Papan mengingat ceritanya. Kalimat berikutnya mengubah adegan yang sama."*
- **Catatan:** ini poin inovasi utama, jadi beri jeda pendek. Jangan dipercepat.

**S9 · 1:06–1:14 · Raka menjawab duluan**
- **Visual:** Di papan muncul pertanyaan **"Ada berapa kelinci sekarang?"** dengan tiga tombol: **0 · 1 · 2**. Raka maju dan mengetuk **1**. Tombol berubah kuning, muncul **"Benar!"** dan bintang-bintang. Teman-teman bersorak, Bu Sari mengacungkan jempol.
- **Animasi:** tombol *pop*, efek *sparkle* CapCut, konfeti.
- **VO Raka:** *"Kali ini, aku yang menjawab duluan!"*
- **SFX:** "ting!", sorak anak-anak.

**S10 · 1:14–1:26 · Cara kerjanya (TEKNIS)**
- **Visual:** Diagram kartun bergerak dari kiri ke kanan di atas latar krem:
  1. Gelembung suara keluar dari mulut Bu Sari → gelombang suara
  2. → berubah jadi teks *"di rumput ada tiga kelinci"*
  3. → robot/otak AI kecil yang lucu menyorot kata-kata dengan stiker warna: **TEMPAT** *rumput* · **JUMLAH** *tiga* · **BENDA** *kelinci* · **AKSI** *pergi*
  4. → menjadi adegan papan dengan kelinci
- **Animasi:** setiap langkah muncul mengikuti VO (*wipe* kiri→kanan). Stiker *pop* satu per satu.
- **VO Raka:** *"Caranya: suara Bu Sari diubah jadi teks. Lalu AI memahami jumlah, benda, aksi, dan tempatnya, lalu menggambar ceritanya."*

**S11 · 1:26–1:36 · Guru tetap memegang kendali**
- **Visual:** Close-up layar laptop Bu Sari (panel guru versi kartun): kotak **Pratinjau** berisi kalimat dan rencana adegan, dengan tiga tombol besar **Tampilkan · Batalkan · Sematkan**. Jari Bu Sari mengetuk **Tampilkan**, lalu adegan muncul di papan di belakangnya.
- **Animasi:** kursor/jari mengetuk, tombol *press*, *split screen* laptop | papan.
- **VO Raka:** *"Bu Sari tetap pegang kendali: cek dulu, baru tampilkan."*
- **Teks kecil:** Pratinjau · Tampilkan · Batalkan · Sematkan

### BABAK 4 — DAMPAK & PENUTUP (1:36–1:58)

**S12 · 1:36–1:45 · Murah dan siap pakai**
- **Visual:** Meja guru: laptop + proyektor (centang hijau, *"sudah ada di kelas"*), lalu mikrofon jepit + clicker masuk dengan label harga. Stopwatch menunjuk 5 menit.
- **Animasi:** item *pop* bergantian, centang ✓ muncul.
- **VO Raka:** *"Cukup laptop dan proyektor yang sudah ada di kelas, ditambah mikrofon jepit dan clicker."*
- **Teks:** **±Rp275 ribu** tambahan · target persiapan **5 menit**

**S13 · 1:45–1:53 · CALLBACK ke adegan pembuka**
- **Visual:** **Komposisi persis sama dengan S3** (POV Raka dari bangku belakang). Bedanya: warna penuh, papan menampilkan caption dan kelinci, dan **Raka yang pertama mengangkat tangan**, tersenyum.
- **Audio:** suara kelas *masih teredam* (efek yang sama dengan S2). Ini disengaja: pendengarannya tidak berubah, yang berubah adalah aksesnya.
- **VO Raka:** *"Aku masih tidak bisa mendengar Bu Sari dengan jelas. Tapi sekarang, aku mengerti."*
- **Musik:** ukulele naik ke bagian paling hangat.

**S14 · 1:53–1:58 · Kartu akhir**
- **Visual:** Latar hijau tua #16302A. Logo **SUARA PAPAN** (kuning #E8B931). Satu kelinci melompat di pojok.
- **Bu Sari + anak-anak (bersama):** *"Guru bicara. Kelas melihat. Siswa ikut berhitung."*
- **Teks:**
  - **Setiap siswa berhak memahami pelajaran.**
  - Demo: **suarapapan.vercel.app/guru**
  - Langkah berikutnya (usulan): pilot 8 minggu · 2 sekolah · 6 guru
  - Hackathon Dies Natalis FMIPA UGM 2026
- Tahan 1 detik, lalu *fade* ke hitam.

---

## 5. Prompt gambar (salin ke GPT / Gemini)

> Awali setiap prompt dengan **blok Panduan gaya** (bagian 3), lalu lampirkan lembar karakter R1.

| ID | Untuk | Prompt |
|---|---|---|
| **R1** | Lembar karakter | Character reference sheet on plain cream background: **Raka**, 7-year-old Indonesian boy, short messy black hair, big round eyes, warm brown skin, white shirt and red shorts school uniform, light-blue hearing aid on right ear, yellow backpack. Front, side, happy, confused poses. **Bu Sari**, Indonesian female teacher in her 30s, olive-green hijab, cream blouse with small flower print, long brown skirt, warm smile, small clip-on microphone on collar. Front, side, talking, tired poses. |
| **S1** | Kelas ceria | Wide shot of a bright Indonesian elementary classroom, Bu Sari smiling at the front pointing at a green chalkboard, 5 students in white-and-red uniforms sitting at wooden desks looking excited, window with sunlight and a plant. |
| **S2** | Close-up Raka | Close-up of Raka at his desk, light-blue hearing aid clearly visible on his right ear, confused expression, slightly furrowed brows, classroom softly blurred behind him. |
| **S3** | POV Raka | First-person view from the back row of the classroom: back of classmates' heads with all hands raised, Bu Sari at the front blurred mid-sentence, green chalkboard showing only "3 − 2 = ?" in chalk. Raka's small hands on the desk in the foreground. |
| **S4a** | Jendela | View from inside the classroom out through the window to the school roof and blue sky. |
| **S4b** | Atap sekolah | Aerial view of a small Indonesian village school with red tile roof among palm trees and rice fields. |
| **S4c** | Peta | Cute cartoon map of Indonesia's islands in sage green on a deep green ocean, many tiny school icons scattered across the islands, no labels. |
| **S5** | Kewalahan | Bu Sari alone in front of a crowded class of 30 children, holding chalk in one hand and worksheets in the other, one child tugging her sleeve, another raising a hand, wall clock above, she looks tired but kind. |
| **S6** | Titik balik | Bu Sari clipping a small microphone onto her collar, smiling, an open laptop on the teacher's desk connected by a cable to a ceiling projector. Leave empty space at top for a logo. |
| **S7** | Papan proyektor | Classroom front wall: projector beam showing a large deep green #16302A screen with a strip of bright green grass at the bottom, **empty space for rabbits and caption** (rabbits and text are added in editing). Bu Sari standing to the side speaking. |
| **S7b** | Raka berbinar | Same framing as S2, Raka now wide-eyed and amazed, looking up at the screen, warm yellow light on his face. |
| **S9** | Raka menjawab | Raka standing at the front, tapping a big projected screen with his finger, classmates cheering behind him, Bu Sari giving a thumbs up. |
| **S10** | Robot AI | A small friendly round robot-brain mascot holding a magnifying glass, cream background, isolated, simple shapes. *(Stiker, gelombang suara, dan teks dibuat di CapCut.)* |
| **S11** | Laptop guru | Over-the-shoulder close-up of Bu Sari's hand on a laptop, the screen shows a simple clean teacher panel with a preview box and three big buttons (leave the button labels blank, text added in editing). Projector screen visible softly in the background. |
| **S12** | Meja guru | Top-down flat-lay of a teacher's desk: laptop, small projector, clip-on microphone, presentation clicker, a stopwatch. Clean, spaced out, cream desk surface. |
| **S13** | Callback | **Same composition as S3** but full warm color: board shows the green grass scene with one rabbit, classmates turning around smiling, and Raka's own hand raised first in the foreground. |

**Aset yang tidak perlu digenerate:**
- Kelinci → `C:\Users\ATA\suarapapan\web\public\aset\obj\kelinci.webp`
- Rumput → `...\aset\tempat\rumput.webp` (opsional, sebagai latar papan)
- Caption, persamaan, tombol 0·1·2, "Benar!", label stiker AI → **dibuat sebagai teks di CapCut** (AI gambar sering salah menulis huruf)

---

## 6. Cek waktu

Kecepatan bicara nyaman untuk suara anak ≈ **2,0 kata/detik**. Batas aman: ≤ 2,2.

| Adegan | Waktu | Detik | Kata VO + dialog | Kata/detik |
|---|---|---|---|---|
| S1 | 0:00–0:05 | 5 | 7 | 1,4 |
| S2 | 0:05–0:10 | 5 | 0 (teks saja) | — |
| S3 | 0:10–0:15 | 5 | 8 | 1,6 |
| S4 | 0:15–0:27 | 12 | 20 | 1,7 |
| S5 | 0:27–0:40 | 13 | 21 | 1,6 |
| S6 | 0:40–0:46 | 6 | 9 | 1,5 |
| S7 | 0:46–0:56 | 10 | 16 | 1,6 |
| S8 | 0:56–1:06 | 10 | 13 | 1,3 |
| S9 | 1:06–1:14 | 8 | 6 | 0,8 |
| S10 | 1:14–1:26 | 12 | 18 | 1,5 |
| S11 | 1:26–1:36 | 10 | 9 | 0,9 |
| S12 | 1:36–1:45 | 9 | 14 | 1,6 |
| S13 | 1:45–1:53 | 8 | 13 | 1,6 |
| S14 | 1:53–1:58 | 5 | 7 | 1,4 |
| **Total** | | **118** | **161** | **1,4** |

Ruang napasnya cukup. Kalau rekaman suara ternyata lebih lambat, potong dulu **S11** (hanya teks, tanpa VO), baru S12.

---

## 7. Audio

| Lapisan | Saran | Catatan |
|---|---|---|
| Musik | Ukulele/xylophone ceria, bebas royalti (CapCut Library → *"kids happy ukulele"*) | **Berhenti total di S2.** Masuk lagi di S6. Paling keras di S13. |
| Efek teredam | CapCut → *Voice effects* → *Low-pass* / *Underwater* | Dipakai di S2, S3, dan **S13 (callback)**. Jaga lembut, jangan sampai menyakitkan telinga. |
| SFX | boing (kelinci), ting (benar), sorak, detak jam, whoosh (whip pan) | |
| VO Raka | Rekam di ruangan tertutup penuh kain (lemari baju bagus), mic HP 15 cm dari mulut | Rekam per adegan, sisakan 0,5 detik hening di tiap ujung. |

---

## 8. Alur kerja produksi (± 1 hari)

1. **Rekam VO dulu** (Raka + Bu Sari), karena semua timing animasi mengikuti suara.
2. Generate **R1**, lalu S1–S13 dengan R1 terlampir. Tolak gambar yang wajah/hijab/alat bantu dengarnya berubah.
3. Susun di CapCut sesuai tabel bagian 6. Taruh VO dulu, lalu gambar, lalu teks, lalu SFX, lalu musik.
4. Tambahkan kelinci `kelinci.webp` sebagai *overlay* di S7–S9 dan S13.
5. **Pasang subtitle untuk seluruh VO** (CapCut → *Auto captions*, bahasa Indonesia, lalu koreksi manual). Video tentang aksesibilitas *wajib* punya caption, dan juri akan memperhatikannya.
6. Ekspor 1080p, 30 fps. **Cek durasi ≤ 2:00.**

---

## 9. Batas kejujuran (jangan dilanggar saat mengedit)

- Semua angka di video **sama dengan deck**: 82% (PISA 2022), 85,2% tanpa GPK (Dapodik Des 2023), ±Rp275 ribu, 5 menit. **Jangan tambah angka baru.**
- Pilot 8 minggu / 2 sekolah / 6 guru ditulis sebagai **usulan**, bukan hasil.
- Jangan klaim *"menyembuhkan"*, *"menggantikan guru pendamping"*, atau *"terbukti meningkatkan nilai"*. Deck sendiri menyatakan caption **bukan** pengganti GPK atau bahasa isyarat, dan dampaknya baru akan dibuktikan lewat uji kelas.
- Callback S13 sengaja menyatakan Raka **masih** tidak mendengar dengan jelas. Pesannya adalah *akses*, bukan *keajaiban*. Ini juga yang membuat ceritanya terasa jujur.
