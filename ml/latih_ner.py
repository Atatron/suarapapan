"""Fine-tuning IndoBERT untuk mengenali JUMLAH, BENDA, AKSI, TEMPAT, POSISI, PERISTIWA.

Masukan model = pasangan (kalimat, konteks adegan). Label hanya dihitung pada
kata-kata kalimat; token konteks dan sub-kata lanjutan diberi -100 (diabaikan).

Pakai:  .venv\\Scripts\\python latih_ner.py
Hasil:  model/indobert-suarapapan/  dan  hasil/metrik_latih.json, hasil/confusion_matrix.png
"""
import json
import argparse
import random
import time
from pathlib import Path

import numpy as np
import torch
from seqeval.metrics import classification_report, f1_score
from torch.utils.data import DataLoader
from transformers import AutoModelForTokenClassification, AutoTokenizer, get_linear_schedule_with_warmup

from bahasa import LABEL, LABEL2ID, tokenisasi

DASAR = "indobenchmark/indobert-base-p1"
AKAR = Path(__file__).parent
SIMPAN = AKAR / "model" / "indobert-suarapapan"
HASIL = AKAR / "hasil"
CFG = {"lr": 3e-5, "batch": 4, "epoch": 5, "max_len": 96, "warmup": 0.1, "seed": 2026}
DATA = AKAR / 'data'


def baca(nama):
    with open(DATA / f"{nama}.jsonl", encoding="utf-8") as f:
        return [json.loads(b) for b in f]


def enkode(tok, contoh, dengan_label=True):
    konteks = [c["konteks"].replace(":", " ") for c in contoh]
    enc = tok([c["kata"] for c in contoh], [tokenisasi(k) for k in konteks], is_split_into_words=True,
              truncation=True, max_length=CFG["max_len"], padding=True, return_tensors="pt")
    if not dengan_label:
        return enc
    label = []
    for i, c in enumerate(contoh):
        seq, kata_id, sebelum, baris = enc.sequence_ids(i), enc.word_ids(i), None, []
        for s, w in zip(seq, kata_id):
            # hanya sub-kata pertama dari setiap kata di kalimat (bukan konteks) yang dinilai
            baris.append(LABEL2ID[c["label"][w]] if s == 0 and w is not None and w != sebelum else -100)
            sebelum = w if s == 0 else None
        label.append(baris)
    enc["labels"] = torch.tensor(label)
    return enc


@torch.no_grad()
def prediksi(model, tok, contoh, perangkat):
    model.eval()
    semua = []
    for i in range(0, len(contoh), 64):
        bagian = contoh[i:i + 64]
        enc = enkode(tok, bagian).to(perangkat)
        label_asli = enc.pop("labels")
        logit = model(**enc).logits.argmax(-1)
        for b in range(len(bagian)):
            mask = label_asli[b] != -100
            semua.append([LABEL[x] for x in logit[b][mask].tolist()])
    return semua


