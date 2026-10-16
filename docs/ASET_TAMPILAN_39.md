# Impor aset tampilan, 16 Oktober 2026

Sumber: paket lokal `sprite-sheets-39-2026-10-16`, bagian `final/`.
Sebanyak 39 PNG berukuran 1536 × 1536 memakai grid 4 × 3 (sel 384 × 512).
Setiap sel adalah satu kelompok gambar, termasuk pasangan benda, orang dengan
properti, dan diorama. Nama Inggris sumber dipetakan secara eksplisit ke ID dan
label Indonesia dalam `tools/aset_tampilan_39.json`.

| Hasil impor | Objek/karakter | Elemen tempat | Total |
|---|---:|---:|---:|
| Gambar dari sumber | 341 | 127 | 468 |
| ID baru | 218 | 105 | 323 |
| Gambar diperbarui pada ID lama | 123 | 22 | 145 |
| Isi pustaka setelah impor | 410 | 127 | 537 |

ID lama yang tidak ada padanannya tetap tersedia. Varian yang berbeda memakai
ID tersendiri, misalnya `donat` dan `donat-jajanan`, atau `anak-bebek` lama dan
`anak-ayam` baru. Properti seperti bedug, tiang listrik, dan tenda masuk `obj`,
meskipun sheet sumbernya terutama berisi bangunan.

## Pembuatan ulang

Gunakan Python dengan Pillow, NumPy, dan SciPy. Dari akar repositori:

```powershell
python tools/bangun_aset.py --sprites "../output/sprite-sheets-39-2026-10-16" --mapping tools/aset_tampilan_39.json --out web/public/aset --qa "../output/asset-integration-2026-10-16"
python -m unittest discover -s tools -p test_bangun_aset.py
npm --prefix web test
npm --prefix web run build
git diff --check
```

Sesuaikan `--sprites` dan `--qa` dengan lokasi paket sumber. Hash 39 PNG dikunci
di `tools/aset_tampilan_39_checksums.json`. Pengimpor memeriksa hash, urutan nama,
ID unik, dan koordinat grid sebelum menulis gambar. Jalur lama `--places` tetap
tersedia untuk paket sebelumnya.

Pengimpor memisahkan sel, membuang putih dari tepi, lalu menangani celah putih
tertutup pada daftar gambar yang diperiksa secara visual. Warna putih yang
merupakan isi gambar dipertahankan; `backgroundSeeds` memilih celah tertentu
untuk gambar bermutiara, logam, atau pakaian putih. Hasilnya WebP dengan transparansi: objek
dinormalisasi ke kanvas 400 × 320; tempat memakai ukuran potongan gambarnya.
Jaring laba-laba, harpa, dan raket mempunyai ambang khusus untuk celah kecilnya
(`backgroundThreshold`, `pocketMin`, dan `pocketWhite` pada pemetaan).

`pustaka.json` digabung dengan data lama. Kotak isi pada `ukuran.json` diukur dari
WebP akhir. Tinggi fisik adalah perkiraan untuk keterbacaan dan proporsi; nilai
khusus berada dalam pemetaan. Semua objek mempunyai pasangan latar dan area
penempatan pada `latar.json`. Nama tempat baru diarahkan ke latar yang tersedia
melalui `latar.js`, dan kategori baru memiliki judul Indonesia pada pemilih karakter.

Paket ini tidak berisi gambar latar 16:9. Sebanyak 32 latar yang sudah ada tetap
dipakai; `tools/bangun_latar.py` tidak dijalankan karena membutuhkan paket
`sprite-background-map.json` yang berbeda. Diorama tempat tidak diubah menjadi
latar layar penuh.

## Pemeriksaan

- Semua hash PNG sumber sesuai; 468 keluaran tidak kosong, transparan, dan
  berada di dalam batas sel. Dimensi tempat cocok dengan registrasi.
- Contact sheet objek dan tempat diperiksa di atas warna papan untuk menemukan
  potongan terpotong, label keliru, dan celah putih yang tertinggal.
- Tes JavaScript memeriksa pencarian seluruh 468 ID/nama, kosakata suara,
  alias lama, pasangan latar, serta ukuran dan jangkar seluruh karakter.
- Tes Python memakai sumber sintetis di folder sementara untuk memeriksa
  penggabungan, pembuatan ulang identik, koreksi latar, dan penolakan grid salah.
