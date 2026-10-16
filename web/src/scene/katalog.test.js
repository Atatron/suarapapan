import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { katalogAset, katalogLatar, idAset, temukanAset } from './katalog.js';
import { cariGambar } from './pustaka.js';
import { uraiLokal } from '../lib/lokal.js';
import { rapikan } from '../lib/rapikan.js';
import { ADEGAN_KOSONG, terapkan, konteks, yangAda } from './engine.js';

test('every shipped catalog item points at a real asset and imported frames stay unique', () => {
  const all = [...katalogAset, ...katalogLatar];
  assert.equal(all.length, 569);
  assert.equal(new Set(all.map((a) => `${a.kind}/${a.id}`)).size, all.length);
  for (const a of all) {
    assert.equal(fs.existsSync(new URL(`../../public${a.path}`, import.meta.url)), true, a.path);
    assert.equal(idAset(a.id, a.kind), a.id);
  }
  const imported = all.filter((a) => a.sheet);
  assert.equal(imported.length, 468);
  assert.equal(new Set(imported.map((a) => `${a.sheet}/${a.frame}`)).size, 468);
});

test('all 410 curated object IDs survive local parser, grounding and sprite lookup', () => {
  for (const a of katalogAset.filter((x) => x.kind === 'obj')) {
    const r = uraiLokal(`Ada satu ${a.id.replaceAll('-', ' ')}.`, 'kosong');
    assert.equal(r?.hasil.entitas.length, 1, a.id);
    assert.equal(r.hasil.entitas[0].jumlah, 1, a.id);
    assert.equal(cariGambar(r.hasil.entitas[0].jenis), a.id, a.id);
  }
});

test('specific names win and unsafe legacy substitutions cannot pass model grounding', () => {
  assert.equal(temukanAset('Anak menggunakan kursi roda')[0].id, 'anak-kursi-roda');
  assert.equal(idAset('mobil mainan'), 'mobil-mainan');
  assert.equal(idAset('anak ayam'), 'piyik-ayam');
  for (const [sentence, fake] of [['Ada satu kol', 'brokoli'], ['Ada satu lemari', 'keranjang'], ['Ada satu unicorn', 'kelinci']]) {
    const r = rapikan({ entitas: [{ jenis: fake, jumlah: 1 }] }, sentence);
    assert.equal(r.needsConfirmation, true);
    assert.equal(r.entitas.length, 0);
  }
});

test('human aliases target the existing semantic group and cannot duplicate a removal', () => {
  const p = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'manusia', jumlah: 3 }] }).adegan;
  const result = rapikan({ entitas: [{ jenis: 'anak-laki-laki', jumlah: 1 }], peristiwa: [{ tipe: 'hapus', target: 'orang', jumlah: 1 }] }, 'Satu orang pergi', konteks(p));
  assert.equal(result.entitas.length, 0);
  assert.equal(result.peristiwa[0].target, 'manusia');
  assert.equal(yangAda(terapkan(p, result).adegan).length, 2);
});
