import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { cariGambar, cariTempat, urlGambar, _untukTes } from './pustaka.js';

test('subjek manusia generik memakai sprite bawaan, bukan emoji', () => {
  for (const jenis of ['manusia', 'Manusia', 'orang', 'seseorang', 'teman', 'manusia-manusia', 'orang-orang']) {
    const nama = cariGambar(jenis);
    assert.equal(nama, 'anak-laki-laki', jenis);
    assert.ok(existsSync(new URL(`../../public${urlGambar(nama)}`, import.meta.url)), jenis);
  }
});

test('frasa pengguna kursi roda tetap manusia, bukan benda kursi', () => {
  for (const jenis of ['anak kursi roda', 'anak menggunakan kursi roda', 'anak memakai kursi roda',
    'anak dengan kursi roda', 'anak di kursi roda', 'anak pengguna kursi roda', 'pengguna kursi roda',
    'si anak menggunakan kursi roda yang baru']) {
    assert.equal(cariGambar(jenis), 'anak-kursi-roda', jenis);
  }
  assert.equal(cariGambar('kursi'), 'kursi');
});

test('nama inklusi panjang tetap ditemukan saat mendapat kata pelengkap', () => {
  for (const jenis of ['anak dengan alat bantu dengar', 'anak menggunakan alat bantu dengar',
    'anak memakai alat bantu dengar', 'si anak dengan alat bantu dengar yang baru']) {
    assert.equal(cariGambar(jenis), 'anak-dengan-alat-bantu-dengar', jenis);
  }
  assert.equal(cariGambar('si anak tunanetra dengan tongkat yang baru'), 'anak-tunanetra-dengan-tongkat');
});

test('seluruh frasa majemuk katalog tetap lebih spesifik dari potongan namanya', () => {
  for (const [nama, item] of Object.entries(_untukTes.OBJ)) {
    if (!nama.includes('-')) continue;
    assert.equal(cariGambar(`si ${item.n} yang baru`), nama, item.n);
  }
});

test('alias manusia tidak mengubah hewan atau subjek asing menjadi manusia', () => {
  assert.equal(cariGambar('anak kucing'), 'kucing');
  assert.equal(cariGambar('anak kelinci kecil'), 'kelinci');
  assert.equal(cariGambar('kuda nil'), 'kuda-nil');
  assert.equal(cariGambar('apel merah'), 'apel');
  for (const jenis of ['', 'robot kuantum asing', 'makhluk luar angkasa asing', 'manusia xylophor', 'orang xylophor', 'constructor']) {
    assert.equal(cariGambar(jenis), null, jenis);
  }
  assert.equal(cariTempat('constructor'), null);
  assert.equal(cariTempat('di hutan lebat'), 'hutan');
});
