import test from 'node:test';
import assert from 'node:assert/strict';
import { buatAntrean } from './pekerjaan.js';

const tertunda = () => { let selesai; const janji = new Promise((r) => { selesai = r; }); return { janji, selesai }; };

test('Undo invalidates active and queued results even when provider ignores abort', async () => {
  const antrean = buatAntrean();
  const api = tertunda();
  const papan = [];
  let signal;
  const pertama = antrean.tambahkan(async (t) => { signal = t.signal; await api.janji; if (t.berlaku()) papan.push('lama'); });
  const kedua = antrean.tambahkan(() => papan.push('antrean lama'));
  await Promise.resolve();
  antrean.batalkan();
  assert.equal(signal.aborted, true);
  await antrean.tambahkan((t) => { if (t.berlaku()) papan.push('setelah Undo'); });
  api.selesai();
  await Promise.all([pertama, kedua]);
  assert.deepEqual(papan, ['setelah Undo']);
});

test('transcription and parse share ordered jobs; a rejection does not poison later input', async () => {
  const antrean = buatAntrean();
  const api = tertunda();
  const urutan = [];
  const a = antrean.tambahkan(async () => { await api.janji; urutan.push('transkripsi A', 'urai A'); });
  const b = antrean.tambahkan(() => urutan.push('urai B'));
  api.selesai();
  await Promise.all([a, b]);
  assert.deepEqual(urutan, ['transkripsi A', 'urai A', 'urai B']);
  await assert.rejects(antrean.tambahkan(() => { throw new Error('putus'); }), /putus/);
  await antrean.tambahkan(() => urutan.push('pulih'));
  assert.equal(urutan.at(-1), 'pulih');
});

test('queue is bounded and cancellation immediately permits new input', async () => {
  const antrean = buatAntrean({ maks: 1 });
  const api = tertunda();
  const a = antrean.tambahkan(() => api.janji);
  await Promise.resolve();
  await assert.rejects(antrean.tambahkan(() => {}), /Tunggu/);
  antrean.batalkan();
  await antrean.tambahkan(() => {});
  api.selesai();
  await a;
  assert.equal(antrean.jumlah, 0);
});
