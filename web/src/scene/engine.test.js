import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADEGAN_KOSONG, terapkan, yangAda, konteks, deskripsi, uraiPosisi } from './engine.js';
import { cariGambar, cariTempat, _untukTes } from './pustaka.js';
import { existsSync } from 'node:fs';
import { rapikan, urutkanModel, uraiGemini, _setelUlangUntukTes, emojiSah } from '../../api/_urai.js';

const tigaKelinci = {
  entitas: [{ jenis: 'kelinci', jumlah: 3, aksi: 'lari', posisi: '' }],
  latar: 'rumput', konsep: 'membilang', peristiwa: [], pertanyaan: '',
};
const duaPergi = {
  entitas: [], latar: '', konsep: 'pengurangan',
  peristiwa: [{ tipe: 'hapus', target: 'kelinci', jumlah: 2 }], pertanyaan: '',
};

test('kalimat baru memulai adegan', () => {
  const { adegan, berubah } = terapkan(ADEGAN_KOSONG, tigaKelinci);
  assert.equal(berubah, true);
  assert.equal(yangAda(adegan).length, 3);
  assert.equal(adegan.latar, 'rumput');
  assert.equal(konteks(adegan), 'kelinci: 3');
});

test('dua kelinci pergi → tersisa satu dan soal 3 − 2 muncul', () => {
  const a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  const { adegan } = terapkan(a, duaPergi);
  assert.equal(adegan.objek.length, 3, 'yang pergi tetap ada untuk animasi keluar');
  assert.equal(yangAda(adegan).length, 1);
  assert.deepEqual(adegan.soal, { teks: '3 − 2 = ?', jawaban: 1, opsi: [0, 1, 2] });
  assert.equal(adegan.latar, 'rumput', 'latar lama dipertahankan');
  assert.match(deskripsi(adegan), /1 kelinci berlari, 2 pergi di rumput/);
});

test('benda yang sudah pergi dibuang pada langkah berikutnya', () => {
  let a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  a = terapkan(a, duaPergi).adegan;
  a = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 4 }], konsep: 'penjumlahan' }).adegan;
  assert.equal(a.objek.length, 5);
  assert.deepEqual(a.soal, { teks: '1 + 4 = ?', jawaban: 5, opsi: [4, 5, 6] });
});

test('salam tidak mengubah papan', () => {
  const a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  const r = terapkan(a, { entitas: [], peristiwa: [], konsep: 'tidak_ada' });
  assert.equal(r.berubah, false);
  assert.equal(r.adegan, a);
});

test('menghapus benda yang tidak ada memberi catatan, bukan error', () => {
  const r = terapkan(ADEGAN_KOSONG, duaPergi);
  assert.equal(r.catatan.length, 1);
  assert.equal(yangAda(r.adegan).length, 0);
});

test('menghapus lebih banyak dari yang ada', () => {
  const a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  const r = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'hapus', target: 'kelinci', jumlah: 5 }] });
  assert.deepEqual(r.adegan.soal, { teks: '3 − 3 = ?', jawaban: 0, opsi: [0, 1] });
  assert.equal(r.catatan.length, 1);
});

test('jumlah dibatasi 20', () => {
  const r = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'bintang', jumlah: 99, aksi: 'diam' }], peristiwa: [] });
  assert.equal(r.adegan.objek.length, 20);
});

test('adegan lama tidak ikut berubah (untuk tombol Batalkan)', () => {
  const a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  const salinan = JSON.stringify(a);
  terapkan(a, duaPergi);
  assert.equal(JSON.stringify(a), salinan);
});

// ---------- pecahan, posisi, pertanyaan ----------

const pizzaEmpat = { entitas: [{ jenis: 'pizza', jumlah: 1, aksi: 'diam', posisi: '', bagi: 4 }], peristiwa: [], konsep: 'pecahan' };

