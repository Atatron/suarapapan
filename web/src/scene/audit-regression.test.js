import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADEGAN_KOSONG, BATAS_OBJEK, BATAS_ANIMASI_KELUAR, terapkan, yangAda } from './engine.js';

const papan = (...kelompok) => terapkan(ADEGAN_KOSONG, {
  entitas: kelompok.map(([jenis, jumlah]) => ({ jenis, jumlah })), peristiwa: [],
}).adegan;
const proses = (adegan, peristiwa, opsi) => terapkan(adegan, { entitas: [], peristiwa }, opsi);
const peristiwa = (tipe, target, jumlah) => ({ tipe, target, jumlah });

function periksaSoal(hasil, jumlah) {
  const soal = hasil.adegan.soal;
  assert.ok(soal, 'perubahan hitungan menghasilkan soal');
  assert.equal(soal.jawaban, jumlah, 'kunci jawaban sesuai benda aktif');
  assert.ok(soal.opsi.includes(jumlah), 'jawaban yang terlihat dapat dipilih');
  const token = soal.teks.replace(' = ?', '').split(' ');
  let nilai = Number(token[0]);
  for (let i = 1; i < token.length; i += 2) {
    assert.ok(['+', '−'].includes(token[i]), soal.teks);
    nilai += (token[i] === '+' ? 1 : -1) * Number(token[i + 1]);
  }
  assert.equal(nilai, jumlah, 'persamaan menghitung semua delta yang diterapkan');
  if (hasil.penjelasan.length) assert.match(hasil.penjelasan.at(-1), new RegExp(`= ${jumlah}\\.$`));
}

test('QA2-008: pengurangan dan penjumlahan campuran memakai jumlah akhir yang terlihat', () => {
  const awal = papan(['apel', 3], ['burung', 2]);
  const tersimpan = JSON.stringify(awal);
  const r = proses(awal, [peristiwa('hapus', 'apel', 1), peristiwa('tambah', 'burung', 2)]);
  assert.equal(yangAda(r.adegan).length, 6);
  assert.equal(r.adegan.soal.teks, '5 − 1 + 2 = ?');
  periksaSoal(r, 6);
  assert.equal(JSON.stringify(awal), tersimpan, 'snapshot undo tidak berubah');
});

test('QA2-008: beberapa pengurangan dan urutan tambah lalu hapus tidak kehilangan delta', () => {
  const awal = papan(['apel', 3], ['burung', 2]);
  const kurang = proses(awal, [peristiwa('hapus', 'apel', 1), peristiwa('hapus', 'burung', 1)]);
  assert.equal(kurang.adegan.soal.teks, '5 − 1 − 1 = ?');
  periksaSoal(kurang, 3);
  const r = proses(awal, [peristiwa('tambah', 'apel', 2), peristiwa('hapus', 'apel', 1)]);
  assert.equal(r.adegan.soal.teks, '5 + 2 − 1 = ?');
  periksaSoal(r, 6);
});

test('QA2-008: opsi menghitung satu jenis tetap mengabaikan jenis hiasan', () => {
  const r = proses(papan(['apel', 3], ['burung', 2]), [
    peristiwa('tambah', 'apel', 2), peristiwa('hapus', 'apel', 1),
  ], { hitungSemua: false });
  assert.equal(yangAda(r.adegan).length, 6);
  assert.equal(yangAda(r.adegan, 'apel').length, 4);
  assert.equal(r.adegan.soal.teks, '3 + 2 − 1 = ?');
  periksaSoal(r, 4);
});

test('QA2-009: 20 apel dikurangi 10 lalu ditambah 10 tetap 20 benda aktif', () => {
  const r = proses(papan(['apel', 20]), [peristiwa('hapus', 'apel', 10), peristiwa('tambah', 'apel', 10)]);
  assert.equal(yangAda(r.adegan).length, 20);
  assert.equal(r.adegan.objek.filter((o) => o.status === 'pergi').length, 10);
  assert.equal(r.catatan.length, 0, 'animasi keluar tidak memicu penolakan kapasitas');
  assert.equal(r.adegan.soal.teks, '20 − 10 + 10 = ?');
  periksaSoal(r, 20);
});

