"""All-catalog BIO training data; held-out sentence families never enter training.

python ml/buat_dataset_aset.py
Produces ml/data/aset/{latih,validasi,uji_templat}.jsonl + manifest.json.
Synthetic regression/training data, not independent human-teacher evaluation.
"""
import hashlib
import json
from pathlib import Path
from bahasa import tokenisasi, angka_ke_kata, LABEL
from katalog import ASET, INDEKS, KONFLIK, JALUR

OUTPUT = Path(__file__).parent / 'data/aset'


def contoh(parts, context='kosong', family='', asset=''):
    words, labels = [], []
    for text, label in parts:
        tokens = tokenisasi(text)
        words.extend(tokens)
        labels.extend(['O' if not label else f"{'B' if i == 0 else 'I'}-{label}" for i in range(len(tokens))])
    return {'konteks': context, 'kata': words, 'label': labels, 'family': family, 'asset': asset}


def generate():
    splits = {'latih': [], 'validasi': [], 'uji_templat': []}
    objects = [a for a in ASET if a['kind'] == 'obj']
    places = [a for a in ASET if a['kind'] == 'tempat']
    for i, a in enumerate(objects):
        name = a['id'].replace('-', ' ')
        # Canonical and ALL unambiguous aliases, including English source names.
        aliases = [k.replace('-', ' ') for k, v in INDEKS['obj'].items() if v['id'] == a['id']]
        place = places[i % len(places)]['id'].replace('-', ' ')
        for alias in aliases:
            splits['latih'].append(contoh([('ada', None), ('dua', 'JUMLAH'), (alias, 'BENDA'), ('di', None), (place, 'TEMPAT')], family='introduce', asset=a['id']))
        splits['latih'].append(contoh([('lalu', None), ('satu', 'JUMLAH'), (name, 'BENDA'), ('diambil', 'PERISTIWA')], f"{a['id']}: 3", 'remove', a['id']))
        splits['latih'].append(contoh([('tambahkan', 'PERISTIWA'), ('tiga', 'JUMLAH'), (name, 'BENDA'), ('lagi', None)], f"{a['id']}: 2", 'add', a['id']))
        splits['latih'].append(contoh([('satu', 'JUMLAH'), (name, 'BENDA'), ('di bawah meja', 'POSISI')], family='position', asset=a['id']))
        action = 'berlari' if a['category'].startswith('orang') or a['category'] in ['hewan-ternak', 'hewan-hutan'] else 'berenang' if a['category'] == 'hewan-laut' else 'terbang' if a['category'] == 'burung' else 'jatuh'
        splits['latih'].append(contoh([('ada', None), ('tiga', 'JUMLAH'), (name, 'BENDA'), (action, 'AKSI')], family='action', asset=a['id']))
        splits['validasi'].append(contoh([('perhatikan di sini terdapat', None), ('empat', 'JUMLAH'), (name, 'BENDA'), ('yang sedang', None), (action, 'AKSI')], family='observe-heldout', asset=a['id']))
        splits['uji_templat'].append(contoh([('pada gambar terlihat', None), ('5', 'JUMLAH'), (name, 'BENDA'), (action, 'AKSI'), ('di', None), (place, 'TEMPAT')], family='picture-heldout', asset=a['id']))
        if i < 40:
            for split, prefix in [('latih', 'lalu'), ('validasi', 'setelah dihitung'), ('uji_templat', 'sesudah itu')]:
                splits[split].append(contoh([(prefix, None), ('dua', 'JUMLAH'), (name, 'BENDA'), ('dibawa pergi', 'PERISTIWA')], f"{a['id']}: 6", f'remove-clause-{split}', a['id']))
                splits[split].append(contoh([(prefix, None), ('satu', 'JUMLAH'), (name, 'BENDA'), ('berdiri', 'AKSI'), ('di samping kursi', 'POSISI')], family=f'position-clause-{split}', asset=a['id']))
                splits[split].append(contoh([(prefix, None), ('satu', 'JUMLAH'), (name, 'BENDA'), ('jatuh perlahan', 'AKSI')], family=f'action-multi-{split}', asset=a['id']))
    # Guarantee every place is learned and tested as a complete span.
    for a in places:
        name = a['id'].replace('-', ' ')
        for alias, value in INDEKS['tempat'].items():
            if value['id'] == a['id']:
                splits['latih'].append(contoh([('di', None), (alias.replace('-', ' '), 'TEMPAT'), ('ada', None), ('dua', 'JUMLAH'), ('kelinci', 'BENDA')], family='place-first', asset=a['id']))
        splits['validasi'].append(contoh([('di', None), (name, 'TEMPAT'), ('terdapat', None), ('empat', 'JUMLAH'), ('kucing', 'BENDA')], family='place-heldout', asset=a['id']))
        splits['uji_templat'].append(contoh([('pada gambar', None), ('lima', 'JUMLAH'), ('buku', 'BENDA'), ('berada di', None), (name, 'TEMPAT')], family='place-picture-heldout', asset=a['id']))
    # Negation/conditionals must never train a positive edit. Runtime also blocks them.
    for split, prefix in [('latih', 'jangan tambahkan dua'), ('validasi', 'kalau ada tiga'), ('uji_templat', 'bukan empat')]:
        for a in objects:
            splits[split].append(contoh([(f"{prefix} {a['id'].replace('-', ' ')}", None)], family=f'negative-{split}', asset=a['id']))
    for prefix in ['kalau nanti ada dua', 'ini bukan tiga', 'misalnya ada empat', 'tidak perlu menambah lima']:
        for a in objects:
            splits['latih'].append(contoh([(f"{prefix} {a['id'].replace('-', ' ')}", None)], family='scope-coverage', asset=a['id']))
    for split, prefix in [('latih', 'ada dua'), ('validasi', 'lihat tiga'), ('uji_templat', 'pada gambar empat')]:
        for unknown in ['unicorn', 'robot kuantum', 'kol', 'lemari', 'naga kristal']:
            splits[split].append(contoh([(f'{prefix} {unknown}', None)], family=f'unknown-{split}'))
    # OPERATOR was absent from the old label inventory. Both symbols and spoken
    # words are learned; answers are still computed by the deterministic engine.
    for split, prefix, ops in [
        ('latih', '', ['ditambah dengan', 'dikurangi dengan', 'dikalikan dengan', 'dibagi dengan']),
        ('validasi', 'berapa hasil dari', ['tambah', 'kurang', 'kali', 'bagi']),
        ('uji_templat', 'hitunglah', ['+', '−', '×', '÷']),
    ]:
        for kind, operator in enumerate(ops):
            for left in range(0, 13):
                for right in range(0, 7):
                    splits[split].append(contoh([(prefix, None), (angka_ke_kata(left), 'JUMLAH'), (operator, 'OPERATOR'),
                                                 (str(right), 'JUMLAH')], family=f'arithmetic-{split}'))
    for symbols in [ ['+','−','×','÷'], ['plus','minus','kali','bagi'], ['tambah','kurang','dikali','dibagi'] ]:
        for operator in symbols:
            for left in range(0, 13):
                for right in range(0, 7):
                    splits['latih'].append(contoh([('coba kerjakan', None), (angka_ke_kata(left), 'JUMLAH'),
                                                  (operator, 'OPERATOR'), (str(right), 'JUMLAH')], family='operator-coverage'))
    # Preserve the old natural-language action/event coverage, without allowing
    # a sentence from any held-out split to enter the expanded training set.
    old = Path(__file__).parent / 'data/latih.jsonl'
    seen = {' '.join(r['kata']) for rows in splits.values() for r in rows}
    if old.exists():
        for line in old.read_text(encoding='utf-8').splitlines():
            row = json.loads(line)
            key = ' '.join(row['kata'])
            if key not in seen:
                splits['latih'].append({**row, 'family': 'legacy-train', 'asset': ''})
                seen.add(key)
    return splits


def main():
    splits = generate()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    seen = set()
    for name, rows in splits.items():
        keys = {' '.join(r['kata']) for r in rows}
        if keys & seen:
            raise ValueError(f'Duplicate sentence across splits: {name}')
        seen.update(keys)
        with (OUTPUT / f'{name}.jsonl').open('w', encoding='utf-8') as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + '\n')
    metadata = {'catalog_sha256': hashlib.sha256(JALUR.read_bytes()).hexdigest(), 'objects': len([a for a in ASET if a['kind'] == 'obj']),
                'places': len([a for a in ASET if a['kind'] == 'tempat']), 'splits': {k: len(v) for k, v in splits.items()},
                'ambiguous_aliases': KONFLIK, 'training_performed': False,
                'labels': LABEL, 'label_counts': {name: {label: sum(row['label'].count(label) for row in rows) for label in LABEL} for name, rows in splits.items()},
                'evaluation_scope': 'Synthetic development/regression sets with separate sentence families; reused to diagnose missing symbol coverage. Not independent teacher field accuracy.'}
    (OUTPUT / 'manifest.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == '__main__':
    main()
