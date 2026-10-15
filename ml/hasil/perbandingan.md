| Pendekatan | Benar | Akurasi | Latensi median | Latensi p90 |
|---|---|---|---|---|
| IndoBERT (model kami) | 40/40 | 100% | 8.6 ms | 12.9 ms |
| LLM qwen2.5:7b-instruct | 39/40 | 98% | 877.0 ms | 1056 ms |
| Gabungan (IndoBERT, cadangan qwen2.5:7b-instruct) | 40/40 | 100% | 6.8 ms | 13.6 ms |
