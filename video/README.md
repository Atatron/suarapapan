# Sumber video demo SuaraPapan (1:59)

Video ini **dibuat dengan kode**, bukan dengan alat pembuat video:

| Bagian | Cara membuatnya |
|---|---|
| Karakter dan adegan | Digambar dengan kode (SVG/HTML) di `cast.js`, `world.js`, `scenes_*.js` |
| Suara narasi | Suara sintetis Indonesia `edge-tts` (`id-ID-GadisNeural`, `id-ID-ArdiNeural`) lewat `tts.py` |
| Musik dan efek suara | Disintesis dengan kode (`mix.py`), tanpa lisensi pihak ketiga |
| Gambar padang rumput dan kelinci | Aset aplikasi SuaraPapan sendiri |
| Penyusunan | `timeline.py` menghitung waktu tiap adegan dari durasi suara; `render.mjs` merender setiap bingkai `index.html` dengan Edge headless lalu merangkainya dengan ffmpeg |

`SUMBER.md` mencatat **dari mana setiap angka di layar berasal**, termasuk catatan ketika sumber
mengukur hal yang sedikit berbeda dari kalimat yang beredar (misalnya ruang kelas, bukan sekolah).
Tidak ada data harga di video.

Berkas video jadinya (±50 MB) tidak disimpan di riwayat git; lihat bagian *Releases* di GitHub.

## Merender ulang (opsional)

Butuh Node.js, Python 3.12 (`edge-tts`, `numpy`, `scipy`), Microsoft Edge, dan ffmpeg.
Skrip memakai lokasi ffmpeg di laptop kami (konstanta `FF` di `render.mjs` dan skrip `.py`);
ubah ke lokasi ffmpeg Anda. Urutannya mengikuti catatan di tiap skrip:

```bash
cd video
npm install
python tts.py        # suara narasi + penanda waktu kata  → build/vo/
python timeline.py   # waktu tiap adegan                   → build/timeline.json
python mix.py        # musik, efek, dan pencampuran suara  → build/mix.wav
node render.mjs      # merender bingkai dan merangkai video
```
