| Pendekatan | Benar | Akurasi | Latensi median | Latensi p90 |
|---|---|---|---|---|
| IndoBERT (model kami) | 40/40 | 100% | 8.2 ms | 14.4 ms |
| LLM qwen2.5:7b-instruct | 39/40 | 98% | 814.0 ms | 952 ms |
| Gabungan (IndoBERT, cadangan qwen2.5:7b-instruct) | 40/40 | 100% | 5.7 ms | 6.6 ms |