def main():
    global DATA, SIMPAN, HASIL
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, default=DATA)
    parser.add_argument('--output', type=Path, default=SIMPAN)
    parser.add_argument('--results', type=Path, default=HASIL)
    parser.add_argument('--epochs', type=int, default=CFG['epoch'])
    parser.add_argument('--base-model', default=DASAR)
    parser.add_argument('--batch', type=int, default=CFG['batch'])
    args = parser.parse_args()
    DATA, SIMPAN, HASIL = args.data_dir.resolve(), args.output.resolve(), args.results.resolve()
    CFG.update(epoch=max(1, args.epochs), batch=max(1, args.batch))
    random.seed(CFG["seed"]); np.random.seed(CFG["seed"]); torch.manual_seed(CFG["seed"])
    perangkat = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Perangkat: {perangkat} {torch.cuda.get_device_name(0) if perangkat == 'cuda' else ''}")

    latih, validasi, uji = baca("latih"), baca("validasi"), baca("uji_templat")
    tok = AutoTokenizer.from_pretrained(args.base_model)
    model = AutoModelForTokenClassification.from_pretrained(
        args.base_model, id2label=dict(enumerate(LABEL)), label2id=LABEL2ID).to(perangkat)
    print(f"Data: {len(latih)} train, {len(validasi)} validation, {len(uji)} test; labels: {LABEL}", flush=True)

    pemuat = DataLoader(latih, batch_size=CFG["batch"], shuffle=True, collate_fn=lambda b: enkode(tok, b))
    langkah = len(pemuat) * CFG["epoch"]
    opt = torch.optim.AdamW(model.parameters(), lr=CFG["lr"], weight_decay=0.01)
    jadwal = get_linear_schedule_with_warmup(opt, int(CFG["warmup"] * langkah), langkah)

    terbaik, riwayat, mulai = -1.0, [], time.time()
    for ep in range(1, CFG["epoch"] + 1):
        model.train()
        total = 0.0
        for enc in pemuat:
            enc = enc.to(perangkat)
            loss = model(**enc).loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); jadwal.step(); opt.zero_grad()
            total += loss.item()
        f1 = f1_score([c["label"] for c in validasi], prediksi(model, tok, validasi, perangkat))
        riwayat.append({"epoch": ep, "loss": round(total / len(pemuat), 4), "f1_validasi": round(f1, 4)})
        print(f"epoch {ep}: loss {total / len(pemuat):.4f} · F1 validasi {f1:.4f} · {time.time() - mulai:.0f} dtk", flush=True)
        if f1 > terbaik:
            terbaik = f1
            SIMPAN.mkdir(parents=True, exist_ok=True)
            model.save_pretrained(SIMPAN); tok.save_pretrained(SIMPAN)

    # evaluasi akhir pada data uji templat dengan model terbaik
    del opt, jadwal, pemuat, model
    if perangkat == 'cuda':
        torch.cuda.empty_cache()
    model = AutoModelForTokenClassification.from_pretrained(SIMPAN).to(perangkat)
    asli = [c["label"] for c in uji]
    tebak = prediksi(model, tok, uji, perangkat)
    laporan = classification_report(asli, tebak, output_dict=True, zero_division=0)
    print(classification_report(asli, tebak, digits=3, zero_division=0))

    HASIL.mkdir(parents=True, exist_ok=True)
    jenis = ["O", "JUMLAH", "BENDA", "AKSI", "TEMPAT", "POSISI", "PERISTIWA", "OPERATOR"]
    ke = lambda l: l.split("-", 1)[1] if l != "O" else "O"
    cm = np.zeros((len(jenis), len(jenis)), dtype=int)
    for a, t in zip(asli, tebak):
        for x, y in zip(a, t):
            cm[jenis.index(ke(x)), jenis.index(ke(y))] += 1
    simpan_cm(cm, jenis)
    with open(HASIL / "metrik_latih.json", "w", encoding="utf-8") as f:
        json.dump({
            "training_performed": True, "model_dasar": str(args.base_model), "konfigurasi": CFG, "data_dir": str(DATA), "data_manifest": json.loads((DATA / 'manifest.json').read_text(encoding='utf-8')) if (DATA / 'manifest.json').exists() else None,
            "perangkat": torch.cuda.get_device_name(0) if perangkat == "cuda" else "cpu",
            "jumlah_data": {"latih": len(latih), "validasi": len(validasi), "uji_templat": len(uji)},
            "riwayat": riwayat, "f1_validasi_terbaik": round(terbaik, 4),
            "uji_templat": {k: {m: round(float(v), 4) for m, v in d.items()} for k, d in laporan.items()},
            "confusion_matrix": {"label": jenis, "nilai": cm.tolist()}, "durasi_detik": round(time.time() - mulai),
        }, f, ensure_ascii=False, indent=2)
    print(f"Model tersimpan di {SIMPAN}")


def simpan_cm(cm, jenis):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    norm = cm / cm.sum(axis=1, keepdims=True).clip(min=1)
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.imshow(norm, cmap="Greens", vmin=0, vmax=1)
    ax.set_xticks(range(len(jenis)), jenis, rotation=40, ha="right")
    ax.set_yticks(range(len(jenis)), jenis)
    ax.set_xlabel("Prediksi model"); ax.set_ylabel("Label sebenarnya")
    ax.set_title("Confusion matrix per kata (data uji templat)")
    for i in range(len(jenis)):
        for j in range(len(jenis)):
            ax.text(j, i, cm[i, j], ha="center", va="center", fontsize=9, color="white" if norm[i, j] > 0.5 else "#15211D")
    fig.tight_layout()
    fig.savefig(HASIL / "confusion_matrix.png", dpi=150)


if __name__ == "__main__":
    main()
