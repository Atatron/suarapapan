import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uraiLokal, bacaKonteks } from './lokal.js';
import { ADEGAN_KOSONG, terapkan, konteks, yangAda } from '../scene/engine.js';

const baca = (nama) => JSON.parse(readFileSync(new URL(`../../../tests/${nama}.json`, import.meta.url), 'utf8'));

// Satu kalimat → papan baru, lewat parser lokal dan mesin adegan yang sebenarnya.
function ucap(papan, kalimat) {
  const r = uraiLokal(kalimat, konteks(papan));
  assert.ok(r, `tidak dipahami: ${kalimat}`);
  return { ...terapkan(papan, r.hasil), yakin: r.yakin, hasil: r.hasil };
}
const hitung = (papan, jenis) => yangAda(papan, jenis).length;

test('bacaKonteks: format mesin dan format uji lama', () => {
  assert.deepEqual(bacaKonteks('kosong'), []);
  assert.deepEqual(bacaKonteks('kelinci: 3, harimau: 2'), [{ jenis: 'kelinci', n: 3, bagi: false }, { jenis: 'harimau', n: 2, bagi: false }]);
  assert.equal(bacaKonteks('pizza: 1 (dibagi 4)')[0].bagi, true);
  assert.equal(bacaKonteks('kelinci: 5 (2 berlari dan 3 melompat), apel: 1').length, 2);
  assert.deepEqual(bacaKonteks('kelinci 3'), [{ jenis: 'kelinci', n: 3, bagi: false }]);
});

test('alur demo README berjalan tanpa Gemini: membilang → mengurang', () => {
  let p = ADEGAN_KOSONG;
  let r = ucap(p, 'Ada tiga kelinci berlari di rumput.');
  assert.equal(r.yakin, 'tinggi');
  assert.equal(hitung(r.adegan, 'kelinci'), 3);
  assert.equal(r.hasil.latar, 'rumput');
  p = r.adegan;
  r = ucap(p, 'Lalu dua kelinci pergi.');
  assert.equal(r.yakin, 'tinggi');
  assert.equal(r.adegan.soal?.jawaban, 1);
});

test('alur demo README: dua jenis, total, pecahan, posisi, menghitung', () => {
  let r = ucap(ADEGAN_KOSONG, 'Di hutan ada tiga kelinci dan dua harimau.');
  assert.equal(hitung(r.adegan, 'kelinci'), 3);
  assert.equal(hitung(r.adegan, 'harimau'), 2);
  assert.equal(r.hasil.latar, 'hutan');
  r = ucap(r.adegan, 'Berapa jumlah hewan semuanya?');
  assert.equal(r.hasil.tanya_jenis, 'total');
  assert.equal(r.adegan.soal?.jawaban, 5);

  r = ucap(ADEGAN_KOSONG, 'Ibu punya satu pizza, kita bagi empat sama besar.');
  assert.equal(hitung(r.adegan, 'pizza'), 1);
  assert.equal(r.adegan.objek[0].bagi, 4);
  r = ucap(r.adegan, 'Adik makan satu potong.');
  assert.equal(r.adegan.objek[0].diambil, 1);

  r = ucap(ADEGAN_KOSONG, 'Kucing tidur di bawah meja.');
  assert.equal(r.adegan.objek[0].posisi, 'di bawah meja');

  r = ucap(ADEGAN_KOSONG, 'Ada tujuh ikan berenang di kolam.');
  assert.equal(hitung(r.adegan, 'ikan'), 7);
  r = ucap(r.adegan, 'Coba hitung, ada berapa ikan?');
  assert.equal(r.hasil.tanya_jenis, 'benda');
  assert.equal(r.hasil.tanya_benda, 'ikan');
});

test('tambah dan hapus mengikuti isi papan', () => {
  let r = ucap(ADEGAN_KOSONG, 'Ada lima apel.');
  r = ucap(r.adegan, 'Ibu memberi dua apel lagi.');
  assert.equal(hitung(r.adegan, 'apel'), 7);
  r = ucap(r.adegan, 'Tiga apel dimakan.');
  assert.equal(hitung(r.adegan, 'apel'), 4);
});

test('sapaan dan instruksi tanpa benda berangka tidak mengubah papan dan tidak perlu Gemini', () => {
  for (const k of ['Selamat pagi anak-anak.', 'Ayo duduk yang rapi.', 'Kita lanjutkan besok ya.']) {
    const r = uraiLokal(k, 'kosong');
    assert.ok(r, k);
    assert.equal(r.yakin, 'tinggi');
    assert.equal(terapkan(ADEGAN_KOSONG, r.hasil).berubah, false, k);
  }
});

test('benda di luar pustaka dan kalimat ambigu diserahkan ke Gemini (null atau yakin rendah)', () => {
  assert.equal(uraiLokal('Budi punya 6 kelereng', 'kosong'), null);
  const ambigu = uraiLokal('Tiga balon terbang', 'balon: 7');
  assert.notEqual(ambigu?.yakin, 'tinggi');
  const koreksi = uraiLokal('Eh bukan empat, maksudnya lima jeruk', 'kosong');
  assert.notEqual(koreksi?.yakin, 'tinggi');
});

test('kalimat berangka tanpa benda di papan tidak membuat perubahan liar', () => {
  const r = uraiLokal('Pada halaman dua belas ada soal', 'kosong');
  assert.ok(r === null || terapkan(ADEGAN_KOSONG, r.hasil).berubah === false || r.yakin !== 'tinggi');
});

// Regresi pada kalimat berlabel. Set 40/51/45 dipakai MENYETEL aturan, jadi hanya penjaga regresi;
// set `kalimat_uji_lokal` ditulis sesudahnya dan dijalankan sekali sebelum disetel (lihat docs).
function bandingkan(nama) {
  let tinggi = 0, benarTinggi = 0;
  const salah = [];
  for (const d of baca(nama)) {
    const r = uraiLokal(d.kalimat, d.konteks);
    if (!r || r.yakin !== 'tinggi') continue;
    tinggi++;
    const harap = [...d.entitas.map(([j, n]) => `${j}+${n}`), ...d.peristiwa.map(([t, j, n]) => `${j}${t === 'hapus' ? '-' : '+'}${n}`)].sort().join(' ');
    const dapat = [...r.hasil.entitas.map((e) => `${e.jenis}+${e.jumlah}`),
      ...r.hasil.peristiwa.map((p) => `${p.target}${p.tipe === 'hapus' || p.tipe === 'ambil' ? '-' : '+'}${p.jumlah}`)].sort().join(' ');
    if (harap === dapat) benarTinggi++; else salah.push(`${d.kalimat} → ${dapat} (seharusnya ${harap})`);
  }
  return { tinggi, benarTinggi, salah };
}

for (const nama of ['kalimat_uji', 'kalimat_uji_sulit', 'kalimat_uji_perintah', 'kalimat_uji_lokal']) {
  test(`jalur yakin tinggi tidak salah pada ${nama}`, () => {
    const { tinggi, benarTinggi, salah } = bandingkan(nama);
    assert.ok(tinggi >= 25, `cakupan terlalu kecil (${tinggi})`);
    assert.deepEqual(salah, [], `${benarTinggi}/${tinggi} benar`);
  });
}