test('pizza dibagi empat lalu satu potong diambil → soal 1/4', () => {
  let a = terapkan(ADEGAN_KOSONG, pizzaEmpat).adegan;
  assert.equal(a.objek[0].bagi, 4);
  assert.equal(a.konsep, 'pecahan');
  assert.equal(konteks(a), 'pizza: 1 (dibagi 4)');
  a = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'ambil', target: 'pizza', jumlah: 1 }] }).adegan;
  assert.equal(a.objek[0].diambil, 1);
  assert.equal(a.soal.jawaban, '1/4');
  assert.deepEqual(a.soal.opsi, ['1/4', '2/4']);
  assert.match(deskripsi(a), /1 potong diambil \(1\/4\)/);
});

test('benda yang sudah ada bisa dibagi belakangan', () => {
  let a = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'kue', jumlah: 1, aksi: 'diam' }], peristiwa: [] }).adegan;
  a = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'bagi', target: 'kue', jumlah: 3 }] }).adegan;
  assert.equal(a.objek[0].bagi, 3);
  assert.equal(a.konsep, 'pecahan');
});

test('"ambil" pada benda yang tidak dibagi berarti bendanya pergi', () => {
  const a = terapkan(ADEGAN_KOSONG, tigaKelinci).adegan;
  const input = { entitas: [], peristiwa: [{ tipe: 'ambil', target: 'kelinci', jumlah: 1 }] };
  const r = terapkan(a, input);
  assert.equal(yangAda(r.adegan).length, 2);
  assert.equal(input.peristiwa.length, 1, 'hasil parser tidak diubah');
});

test('kucing di bawah meja pindah ke atas meja', () => {
  assert.deepEqual(uraiPosisi('di bawah meja'), { relasi: 'bawah', acuan: 'meja' });
  assert.deepEqual(uraiPosisi('ke sebelah kursi'), { relasi: 'samping', acuan: 'kursi' });
  assert.equal(uraiPosisi('di rumput'), null);
  let a = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'kucing', jumlah: 1, aksi: 'diam', posisi: 'di bawah meja' }], peristiwa: [], konsep: 'posisi' }).adegan;
  assert.equal(konteks(a), 'kucing: 1 (di bawah meja)');
  a = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'pindah', target: 'kucing', jumlah: 1, posisi: 'ke atas meja' }] }).adegan;
  assert.equal(a.objek[0].posisi, 'di atas meja');
  assert.equal(a.konsep, 'posisi');
});

test('guru bertanya "ada berapa ikan?" → soal menghitung', () => {
  const tujuhIkan = { entitas: [{ jenis: 'ikan', jumlah: 7, aksi: 'berenang' }], peristiwa: [], latar: 'kolam' };
  let a = terapkan(ADEGAN_KOSONG, tujuhIkan).adegan;
  const r = terapkan(a, { entitas: [], peristiwa: [], konsep: 'membilang', pertanyaan: 'Ada berapa ikan?', tanya_benda: 'ikan' });
  assert.equal(r.berubah, true);
  assert.deepEqual(r.adegan.soal, { teks: 'Ada berapa ikan?', jawaban: 7, opsi: [6, 7, 8] });
  assert.equal(yangAda(r.adegan).length, 7);
});

test('pertanyaan di papan kosong hanya jadi caption', () => {
  const r = terapkan(ADEGAN_KOSONG, { entitas: [], peristiwa: [], pertanyaan: 'Siapa yang sudah sarapan?' });
  assert.equal(r.berubah, false);
});

// ---------- pengurai Gemini (versi online) ----------

