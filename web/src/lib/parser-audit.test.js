import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uraiLokal } from './lokal.js';
import { rapikan, kosong, GalatFormatAdegan } from './rapikan.js';
import { uraikan, transkripsi } from './api.js';
import { uraiGemini, _setelUlangUntukTes } from '../../api/_urai.js';
import { ADEGAN_KOSONG, terapkan, yangAda, konteks } from '../scene/engine.js';

const papan = (jenis = 'kelinci', jumlah = 3) => terapkan(ADEGAN_KOSONG, { entitas: [{ jenis, jumlah, aksi: 'diam' }] }).adegan;
const denganFetch = async (fn, jalankan) => {
  const lama = globalThis.fetch;
  globalThis.fetch = fn;
  try { return await jalankan(); } finally { globalThis.fetch = lama; }
};

test('QA2-004: negation, conditional and quoted commands cannot become positive edits on either parser path', async () => {
  const p = papan();
  for (const kalimat of [
    'Jangan tambahkan dua kelinci.', 'Tidak ada dua burung.', 'Tak perlu tambah kelinci.',
    'Kalau ada dua kelinci, tambahkan satu.', 'Jika dua kelinci datang, hapus satu.',
    'Guru berkata "tambahkan dua kelinci".', 'Guru berkata ‘ada dua kelinci’.',
  ]) {
    const lokal = uraiLokal(kalimat, konteks(p));
    assert.equal(lokal.needsConfirmation, true, kalimat);
    assert.equal(lokal.yakin, 'rendah', kalimat);
    assert.equal(terapkan(p, lokal.hasil).berubah, false, kalimat);
    const model = rapikan({ ...kosong, entitas: [{ jenis: 'kelinci', jumlah: 2 }] }, kalimat, konteks(p));
    assert.equal(model.needsConfirmation, true, kalimat);
    assert.equal(terapkan(p, model).berubah, false, kalimat);
    await denganFetch(() => { throw new Error('unsafe scope must not use the provider'); }, async () => {
      const api = await uraikan(kalimat, konteks(p));
      assert.equal(api.needsConfirmation, true);
      assert.equal(api.notice.code, lokal.notice.code);
    });
  }
});

test('QA2-005: self correction offers five rabbits for review instead of adding three and five', async () => {
  const r = await uraikan('Ada tiga kelinci, eh salah, lima kelinci', 'kosong');
  assert.equal(r.yakin, 'rendah');
  assert.equal(r.needsConfirmation, true);
  assert.equal(r.notice.code, 'SELF_CORRECTION');
  assert.equal(yangAda(terapkan(ADEGAN_KOSONG, r.hasil).adegan).length, 5);
});

test('QA2-005: a post-verb operand subtracts one from three existing apples', async () => {
  const p = papan('apel');
  const r = await uraikan('Tiga apel itu dimakan satu', konteks(p));
  assert.deepEqual(r.hasil.peristiwa.map((e) => [e.tipe, e.target, e.jumlah]), [['hapus', 'apel', 1]]);
  assert.equal(r.hasil.entitas.length, 0);
  const hasil = terapkan(p, r.hasil).adegan;
  assert.equal(yangAda(hasil).length, 2);
  assert.equal(hasil.soal.jawaban, 2);
});

test('QA2-005/006: outage fallback preserves confidence and unknown spans without publishing a partial lesson', async () => {
  await denganFetch(async () => Response.json({ detail: 'Kuota Gemini habis' }, { status: 503 }), async () => {
    for (const kalimat of ['Ada tiga kelinci dan dua unicorn', 'Ada tiga kelinci dan unicorn']) {
      const p = papan('apel');
      const r = await uraikan(kalimat, konteks(p));
      assert.equal(r.yakin, 'rendah');
      assert.equal(r.needsConfirmation, true);
      assert.equal(r.notice.code, 'INCOMPLETE_COVERAGE');
      assert.ok(r.notice.unresolvedSpans.some((s) => s.includes('unicorn')));
      assert.equal(r.availability.reason, 'QUOTA');
      assert.equal(terapkan(p, r.hasil).berubah, false);
    }
  });
});

test('an unknown noun after an event quantity is not swallowed as a bare operand', () => {
  const p = papan('apel');
  const r = uraiLokal('Tiga apel itu dimakan satu unicorn', konteks(p));
  assert.equal(r.needsConfirmation, true);
  assert.equal(r.notice.code, 'INCOMPLETE_COVERAGE');
  assert.equal(terapkan(p, r.hasil).berubah, false);
});

