import test from 'node:test';
import assert from 'node:assert/strict';
import { uraiPosisi } from './engine.js';
import { cariGambar } from './pustaka.js';

test('acuan posisi mempertahankan nama benda majemuk supaya sprite dapat ditemukan', () => {
  for (const [posisi, relasi, acuan, sprite] of [
    ['di atas sebuah tempat tidur', 'atas', 'tempat tidur', 'tempat-tidur'],
    ['di samping anak dengan alat bantu dengar', 'samping', 'anak dengan alat bantu dengar', 'anak-dengan-alat-bantu-dengar'],
    ['ke sebelah papan tulis kecil.', 'samping', 'papan tulis kecil', 'papan-tulis-kecil'],
  ]) {
    assert.deepEqual(uraiPosisi(posisi), { relasi, acuan });
    assert.equal(cariGambar(acuan), sprite);
  }
});

test('acuan posisi tunggal dan masukan yang bukan posisi tetap didukung', () => {
  assert.deepEqual(uraiPosisi('di bawah meja'), { relasi: 'bawah', acuan: 'meja' });
  assert.deepEqual(uraiPosisi('  di atas tempat   tidur  '), { relasi: 'atas', acuan: 'tempat tidur' });
  assert.equal(uraiPosisi('di hutan'), null);
  assert.equal(uraiPosisi(''), null);
});