test('QA2-009: animasi keluar dan benda aktif memiliki batas terpisah pada transaksi panjang', () => {
  const awal = papan(['apel', 20]);
  const tersimpan = JSON.stringify(awal);
  const rangkaian = Array.from({ length: 80 }, () => [
    peristiwa('hapus', 'apel', 20), peristiwa('tambah', 'apel', 20),
  ]).flat();
  const r = proses(awal, rangkaian);
  assert.equal(yangAda(r.adegan).length, BATAS_OBJEK);
  assert.equal(r.adegan.objek.filter((o) => o.status === 'pergi').length, BATAS_ANIMASI_KELUAR);
  assert.equal(r.adegan.objek.length, BATAS_OBJEK + BATAS_ANIMASI_KELUAR);
  assert.equal(new Set(r.adegan.objek.map((o) => o.id)).size, r.adegan.objek.length);
  assert.equal(JSON.stringify(awal), tersimpan);
  periksaSoal(r, 20);
  const berikut = terapkan(r.adegan, { pertanyaan: 'Berapa semuanya?', tanya_jenis: 'total' });
  assert.equal(berikut.adegan.objek.length, 20, 'animasi langkah sebelumnya dibersihkan');
});

test('QA2-009: permintaan 500 benda dibatasi dengan jumlah diminta dan diterapkan yang jelas', () => {
  const baru = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'apel', jumlah: 500 }], peristiwa: [] });
  assert.equal(yangAda(baru.adegan).length, 20);
  assert.match(baru.catatan.join(' '), /20 benda aktif.*500 apel.*20 ditambahkan/);
  const tambah = proses(papan(['apel', 19]), [peristiwa('tambah', 'apel', 500)]);
  assert.equal(yangAda(tambah.adegan).length, 20);
  assert.match(tambah.catatan.join(' '), /500 apel.*1 ditambahkan/);
  periksaSoal(tambah, 20);
  const entitas = terapkan(papan(['apel', 3]), { entitas: [{ jenis: 'apel', jumlah: 500 }], peristiwa: [], gabung: true });
  assert.equal(entitas.adegan.soal.teks, '3 + 17 = ?');
  periksaSoal(entitas, 20);
  const hapus = proses(papan(['apel', 20]), [peristiwa('hapus', 'apel', 500)]);
  assert.equal(yangAda(hapus.adegan).length, 0);
  assert.match(hapus.catatan.join(' '), /500.*20 dihapus/);
});

test('QA2-008/009: persamaan, jawaban, kapasitas dan riwayat konsisten pada 200 rangkaian acak', () => {
  let acak = 0x16a11d;
  const bilangan = (maks) => {
    acak = (Math.imul(acak, 1664525) + 1013904223) >>> 0;
    return acak % maks;
  };
  let adegan = papan(['apel', 3], ['burung', 2]);
  for (let langkah = 0; langkah < 200; langkah++) {
    const snapshot = JSON.stringify(adegan);
    const jumlah = new Map(['apel', 'burung'].map((jenis) => [jenis, yangAda(adegan, jenis).length]));
    const daftar = Array.from({ length: 2 + bilangan(5) }, () => peristiwa(
      bilangan(2) ? 'tambah' : 'hapus', bilangan(2) ? 'apel' : 'burung', 1 + bilangan(30),
    ));
    for (const p of daftar) {
      const total = [...jumlah.values()].reduce((a, b) => a + b, 0);
      jumlah.set(p.target, p.tipe === 'hapus'
        ? Math.max(0, jumlah.get(p.target) - p.jumlah)
        : jumlah.get(p.target) + Math.min(p.jumlah, BATAS_OBJEK - total));
    }
    const r = proses(adegan, daftar);
    const total = [...jumlah.values()].reduce((a, b) => a + b, 0);
    for (const [jenis, n] of jumlah) assert.equal(yangAda(r.adegan, jenis).length, n);
    assert.ok(total <= BATAS_OBJEK);
    assert.ok(r.adegan.objek.length <= BATAS_OBJEK + BATAS_ANIMASI_KELUAR);
    assert.equal(JSON.stringify(adegan), snapshot);
    if (r.adegan.soal) periksaSoal(r, total);
    adegan = r.adegan;
  }
});