test('rapikan: penggolong, kata ulang, aksi karangan, latar', () => {
  const h = rapikan({
    entitas: [{ jenis: 'ekor kelinci-kelinci', jumlah: 3, aksi: 'lari', posisi: 'di rumput', bagi: 0 },
      { jenis: 'kue', jumlah: 1, aksi: 'berenang', posisi: '', bagi: 0 }],
    latar: 'rumput', konsep: 'membilang', peristiwa: [], pertanyaan: '', tanya_benda: '',
  }, 'ada tiga kelinci berlari di rumput dan satu kue');
  assert.deepEqual(h.entitas[0], { jenis: 'kelinci', jumlah: 3, aksi: 'lari', posisi: '', bagi: 0, emoji: '', emoji_acuan: '' });
  assert.equal(h.entitas[1].aksi, 'diam', 'kue tidak berenang karena kata itu tidak diucapkan');
  assert.equal(rapikan({ entitas: [{ jenis: 'kupu-kupu', jumlah: 2, aksi: 'terbang', posisi: '', bagi: 0 }] }, 'dua kupu-kupu terbang').entitas[0].jenis, 'kupu-kupu');
  assert.equal(rapikan({ entitas: [{ jenis: 'pizza', jumlah: 1, aksi: 'diam', posisi: '', bagi: 4 }], konsep: 'membilang' }, 'pizza dibagi empat').konsep, 'pecahan');
});

test('urutan model: Flash-Lite terbaru dulu, lalu Flash', () => {
  const urut = urutkanModel(['models/gemini-2.0-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.5-flash', 'models/gemini-2.5-pro', 'models/gemini-2.5-flash-lite-preview-06-17', 'models/gemini-3.0-flash-lite']);
  assert.deepEqual(urut, ['gemini-3.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']);
});

test('uraiGemini: memakai skema, merapikan jawaban, pindah model saat kuota habis', async () => {
  _setelUlangUntukTes();
  const panggilan = [];
  const fetchPalsu = async (url, opsi) => {
    panggilan.push(url);
    if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }, { name: 'models/gemini-9-flash' }] });
    if (url.includes('gemini-9-flash-lite')) return new Response('quota', { status: 429 });
    const badan = JSON.parse(opsi.body);
    assert.equal(badan.generationConfig.responseMimeType, 'application/json');
    assert.ok(badan.generationConfig.responseSchema.properties.entitas);
    const jawab = { entitas: [{ jenis: 'buah apel', jumlah: 2, aksi: 'diam', posisi: '', bagi: 0 }], latar: '', konsep: 'membilang', peristiwa: [], pertanyaan: '', tanya_benda: '' };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(jawab) }] } }] });
  };
  const r = await uraiGemini('ada dua apel', 'kosong', { kunci: 'tes', fetchFn: fetchPalsu });
  assert.equal(r.sumber, 'gemini-9-flash');
  assert.equal(r.hasil.entitas[0].jenis, 'apel');
  assert.equal(panggilan.filter((u) => u.includes(':generateContent')).length, 2);
  _setelUlangUntukTes();
});

test('uraiGemini tanpa kunci memberi pesan yang jelas', async () => {
  await assert.rejects(uraiGemini('halo', 'kosong', { kunci: '' }), /GEMINI_API_KEY/);
});

test('uraiGemini: permintaan yang ditolak (400) dicoba lagi dengan bentuk lebih longgar', async () => {
  _setelUlangUntukTes();
  const bentuk = [];
  const fetchPalsu = async (url, opsi) => {
    if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }] });
    const c = JSON.parse(opsi.body).generationConfig;
    bentuk.push(c.responseJsonSchema ? 'json' : c.thinkingConfig ? 'ketat' : 'skema');
    if (!c.responseJsonSchema) return new Response('{"error":{"message":"Request contains an invalid argument."}}', { status: 400 });
    assert.equal(c.responseJsonSchema.type, 'object');
    assert.equal(c.responseJsonSchema.properties.entitas.items.propertyOrdering, undefined);
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"entitas":[],"peristiwa":[],"latar":"","konsep":"tidak_ada","pertanyaan":"","tanya_benda":""}' }] } }] });
  };
  await uraiGemini('halo', 'kosong', { kunci: 'tes', fetchFn: fetchPalsu });
  assert.deepEqual(bentuk, ['ketat', 'ketat', 'ketat', 'skema', 'json']);
  bentuk.length = 0;
  await uraiGemini('halo', 'kosong', { kunci: 'tes', fetchFn: fetchPalsu });
  assert.deepEqual(bentuk, ['json'], 'bentuk yang berhasil diingat');
  _setelUlangUntukTes();
});

