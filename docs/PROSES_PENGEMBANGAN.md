# Proses pengembangan SuaraPapan

Dokumen ini menceritakan **bagaimana** SuaraPapan dibuat: urutan kerja, keputusan, hasil
pengukuran, dan kesalahan yang kami temukan sendiri. Semua tanggal diambil dari riwayat
commit di repo ini (`git log`), jadi bisa diperiksa.

> Kode ditulis dan diuji dengan bantuan **Claude Code (Anthropic)** berdasarkan permintaan tim
> dalam bahasa Indonesia; tim memutuskan apa yang dibuat, mencoba hasilnya, dan mengoreksi arah.
> Detail alat AI ada di [README](../README.md#penggunaan-ai).

## 1. Garis waktu

| Waktu (WIB) | Yang selesai | Commit |
|---|---|---|
| 13 Okt, 02:15 | **Hari 1.** Aplikasi web pertama: panel guru, papan proyektor, mesin adegan (tambah/hapus benda), mikrofon Chrome | `f2d1fe6` |
| 13 Okt, 06:36 | **Hari 2.** Model **IndoBERT** buatan sendiri (6 label: jumlah, benda, aksi, tempat, posisi, peristiwa) + jalur gabungan dengan LLM lokal | `628d42b` |
| 13 Okt, 06:37 | Hasil perbandingan pertama disimpan **sebelum** model diperbaiki (agar angka jujur tetap ada) | `166f24e` |
| 15 Okt, 14:46 | **Versi online** di Vercel: pengurai kalimat memakai Gemini; topik pecahan, posisi, dan soal menghitung | `4bf1cd8` |
| 15 Okt, 15:05 | Emoji pilihan Gemini untuk benda tanpa gambar | `b648318` |
| 15 Okt, 21:00 | **Pustaka gambar**: 192 karakter dan 22 ikon tempat, dipotong dari sprite sheet | `eabd18c` |
| 15 Okt, 21:33 | **Pengenalan suara akurat**: rekam suara, transkripsi Gemini dengan kosakata papan | `4ccc0f7` |
| 15 Okt, 21:37 | Halaman `/uji` untuk mengukur akurasi suara dengan suara sendiri | `7a9895d` |
| 15 Okt, 23:32 | **32 latar lukisan penuh** yang cocok dengan karakter | `af9d1c2` |
| 15 Okt, 23:52 | Menambah karakter ke papan tanpa mengganti adegan; perbaikan hitungan ganda | `86fe859` |
| 16 Okt, 00:03 | **Batalkan dan Ulangi** dengan tampilan sebelum dan sesudah | `cfda549` |
| 16 Okt, 00:19 | **Aritmetika beberapa jenis karakter** (3 kelinci + 2 harimau = 5) | `10682dc` |
| 16 Okt, 00:57 | Alat pemotong sheet pose gerak (gambar pose belum dibuat) | `c98a387` |
| 16 Okt, 02:33 | Perbaikan karakter ganda/hilang saat menambah jenis baru | `737b061` |
| 16 Okt, 03:07–04:14 | Melatih ulang IndoBERT, uji sulit 51 kalimat, uji perintah 45 kalimat, perbaikan regresi | `6d58806` … `ebec6ad` |

## 2. Keputusan desain yang membedakan produk ini

1. **Kalimat memperbarui adegan yang sama.** "Lalu dua kelinci pergi" tidak menggambar ulang;
   ia mengubah adegan sebelumnya dan menghasilkan soal `3 − 2 = ?` dari perubahan itu.
   Mesinnya ada di `web/src/scene/engine.js` dan murni (tanpa efek samping), sehingga mudah diuji.
2. **Gambar tidak dibuat saat kelas berjalan.** Semua ilustrasi dibuat lebih dulu dan dikurasi.
   Alasannya: cepat, konsisten, dan aman untuk anak (tidak ada gambar yang tak terduga).
3. **Guru tetap memegang kendali.** Pratinjau sebelum tampil, Batalkan/Ulangi, dan kartu
   "Sebelum dan sesudah" yang menunjukkan perubahan apa yang akan terjadi.
4. **Dua jalur pemahaman kalimat.** IndoBERT buatan sendiri (cepat, bisa lokal) dan Gemini
   (online, lebih luas). Keduanya menghasilkan bentuk JSON yang sama, sehingga mesin adegan
   tidak peduli siapa yang menguraikan.
5. **Tidak ada kedipan atau gerakan mengejutkan**; animasi mengikuti pengaturan
   *kurangi gerakan* milik sistem (`prefers-reduced-motion`).

## 3. Pengukuran

Setiap angka diberi catatan tentang seberapa kuat buktinya.

### Pemahaman kalimat (IndoBERT)

| Uji | Hasil | Seberapa kuat? |
|---|---|---|
| 40 kalimat tulisan tim, **sebelum** perbaikan (13 Okt) | IndoBERT 38/40 (median 7,9 ms); LLM Qwen2.5-7B 38/40 (759 ms); gabungan 39/40 | Angka paling jujur: perbaikan dibuat setelah melihat kesalahannya. Berkas: [`ml/hasil/perbandingan_sebelum_perbaikan.md`](../ml/hasil/perbandingan_sebelum_perbaikan.md) |
| Set yang sama, **sesudah** perbaikan | IndoBERT 40/40 (median 8,6 ms) | **Bukan bukti independen**: set ini dipakai untuk memperbaiki model |
| 51 kalimat bebas + 45 kalimat perintah | 51/51 dan 45/45 | Disusun saat memperkuat model; berfungsi sebagai **uji regresi**, bukan uji murni |
| F1 validasi 1,0 pada 857 label | Sempurna | Data dibuat dari templat yang sama dengan data latih, jadi **tidak mewakili** kalimat guru sungguhan |
| 100 kalimat guru asli | **Belum dijalankan** | Baru 4 kalimat terkumpul (`tests/kalimat_guru_asli.csv`). Ini uji yang akan kami percaya |

Latensi diukur pada laptop dengan GPU RTX 5060.

### Pengenalan suara (versi online)

| Uji | Hasil | Catatan |
|---|---|---|
| 8 kalimat × 2 putaran, suara sintetis Indonesia (`id-ID-ArdiNeural`, `id-ID-GadisNeural`), separuhnya diberi derau kelas (rasio 8 dB) | **0 kesalahan dari 124 kata** | Suara **sintetis**, lebih bersih daripada suara asli. Anak-anak, aksen daerah, dan gema belum diuji |
| 12 klip derau (desis, gumam, dengung) dan hening | 0 klip menghasilkan kalimat | Setelah lapisan pengaman ditambahkan (lihat bagian 4). Satu klip kena batas waktu layanan. Derau buatan, bukan kelas sungguhan |
| Kecepatan setelah tombol dilepas | ±3–7 detik, kadang lebih | Gemini tingkat gratis kadang lambat atau sibuk |
| Uji dengan suara guru sungguhan | **Belum dilakukan** | Halaman `/uji` sudah siap; cara pakainya ada di README |

### Pengujian otomatis

`cd web && npm test` menjalankan **181 uji** (180 lulus, 1 dilewati karena butuh berkas audio).
Yang diuji: mesin adegan, aritmetika beberapa jenis karakter, riwayat Batalkan/Ulangi,
pembersih hasil parser, pencarian gambar dan latar, pengkodean audio, pendeteksi ucapan,
penghitung kesalahan kata, penguraian aturan lokal, dan batas laju API.

## 4. Kesalahan yang kami temukan dan perbaiki

Dikumpulkan di sini karena **cara menemukannya** sama pentingnya dengan hasil akhirnya.

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Rekaman sunyi menghasilkan kalimat karangan ("Di atas meja ada lima apel") | Model bahasa "mengisi kekosongan" dari konteks adegan | Deteksi ucapan berbasis energi di klien **dan** server sebelum memanggil model, ditambah penanda `ada_ucapan` |
| Setelah penanda dibuat ketat, kalimat jelas ikut terbuang (19% kata salah) | Instruksi terlalu hati-hati | Instruksi dilonggarkan; deteksi energi yang menjaga keamanan |
| Ucapan dua kalimat kadang mengurai kalimat yang salah | Satu panggilan melakukan dua tugas | Penguraian gabungan hanya dipercaya untuk **satu** kalimat |
| "Kelinci yang datang sebanyak 3" menjadi 6 kelinci dan harimau hilang | Model melaporkan satu kejadian dua kali; benda baru mengganti seluruh adegan | Penghapus duplikat, mode "gabung", dan penjelasan "3 + 3 = 6" dengan tombol tafsir lain |
| Soal pengurangan hanya menghitung satu jenis (`2 − 2 = 0` padahal ada 3 kelinci) | Aritmetika per jenis | Aritmetika memakai jumlah semua karakter, dengan pilihan untuk mematikannya |
| "Ikan di dalam laut" dianggap pelajaran posisi | "dalam laut" mirip "dalam kotak" | Kata tempat tidak dipakai sebagai acuan posisi |
| Bercak putih di sela kaki ayam, bebek, angsa | Latar putih yang terkurung tidak terjangkau penghapus latar | Daftar 22 benda yang diperiksa satu per satu; benda yang memang berisi warna putih (nasi, susu, awan) tidak disentuh |
| Galat merah `phrases-not-supported` di Chrome | Fitur petunjuk kata Chrome hanya jalan di perangkat | Fitur itu dihapus; kosakata diberikan lewat jalur Gemini |
| Model terbaru menolak parameter berpikir (`invalid argument`) | Nama model dan opsi berubah-ubah | Mencoba bentuk permintaan dari yang ketat ke yang longgar, lalu mengingat yang berhasil |
| Situs publik berhenti memahami kalimat setelah beberapa percobaan (503/429) | Log produksi menunjukkan kuota gratis Gemini hanya **20 permintaan per hari per model**; pemakaian juri akan menghabiskannya | Aturan bahasa di browser (`web/src/lib/lokal.js`) memahami pola sederhana tanpa server, dan menjadi cadangan jika Gemini gagal. Pengukuran: 41 kalimat baru dijalankan **sekali sebelum disetel** (39 benar, 1 salah label kami, 1 ragu); 136 kalimat lama dipakai menyetel sehingga 100% di sana tidak independen. Ditambah batas laju per IP dan cache jawaban yang sama di server |
| Halaman panel guru kosong saat dikembangkan setelah klien mengimpor `api/_urai.js` | Proxy dev mengarahkan semua `/api/*` ke server, termasuk berkas JavaScript | `rapikan` dipindah ke `src/lib/rapikan.js` yang dipakai bersama klien dan server |
| Aset baru dikembalikan sebagai halaman HTML sesaat setelah rilis | Cache tepi belum beralih | Dicatat sebagai perilaku operasional; cek ulang beberapa detik kemudian |

## 5. Hal yang belum selesai

Daftar lengkapnya ada di README bagian *Keterbatasan*. Singkatnya: suara manusia nyata belum
diuji, 100 kalimat guru asli belum diuji, pengenalan suara tanpa internet belum ada, dan
gambar pose gerak belum dibuat (alat pemotongnya sudah).
