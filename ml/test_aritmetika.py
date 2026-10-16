import unittest
from aritmetika import urai_operasi, hitung_operasi
from validasi import amankan
from bahasa import LABEL


class TestArithmetic(unittest.TestCase):
    def test_all_operators_and_grouping(self):
        for text, answer, remainder in [('3 + 2',5,0),('lima dikurangi dua',3,0),('tiga kali dua apel',6,0),
                                        ('dua belas apel dibagi tiga kelompok',4,0),('7 ÷ 2',3,1),('0 × 5',0,0),('3 dikalikan dengan 2',6,0)]:
            with self.subTest(text=text):
                op = urai_operasi(text)
                result = hitung_operasi(op)
                self.assertEqual(result['answer'],answer)
                self.assertEqual(result['remainder'],remainder)
                self.assertEqual(amankan({'entitas':[], 'peristiwa':[]},text)['operasi'],op)
        self.assertIsNone(urai_operasi('Satu pizza dibagi empat'))

    def test_invalid_arithmetic_and_unspoken_operations(self):
        for text in ['5 ÷ 0','dua kurang tiga','6 kali 6 apel']:
            result = amankan({'entitas':[],'peristiwa':[]},text)
            self.assertTrue(result['needsConfirmation'])
            self.assertEqual(result['notice']['code'],'UNSUPPORTED_ARITHMETIC')
        self.assertTrue(amankan({'operasi':{'operator':'kali','kiri':3,'kanan':4}},'Selamat pagi')['needsConfirmation'])

    def test_operator_bio_labels_exist(self):
        self.assertIn('B-OPERATOR',LABEL)
        self.assertIn('I-OPERATOR',LABEL)

    def test_explicit_count_disagreement_cannot_be_auto_approved(self):
        result = amankan({'peristiwa':[{'tipe':'tambah','target':'buku','jumlah':1}]},'Ayo kita tambah dua buku.','buku: 2')
        self.assertTrue(result['needsConfirmation'])
        self.assertEqual(result['notice']['code'],'QUANTITY_MISMATCH')
        self.assertEqual(result['peristiwa'],[])

    def test_background_only_terms_and_unsupported_color(self):
        good = amankan({'entitas':[{'jenis':'anak','jumlah':1}], 'latar':'taman'},'anak di taman')
        self.assertEqual(good['latar'],'flower-garden')
        bad = amankan({'entitas':[{'jenis':'apel','jumlah':2}]},'Ada dua apel biru')
        self.assertTrue(bad['needsConfirmation'])

    def test_missed_event_cannot_replace_existing_objects_or_do_nothing(self):
        for text, noun, count, raw in [
            ('adik makan dua jeruk', 'jeruk', 6, {'entitas':[{'jenis':'jeruk','jumlah':2}]}),
            ('Ayo kita tambah dua buku.', 'buku', 2, {}),
            ('Coba hapus dua buku yang sudah ditampilkan.', 'buku', 4, {'entitas':[{'jenis':'buku','jumlah':2}]}),
        ]:
            with self.subTest(text=text):
                result = amankan(raw,text,f'{noun}: {count}')
                self.assertTrue(result['needsConfirmation'])
                self.assertEqual(result['notice']['code'],'OPERATION_MISMATCH')
                self.assertEqual(result['entitas'],[])
        correct = amankan({'peristiwa':[{'tipe':'hapus','target':'jeruk','jumlah':2}]},'adik makan dua jeruk','jeruk: 6')
        self.assertFalse(correct.get('needsConfirmation',False))


if __name__ == '__main__':
    unittest.main()
