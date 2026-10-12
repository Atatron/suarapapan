import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADEGAN_KOSONG, terapkan, yangAda, konteks, deskripsi } from './engine.js';

const tigaKelinci = {
  entitas: [{ jenis: 'kelinci', jumlah: 3, aksi: 'lari', posisi: '' }],
  latar: 'rumput', konsep: 'membilang', peristiwa: [], pertanyaan: '',
};
const duaPergi = {
  entitas: [], latar: '', konsep: 'pengurangan',
  peristiwa: [{ tipe: 'hapus', target: 'kelinci', jumlah: 2 }], pertanyaan: '',
};

test('kalimat baru memulai adegan', () => {
  const { adegan, berubah } = terapkan(ADEGAN_KOSONG, tigaKelinci);
  assert.equal(berubah, true);
  assert.equal(yangAda(adegan).length, 3);
  assert.equal(adegan.latar, 'rumput');
  assert.equal(konteks(adegan), 'kelinci: 3');
});

test('dua kelinci pergi → tersisa satu dan soal 3 − 2 muncul', () => {
  const a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  const { adegan } = terapkan(a, duaPergi);
  assert.equal(adegan.objek.length, 3, 'yang pergi tetap ada untuk animasi keluar');
  assert.equal(yangAda(adegan).length, 1);
  assert.deepEqual(adegan.soal, { teks: '3 − 2 = ?', jawaban: 1 });
  assert.equal(adegan.latar, 'rumput', 'latar lama dipertahankan');
  assert.match(deskripsi(adegan), /1 kelinci berlari, 2 pergi di rumput/);
});

test('benda yang sudah pergi dibuang pada langkah berikutnya', () => {
  let a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  a = terapkan(a, duaPergi).adegan;
  a = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 4 }], konsep: 'penjumlahan' }).adegan;
  assert.equal(a.objek.length, 5);
  assert.deepEqual(a.soal, { teks: '1 + 4 = ?', jawaban: 5 });
});

test('salam tidak mengubah papan', () => {
  const a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  const r = terapkan(a, { entitas: [], peristiwa: [], konsep: 'tidak_ada' });
  assert.equal(r.berubah, false);
  assert.equal(r.adegan, a);
});

test('menghapus benda yang tidak ada memberi catatan, bukan error', () => {
  const r = terapkan(ADEGAN_KOSONG, duaPergi);
  assert.equal(r.catatan.length, 1);
  assert.equal(yangAda(r.adegan).length, 0);
});

test('menghapus lebih banyak dari yang ada', () => {
  const a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  const r = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'hapus', target: 'kelinci', jumlah: 5 }] });
  assert.deepEqual(r.adegan.soal, { teks: '3 − 3 = ?', jawaban: 0 });
  assert.equal(r.catatan.length, 1);
});

test('jumlah dibatasi 20', () => {
  const r = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'bintang', jumlah: 99, aksi: 'diam' }], peristiwa: [] });
  assert.equal(r.adegan.objek.length, 20);
});

test('adegan lama tidak ikut berubah (untuk tombol Batalkan)', () => {
  const a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  const salinan = JSON.stringify(a);
  terapkan(a, duaPergi);
  assert.equal(JSON.stringify(a), salinan);
});
