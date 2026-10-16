import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BroadcastChannel } from 'node:worker_threads';
import { bacaSesi, bolehTerimaSnapshot, buatSaluran, buatSesiGuru, idBaru, simpanSesi } from './saluran.js';

const penyimpanan = () => {
  const data = new Map();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};
const adegan = (jenis = 'apel') => ({ objek: [{ id: 'obj-1', jenis, status: 'diam' }], versi: 1 });
const caption = { teks: 'Ada satu apel.', sementara: false, sorot: ['satu', 'apel'] };
const sejarah = (a) => ({ lalu: [{ adegan: { objek: [], versi: 0 }, label: '' }], sekarang: { adegan: a, label: caption.teks }, maju: [] });
function berikutnya(saluran, aksi) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { lepas(); reject(new Error('Tidak menerima pesan BroadcastChannel')); }, 2000);
    const lepas = saluran.dengar((m) => { clearTimeout(timer); lepas(); resolve(m); });
    aksi();
  });
}

test('dua kelas nyata pada BroadcastChannel menerima hanya pesan untuk sesinya', async () => {
  const sesiA = idBaru(), sesiB = idBaru();
  const guruA = buatSaluran(sesiA, BroadcastChannel), papanA = buatSaluran(sesiA, BroadcastChannel);
  const guruB = buatSaluran(sesiB, BroadcastChannel), papanB = buatSaluran(sesiB, BroadcastChannel);
  const diterimaA = [], diterimaB = [];
  const lepasA = papanA.dengar((m) => diterimaA.push(m));
  const lepasB = papanB.dengar((m) => diterimaB.push(m));
  try {
    await Promise.all([
      berikutnya(papanA, () => guruA.kirim({ type: 'uji', kelas: 'A', sesi: sesiB })),
      berikutnya(papanB, () => guruB.kirim({ type: 'uji', kelas: 'B' })),
    ]);
    await new Promise((r) => setTimeout(r, 25));
    assert.deepEqual(diterimaA.map((m) => [m.kelas, m.sesi]), [['A', sesiA]]);
    assert.deepEqual(diterimaB.map((m) => [m.kelas, m.sesi]), [['B', sesiB]]);
  } finally { lepasA(); lepasB(); [guruA, papanA, guruB, papanB].forEach((s) => s.tutup()); }
});

test('halo setelah refresh papan memulihkan adegan, caption dan sorot dalam satu pesan', async () => {
  const sesi = idBaru(), storage = penyimpanan(), a = adegan();
  const guru = buatSesiGuru(sesi, { adegan: a, sejarah: sejarah(a), caption }, { storage, Channel: BroadcastChannel });
  const lepas = guru.dengar();
  let papan = buatSaluran(sesi, BroadcastChannel);
  try {
    const pertama = await berikutnya(papan, () => papan.kirim({ type: 'halo' }));
    papan.tutup();
    papan = buatSaluran(sesi, BroadcastChannel);
    const pulih = await berikutnya(papan, () => papan.kirim({ type: 'halo' }));
    assert.equal(pulih.type, 'snapshot');
    assert.deepEqual(pulih.snapshot.adegan, a);
    assert.deepEqual(pulih.snapshot.caption, caption);
    assert.deepEqual(pulih.snapshot, pertama.snapshot);
  } finally { lepas(); guru.tutup(); papan.tutup(); }
});

test('refresh guru menyimpan riwayat undo/redo dan mencabut pengendali lama', async () => {
  const sesi = idBaru(), storage = penyimpanan(), a = adegan();
  const lama = buatSesiGuru(sesi, { adegan: a, sejarah: sejarah(a), caption }, { storage, Channel: BroadcastChannel });
  const sebelum = lama.baca();
  const baru = buatSesiGuru(sesi, { adegan: { objek: [] } }, { storage, Channel: BroadcastChannel });
  const papan = buatSaluran(sesi, BroadcastChannel);
  const lepas = baru.dengar();
  try {
    assert.deepEqual(baru.baca().sejarah, sejarah(a));
    assert.deepEqual(baru.baca().caption, caption);
    assert.equal(lama.aktif(), false);
    assert.equal(lama.perbarui({ adegan: adegan('kelinci') }), false);
    const m = await berikutnya(papan, () => papan.kirim({ type: 'halo' }));
    const kini = m.snapshot;
    assert.ok(kini.generation > sebelum.generation);
    assert.equal(bolehTerimaSnapshot(sebelum, kini, sesi, kini), true);
    assert.equal(bolehTerimaSnapshot(kini, sebelum, sesi, kini), false);
    assert.deepEqual(bacaSesi(sesi, storage).adegan, a);
  } finally { lepas(); lama.tutup(); baru.tutup(); papan.tutup(); }
});

