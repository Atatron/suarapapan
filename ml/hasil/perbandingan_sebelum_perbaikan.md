# Perbandingan pertama (13 Oktober 2026), sebelum model diperbaiki

Set uji: 40 kalimat tulisan tangan (`tests/kalimat_uji.json`). Ini angka yang
paling jujur untuk dilaporkan, karena perbaikan sesudahnya dibuat setelah
melihat kesalahan pada set yang sama.

| Pendekatan | Benar | Akurasi | Latensi median | Latensi p90 |
|---|---|---|---|---|
| IndoBERT (model kami) | 38/40 | 95% | 7.9 ms | 13.3 ms |
| LLM qwen2.5:7b-instruct | 38/40 | 95% | 759.5 ms | 915 ms |
| Gabungan (IndoBERT, cadangan qwen2.5:7b-instruct) | 39/40 | 98% | 6.4 ms | 7.8 ms |

Kesalahan yang ditemukan, lalu diperbaiki secara umum:

- IndoBERT: "dua puluh tujuh semut" terbaca 7 (data latih hanya sampai 20, potongan angka tidak digabung).
- IndoBERT: "Siti membawa 8 kue" ke papan kosong terbaca sebagai peristiwa. Pada jalur gabungan, kalimat ini sudah benar karena IndoBERT ragu (yakin 0,68) dan LLM mengambil alih.
- LLM: "kupu-kupu" terpotong menjadi "kupu" oleh fungsi penormal kata di server.

Uji independen yang sebenarnya: 100 kalimat guru asli dari tim (`tests/kalimat_guru_asli.csv`).
