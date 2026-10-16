import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uraiLokal, bacaKonteks } from './lokal.js';
import { cariGambar } from '../scene/pustaka.js';
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
  assert.equal(uraiLokal('Budi punya 6 unicorn', 'kosong'), null);
  const ambigu = uraiLokal('Tiga balon terbang', 'balon: 7');
  assert.notEqual(ambigu?.yakin, 'tinggi');
  const koreksi = uraiLokal('Eh bukan empat, maksudnya lima jeruk', 'kosong');
  assert.notEqual(koreksi?.yakin, 'tinggi');
});

test('koleksi baru dikenali aturan lokal tanpa menunggu Gemini', () => {
  const r = uraiLokal('Budi punya 6 kelereng', 'kosong');
  assert.equal(r?.yakin, 'tinggi');
  assert.deepEqual(r.hasil.entitas.map(({ jenis, jumlah }) => ({ jenis, jumlah })), [{ jenis: 'kelereng', jumlah: 6 }]);
});

test('subjek manusia dan frasa inklusi tetap mendapat sprite dalam jalur lokal', () => {
  for (const [kalimat, sprite] of [
    ['Ada satu manusia di samping meja.', 'anak-laki-laki'],
    ['Ada dua orang di samping meja.', 'anak-laki-laki'],
    ['Ada seorang di samping meja.', 'anak-laki-laki'],
    ['Ada satu anak menggunakan kursi roda.', 'anak-kursi-roda'],
    ['Ada satu anak dengan alat bantu dengar.', 'anak-dengan-alat-bantu-dengar'],
  ]) {
    const r = uraiLokal(kalimat, 'kosong');
    assert.ok(r, kalimat);
    assert.equal(r.hasil.entitas.length, 1, kalimat);
    assert.equal(cariGambar(r.hasil.entitas[0].jenis), sprite, kalimat);
  }
  const guru = uraiLokal('Ada dua orang guru.', 'kosong');
  assert.equal(guru.hasil.entitas[0].jenis, 'guru', 'penggolong orang tidak mengganti profesi');
  assert.equal(guru.hasil.entitas[0].jumlah, 2);
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
    const dapat = [...r.hasil.entitas.map((e) => `${e.jenis}+${Math.min(e.jumlah, 20)}`) /* papan memuat 20 */,
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

test('"laki-laki" bukan kata ulang: tetap menjadi gambar anak laki-laki, bukan emoji berlabel "laki"', () => {
  const r = uraiLokal('Ada dua laki-laki di sungai.', 'kosong');
  assert.equal(r.hasil.entitas[0].jenis, 'laki-laki');
  assert.equal(cariGambar('laki-laki'), 'anak-laki-laki');
  assert.equal(cariGambar('laki'), 'anak-laki-laki'); // papan lama yang sudah berlabel "laki"
});

test('jumlah di atas batas papan: guru diberi tahu, bukan dipotong diam-diam', () => {
  const r = ucap(ADEGAN_KOSONG, 'Ada 50 kelinci.');
  assert.equal(hitung(r.adegan, 'kelinci'), 20);
  assert.ok(r.catatan.some((c) => /20 gambar/.test(c)), r.catatan.join('|'));
});

test('menghapus benda yang tidak ada di papan tidak menciptakan benda; "semua X pergi" menghapus semuanya', () => {
  assert.equal(uraiLokal('Dua kelinci pergi lagi.', 'kosong'), null);
  const r = ucap(ucap(ADEGAN_KOSONG, 'Ada empat kucing.').adegan, 'Semua kucing pergi.');
  assert.equal(hitung(r.adegan, 'kucing'), 0);
});

test('nama benda panjang, kata ulang tetap, dan tempat dua kata dikenali', () => {
  assert.equal(uraiLokal('Ada dua anak kursi roda.', 'kosong').hasil.entitas[0].jenis, 'anak-kursi-roda');
  assert.equal(uraiLokal('Ada tiga cumi cumi di laut.', 'kosong').hasil.entitas[0].jenis, 'cumi-cumi');
  assert.equal(uraiLokal('Ada tiga ikan di bawah laut.', 'kosong').hasil.latar, 'bawah-laut');
});
