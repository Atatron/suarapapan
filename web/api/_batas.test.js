import { test } from 'node:test';
import assert from 'node:assert/strict';
import { izinkan, _kosongkan, dariCache, simpanCache, _kosongkanCache } from './_batas.js';

const req = (ip) => new Request('https://x.test/api/parse', { headers: { 'x-forwarded-for': ip } });

test('batas laju: melewati maks ditolak, IP lain tidak terpengaruh, jendela berikutnya dibuka lagi', () => {
  _kosongkan();
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(izinkan(req('1.1.1.1'), 'a', { maks: 3 }, t0 + i), true);
  assert.equal(izinkan(req('1.1.1.1'), 'a', { maks: 3 }, t0 + 10), false);
  assert.equal(izinkan(req('2.2.2.2'), 'a', { maks: 3 }, t0 + 10), true);
  assert.equal(izinkan(req('1.1.1.1'), 'b', { maks: 3 }, t0 + 10), true, 'nama endpoint berbeda dihitung terpisah');
  assert.equal(izinkan(req('1.1.1.1'), 'a', { maks: 3 }, t0 + 61_000), true);
});

test('cache: kedaluwarsa dan kapasitas', () => {
  _kosongkanCache();
  simpanCache('k', { a: 1 }, 0);
  assert.deepEqual(dariCache('k', 1000), { a: 1 });
  assert.equal(dariCache('k', 31 * 60 * 1000), null);
  for (let i = 0; i < 400; i++) simpanCache(`x${i}`, i, 0);
  assert.equal(dariCache('x0', 1), null, 'entri tertua dibuang');
  assert.equal(dariCache('x399', 1), 399);
});
