import unittest
from katalog import ASET, id_aset, temukan, landaskan
from buat_dataset_aset import generate


class TestCatalog(unittest.TestCase):
    def test_all_canonical_assets(self):
        for a in ASET:
            self.assertEqual(id_aset(a['id'].replace('-', ' '), a['kind']), a['id'])

    def test_compounds_and_unsafe_aliases(self):
        self.assertEqual([a['id'] for a in temukan('ada dua anak menggunakan kursi roda')], ['anak-kursi-roda'])
        self.assertEqual(id_aset('anak ayam'), 'piyik-ayam')
        for noun in ['kol', 'lemari', 'glazed donut', 'constructor']:
            self.assertIsNone(id_aset(noun))

    def test_hallucinations_fail_closed(self):
        for utterance, noun in [('Ada dua kelinci', 'harimau'), ('Ada dua unicorn', 'kuda'), ('Ada dua anak menggunakan kursi roda', 'anak-laki-laki')]:
            h = landaskan({'entitas': [{'jenis': noun, 'jumlah': 2}], 'peristiwa': []}, utterance)
            self.assertTrue(h['needsConfirmation'])
            self.assertEqual(h['entitas'], [])

    def test_dataset_covers_all_assets_without_split_leakage(self):
        splits = generate()
        seen = set()
        expected = {a['id'] for a in ASET if a['kind'] != 'latar'}
        families = set()
        for split, rows in splits.items():
            keys = {' '.join(r['kata']) for r in rows}
            self.assertFalse(keys & seen, split)
            seen |= keys
            self.assertTrue(expected <= {r['asset'] for r in rows}, split)
            current = {r['family'] for r in rows}
            self.assertFalse(current & families)
            families |= current
            for row in rows:
                self.assertEqual(len(row['kata']), len(row['label']))


if __name__ == '__main__':
    unittest.main()
