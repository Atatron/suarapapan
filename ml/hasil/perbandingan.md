| Pendekatan | Benar | Akurasi | Latensi median | Latensi p90 |
|---|---|---|---|---|
| IndoBERT (model kami) | 40/40 | 100% | 9.1 ms | 12.7 ms |
| LLM qwen2.5:7b-instruct | 40/40 | 100% | 749.0 ms | 908 ms |
| Gabungan (IndoBERT, cadangan qwen2.5:7b-instruct) | 40/40 | 100% | 6.9 ms | 9.9 ms |