test('revisi usang, kelas lain, dan seretan dari adegan lama tidak diterima', async () => {
  const sesi = idBaru(), storage = penyimpanan();
  const guru = buatSesiGuru(sesi, { adegan: adegan(), caption }, { storage, Channel: BroadcastChannel });
  const papan = buatSaluran(sesi, BroadcastChannel);
  const diterima = [];
  const lepas = guru.dengar((m) => diterima.push(m));
  try {
    const lama = guru.baca();
    const pesan = await berikutnya(papan, () => guru.perbarui({ adegan: adegan('kelinci') }));
    const kini = pesan.snapshot;
    assert.equal(bolehTerimaSnapshot(kini, lama, sesi, kini), false);
    assert.equal(bolehTerimaSnapshot(null, kini, idBaru(), kini), false);
    papan.kirim({ type: 'geser', id: 'obj-1', controllerId: lama.controllerId, generation: lama.generation, revision: lama.revision });
    await berikutnya(papan, () => papan.kirim({ type: 'halo' }));
    assert.equal(diterima.some((m) => m.type === 'geser'), false);
    const drag = { type: 'geser', id: 'obj-1', px: 0.2, py: 0.7, controllerId: kini.controllerId, generation: kini.generation, revision: kini.revision };
    papan.kirim(drag);
    await berikutnya(papan, () => papan.kirim({ type: 'halo' }));
    assert.equal(diterima.filter((m) => m.type === 'geser').length, 1);
  } finally { lepas(); guru.tutup(); papan.tutup(); }
});

test('penyimpanan rusak/versi asing dan kuota penuh pulih tanpa merusak kelas', () => {
  const sesi = idBaru(), storage = penyimpanan();
  const guru = buatSesiGuru(sesi, { adegan: adegan(), caption }, { storage, Channel: null });
  try {
    const sah = guru.baca();
    assert.equal(simpanSesi(sesi, { ...sah, format: 999 }, storage), false);
    assert.equal(simpanSesi(sesi, { ...sah, caption: { teks: 42 } }, storage), false);
    for (const rusak of [
      { ...sah.adegan, latar: 42 },
      { ...sah.adegan, soal: { teks: 42, jawaban: 1 } },
      { ...sah.adegan, soal: { teks: 'Berapa?', jawaban: 1, opsi: {} } },
      { ...sah.adegan, objek: [{ ...sah.adegan.objek[0], bagi: 1000000 }] },
      { ...sah.adegan, objek: [{ ...sah.adegan.objek[0], emoji: { tidak: 'bisa dirender' } }] },
      { ...sah.adegan, objek: Array.from({ length: 500 }, (_, i) => ({ id: `obj-${i}`, jenis: 'apel' })) },
    ]) assert.equal(simpanSesi(sesi, { ...sah, adegan: rusak }, storage), false, 'data tersimpan yang dapat merusak render ditolak');
    const kunci = [...storage.data.keys()].find((k) => !k.endsWith(':pengendali'));
    storage.setItem(kunci, '{rusak');
    assert.equal(bacaSesi(sesi, storage), null);
    const penuh = { getItem() { throw new Error('storage diblokir'); }, setItem() { throw new Error('kuota penuh'); } };
    assert.equal(bacaSesi(sesi, penuh), null);
    assert.equal(simpanSesi(sesi, sah, penuh), false);
    const tanpaSimpan = buatSesiGuru(idBaru(), { adegan: adegan(), caption }, { storage: penuh, Channel: null });
    assert.equal(tanpaSimpan.perbarui({ caption: { ...caption, teks: 'Bisa tetap mengajar.' } }), true);
    tanpaSimpan.tutup();
  } finally { guru.tutup(); }
});

test('klaim serentak dengan generasi sama mengikuti pengendali pemenang penyimpanan', () => {
  const sesi = idBaru(), storage = penyimpanan();
  const guru = buatSesiGuru(sesi, { adegan: adegan(), caption }, { storage, Channel: null });
  try {
    const lama = guru.baca();
    const pemenang = { ...lama, controllerId: idBaru(), revision: 0 };
    assert.equal(bolehTerimaSnapshot(lama, pemenang, sesi, pemenang), true);
    assert.equal(bolehTerimaSnapshot(pemenang, lama, sesi, pemenang), false);
    assert.equal(bolehTerimaSnapshot(lama, pemenang, sesi, null), false, 'tanpa otoritas, tab lain tidak boleh mengambil alih');
  } finally { guru.tutup(); }
});