test('uraiGemini: model pertama lambat → model cadangan dipakai, yang lambat dibatalkan', async () => {
  _setelUlangUntukTes();
  let dibatalkan = false;
  const fetchPalsu = async (url, opsi) => {
    if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }, { name: 'models/gemini-8-flash-lite' }] });
    if (url.includes('gemini-9')) {
      return new Promise((_, gagal) => opsi.signal.addEventListener('abort', () => { dibatalkan = true; gagal(new Error('aborted')); }));
    }
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"entitas":[],"peristiwa":[],"latar":"","konsep":"tidak_ada","pertanyaan":"","tanya_benda":""}' }] } }] });
  };
  const r = await uraiGemini('halo', 'kosong', { kunci: 'tes', fetchFn: fetchPalsu, tundaCadangan: 20 });
  assert.equal(r.sumber, 'gemini-8-flash-lite');
  assert.equal(dibatalkan, true);
  _setelUlangUntukTes();
});

test('uraiGemini: semua model lambat → galat batas waktu, bukan menggantung', async () => {
  _setelUlangUntukTes();
  const fetchPalsu = async (url, opsi) => {
    if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }] });
    return new Promise((_, gagal) => opsi.signal.addEventListener('abort', () => gagal(new Error('aborted'))));
  };
  await assert.rejects(uraiGemini('halo', 'kosong', { kunci: 'tes', fetchFn: fetchPalsu, tundaCadangan: 10, batasWaktu: 60 }), /terlalu lama/);
  _setelUlangUntukTes();
});

test('emoji: hanya emoji asli yang diterima, dan ikut ke benda yang ditambahkan', () => {
  assert.equal(emojiSah('🐅'), '🐅');
  assert.equal(emojiSah('🧑‍🏫'), '🧑‍🏫');
  assert.equal(emojiSah('harimau'), '');
  assert.equal(emojiSah('🐅 harimau'), '');
  let a = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'harimau', jumlah: 2, aksi: 'diam', emoji: '🐅' }], peristiwa: [] }).adegan;
  assert.equal(a.objek[0].emoji, '🐅');
  a = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'harimau', jumlah: 1 }] }).adegan;
  assert.equal(a.objek[2].emoji, '🐅');
});

// ---------- pustaka gambar kartun ----------

test('pustaka: semua file gambar ada dan semua alias menunjuk ke gambar yang ada', () => {
  const { OBJ, TEMPAT, ALIAS_OBJ, ALIAS_TEMPAT } = _untukTes;
  assert.equal(Object.keys(OBJ).length, 192);
  assert.equal(Object.keys(TEMPAT).length, 22);
  for (const n of Object.keys(OBJ)) assert.ok(existsSync(new URL(`../../public/aset/obj/${n}.webp`, import.meta.url)), `obj/${n}`);
  for (const n of Object.keys(TEMPAT)) assert.ok(existsSync(new URL(`../../public/aset/tempat/${n}.webp`, import.meta.url)), `tempat/${n}`);
  for (const [a, v] of Object.entries(ALIAS_OBJ)) assert.ok(OBJ[v], `alias ${a} → ${v}`);
  for (const [a, v] of Object.entries(ALIAS_TEMPAT)) assert.ok(TEMPAT[v], `alias ${a} → ${v}`);
});

test('pustaka: pencarian benda dan tempat', () => {
  assert.equal(cariGambar('harimau'), 'harimau');
  assert.equal(cariGambar('Kelinci-kelinci'), 'kelinci');
  assert.equal(cariGambar('kuda nil'), 'kuda-nil');
  assert.equal(cariGambar('anak kucing'), 'kucing');
  assert.equal(cariGambar('apel merah'), 'apel');
  assert.equal(cariGambar('macan'), 'harimau');
  assert.equal(cariGambar('bajaj'), null);
  assert.equal(cariTempat('di hutan lebat'), 'hutan');
  assert.equal(cariTempat('kebun binatang'), 'kebun-binatang');
  assert.equal(cariTempat('langit'), null, 'tanpa gambar → tetap pakai latar CSS');
  assert.equal(cariTempat(''), null);
});
