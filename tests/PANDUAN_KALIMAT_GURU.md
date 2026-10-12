# Panduan untuk Anggota Data: mengisi kalimat guru asli

Tujuannya adalah menguji model dengan kalimat yang **benar-benar diucapkan guru**,
bukan kalimat buatan. Hasil ujian inilah yang masuk ke pitch deck dan proposal.

## Cara mengisi

Buka `kalimat_guru_asli.csv` dengan Excel atau Google Sheets. Satu baris berisi satu kalimat.
Empat baris pertama adalah contoh, jadi hapus dulu sebelum mulai mengisi.

| Kolom | Isi | Contoh |
|---|---|---|
| `kalimat` | Kalimat persis seperti yang diucapkan guru, termasuk "nah", "coba lihat", dan sejenisnya | `nah coba lihat, ada lima balon` |
| `isi_papan_sebelumnya` | Benda yang sudah ada di papan sebelum kalimat ini, ditulis `benda jumlah`. Kalau belum ada apa-apa, tulis `kosong`. | `balon 5` |
| `apa_yang_terjadi` | Pilih salah satu: `baru` (adegan baru), `tambah`, `hapus`, atau `tidak ada` (salam, pujian, pertanyaan) | `hapus` |
| `benda` | Kata benda tunggal, tanpa "ekor/buah" | `balon` |
| `jumlah` | Angka. Untuk `baru`, tulis jumlah bendanya. Untuk `tambah`/`hapus`, tulis jumlah yang berubah. | `2` |

## Supaya hasil ujiannya jujur

- Tulis kalimat **dengan gaya bicara guru sungguhan**. Kalau bisa, dengarkan video guru SD mengajar di YouTube dan catat ucapannya.
- **Jangan melihat daftar kalimat di dataset** (`ml/data/`). Kalimat yang meniru dataset membuat skor terlihat bagus padahal tidak jujur.
- Variasikan: angka besar ("dua puluh"), benda yang jarang ("kelereng", "jerapah"), salam, pujian, pertanyaan, dan kalimat panjang.
- Target: **100 kalimat**. Sekitar 40% adegan baru, 40% tambah atau hapus, dan 20% tidak ada.

Setelah selesai, simpan sebagai CSV dan beri tahu operator Claude. Kalimat-kalimatnya akan
diubah otomatis menjadi set uji dengan `ml/impor_kalimat_asli.py`.
