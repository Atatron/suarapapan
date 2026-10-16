import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { adaUcapan, deteksiUcapan, normalkan, pcmKeWav, wavKePcm } from './wav.js';
import { transkripsiGemini } from '../../api/_suara.js';
import { speech, speechWav, burstNoise } from './fixtures/audio.js';

const janganKirim = () => { throw new Error('Audio tidak boleh mencapai model'); };

test('QA2-001: classifier lokal menolak derau berdenyut yang lolos penyaring energi lama', async () => {
  for (const seed of [123456789, 1, 0xabcdef]) {
    for (const gain of [0.03, 0.08, 0.25]) {
      const noise = normalkan(burstNoise(seed, gain));
      assert.equal(adaUcapan(noise).ada, true, 'fixture mereproduksi celah lama');
      assert.equal((await deteksiUcapan(noise)).ada, false);
      const r = await transkripsiGemini({ audio: Buffer.from(pcmKeWav(noise)).toString('base64') }, { fetchFn: janganKirim });
      assert.equal(r.tanpaUcapan, true, 'server mengulang gate tanpa panggilan model');
    }
  }
});

test('QA2-001: hening, dengung stabil dan ketukan pendek tidak memanggil model', async () => {
  const hening = new Float32Array(32000);
  const dengung = Float32Array.from(hening, (_, i) => 0.03 * Math.sin(2 * Math.PI * 100 * i / 16000));
  const ketuk = hening.slice();
  ketuk.fill(0.5, 10000, 10100);
  for (const pcm of [hening, dengung, ketuk]) {
    assert.equal((await deteksiUcapan(pcm)).ada, false);
    const r = await transkripsiGemini({ audio: Buffer.from(pcmKeWav(pcm)).toString('base64') }, { fetchFn: janganKirim });
    assert.equal(r.sumber, 'vad');
  }
});

test('QA2-001: rekaman ucapan asli lolos classifier dan mencapai model terkontrol', async () => {
  assert.equal((await deteksiUcapan(speech, { laju: 8000 })).ada, true);
  const pelan = normalkan(Float32Array.from(speech, (x) => x / 8));
  assert.equal((await deteksiUcapan(pelan, { laju: 8000 })).ada, true);
  let panggilan = 0;
  const r = await transkripsiGemini({ audio: speechWav }, {
    kunci: 'tes', fetchFn: async (url) => {
      if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }] });
      panggilan++;
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"ada_ucapan":true,"transkrip":"Ada tiga apel."}' }] } }] });
    },
  });
  assert.equal(panggilan, 1);
  assert.equal(r.transkrip, 'Ada tiga apel.');
});

test('QA2-001: bytes vendored dan fixture cocok dengan hash sumber yang ditinjau', async () => {
  const { default: base64 } = await import('./vendor/libfvad.js');
  assert.equal(createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex'), '3fadafc9c5c1c3117d0178ae631484c6dabc72e0f8742b95c370cd39f46cf171');
  assert.equal(createHash('sha256').update(readFileSync(new URL('./fixtures/speech-8khz.raw', import.meta.url))).digest('hex'), '3dbb730b90e0266d78d4fe03f00aba37a83780a6a5240d9084b5c01266194c1e');
});

test('batas audio: WAV salah format, terpotong, format palsu dan durasi berlebih gagal tertutup', async () => {
  const valid = Buffer.from(pcmKeWav(speech, 8000));
  const rusak = [Buffer.from('ABC'), valid.subarray(0, 40), valid.subarray(0, valid.length - 2)];
  for (const [offset, nilai] of [[16, 1], [20, 3], [22, 2], [24, 12345], [34, 8], [40, 999999]]) {
    const b = Buffer.from(valid); b.writeUInt32LE(nilai, offset); rusak.push(b);
  }
  for (const b of rusak) {
    assert.equal(wavKePcm(b), null);
    await assert.rejects(transkripsiGemini({ audio: b.toString('base64') }, { fetchFn: janganKirim }), /WAV.*valid|Format/);
  }
  for (const audio of ['!!!!', 'UklGRg=', 'AAAA====']) await assert.rejects(transkripsiGemini({ audio }, { fetchFn: janganKirim }), /Format/);
  await assert.rejects(transkripsiGemini({ audio: speechWav, mime: 'audio/mp3' }, { fetchFn: janganKirim }), /Format/);
  await assert.rejects(transkripsiGemini({ audio: Buffer.from(pcmKeWav(new Float32Array(16000 * 31))).toString('base64') }, { fetchFn: janganKirim }), /panjang/);
  await assert.rejects(deteksiUcapan(new Float32Array([NaN, Infinity])), /valid/);
  assert.equal(wavKePcm(null), null);
});
