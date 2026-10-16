# Size, placement, arithmetic and model audit

The starting point is merged `origin/main` at `af90d92` (PR #2), fetched from GitHub on 16 October 2026. The earlier asset catalog and voice workflow fixes are included. Work continues on `codex/size-arithmetic-training`.

## What changed

- Nine presentation profiles distinguish adults, children, babies, ordinary animals, small animals/insects, vehicles, furniture, environmental objects and small props. The semantic sentence role does not change an asset's physical scale. A toy car uses a prop scale rather than a vehicle scale.
- All 32 existing backgrounds have explicit usable surface areas in `web/src/scene/permukaan.js`. People and animals use floors, books/pencils can use tables, fish can use water, and flying objects use air. Regions are selected per object, including different actions of the same species.
- The old layout ignored its horizontal region and spread every sprite across the full scene. It now respects bounded regions. This fixes a child appearing on the foreground classroom desk. Human scale in the garden is adjusted to the foreground path.
- The original background artwork is retained. Exact named places continue to win over automatic subject-based background selection. A redundant miniature place badge is hidden when the full-size scene already depicts that place.
- Bare phrases such as **anak di kelas** create one subject; later **anak di taman** changes the place without resetting its quantity. **Ganti latar ke kelas** changes only the background.
- Arithmetic is computed by code, never accepted as a model-provided answer. Explicit `+`, `−`, `×`, `÷`, their common keyboard equivalents and Indonesian operator words are supported. Multiplication and sharing division display groups; integer division can display a remainder. Fraction cutting remains a separate lesson.
- Sequential clauses are applied in order. **Ada lima apel, lalu dua apel dimakan dan tiga apel datang** produces six apples and `5 − 2 + 3 = ?`.
- Division by zero, unsupported negative results, more than 20 drawn objects, or more than 12 drawn groups are held for correction instead of displaying a conflicting equation and picture. Numeric-only exercises do not invent a sprite.

## Examples

| Input | Expected display |
|---|---|
| `anak di kelas` | One child on the floor beside the desk |
| `anak di taman` | One child on the garden path |
| `Ada satu guru dan dua buku di kelas` | Adult on the floor, books on the table |
| `3 kali 2 apel` | Three groups of two apples; answer 6 |
| `dua belas apel dibagi tiga kelompok` | Three groups of four apples; answer 4 |
| `7 ÷ 2` | Answer `3 sisa 1` |
| `satu pizza dibagi empat` | One pizza split into four fractional pieces |
| `5 ÷ 0` | Explanation that division by zero is undefined; board retained |

## Training and reproducibility

The previous asset dataset omitted the `OPERATOR` BIO labels and lacked explicit action examples. The expanded inventory contains 15 labels: `O`, and `B`/`I` pairs for `JUMLAH`, `BENDA`, `AKSI`, `TEMPAT`, `POSISI`, `PERISTIWA`, `OPERATOR`. All labels have training examples. Subjects, objects and props share the `BENDA` span label; the verified catalog supplies their presentation category.

The expanded dataset contains 8,935 training, 1,436 validation and 1,436 test sentences. It includes every canonical object and place, unambiguous English aliases, all six action classes, arithmetic words/symbols, negative scopes and legacy natural-language training examples. Sentence families and exact sentence strings are separated across splits. The first run exposed missing symbol generalization; symbol and scope coverage were expanded and the saved checkpoint was trained further. The evaluation sets have therefore been used for development and must be treated as regression measurements, not independent teacher field data. The first run's reports remain in `ml/hasil/aset`; the continued run is in `ml/hasil/aset-v2`.

Runtime accuracy and raw BIO F1 are different measurements. The saved training report records raw label metrics; `evaluasi_aset.py` measures the reconstructed/grounded scenes and high-confidence mistakes. Scope/asset/operator validation remains necessary even when the neural model is confident. No zero-error guarantee is claimed.

The completed run used five initial epochs and two continued epochs on the local RTX 3050. The continued checkpoint is active at `ml/model/indobert-suarapapan`; its SHA-256 is `15929badd39259ce6c93bcb68956967b59eebdc05a050800dcbd4cdeaa83f310`. A local `training_manifest.json` records its provenance. Raw test BIO micro F1 is 97.9%, including 100% OPERATOR F1 on 364 operator spans. These are synthetic development/regression scores.

The final runtime report covers 587 cases: 545 have the expected visible outcome, including 394 of 410 synthetic catalog sentences. Of 304 high-confidence cases accepted without a review flag, none has a wrong visible outcome. The other 283 cases need review because of low confidence or validation; this is a measured coverage limit, not proof of zero noise. One accepted result uses a different but visibly equivalent introduction schema, retained in the exact-mismatch metric. Explicit changes such as **hapus dua buku** are held for correction when the model misses the event instead of silently replacing the objects or doing nothing.

Validation completed: 185 browser/unit tests passed with one existing optional skip; 16 Python ML tests and five asset-tool tests passed; the catalog audit verified 569 assets, 39 source sheets and 468 frames; the production frontend build passed. The local API reports IndoBERT available and correctly parses **Tiga kali dua apel** and the compound **anak menggunakan kursi roda**. Ollama is unavailable on this machine; low-confidence results remain flagged for review.

Commands from the repository root (PowerShell):

```powershell
# Install the official PyTorch build appropriate to the machine first.
.venv/Scripts/python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cu128
.venv/Scripts/python.exe -m pip install -r ml/requirements-training.txt
.venv/Scripts/python.exe ml/buat_dataset_aset.py
$env:HF_HOME = Join-Path (Get-Location) '.cache/huggingface'
$env:HF_HUB_DISABLE_XET = '1'
.venv/Scripts/python.exe ml/latih_ner.py --data-dir ml/data/aset --results ml/hasil/aset --batch 4 --epochs 5
# Optional continued run, preserving the initial checkpoint until validated:
.venv/Scripts/python.exe ml/latih_ner.py --data-dir ml/data/aset --base-model ml/model/indobert-suarapapan --output ml/model/indobert-suarapapan-v2 --results ml/hasil/aset-v2 --batch 4 --epochs 2
.venv/Scripts/python.exe ml/evaluasi_aset.py --model ml/model/indobert-suarapapan-v2 --out ml/hasil/aset-v2/evaluasi_runtime.json
# After validating the report, activate the continued checkpoint:
Get-ChildItem ml/model/indobert-suarapapan-v2 -File | Copy-Item -Destination ml/model/indobert-suarapapan -Force
.venv/Scripts/python.exe -m unittest discover -s ml -p 'test_*.py'
npm test --prefix web
npm run build --prefix web
.venv/Scripts/python.exe -m uvicorn serve:app --app-dir ml --host 127.0.0.1 --port 8000
```

Weights are saved locally in `ml/model/indobert-suarapapan` (Git-ignored). Reports go into `ml/hasil/aset`. The online Gemini service does not use these IndoBERT weights; it benefits from the shared vocabulary, browser parser and deterministic validation. Run the Python backend to use the trained local model.

The code and documentation are local changes on `codex/size-arithmetic-training`; they have not been deployed. The local frontend preview on port 5181 connects to the trained backend on port 8000.

## Visual evidence

- [Classroom floor placement](audit/evidence/classroom-floor-fixed.png)
- [Garden ground placement](audit/evidence/garden-ground-fixed.png)
- [Grouped multiplication and correct-answer feedback](audit/evidence/multiplication-verified.png)

The complete original asset inventory, source-sheet hashes and contact sheets remain in [the asset audit](audit/assets/README.md).