test('provider output cannot erase a local incomplete-coverage review requirement', async () => {
  await denganFetch(async () => Response.json({ hasil: { ...kosong, entitas: [{ jenis: 'kelinci', jumlah: 3 }] }, sumber: 'mock' }), async () => {
    const r = await uraikan('Ada tiga kelinci dan dua unicorn', 'kosong');
    assert.equal(r.needsConfirmation, true);
    assert.equal(r.notice.code, 'INCOMPLETE_COVERAGE');
    assert.equal(r.availability.status, 'available');
  });
});

test('numeric IndoBERT uncertainty and malformed transcripts retain a safe API boundary', async () => {
  await denganFetch(async () => Response.json({ hasil: { ...kosong, entitas: [{ jenis: 'kelinci', jumlah: 2 }] }, sumber: 'indobert (LLM tidak tersedia)', yakin: 0.42 }), async () => {
    const r = await uraikan('Ada beberapa kelinci', 'kosong');
    assert.equal(r.yakin, 0.42);
    assert.equal(r.needsConfirmation, true);
    assert.equal(r.notice.code, 'LOW_PROVIDER_CONFIDENCE');
  });
  await denganFetch(async () => Response.json({ transkrip: 'Ada kelinci', kalimat: {} }), async () => {
    await assert.rejects(transkripsi('QUJD', 'kosong'), { code: 'INVALID_RESPONSE' });
  });
  assert.equal(uraiLokal('Ada unicorn', 'kosong'), null);
  const mixed = uraiLokal('Ada tiga kelinci dan burung', 'kosong');
  assert.equal(mixed.needsConfirmation, true);
  assert.equal(mixed.hasil.entitas.length, 0);
});

test('model certainty cannot auto-approve an utterance whose quantities need interpretation', async () => {
  await denganFetch(async () => Response.json({ hasil: { ...kosong, entitas: [{ jenis: 'apel', jumlah: 3 }] }, yakin: 0.99 }), async () => {
    const r = await uraikan('Ada beberapa apel', 'kosong');
    assert.equal(r.needsConfirmation, true);
    assert.equal(r.notice.code, 'MODEL_REVIEW');
  });
});

test('combined transcription cannot override a determinate spoken quantity with a model count', async () => {
  await denganFetch(async () => Response.json({ transkrip: 'Ada tiga apel', kalimat: ['Ada tiga apel'], hasil: { ...kosong, entitas: [{ jenis: 'apel', jumlah: 5 }] } }), async () => {
    const r = await transkripsi('QUJD', 'kosong', { urai: true });
    assert.equal(r.hasil.entitas[0].jumlah, 3);
  });
});

test('QA2-003: schema-valid but unspoken event action becomes neutral', () => {
  const p = papan();
  const r = rapikan({ peristiwa: [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 0, aksi: 'terbang', aksi_awal: '' }] }, 'Kelinci itu menari salsa', konteks(p));
  assert.equal(r.peristiwa[0].aksi, 'diam');
  assert.equal(r.needsConfirmation, true);
  assert.equal(r.notice.code, 'UNSUPPORTED_OPERATION');
  assert.ok(yangAda(terapkan(p, r).adegan).every((e) => e.aksi === 'diam'));
  const spoken = rapikan({ peristiwa: [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 0, aksi: 'terbang' }] }, 'Kelinci mulai terbang', konteks(p));
  assert.equal(spoken.peristiwa[0].aksi, 'terbang');
});

test('requested 500 objects is visibly capped for review in both local and provider paths', async () => {
  const r = await uraikan('Ada 500 kelinci', 'kosong');
  assert.equal(r.needsConfirmation, true);
  assert.equal(r.hasil.entitas[0].jumlah, 20);
  assert.equal(r.notice.code, 'LIMITED_QUANTITY');
  assert.deepEqual(r.notice.adjustments[0], { field: 'jumlah', target: 'kelinci', requested: 500, applied: 20 });
  const model = rapikan({ ...kosong, entitas: [{ jenis: 'kelinci', jumlah: 500 }] }, 'Ada 500 kelinci');
  assert.equal(model.needsConfirmation, true);
  assert.equal(model.notice.adjustments[0].requested, 500);
});

