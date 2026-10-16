import copy
import unittest

from validasi import amankan


class BoundaryTests(unittest.TestCase):
    def test_unsafe_scope_cannot_add(self):
        raw = {'entitas': [{'jenis': 'kelinci', 'jumlah': 2}]}
        for sentence in ['Jangan tambahkan dua kelinci', 'Tidak ada dua kelinci', 'Kalau ada dua kelinci', 'Dia berkata "ada dua kelinci"']:
            with self.subTest(sentence=sentence):
                result = amankan(raw, sentence)
                self.assertEqual(result['entitas'], [])
                self.assertTrue(result['needsConfirmation'])

    def test_malformed_containers_and_scalars_fail(self):
        for raw in [[], {'entitas': {}}, {'entitas': [3]}, {'entitas': [{'jumlah': True}]}, {'gabung': 'false'}, {'latar': {}}]:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                amankan(raw, 'Ada kelinci')

    def test_event_action_is_grounded_and_input_immutable(self):
        raw = {'peristiwa': [{'tipe': 'ubah_aksi', 'target': 'kelinci', 'jumlah': 0, 'aksi': 'terbang'}]}
        before = copy.deepcopy(raw)
        result = amankan(raw, 'Kelinci menari salsa', 'kelinci: 3')
        self.assertEqual(result['peristiwa'][0]['aksi'], 'diam')
        self.assertTrue(result['needsConfirmation'])
        self.assertEqual(raw, before)

    def test_catalog_prevents_partial_or_invented_subjects(self):
        result = amankan({'entitas': [{'jenis': 'kelinci', 'jumlah': 3}, {'jenis': 'unicorn', 'jumlah': 2}]}, 'Ada tiga kelinci dan dua unicorn')
        self.assertEqual(result['entitas'], [])
        self.assertTrue(result['needsConfirmation'])
        result = amankan({'entitas': [{'jenis': 'kursi', 'jumlah': 1}]}, 'Ada satu anak menggunakan kursi roda')
        self.assertEqual(result['entitas'], [], 'longest inclusive phrase must not become a chair')

    def test_alias_event_edits_existing_semantic_label(self):
        result = amankan({'peristiwa': [{'tipe': 'hapus', 'target': 'anak-laki-laki', 'jumlah': 1}]}, 'Satu orang pergi', 'manusia: 3')
        self.assertEqual(result['peristiwa'][0]['target'], 'manusia')

    def test_quantity_cap_and_scope_preserve_review(self):
        result = amankan({'entitas': [{'jenis': 'kelinci', 'jumlah': 500}]}, 'Ada 500 kelinci')
        self.assertEqual(result['entitas'][0]['jumlah'], 20)
        self.assertIn('500', result['notice']['message'])
        self.assertTrue(result['needsConfirmation'])
        result = amankan({'entitas': [{'jenis': 'kelinci', 'jumlah': 8}]}, 'Ada tiga kelinci eh salah lima kelinci')
        self.assertEqual(result['entitas'], [])
        self.assertEqual(result['notice']['code'], 'SELF_CORRECTION')


if __name__ == '__main__':
    unittest.main()
