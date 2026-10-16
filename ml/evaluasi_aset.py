"""Evaluate saved weights and runtime grounding, without Ollama/API/network calls."""
import json
import argparse
import re
from pathlib import Path
from ner import PengenalNER
from validasi import amankan
from katalog import ASET, id_aset

ROOT = Path(__file__).resolve().parents[1]


def signature(h):
    return sorted([f"new:{id_aset(e['jenis']) or e['jenis']}:{e['jumlah']}" for e in h.get('entitas', [])]
                  + [f"{p['tipe']}:{id_aset(p['target']) or p['target']}:{p['jumlah']}" for p in h.get('peristiwa', [])])


def outcome_signature(items, context):
    existing = set()
    for part in re.split(r',\s*(?![^()]*\))',context):
        m = re.match(r'\s*(.+?)\s*:?\s+\d+',part)
        if m:
            noun = m[1].strip().rstrip(':')
            existing.add(id_aset(noun) or noun)
    normalized = []
    for item in items:
        kind,noun,count = item.split(':',2)
        # A new species introduced via tambah or entitas has the same visible
        # outcome. Preserve the exact schema mismatch as a separate metric.
        if kind == 'tambah' and noun not in existing:
            kind = 'new'
        normalized.append(f'{kind}:{noun}:{count}')
    return sorted(normalized)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path, default=ROOT / 'ml/model/indobert-suarapapan')
    parser.add_argument('--out', type=Path, default=ROOT / 'ml/hasil/aset/evaluasi_runtime.json')
    args = parser.parse_args()
    ner = PengenalNER(args.model)
    cases = []
    for filename in ['kalimat_uji', 'kalimat_uji_sulit', 'kalimat_uji_perintah', 'kalimat_uji_lokal']:
        for row in json.loads((ROOT / f'tests/{filename}.json').read_text(encoding='utf-8')):
            cases.append({'suite': filename, 'text': row['kalimat'], 'context': row.get('konteks','kosong'),
                          'expected': sorted([f"new:{id_aset(j) or j}:{n}" for j,n in row['entitas']] + [f"{t}:{id_aset(j) or j}:{n}" for t,j,n in row['peristiwa']])})
    for a in ASET:
        if a['kind'] == 'obj':
            cases.append({'suite':'all-catalog', 'text':f"Pada gambar terlihat lima {a['id'].replace('-', ' ')}.", 'context':'kosong', 'expected':[f"new:{a['id']}:5"]})
    results = []
    print(f'Evaluating {len(cases)} scene cases on {ner.perangkat}', flush=True)
    for case in cases:
        r = ner.urai(case['text'],case['context'])
        h = amankan(r['hasil'],case['text'],case['context'])
        actual = signature(h)
        results.append({**case, 'actual':actual, 'correct':actual == case['expected'],
                        'outcome_correct':outcome_signature(actual,case['context']) == outcome_signature(case['expected'],case['context']),
                        'confidence':r['yakin'], 'review':bool(h.get('needsConfirmation')), 'raw':r['hasil']})
    suites = {}
    for suite in sorted({c['suite'] for c in cases}):
        rows = [r for r in results if r['suite'] == suite]
        high = [r for r in rows if r['confidence'] >= .85 and not r['review']]
        suites[suite] = {'cases':len(rows),'exact_correct':sum(r['correct'] for r in rows), 'outcome_correct':sum(r['outcome_correct'] for r in rows), 'high_confidence':len(high),
                         'high_confidence_wrong':sum(not r['outcome_correct'] for r in high), 'high_confidence_exact_mismatch':sum(not r['correct'] for r in high), 'review':sum(r['review'] for r in rows)}
    report = {'scope':'Developer-written regression cases and synthetic catalog sentences; not teacher field accuracy.',
              'model':str(ner.model.config._name_or_path),'labels':ner.model.config.id2label,'suites':suites,'results':results}
    target = args.out
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(suites,ensure_ascii=False,indent=2),flush=True)


if __name__ == '__main__':
    main()