test('unsupported operations and unnamed subjects are never silently discarded', () => {
  const h = rapikan({ ...kosong, entitas: [{ jenis: '', jumlah: 1 }], peristiwa: [{ tipe: 'salsa', target: 'kelinci', jumlah: 1 }] }, 'Kelinci salsa');
  assert.equal(h.needsConfirmation, true);
  assert.equal(h.notice.code, 'UNSUPPORTED_OPERATION');
  assert.equal(h.notice.adjustments.length, 2);
  assert.equal(h.entitas.length, 0);
  assert.equal(h.peristiwa.length, 0);
});

test('QA2-003: malformed scene containers and scalar types fail at a controlled boundary', () => {
  for (const data of [null, [], { entitas: {} }, { peristiwa: 'hapus' }, { entitas: [null] }, { entitas: [{ jenis: {} }] }, { peristiwa: [{ jumlah: '2' }] }, { gabung: 'true' }, { latar: [] }]) {
    assert.throws(() => rapikan(data, 'ada tiga kelinci'), GalatFormatAdegan);
  }
});

test('QA2-003: JSON-only provider mode also validates the scene container', async () => {
  _setelUlangUntukTes();
  const fetchFn = async (url, opsi) => {
    if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }] });
    const c = JSON.parse(opsi.body).generationConfig;
    if (c.responseSchema || c.responseJsonSchema) return new Response('unsupported', { status: 400 });
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...kosong, entitas: {} }) }] } }] });
  };
  try {
    await assert.rejects(uraiGemini('ada tiga kelinci', 'kosong', { kunci: 'test', fetchFn }), /tidak bisa dibaca/);
  } finally { _setelUlangUntukTes(); }
});

test('the server deadline includes model discovery before the first generation request', async () => {
  _setelUlangUntukTes();
  let signal;
  try {
    await assert.rejects(uraiGemini('halo', 'kosong', { kunci: 'test', batasWaktu: 5, fetchFn: async (_, opsi) => {
      signal = opsi.signal;
      return new Promise(() => {});
    } }), /terlalu lama/);
    assert.equal(signal.aborted, true);
  } finally { _setelUlangUntukTes(); }
});

test('cancellation propagates for local paths, in-flight parsing and transcription without fallback', async () => {
  const sudah = new AbortController();
  sudah.abort();
  await assert.rejects(uraikan('Ada tiga kelinci', 'kosong', { signal: sudah.signal }), { name: 'AbortError' });
  for (const jalankan of [
    (signal) => uraikan('Tiga balon terbang', 'balon: 7', { signal }),
    (signal) => transkripsi('QUJD', 'kosong', { signal }),
  ]) {
    const controller = new AbortController();
    await denganFetch(async () => { controller.abort(); return new Promise(() => {}); }, async () => {
      await assert.rejects(jalankan(controller.signal), { name: 'AbortError' });
    });
  }
});

test('bounded timeout and provider error classification remain actionable', async () => {
  await denganFetch(async () => new Promise(() => {}), async () => {
    const r = await uraikan('Tiga balon terbang', 'balon: 7', { timeoutMs: 5 });
    assert.equal(r.availability.reason, 'TIMEOUT');
    assert.equal(r.yakin, 'rendah');
    assert.equal(r.needsConfirmation, true);
    await assert.rejects(transkripsi('QUJD', 'kosong', { timeoutMs: 5 }), { code: 'TIMEOUT' });
  });
  for (const [detail, reason] of [['Kunci GEMINI_API_KEY ditolak', 'CONFIGURATION'], ['Gemini sedang sibuk', 'PROVIDER_UNAVAILABLE']]) {
    await denganFetch(async () => Response.json({ detail }, { status: 503 }), async () => {
      const r = await uraikan('Tiga balon terbang', 'balon: 7');
      assert.equal(r.availability.reason, reason);
    });
  }
});

test('transcription with a combined scene lifts review metadata to the teacher API boundary', async () => {
  await denganFetch(async () => Response.json({ transkrip: 'Jangan tambahkan dua kelinci', kalimat: ['Jangan tambahkan dua kelinci'], hasil: { ...kosong, entitas: [{ jenis: 'kelinci', jumlah: 2 }] } }), async () => {
    const r = await transkripsi('QUJD', 'kelinci: 3', { urai: true });
    assert.equal(r.needsConfirmation, true);
    assert.equal(r.notice.code, 'NEGATION_SCOPE');
    assert.equal(r.hasil.entitas.length, 0);
  });
});
