import { test } from 'node:test';
import { speechWav } from '../lib/fixtures/audio.js';
import assert from 'node:assert/strict';
import { ADEGAN_KOSONG, terapkan, yangAda, konteks, deskripsi, uraiPosisi } from './engine.js';
import { hitungWer, normalisasi } from '../lib/wer.js';
import * as Sej from './sejarah.js';
import { kelompokJenis } from './engine.js';
import { pcmKeWav, hitungRms, normalkan, keBase64 } from '../lib/wav.js';
import { pilihAlternatif } from '../lib/suara.js';
import { bersihkanTranskrip, pecahKalimat, transkripsiGemini, sistemSuara, kosakata as kosakataServer } from '../../api/_suara.js';
import { cariGambar, cariTempat, urlPose, _untukTes } from './pustaka.js';
import POSE_AKSI from './aksi.json' with { type: 'json' };
import UKURAN from './ukuran.json' with { type: 'json' };
import ASET_TAMPILAN from '../../../tools/aset_tampilan_39.json' with { type: 'json' };
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
  assert.ok(Object.keys(OBJ).length >= 192, 'pustaka karakter lama tetap tersedia');
  assert.ok(Object.keys(TEMPAT).length >= 22, 'pustaka tempat lama tetap tersedia');
  for (const [id, v] of Object.entries(OBJ)) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(typeof v.n, 'string', `label ${id}`);
    assert.ok(v.n.trim(), `label ${id} tidak kosong`);
    assert.equal(typeof v.k, 'string', `kategori ${id}`);
    assert.ok(v.k.trim(), `kategori ${id} tidak kosong`);
  }
  for (const [id, v] of Object.entries(TEMPAT)) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(Number.isInteger(v.w) && v.w > 0, `lebar tempat ${id}`);
    assert.ok(Number.isInteger(v.h) && v.h > 0, `tinggi tempat ${id}`);
  }
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
  assert.equal(cariGambar('benda-tidak-dikenal'), null);
  assert.equal(cariTempat('di hutan lebat'), 'hutan');
  assert.equal(cariTempat('kebun binatang'), 'kebun-binatang');
  assert.equal(cariTempat('langit'), null, 'tanpa gambar → tetap pakai latar CSS');
  assert.equal(cariTempat(''), null);
});

test('pustaka: seluruh 468 aset dari 39 sheet terdaftar dan ditemukan dengan nama Indonesia', () => {
  assert.equal(ASET_TAMPILAN.sheets.length, 39);
  const ditemukan = new Set();
  const kataServer = new Set(kosakataServer());
  for (const sheet of ASET_TAMPILAN.sheets) {
    assert.equal(sheet.items.length, 12, `isi sheet ${sheet.number}`);
    for (const item of sheet.items) {
      const jenis = item.kind || sheet.kind;
      assert.ok(['obj', 'tempat'].includes(jenis), `${item.id}: jenis aset`);
      const kunci = `${jenis}/${item.id}`;
      assert.equal(ditemukan.has(kunci), false, `id ganda ${kunci}`);
      ditemukan.add(kunci);
      const daftar = jenis === 'obj' ? _untukTes.OBJ : _untukTes.TEMPAT;
      const cari = jenis === 'obj' ? cariGambar : cariTempat;
      assert.ok(daftar[item.id], `terdaftar ${kunci}`);
      assert.equal(cari(item.id), item.id, `pencarian id ${kunci}`);
      assert.equal(cari(item.name), item.id, `pencarian nama ${item.name}`);
      assert.ok(kataServer.has(item.id.replace(/-/g, ' ')), `kosakata suara ${item.id}`);
      if (sheet.slug.startsWith('orang')) assert.equal(kategoriJenis(item.id), 'manusia', item.id);
    }
  }
  assert.equal(ditemukan.size, 468);
  assert.equal(cariGambar('donat'), 'donat');
  assert.equal(cariGambar('donat jajanan'), 'donat-jajanan', 'dua varian sumber tetap terpisah');
  assert.equal(cariGambar('bajaj'), 'bajaj');
});

// ---------- pengenalan suara ----------

test('wav: header RIFF 16 kHz mono 16-bit dan panjang data', () => {
  const pcm = new Float32Array([0, 0.5, -0.5, 1, -1, 2]); // 2 dipotong ke 1
  const buf = pcmKeWav(pcm);
  const v = new DataView(buf);
  const teks = (o, n) => String.fromCharCode(...new Uint8Array(buf, o, n));
  assert.equal(teks(0, 4), 'RIFF');
  assert.equal(teks(8, 4), 'WAVE');
  assert.equal(v.getUint16(22, true), 1, 'mono');
  assert.equal(v.getUint32(24, true), 16000);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getUint32(40, true), pcm.length * 2);
  assert.equal(buf.byteLength, 44 + pcm.length * 2);
  assert.equal(v.getInt16(44 + 5 * 2, true), 32767, 'nilai >1 dipotong');
  assert.equal(v.getInt16(44 + 4 * 2, true), -32768);
});

test('rms dan normalisasi: hening tetap hening, suara pelan diperkuat tanpa memotong', () => {
  assert.equal(hitungRms(new Float32Array(100)), 0);
  const sedang = Float32Array.from({ length: 1000 }, (_, i) => 0.2 * Math.sin(i / 5));
  const keras = normalkan(sedang);
  const puncak = Math.max(...keras.map(Math.abs));
  assert.ok(puncak > 0.85 && puncak <= 0.9001, `puncak ${puncak}`);
  assert.ok(hitungRms(keras) > hitungRms(sedang) * 4);
  // sangat pelan: penguatan dibatasi 8x supaya derau tidak ikut meledak
  const sangatPelan = Float32Array.from({ length: 1000 }, (_, i) => 0.01 * Math.sin(i / 5));
  assert.ok(Math.max(...normalkan(sangatPelan).map(Math.abs)) < 0.0801);
  const hening = new Float32Array(10);
  assert.equal(normalkan(hening), hening, 'hening tidak diubah');
  const sudahKeras = Float32Array.from([0.95, -0.95]);
  assert.equal(normalkan(sudahKeras), sudahKeras);
});

test('base64: panjang besar tidak membuat tumpukan panggilan meledak', () => {
  const b = new Uint8Array(300000).fill(65);
  const s = keBase64(b.buffer);
  assert.equal(s.length, Math.ceil(300000 / 3) * 4);
  assert.equal(Buffer.from(s, 'base64').length, 300000);
});

test('Web Speech: pilih alternatif yang memuat kata papan', () => {
  const kosa = new Set(['gurita', 'tiga', 'laut', 'kuda-nil', 'kuda', 'nil']);
  const alt = [
    { transcript: 'ada tiga guru ita di laut', confidence: 0.9 },
    { transcript: 'ada tiga gurita di laut', confidence: 0.7 },
    { transcript: 'ada tiga gurita di lauk', confidence: 0.4 },
  ];
  assert.equal(pilihAlternatif(alt, kosa), 'ada tiga gurita di laut');
  // tanpa kata dikenal, tetap kandidat pertama
  assert.equal(pilihAlternatif([{ transcript: 'selamat pagi', confidence: 0.8 }, { transcript: 'selamat pagi anak', confidence: 0.5 }], kosa), 'selamat pagi');
  assert.equal(pilihAlternatif([], kosa), '');
});

test('transkrip: dibersihkan dan dipecah per kalimat', () => {
  assert.equal(bersihkanTranskrip('  "Ada tiga   kelinci."\n'), 'Ada tiga kelinci.');
  assert.deepEqual(pecahKalimat('Ada tiga kelinci. Lalu dua pergi! Berapa sisanya?'), ['Ada tiga kelinci.', 'Lalu dua pergi!', 'Berapa sisanya?']);
  assert.deepEqual(pecahKalimat(''), []);
  assert.deepEqual(pecahKalimat('...'), []);
});

test('kosakata server memuat nama benda, tempat, bilangan; prompt memuatnya', () => {
  const k = kosakataServer();
  for (const w of ['gurita', 'kuda nil', 'kebun binatang', 'tiga', 'berlari']) assert.ok(k.includes(w), w);
  assert.match(sistemSuara(), /gurita/);
  assert.match(sistemSuara(), /PERSIS yang diucapkan/);
});

test('transkripsiGemini: kirim audio inline + konteks, kembalikan kalimat', async () => {
  _setelUlangUntukTes();
  let badan = null;
  const fetchPalsu = async (url, opsi) => {
    if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }] });
    badan = JSON.parse(opsi.body);
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"transkrip":"Ada tiga gurita di laut. Lalu satu pergi."}' }] } }] });
  };
  const r = await transkripsiGemini({ audio: speechWav, mime: 'audio/wav', konteks: 'ikan: 2' }, { kunci: 'tes', fetchFn: fetchPalsu });
  assert.deepEqual(r.kalimat, ['Ada tiga gurita di laut.', 'Lalu satu pergi.']);
  const bagian = badan.contents[0].parts;
  assert.equal(bagian[1].inlineData.mimeType, 'audio/wav');
  assert.equal(bagian[1].inlineData.data, speechWav);
  assert.match(bagian[0].text, /ikan: 2/);
  assert.equal(badan.generationConfig.responseSchema.properties.transkrip.type, 'STRING');
  _setelUlangUntukTes();
});

test('transkripsiGemini: rekaman kosong atau terlalu besar ditolak sebelum memanggil Gemini', async () => {
  await assert.rejects(transkripsiGemini({ audio: '' }, { kunci: 'tes', fetchFn: () => { throw new Error('tidak boleh'); } }), /kosong/);
  await assert.rejects(transkripsiGemini({ audio: 'A'.repeat(3_500_000) }, { kunci: 'tes', fetchFn: () => { throw new Error('tidak boleh'); } }), /terlalu panjang/);
});

test('transkripsiGemini urai=true: transkrip + adegan kalimat pertama dalam satu panggilan', async () => {
  _setelUlangUntukTes();
  let badan = null;
  const fetchPalsu = async (url, opsi) => {
    if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }] });
    badan = JSON.parse(opsi.body);
    const jawab = {
      transkrip: 'Ada tiga ekor kelinci berlari di rumput.',
      entitas: [{ jenis: 'ekor kelinci', jumlah: 3, aksi: 'lari', posisi: '', bagi: 0, emoji: '🐇', emoji_acuan: '' }],
      latar: 'rumput', konsep: 'membilang', peristiwa: [], pertanyaan: '', tanya_benda: '',
    };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(jawab) }] } }] });
  };
  const r = await transkripsiGemini({ audio: speechWav, konteks: 'kosong', urai: true }, { kunci: 'tes', fetchFn: fetchPalsu });
  assert.equal(r.kalimat.length, 1);
  assert.equal(r.hasil.entitas[0].jenis, 'kelinci', 'dirapikan seperti jalur teks');
  assert.equal(r.hasil.entitas[0].aksi, 'lari', 'aksi benar karena "berlari" memang diucapkan');
  assert.equal(r.hasil.latar, 'rumput');
  assert.ok(badan.generationConfig.responseSchema.properties.entitas, 'skema gabungan');
  assert.ok(badan.generationConfig.responseSchema.properties.transkrip);
  assert.match(badan.systemInstruction.parts[0].text, /KALIMAT PERTAMA/);
  assert.match(badan.systemInstruction.parts[0].text, /Contoh urai/);
  _setelUlangUntukTes();
});

test('transkripsiGemini urai=true: tanpa ucapan → tanpa hasil', async () => {
  _setelUlangUntukTes();
  const fetchPalsu = async (url) => {
    if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }] });
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"transkrip":"","entitas":[],"latar":"","konsep":"tidak_ada","peristiwa":[],"pertanyaan":"","tanya_benda":""}' }] } }] });
  };
  const r = await transkripsiGemini({ audio: speechWav, urai: true }, { kunci: 'tes', fetchFn: fetchPalsu });
  assert.deepEqual(r.kalimat, []);
  assert.equal(r.hasil, undefined);
  _setelUlangUntukTes();
});

test('transkripsiGemini urai=true: beberapa kalimat → hasil gabungan dibuang, klien urai satu per satu', async () => {
  _setelUlangUntukTes();
  const fetchPalsu = async (url) => {
    if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }] });
    const jawab = { transkrip: 'Anak-anak, perhatikan papan. Ada dua belas bebek.', entitas: [{ jenis: 'bebek', jumlah: 12, aksi: 'diam', posisi: '', bagi: 0, emoji: '', emoji_acuan: '' }], latar: '', konsep: 'membilang', peristiwa: [], pertanyaan: '', tanya_benda: '' };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(jawab) }] } }] });
  };
  const r = await transkripsiGemini({ audio: speechWav, urai: true }, { kunci: 'tes', fetchFn: fetchPalsu });
  assert.equal(r.kalimat.length, 2);
  assert.equal(r.hasil, undefined, 'tidak boleh memakai urai yang mungkin salah kalimat');
  _setelUlangUntukTes();
});

test('rapikan: entitas dipertahankan jika benda belum ada di papan, dibuang jika sudah ada', () => {
  const h = () => ({
    entitas: [{ jenis: 'apel', jumlah: 5, aksi: 'diam', posisi: '', bagi: 0, emoji: '', emoji_acuan: '' }],
    latar: '', konsep: 'penjumlahan', pertanyaan: '', tanya_benda: '',
    peristiwa: [{ tipe: 'tambah', target: 'apel', jumlah: 2, posisi: '' }],
  });
  assert.equal(rapikan(h(), 'beli lima apel lalu dua lagi', 'kosong').entitas.length, 1, 'papan kosong → entitas tetap');
  assert.equal(rapikan(h(), 'satu apel lagi datang', 'apel: 5').entitas.length, 0, 'apel sudah ada → bukan benda baru');
});

test('engine: satu kalimat dengan entitas dan peristiwa → lima apel, lalu tambah dua = tujuh', () => {
  const r = terapkan(ADEGAN_KOSONG, {
    entitas: [{ jenis: 'apel', jumlah: 5, aksi: 'diam', posisi: '' }],
    peristiwa: [{ tipe: 'tambah', target: 'apel', jumlah: 2 }], konsep: 'penjumlahan',
  });
  assert.equal(yangAda(r.adegan, 'apel').length, 7);
  assert.equal(r.adegan.soal.teks, '5 + 2 = ?');
  assert.equal(r.adegan.soal.jawaban, 7);
});

test('engine: benda lama yang diubah tetap ada saat benda baru diperkenalkan', () => {
  const a = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'kelinci', jumlah: 3, aksi: 'diam', posisi: '' }], peristiwa: [] }).adegan;
  const r = terapkan(a, {
    entitas: [{ jenis: 'apel', jumlah: 2, aksi: 'diam', posisi: '' }],
    peristiwa: [{ tipe: 'hapus', target: 'kelinci', jumlah: 1 }],
  });
  assert.equal(yangAda(r.adegan, 'kelinci').length, 2);
  assert.equal(yangAda(r.adegan, 'apel').length, 2);
});

test('suara: ada_ucapan=false → transkrip kosong walau model menulis sesuatu', async () => {
  _setelUlangUntukTes();
  const fetchPalsu = async (url) => {
    if (url.includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-9-flash-lite' }] });
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"ada_ucapan":false,"transkrip":"Ada lima balon di kelas."}' }] } }] });
  };
  const r = await transkripsiGemini({ audio: speechWav }, { kunci: 'tes', fetchFn: fetchPalsu });
  assert.equal(r.transkrip, '');
  assert.deepEqual(r.kalimat, []);
  _setelUlangUntukTes();
});

// ---------- deteksi ucapan (VAD) ----------

import { readFileSync, readdirSync } from 'node:fs';
import { adaUcapan, wavKePcm } from '../lib/wav.js';

const acak = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 - 0.5; }; };

test('vad: hening dan derau stabil bukan ucapan', () => {
  assert.equal(adaUcapan(new Float32Array(48000)).ada, false, 'hening digital');
  const r = acak(1);
  const putih = Float32Array.from({ length: 48000 }, () => r() * 0.2);
  assert.equal(adaUcapan(putih).ada, false, 'desis stabil');
  const dengung = Float32Array.from({ length: 48000 }, (_, i) => 0.1 * Math.sin((2 * Math.PI * 120 * i) / 16000));
  assert.equal(adaUcapan(dengung).ada, false, 'dengung kipas');
});

test('vad: ledakan energi seperti ucapan di atas derau terdeteksi', () => {
  const r = acak(2);
  const x = Float32Array.from({ length: 48000 }, () => r() * 0.01); // derau pelan
  for (const [mulai, panjang] of [[6000, 5000], [20000, 7000]]) {
    for (let i = 0; i < panjang; i++) x[mulai + i] += 0.3 * Math.sin((2 * Math.PI * 220 * i) / 16000) * Math.sin((Math.PI * i) / panjang);
  }
  const v = adaUcapan(x);
  assert.equal(v.ada, true);
  assert.ok(v.terpanjang >= 5);
});

test('vad: satu ketukan pendek bukan ucapan', () => {
  const x = new Float32Array(48000);
  for (let i = 0; i < 400; i++) x[10000 + i] = 0.5 * Math.exp(-i / 80);
  assert.equal(adaUcapan(x).ada, false);
});

test('wav: kode → baca kembali, dan format yang tidak dikenal ditolak', () => {
  const pcm = Float32Array.from({ length: 1600 }, (_, i) => 0.5 * Math.sin(i / 7));
  const kembali = wavKePcm(new Uint8Array(pcmKeWav(pcm)));
  assert.equal(kembali.laju, 16000);
  assert.equal(kembali.pcm.length, 1600);
  assert.ok(Math.abs(kembali.pcm[100] - pcm[100]) < 1e-3);
  assert.equal(wavKePcm(new Uint8Array(10)), null);
  assert.equal(wavKePcm(new Uint8Array(100)), null);
});

test('server: rekaman tanpa ucapan tidak dikirim ke Gemini', async () => {
  _setelUlangUntukTes();
  const hening = Buffer.from(pcmKeWav(new Float32Array(32000))).toString('base64');
  let dipanggil = 0;
  const fetchPalsu = async () => { dipanggil++; return Response.json({}); };
  const r = await transkripsiGemini({ audio: hening, mime: 'audio/wav' }, { kunci: 'tes', fetchFn: fetchPalsu });
  assert.equal(dipanggil, 0);
  assert.equal(r.transkrip, '');
  assert.equal(r.tanpaUcapan, true);
  _setelUlangUntukTes();
});

test('vad: ucapan Indonesia asli (hasil TTS di folder uji, jika ada) terdeteksi', { skip: !process.env.WAV_UJI }, () => {
  const dir = process.env.WAV_UJI;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.wav'))) {
    const w = wavKePcm(new Uint8Array(readFileSync(`${dir}/${f}`)));
    assert.equal(adaUcapan(w.pcm, { laju: w.laju }).ada, true, f);
  }
});

// ---------- WER (halaman uji suara) ----------

test('wer: normalisasi angka dan tanda baca', () => {
  assert.deepEqual(normalisasi('Ada 3 kelinci, berlari!'), ['ada', 'tiga', 'kelinci', 'berlari']);
  assert.deepEqual(normalisasi('Anak-anak, perhatikan.'), ['anak-anak', 'perhatikan']);
});

test('wer: tepat, ganti, sisip, hapus', () => {
  assert.deepEqual(hitungWer('Ada tiga kelinci.', 'ada 3 kelinci'), { salah: 0, total: 3, ganti: 0, sisip: 0, hapus: 0 });
  assert.deepEqual(hitungWer('ada tiga kelinci', 'ada tiga kelinci kecil'), { salah: 1, total: 3, ganti: 0, sisip: 1, hapus: 0 });
  assert.deepEqual(hitungWer('ada tiga kelinci', 'ada kelinci'), { salah: 1, total: 3, ganti: 0, sisip: 0, hapus: 1 });
  assert.deepEqual(hitungWer('ada tiga gurita', 'ada tiga guru ita'), { salah: 2, total: 3, ganti: 1, sisip: 1, hapus: 0 });
  assert.equal(hitungWer('ada tiga kelinci', '').salah, 3);
});

// ---------- latar cerdas ----------

import { pilihLatar, calonLatar, LATAR, _untukTes as _latar } from './latar.js';

const ob = (...jenis) => ({ objek: jenis.map((j, i) => ({ id: `t${i}`, jenis: j, status: 'ada' })), latar: '' });

test('latar: data lengkap — setiap benda ada di pustaka, setiap file latar ada', () => {
  const { OBJ } = _untukTes;
  assert.equal(Object.keys(LATAR).length, 32);
  for (const [nama, b] of Object.entries(_latar.BENDA)) {
    assert.ok(OBJ[nama], `benda ${nama} tidak ada di pustaka gambar`);
    assert.ok(LATAR[b.latar], `latar ${b.latar} untuk ${nama} tidak ada`);
  }
  assert.deepEqual(Object.keys(_latar.BENDA).sort(), Object.keys(OBJ).sort(), 'setiap karakter memiliki pasangan latar');
  for (const [id, b] of [...Object.entries(LATAR), ...Object.entries(_latar.BENDA)]) {
    for (const sumbu of ['x', 'y']) {
      const rentang = b[sumbu];
      assert.ok(Array.isArray(rentang) && rentang.length === 2, `${id}.${sumbu} berupa rentang`);
      assert.ok(rentang.every(Number.isFinite), `${id}.${sumbu} berisi angka`);
      assert.ok(rentang[0] >= 0 && rentang[0] < rentang[1] && rentang[1] <= 1, `${id}.${sumbu} di dalam papan`);
    }
  }
  for (const id of Object.keys(LATAR)) assert.ok(existsSync(new URL(`../../public/aset/latar/${id}.webp`, import.meta.url)), id);
  for (const [k, daftar] of Object.entries(_latar.KANDIDAT)) for (const id of daftar) assert.ok(LATAR[id], `kandidat ${k} → ${id}`);
});

test('latar: dipilih dari benda saat guru tidak menyebut tempat', () => {
  assert.equal(pilihLatar(ob('kelinci', 'kelinci')).id, 'farm');
  assert.equal(pilihLatar(ob('harimau')).id, 'jungle');
  assert.equal(pilihLatar(ob('singa', 'zebra')).id, 'savanna');
  assert.equal(pilihLatar(ob('gurita')).id, 'underwater');
  assert.equal(pilihLatar(ob('paus')).id, 'deep-ocean');
  assert.equal(pilihLatar(ob('dokter')).id, 'clinic');
  assert.equal(pilihLatar(ob('roket')).id, 'space');
});

test('latar: yang paling banyak cocok menang; benda tak dikenal diabaikan', () => {
  assert.equal(pilihLatar(ob('singa', 'gajah', 'harimau')).id, 'savanna', 'benda pertama menentukan');
  assert.equal(pilihLatar(ob('benda-tidak-dikenal', 'benda-tidak-dikenal', 'ikan')).id, 'underwater');
  assert.equal(pilihLatar(ob('benda-tidak-dikenal')).id, 'classroom', 'tak ada yang dikenal dan tak ada tempat → ruang kelas');
});

test('latar: tempat yang disebut guru didahulukan, tetapi calon yang cocok dengan benda dipilih', () => {
  assert.equal(pilihLatar({ ...ob('ayam'), latar: 'sawah' }).id, 'rice-fields');
  assert.equal(pilihLatar({ ...ob('kelinci', 'kelinci', 'kelinci'), latar: 'rumput' }).id, 'farm', 'rumput → peternakan karena kelinci cocok');
  assert.equal(pilihLatar({ ...ob('benda-tidak-dikenal'), latar: 'rumput' }).id, 'nature', 'tanpa benda yang cocok → calon pertama');
  assert.equal(pilihLatar({ ...ob('ikan'), latar: 'laut' }).id, 'underwater');
  assert.equal(pilihLatar({ ...ob('kucing'), latar: 'dapur' }).id, 'kitchen');
});

test('latar: kosong → ruang kelas, area mengikuti benda dan melebar untuk banyak benda', () => {
  assert.equal(pilihLatar({ objek: [], latar: '' }).id, 'classroom');
  const sedikit = pilihLatar(ob('sapi', 'sapi'));
  assert.ok(sedikit.x[0] <= _latar.BENDA.sapi.x[0] && sedikit.x[1] >= _latar.BENDA.sapi.x[1], 'area dilebarkan, tidak dipersempit');
  assert.deepEqual(sedikit.y, _latar.BENDA.sapi.y);
  const banyak = pilihLatar(ob(...Array(9).fill('sapi')));
  assert.deepEqual(banyak.x, [0.04, 0.96]);
  const pecahan = pilihLatar({ objek: [{ id: 'p', jenis: 'pizza', status: 'ada', bagi: 4 }], latar: '' });
  assert.deepEqual(pecahan.x, [0.1, 0.9]);
});

test('latar: calonLatar membaca kata tempat dengan imbuhan dan sinonim', () => {
  assert.deepEqual(calonLatar('di hutan lebat'), _latar.KANDIDAT.hutan);
  assert.deepEqual(calonLatar('taman bermain'), ['playground']);
  assert.deepEqual(calonLatar('bandara'), ['airport']);
  assert.deepEqual(calonLatar('padang rumput'), _latar.KANDIDAT.rumput);
  assert.deepEqual(calonLatar(''), []);
  assert.deepEqual(calonLatar('xyz'), []);
});

test('latar: seluruh tempat baru mempunyai calon latar yang tersedia', () => {
  for (const sheet of ASET_TAMPILAN.sheets) {
    for (const item of sheet.items) {
      if ((item.kind || sheet.kind) !== 'tempat') continue;
      const calon = calonLatar(`di ${item.name}`);
      assert.ok(calon.length, `calon latar ${item.id}`);
      assert.deepEqual(calon, _latar.KANDIDAT[item.id], `pemetaan tempat ${item.id}`);
      assert.ok(calon.every((id) => LATAR[id]), `file latar tersedia untuk ${item.id}`);
    }
  }
  assert.equal(pilihLatar({ objek: [], latar: 'di perpustakaan sekolah' }).id, 'classroom');
  assert.equal(pilihLatar({ objek: [], latar: 'di stasiun kereta' }).id, 'railway');
  assert.equal(pilihLatar({ objek: [], latar: 'di kolam renang' }).id, 'wetland');
});

test('rapikan: "di dalam laut" adalah tempat, bukan pelajaran posisi; "di bawah meja" tetap posisi', () => {
  const dasar = (posisi, latar) => ({
    entitas: [{ jenis: 'ikan', jumlah: 3, aksi: 'diam', posisi, bagi: 0, emoji: '', emoji_acuan: '' }],
    latar, konsep: 'membilang', peristiwa: [], pertanyaan: '', tanya_benda: '',
  });
  assert.equal(rapikan(dasar('di dalam laut', 'laut'), 'tiga ikan di laut').entitas[0].posisi, '');
  assert.equal(rapikan(dasar('di dalam laut', ''), 'tiga ikan di laut').entitas[0].posisi, '', 'meski latar kosong');
  assert.equal(rapikan(dasar('di atas rumput', 'rumput'), 'tiga ikan di atas rumput').entitas[0].posisi, '');
  assert.equal(rapikan(dasar('di bawah meja', ''), 'tiga ikan di bawah meja').entitas[0].posisi, 'di bawah meja');
  assert.equal(rapikan(dasar('di atas kursi', 'kelas'), 'tiga ikan di atas kursi di kelas').entitas[0].posisi, 'di atas kursi');
});

// ---------- menambah karakter ke adegan yang ada ----------

const harimau = { entitas: [{ jenis: 'harimau', jumlah: 1, aksi: 'diam', posisi: '' }], peristiwa: [], latar: 'hutan' };
const tigaKelinciBaru = { entitas: [{ jenis: 'kelinci', jumlah: 3, aksi: 'diam', posisi: '' }], peristiwa: [] };

test('gabung: kelinci dimasukkan ke gambar berisi harimau, harimau tidak hilang', () => {
  const a = terapkan(ADEGAN_KOSONG, harimau).adegan;
  const r = terapkan(a, { ...tigaKelinciBaru, gabung: true });
  assert.equal(yangAda(r.adegan, 'harimau').length, 1);
  assert.equal(yangAda(r.adegan, 'kelinci').length, 3);
  assert.equal(r.adegan.latar, 'hutan', 'latar lama dipertahankan');
  // karakter berjenis lain masuk → penjumlahan semua karakter (1 + 3), bukan hanya kelinci
  assert.equal(r.adegan.soal.teks, '1 + 3 = ?');
  assert.match(r.penjelasan.join(' '), /1 karakter di papan \+ 3 yang masuk = 4/);
  // dimatikan guru: hanya jenis yang disebut, tanpa soal "0 + n"
  const hanyaDisebut = terapkan(a, { ...tigaKelinciBaru, gabung: true }, { hitungSemua: false });
  assert.equal(hanyaDisebut.adegan.soal, null);
  assert.match(hanyaDisebut.penjelasan.join(' '), /3 kelinci dimasukkan ke papan/);
});

test('gabung: jenis baru otomatis bergabung ke papan berisi; opsi.gabung=false menggantinya', () => {
  const a = terapkan(ADEGAN_KOSONG, harimau).adegan;
  const lewatOpsi = terapkan(a, tigaKelinciBaru, { gabung: true }).adegan;
  assert.equal(yangAda(lewatOpsi, 'harimau').length, 1);
  const otomatis = terapkan(a, tigaKelinciBaru).adegan;
  assert.equal(yangAda(otomatis, 'harimau').length, 1, '"ada 2 gajah" lalu "ada 2 kupu-kupu": gajah tetap');
  assert.equal(yangAda(otomatis, 'kelinci').length, 3);
  const ganti = terapkan(a, tigaKelinciBaru, { gabung: false }).adegan;
  assert.equal(yangAda(ganti, 'harimau').length, 0);
  assert.equal(yangAda(ganti, 'kelinci').length, 3);
});

test('tambah: benda yang belum ada masuk tanpa soal "0 + n"', () => {
  const a = terapkan(ADEGAN_KOSONG, harimau).adegan;
  const r = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 3 }] });
  assert.equal(yangAda(r.adegan, 'kelinci').length, 3);
  assert.equal(yangAda(r.adegan, 'harimau').length, 1);
  assert.equal(r.adegan.soal.teks, '1 + 3 = ?', 'jenis baru masuk ke papan berisi → penjumlahan semua karakter');
  assert.equal(r.alternatif, null);
  // papan kosong: benda baru masuk tanpa soal "0 + n"
  const kosong = terapkan(ADEGAN_KOSONG, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 3 }] });
  assert.equal(kosong.adegan.soal, null);
  // guru mematikan hitung semua: tidak ada soal
  assert.equal(terapkan(a, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 3 }] }, { hitungSemua: false }).adegan.soal, null);
});

test('tambah: kelinci sudah 3, "datang 3" → 6 dengan penjelasan dan tafsir alternatif "hanya 3"', () => {
  let a = terapkan(ADEGAN_KOSONG, harimau).adegan;
  a = terapkan(a, { ...tigaKelinciBaru, gabung: true }).adegan;
  const r = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 3 }] });
  assert.equal(yangAda(r.adegan, 'kelinci').length, 6);
  // papan: 1 harimau + 3 kelinci; 3 kelinci datang → semua karakter: 4 + 3 = 7
  assert.equal(r.penjelasan[0], '4 karakter di papan + 3 yang masuk = 7.');
  assert.equal(r.adegan.soal.teks, '4 + 3 = ?');
  // hanya yang disebut (kelinci): 3 + 3 = 6
  const hanyaKelinci = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 3 }] }, { hitungSemua: false });
  assert.equal(hanyaKelinci.penjelasan[0], '3 kelinci + 3 kelinci yang datang = 6.');
  assert.equal(hanyaKelinci.adegan.soal.teks, '3 + 3 = ?');
  assert.equal(r.alternatif.label, 'Maksudnya hanya 3 kelinci');
  assert.equal(yangAda(r.alternatif.adegan, 'kelinci').length, 3);
  assert.equal(yangAda(r.alternatif.adegan, 'harimau').length, 1, 'benda lain tetap');
  // papan asli tidak berubah
  assert.equal(yangAda(a, 'kelinci').length, 3);
});

test('rapikan: satu kejadian dilaporkan dua kali (entitas dan tambah) dihitung sekali', () => {
  const h = () => ({
    entitas: [{ jenis: 'kelinci', jumlah: 3, aksi: 'diam', posisi: '', bagi: 0, emoji: '', emoji_acuan: '' }],
    peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 3, posisi: '' }],
    latar: '', konsep: 'penjumlahan', pertanyaan: '', tanya_benda: '',
  });
  const r = rapikan(h(), 'adapun kelinci yang datang sebanyak 3', 'harimau: 1');
  assert.equal(r.peristiwa.length, 0, 'hanya entitas yang tersisa');
  assert.equal(r.entitas.length, 1);
  assert.equal(r.gabung, true, '"datang" berarti masuk ke adegan yang ada');
  // dua peristiwa sungguhan ("lalu ... lagi") tetap dua
  const dua = rapikan(h(), 'lima apel, lalu tiga kelinci lagi', 'kosong');
  assert.equal(dua.peristiwa.length, 1);
  // jumlah berbeda juga tetap dua
  const beda = h(); beda.peristiwa[0].jumlah = 2;
  assert.equal(rapikan(beda, 'tiga kelinci datang dua lagi', 'kosong').peristiwa.length, 1);
});

test('rapikan: kata "juga/bersama/tambahkan" menandai gabung; kalimat biasa tidak', () => {
  const dasar = { entitas: [{ jenis: 'kelinci', jumlah: 3, aksi: 'diam', posisi: '', bagi: 0, emoji: '', emoji_acuan: '' }], peristiwa: [], latar: '', konsep: 'membilang', pertanyaan: '', tanya_benda: '' };
  assert.equal(rapikan({ ...dasar }, 'ada juga tiga kelinci', 'harimau: 1').gabung, true);
  assert.equal(rapikan({ ...dasar }, 'tambahkan tiga kelinci', 'harimau: 1').gabung, true);
  assert.equal(rapikan({ ...dasar }, 'ada tiga kelinci di rumput', 'kosong').gabung, false);
  // bendera dari model saja tidak cukup: "ada tiga kelinci di rumput" membuka adegan baru
  assert.equal(rapikan({ ...dasar, gabung: true, latar: 'rumput' }, 'ada tiga kelinci berlari di rumput', 'harimau: 1').gabung, false);
});

test('latar: menambah kelinci ke papan berisi harimau tetap di hutan', () => {
  assert.equal(pilihLatar(ob('harimau', 'kelinci', 'kelinci', 'kelinci')).id, 'jungle');
  assert.equal(pilihLatar(ob('kelinci', 'harimau')).id, 'farm', 'urutan masuk menentukan');
});

test('tambah dengan "lagi" tidak menawarkan tafsir "hanya N"', () => {
  const a = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'kelinci', jumlah: 3, aksi: 'diam', posisi: '' }], peristiwa: [] }).adegan;
  const r = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 2 }], tambahEksplisit: true });
  assert.equal(yangAda(r.adegan, 'kelinci').length, 5);
  assert.equal(r.alternatif, null);
  assert.equal(r.penjelasan[0], '3 kelinci + 2 kelinci yang datang = 5.');
});

// ---------- Batalkan / Ulangi dan perbandingan sebelum-sesudah ----------

const papanDengan = (objek, extra = {}) => ({ ...ADEGAN_KOSONG, objek: objek.map((j, i) => ({ id: `${j}${i}`, jenis: j, aksi: 'diam', posisi: '', status: 'ada' })), ...extra });

test('sejarah: batalkan lalu ulangi mengembalikan papan yang sama, bukan salinan yang rusak', () => {
  const a = papanDengan(['harimau']);
  const b = papanDengan(['harimau', 'kelinci']);
  const c = papanDengan(['harimau', 'kelinci', 'kelinci']);
  let s = Sej.awalSejarah(ADEGAN_KOSONG, '');
  s = Sej.catat(s, a, 'ada harimau');
  s = Sej.catat(s, b, 'ada juga kelinci');
  s = Sej.catat(s, c, 'satu kelinci lagi');
  assert.equal(s.sekarang.adegan, c);
  s = Sej.batalkan(s);
  assert.equal(s.sekarang.adegan, b);
  assert.equal(s.sekarang.label, 'ada juga kelinci');
  s = Sej.batalkan(s);
  assert.equal(s.sekarang.adegan, a);
  assert.equal(Sej.bisaUlangi(s), true);
  s = Sej.ulangi(s);
  assert.equal(s.sekarang.adegan, b);
  s = Sej.ulangi(s);
  assert.equal(s.sekarang.adegan, c);
  assert.equal(Sej.bisaUlangi(s), false);
});

test('sejarah: perubahan baru setelah batalkan mengosongkan "ulangi"', () => {
  let s = Sej.awalSejarah(ADEGAN_KOSONG);
  s = Sej.catat(s, papanDengan(['ikan']), 'ikan');
  s = Sej.catat(s, papanDengan(['ikan', 'paus']), 'paus');
  s = Sej.batalkan(s);
  assert.equal(s.maju.length, 1);
  s = Sej.catat(s, papanDengan(['ikan', 'hiu']), 'hiu');
  assert.equal(s.maju.length, 0);
  assert.equal(Sej.ulangi(s), s, 'tidak ada yang bisa diulangi');
});

test('sejarah: batas awal/akhir tidak melempar dan tidak mengubah keadaan', () => {
  const s = Sej.awalSejarah(ADEGAN_KOSONG);
  assert.equal(Sej.batalkan(s), s);
  assert.equal(Sej.ulangi(s), s);
  assert.equal(Sej.bisaBatalkan(s), false);
});

test('sejarah: riwayat dibatasi dan keadaan lama tidak diubah (fungsi murni)', () => {
  let s = Sej.awalSejarah(ADEGAN_KOSONG);
  const awal = s;
  for (let i = 0; i < 45; i++) s = Sej.catat(s, papanDengan(['bola']), `ke-${i}`);
  assert.equal(s.lalu.length, Sej.MAKS_RIWAYAT);
  assert.equal(awal.lalu.length, 0);
  assert.equal(s.sekarang.label, 'ke-44');
});

test('beda: jumlah per jenis, benda yang pergi tidak dihitung, plus potongan dan tempat', () => {
  const a = papanDengan(['harimau', 'kelinci', 'kelinci', 'kelinci'], { latar: 'hutan' });
  const b = {
    ...papanDengan(['harimau', 'kelinci', 'kelinci', 'kelinci', 'kelinci', 'kelinci', 'kelinci'], { latar: 'hutan' }),
  };
  assert.deepEqual(Sej.bedaAdegan(a, b), [{ jenis: 'kelinci', dari: 3, ke: 6, selisih: 3 }]);
  assert.deepEqual(Sej.ringkasBeda(a, b), ['+3 kelinci']);
  const c = { ...a, objek: a.objek.map((o, i) => (o.jenis === 'kelinci' && i < 3 ? { ...o, status: 'pergi' } : o)) };
  assert.deepEqual(Sej.ringkasBeda(a, c), ['−2 kelinci']);
  const pizza1 = { ...ADEGAN_KOSONG, objek: [{ id: 'p', jenis: 'pizza', status: 'ada', bagi: 4, diambil: 0 }] };
  const pizza2 = { ...ADEGAN_KOSONG, objek: [{ id: 'p', jenis: 'pizza', status: 'ada', bagi: 4, diambil: 1 }], latar: 'dapur' };
  assert.deepEqual(Sej.ringkasBeda(pizza1, pizza2), ['potongan diambil: 0 → 1', 'tempat: — → dapur']);
  assert.deepEqual(Sej.ringkasBeda(a, a), []);
});

// ---------- aritmetika dengan beberapa jenis karakter ----------

const ban = (...pasang) => ({
  ...ADEGAN_KOSONG,
  latar: 'hutan',
  objek: pasang.flatMap(([j, n]) => Array.from({ length: n }, (_, i) => ({ id: `${j}${i}`, jenis: j, aksi: 'diam', posisi: '', status: 'ada' }))),
});
const KT_HR = ban(['kelinci', 3], ['harimau', 2]);

test('campur: kelompokJenis menghitung per jenis, urut kemunculan, tanpa yang pergi', () => {
  const a = { ...KT_HR, objek: KT_HR.objek.map((o, i) => (i === 4 ? { ...o, status: 'pergi' } : o)) };
  assert.deepEqual(kelompokJenis(KT_HR), [{ jenis: 'kelinci', n: 3 }, { jenis: 'harimau', n: 2 }]);
  assert.deepEqual(kelompokJenis(a), [{ jenis: 'kelinci', n: 3 }, { jenis: 'harimau', n: 1 }]);
});

test('campur: karakter berjenis lain masuk → penjumlahan total (3 + 2 = 5)', () => {
  const a = ban(['kelinci', 3]);
  const r = terapkan(a, { entitas: [{ jenis: 'harimau', jumlah: 2, aksi: 'diam', posisi: '' }], peristiwa: [], gabung: true });
  assert.equal(r.adegan.soal.teks, '3 + 2 = ?');
  assert.equal(r.adegan.soal.jawaban, 5);
  assert.deepEqual(r.adegan.soal.rincian, [{ jenis: 'kelinci', n: 3 }, { jenis: 'harimau', n: 2 }]);
  assert.equal(r.adegan.konsep, 'penjumlahan');
  assert.match(r.penjelasan[0], /3 karakter di papan \+ 2 yang masuk = 5/);
});

test('campur: salah satu jenis pergi → pengurangan dari total (5 − 2 = 3)', () => {
  const r = terapkan(KT_HR, { entitas: [], peristiwa: [{ tipe: 'hapus', target: 'harimau', jumlah: 2 }] });
  assert.equal(r.adegan.soal.teks, '5 − 2 = ?');
  assert.equal(r.adegan.soal.jawaban, 3);
  assert.equal(yangAda(r.adegan).length, 3);
  assert.deepEqual(r.adegan.soal.rincian.map((k) => k.n), [3, 2], 'rincian = keadaan sebelum');
});

test('campur: menambah jenis yang sudah ada di papan campuran memakai total (5 + 2 = 7)', () => {
  const r = terapkan(KT_HR, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 2 }], tambahEksplisit: true });
  assert.equal(r.adegan.soal.teks, '5 + 2 = ?');
  assert.equal(r.adegan.soal.jawaban, 7);
});

test('campur: "datang" dengan jenis baru lewat peristiwa tambah juga penjumlahan total', () => {
  const r = terapkan(ban(['kelinci', 3]), { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'harimau', jumlah: 2 }] });
  assert.equal(r.adegan.soal.teks, '3 + 2 = ?');
  assert.equal(yangAda(r.adegan, 'harimau').length, 2);
});

test('campur: jenis tunggal tidak berubah (3 kelinci + 2 kelinci, 3 − 2)', () => {
  const a = ban(['kelinci', 3]);
  assert.equal(terapkan(a, { entitas: [], peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 2 }] }).adegan.soal.teks, '3 + 2 = ?');
  assert.equal(terapkan(a, { entitas: [], peristiwa: [{ tipe: 'hapus', target: 'kelinci', jumlah: 2 }] }).adegan.soal.teks, '3 − 2 = ?');
});

test('pertanyaan: total, selisih, terbanyak, tersedikit, dan satu jenis', () => {
  const tanya = (tj, extra = {}) => terapkan(KT_HR, { entitas: [], peristiwa: [], pertanyaan: 'x?', tanya_jenis: tj, ...extra }).adegan.soal;
  assert.deepEqual([tanya('total').teks, tanya('total').jawaban], ['3 + 2 = ?', 5]);
  assert.deepEqual([tanya('selisih').teks, tanya('selisih').jawaban], ['3 − 2 = ?', 1]);
  const t = tanya('terbanyak');
  assert.equal(t.jawaban, 'kelinci');
  assert.deepEqual(t.opsi, ['kelinci', 'harimau', 'sama banyak']);
  assert.equal(tanya('tersedikit').jawaban, 'harimau');
  assert.deepEqual([tanya('benda', { tanya_benda: 'harimau' }).teks, tanya('benda', { tanya_benda: 'harimau' }).jawaban], ['Ada berapa harimau?', 2]);
  // tanpa tanya_jenis tetapi beberapa jenis dan tidak menyebut benda → total
  assert.equal(tanya('tidak_ada').jawaban, 5);
});

test('pertanyaan: jumlah sama → "sama banyak"; satu jenis tidak punya selisih', () => {
  const seri = ban(['ikan', 2], ['kucing', 2]);
  const s = terapkan(seri, { entitas: [], peristiwa: [], pertanyaan: 'x?', tanya_jenis: 'terbanyak' }).adegan.soal;
  assert.equal(s.jawaban, 'sama banyak');
  const satu = terapkan(ban(['ikan', 4]), { entitas: [], peristiwa: [], pertanyaan: 'x?', tanya_jenis: 'selisih' }).adegan.soal;
  assert.equal(satu.teks, 'Ada berapa ikan?', 'tidak ada pembanding → menghitung satu jenis');
});

test('rapikan: tanya_jenis divalidasi dan dikosongkan bila tidak bertanya', () => {
  const h = (extra) => ({ entitas: [], peristiwa: [], latar: '', konsep: 'membilang', pertanyaan: 'Berapa semuanya?', tanya_benda: '', ...extra });
  assert.equal(rapikan(h({ tanya_jenis: 'total' }), 'berapa semuanya', 'kelinci: 3').tanya_jenis, 'total');
  assert.equal(rapikan(h({ tanya_jenis: 'ngawur' }), 'x', 'kosong').tanya_jenis, 'tidak_ada');
  assert.equal(rapikan(h({ pertanyaan: '', tanya_jenis: 'total' }), 'x', 'kosong').tanya_jenis, 'tidak_ada');
});

test('pose aksi: setiap pose di aksi.json punya file, aksi tanpa pose → null', () => {
  for (const [nama, peta] of Object.entries(POSE_AKSI)) {
    assert.ok(_untukTes.OBJ[nama], `${nama} ada di pustaka`);
    for (const [aksi, pose] of Object.entries(peta)) {
      assert.ok(['lari', 'lompat', 'terbang', 'berenang', 'jatuh'].includes(aksi), aksi);
      assert.ok(existsSync(new URL(`../../public/aset/aksi/${nama}__${pose}.webp`, import.meta.url)), `${nama}__${pose}`);
      assert.equal(urlPose(nama, aksi), `/aset/aksi/${nama}__${pose}.webp`);
    }
  }
  assert.equal(urlPose('apel', 'jatuh'), null);
  assert.equal(urlPose('harimau', 'diam'), null, 'diam memakai gambar biasa');
  assert.equal(urlPose(null, 'lari'), null);
});

test('latar: aksi memindahkan tempat jika permukaannya tidak cocok', () => {
  const beraksi = (jenis, aksi, latar = '') => ({ ...ob(jenis), objek: [{ ...ob(jenis).objek[0], aksi }], latar });
  assert.equal(pilihLatar(beraksi('harimau', 'berenang')).id, 'river');
  assert.equal(pilihLatar(beraksi('burung', 'terbang')).id, 'open-sky');
  assert.equal(pilihLatar(beraksi('ikan', 'berenang')).id, 'underwater', 'ikan sudah di air');
  assert.equal(pilihLatar(beraksi('bebek', 'berenang')).id, 'river');
  assert.equal(pilihLatar(beraksi('elang', 'terbang')).id, 'open-sky');
  assert.equal(pilihLatar(beraksi('harimau', 'lari')).id, 'jungle', 'lari tetap di darat');
  assert.equal(pilihLatar(beraksi('harimau', 'berenang', 'hutan')).id, 'jungle', 'tempat dari guru menang');
  assert.equal(pilihLatar(beraksi('burung', 'terbang')).permukaan, 'air');
});

test('"ada 3 anak dan 3 kelinci" saat 3 kelinci sudah ada: kelinci tidak digandakan', () => {
  const a = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'kelinci', jumlah: 3 }], peristiwa: [] }).adegan;
  const r = terapkan(a, {
    entitas: [{ jenis: 'anak', jumlah: 3 }, { jenis: 'kelinci', jumlah: 3 }], peristiwa: [],
  }, { gabung: true });
  assert.equal(yangAda(r.adegan, 'kelinci').length, 3);
  assert.equal(yangAda(r.adegan, 'anak').length, 3);
});

test('"ada juga dua kelinci" tetap menjumlahkan', () => {
  const a = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'kelinci', jumlah: 3 }], peristiwa: [] }).adegan;
  const r = terapkan(a, { entitas: [{ jenis: 'kelinci', jumlah: 2 }], peristiwa: [], gabung: true });
  assert.equal(yangAda(r.adegan, 'kelinci').length, 5);
});

test('"sekarang ditambah dengan 3 kucing": kelinci tetap ada, kucing bergabung', () => {
  const a = terapkan(ADEGAN_KOSONG, { entitas: [{ jenis: 'kelinci', jumlah: 2, posisi: 'di taman' }], peristiwa: [] }).adegan;
  const h = rapikan({ entitas: [{ jenis: 'kucing', jumlah: 3 }], peristiwa: [], konsep: 'penjumlahan' },
    'sekarang ditambah dengan 3 kucing', 'kelinci: 2');
  assert.equal(h.gabung, true);
  const r = terapkan(a, h);
  assert.equal(yangAda(r.adegan, 'kelinci').length, 2);
  assert.equal(yangAda(r.adegan, 'kucing').length, 3);
});

// ---------- tata letak, proporsi, dan seret ----------
import { tataObjek, perspektif, tinggiTampil, ukuranKarakter, kategoriJenis } from './tata.js';
import { pindahkan } from './engine.js';

const adeganDari = (...pasang) => {
  let a = ADEGAN_KOSONG;
  for (const [jenis, jumlah] of pasang) a = terapkan(a, { entitas: [{ jenis, jumlah }], peristiwa: [] }, { gabung: true }).adegan;
  return a;
};

test('proporsi: setiap karakter di pustaka memiliki tinggi nyata dan kotak isi yang sah', () => {
  assert.deepEqual(Object.keys(UKURAN).sort(), Object.keys(_untukTes.OBJ).sort());
  for (const [id, d] of Object.entries(UKURAN)) {
    assert.ok(Number.isFinite(d.t) && d.t > 0, `tinggi nyata ${id}`);
    for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isFinite(d[k]), `${id}.${k} berupa angka`);
    assert.ok(d.x >= 0 && d.y >= 0 && d.w > 0 && d.h > 0, `kotak isi ${id} tidak kosong`);
    assert.ok(d.x + d.w <= 1.0001 && d.y + d.h <= 1.0001, `kotak isi ${id} di dalam sel`);
    const ukuran = ukuranKarakter(id, 0.8, 1);
    assert.equal(ukuran.punyaGambar, true, `pengukuran ${id} dipakai tata letak`);
    assert.ok(Number.isFinite(ukuran.lebar) && ukuran.lebar > 0, `lebar tampil ${id}`);
    assert.ok(ukuran.kakiX > 0 && ukuran.kakiX <= 1 && ukuran.kakiY > 0 && ukuran.kakiY <= 1.0001, `jangkar ${id}`);
  }
});

test('proporsi: guru lebih tinggi dari murid; gajah lebih tinggi dari kelinci; semut tetap terbaca', () => {
  const t = (jenis) => ukuranKarakter(jenis, 0.8, 1).isi;
  assert.ok(t('guru') > t('anak-laki-laki'), 'guru > murid');
  assert.ok(t('gajah') > t('guru'), 'gajah > guru');
  assert.ok(t('kelinci') < t('anak-laki-laki'), 'kelinci < murid');
  assert.ok(t('semut') >= 7, 'semut tidak jadi titik');
  assert.ok(t('jerapah') <= 70, 'jerapah tidak menembus papan');
});

test('proporsi: orang dewasa ≈ 44% tinggi papan di depan; makin ke belakang makin kecil', () => {
  const depan = ukuranKarakter('guru', 0.92, 1).isi;
  const belakang = ukuranKarakter('guru', 0.56, 1).isi;
  assert.ok(depan > 38 && depan < 50, `depan ${depan}`);
  assert.ok(belakang < depan * 0.8, 'perspektif');
  assert.ok(perspektif(0.92) > perspektif(0.56));
  assert.ok(tinggiTampil(0.03) >= 0.55 && tinggiTampil(5) <= 3.2);
});

test('tata: semua karakter di dalam papan dan tidak bertumpuk berlebihan', () => {
  for (const a of [adeganDari(['kelinci', 3]), adeganDari(['kelinci', 3], ['harimau', 2], ['gajah', 1]), adeganDari(['apel', 20])]) {
    const t = tataObjek(a.objek);
    assert.equal(t.length, a.objek.length);
    for (const p of t) {
      assert.ok(p.px > 0.02 && p.px < 0.98, `px ${p.px}`);
      assert.ok(p.py > 0.3 && p.py <= 0.92, `py ${p.py}`);
      assert.ok(p.px - p.lebar / 2 > -0.05 && p.px + p.lebar / 2 < 1.05, 'tidak keluar papan');
    }
  }
});

test('tata: tiga kelinci sebaris, berjarak, urut kiri ke kanan', () => {
  const t = tataObjek(adeganDari(['kelinci', 3]).objek);
  assert.equal(new Set(t.map((p) => p.py)).size, 1);
  assert.ok(t[0].px < t[1].px && t[1].px < t[2].px);
  assert.ok(t[1].px - t[0].px >= t[0].lebar * 0.99, 'tidak saling menimpa');
});

test('tata: banyak karakter tersebar di lebar dan kedalaman, tidak menumpuk di satu sisi', () => {
  const t = tataObjek(adeganDari(['kelinci', 3], ['harimau', 2], ['gajah', 1], ['apel', 2]).objek);
  const xs = t.map((p) => p.px);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.5, 'lebar sebaran');
  assert.ok(new Set(t.map((p) => p.py.toFixed(2))).size >= 3, 'kedalaman bervariasi');
  const ulang = tataObjek(adeganDari(['kelinci', 3], ['harimau', 2], ['gajah', 1], ['apel', 2]).objek);
  assert.deepEqual(ulang.map((p) => [p.px, p.py]), t.map((p, i) => [p.px, p.py]).map((x, i) => [ulang[i].px, ulang[i].py]), 'deterministik');
});

test('ukuran dasar dibedakan: manusia, hewan, dan properti', () => {
  assert.equal(kategoriJenis('guru'), 'manusia');
  assert.equal(kategoriJenis('gajah'), 'hewan');
  assert.equal(kategoriJenis('semut'), 'hewan');
  assert.equal(kategoriJenis('apel'), 'properti');
  assert.equal(kategoriJenis('meja'), 'properti');
  const t = (j) => ukuranKarakter(j, 0.9, 1).isi;
  assert.ok(t('apel') >= 14, 'buah kecil tetap terbaca dan bisa dihitung');
  assert.ok(t('apel') < t('kelinci') + 6 && t('apel') > 10);
  assert.ok(t('pensil') > t('apel'), 'selisih ukuran lembut: pensil lebih besar dari apel');
  assert.ok(t('pohon') > t('guru'), 'properti sebesar pohon memakai skala nyata');
  assert.ok(t('semut') < t('anjing') && t('anjing') < t('harimau') && t('harimau') < t('gajah'));
});

test('seret: pindahkan menyimpan px/py, membatasi, dan karakter lain tetap berpola susunan', () => {
  const a = adeganDari(['kelinci', 3]);
  const id = a.objek[1].id;
  const b = pindahkan(a, id, 0.3, 0.7);
  assert.equal(b.objek[1].px, 0.3);
  assert.equal(b.objek[1].py, 0.7);
  assert.equal(b.objek[0].px, undefined);
  assert.equal(yangAda(b).length, 3);
  assert.equal(pindahkan(a, id, 5, -2).objek[1].px, 0.98);
  assert.equal(pindahkan(a, id, 5, -2).objek[1].py, 0.02);
  assert.equal(pindahkan(a, 'tidak-ada', 0.5, 0.5), a);
  const t = tataObjek(b.objek);
  assert.equal(t[1].px, 0.3);
  assert.equal(t[1].py, 0.7);
});

test('seret: posisi bertahan saat kalimat berikutnya menambah karakter lain', () => {
  const a = adeganDari(['kelinci', 3]);
  const b = pindahkan(a, a.objek[0].id, 0.2, 0.65);
  const c = terapkan(b, { entitas: [{ jenis: 'harimau', jumlah: 1 }], peristiwa: [] }, { gabung: true }).adegan;
  const lama = c.objek.find((o) => o.id === a.objek[0].id);
  assert.equal(lama.px, 0.2);
  assert.equal(lama.py, 0.65);
});

test('sejarah.perbarui mengganti papan tanpa menambah langkah Batalkan', () => {
  const a = adeganDari(['kelinci', 2]);
  const s = Sej.catat(Sej.awalSejarah(ADEGAN_KOSONG), a, 'dua kelinci');
  const b = pindahkan(a, a.objek[0].id, 0.4, 0.7);
  const s2 = Sej.perbarui(s, b);
  assert.equal(s2.lalu.length, s.lalu.length);
  assert.equal(s2.sekarang.adegan.objek[0].px, 0.4);
  assert.equal(s2.sekarang.label, 'dua kelinci');
});

// ---------- suara pelan dari mikrofon laptop ----------
test('suara pelan (puncak 0,01) tetap terdeteksi sebagai ucapan setelah diperkuat; hening/dengung tidak', () => {
  const laju = 16000;
  const ucapanPelan = new Float32Array(laju * 2);
  for (let i = 0; i < ucapanPelan.length; i++) {
    const t = i / laju;
    // dua "suku kata": 200 Hz berselimut naik-turun, puncak 0,01 (jauh lebih pelan dari contoh sintetis)
    const selimut = (t > 0.3 && t < 0.7) || (t > 1.0 && t < 1.5) ? Math.sin(((t % 0.4) / 0.4) * Math.PI) : 0;
    ucapanPelan[i] = 0.01 * selimut * Math.sin(2 * Math.PI * 200 * t) + 0.0004 * (((i * 7919) % 100) / 100 - 0.5);
  }
  assert.equal(adaUcapan(normalkan(ucapanPelan)).ada, true, 'ucapan pelan terdeteksi setelah diperkuat');
  const dengung = new Float32Array(laju * 2).map((_, i) => 0.003 * Math.sin(2 * Math.PI * 100 * (i / laju)));
  assert.equal(adaUcapan(normalkan(dengung)).ada, false, 'dengung stabil bukan ucapan');
  assert.equal(adaUcapan(new Float32Array(laju * 2)).ada, false, 'hening bukan ucapan');
});

// ---------- audit gerak 2026-10-16 (MOV-001..006): diverifikasi terhadap kode sekarang ----------
const papanKelinci = (...kelompok) => {
  let a = ADEGAN_KOSONG;
  for (const [jumlah, aksi, posisi] of kelompok) {
    a = terapkan(a, { entitas: [{ jenis: 'kelinci', jumlah, aksi, posisi: posisi || '' }], peristiwa: [] }, { gabung: true }).adegan;
  }
  return a;
};

test('MOV-005: pindah memakai jumlah — "dua dari lima kelinci" hanya memindah dua', () => {
  const a = papanKelinci([5, 'diam', 'di bawah meja']);
  const r = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'pindah', target: 'kelinci', jumlah: 2, posisi: 'di atas meja' }] });
  const atas = yangAda(r.adegan, 'kelinci').filter((o) => o.posisi === 'di atas meja');
  const bawah = yangAda(r.adegan, 'kelinci').filter((o) => o.posisi === 'di bawah meja');
  assert.equal(atas.length, 2);
  assert.equal(bawah.length, 3);
  assert.deepEqual(r.adegan.objek.map((o) => o.id), a.objek.map((o) => o.id), 'identitas tetap');
});

test('MOV-005: jumlah 0 = semuanya; jumlah melebihi yang ada = semuanya + catatan; yang sudah di tujuan dilewati', () => {
  const a = papanKelinci([2, 'diam', 'di atas meja'], [3, 'diam', 'di bawah meja']);
  const semua = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'pindah', target: 'kelinci', jumlah: 0, posisi: 'di atas meja' }] });
  assert.equal(yangAda(semua.adegan, 'kelinci').filter((o) => o.posisi === 'di atas meja').length, 5);
  const dua = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'pindah', target: 'kelinci', jumlah: 2, posisi: 'di atas meja' }] });
  assert.equal(yangAda(dua.adegan, 'kelinci').filter((o) => o.posisi === 'di atas meja').length, 4, 'dua yang belum di atas ikut pindah');
  const lebih = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'pindah', target: 'kelinci', jumlah: 9, posisi: 'di atas meja' }] });
  assert.equal(yangAda(lebih.adegan, 'kelinci').filter((o) => o.posisi === 'di atas meja').length, 5);
  assert.ok(lebih.catatan.some((c) => /hanya ada 5/i.test(c)), lebih.catatan.join('|'));
});

test('MOV-006: deskripsi memisahkan kelompok yang gerakannya berbeda', () => {
  const a = papanKelinci([2, 'lari'], [3, 'lompat']);
  assert.match(deskripsi(a), /2 kelinci berlari; 3 kelinci melompat/);
  assert.doesNotMatch(deskripsi(a), /5 kelinci/);
  const seragam = papanKelinci([3, 'lari']);
  assert.match(deskripsi(seragam), /^3 kelinci berlari/);
  const tiga = papanKelinci([1, 'lompat'], [3, 'diam'], [2, 'lari']);
  assert.match(deskripsi(tiga), /1 kelinci melompat; 3 kelinci; 2 kelinci berlari/);
});

test('MOV-004: konteks untuk LLM memuat gerakan hanya bila kelompok berbeda; konteks seragam tidak berubah', () => {
  assert.equal(konteks(papanKelinci([2, 'lari'], [3, 'lompat'])), 'kelinci: 5 (2 berlari dan 3 melompat)');
  assert.equal(konteks(papanKelinci([3, 'lari'])), 'kelinci: 3');
  assert.equal(konteks(papanKelinci([3, 'diam', 'di bawah meja'])), 'kelinci: 3 (di bawah meja)');
});

test('MOV-002/003: ubah_aksi mengganti gerakan di tempat; jumlah dan identitas tetap', () => {
  const a = papanKelinci([3, 'lari']);
  const r = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 3, aksi: 'diam' }] });
  assert.equal(r.berubah, true);
  assert.deepEqual(yangAda(r.adegan, 'kelinci').map((o) => o.aksi), ['diam', 'diam', 'diam']);
  assert.deepEqual(r.adegan.objek.map((o) => o.id), a.objek.map((o) => o.id));
  assert.equal(r.adegan.soal ?? null, a.soal ?? null, 'bukan soal hitung');
  const lompat = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 0, aksi: 'lompat' }] });
  assert.deepEqual(yangAda(lompat.adegan, 'kelinci').map((o) => o.aksi), ['lompat', 'lompat', 'lompat']);
});

test('MOV-004: ubah_aksi dengan aksi_awal hanya mengubah kelompok itu', () => {
  const a = papanKelinci([2, 'lari'], [3, 'lompat']);
  const r = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 2, aksi_awal: 'lari', aksi: 'diam' }] });
  const aksi = yangAda(r.adegan, 'kelinci').map((o) => o.aksi);
  assert.equal(aksi.filter((x) => x === 'diam').length, 2);
  assert.equal(aksi.filter((x) => x === 'lompat').length, 3);
  assert.equal(aksi.filter((x) => x === 'lari').length, 0);
});

test('ubah_aksi: aksi tak dikenal → diam; benda tidak ada → catatan, papan tak berubah', () => {
  const a = papanKelinci([1, 'lari']);
  const r = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 1, aksi: 'menari' }] });
  assert.equal(yangAda(r.adegan, 'kelinci')[0].aksi, 'diam');
  const tak = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'ubah_aksi', target: 'gajah', jumlah: 1, aksi: 'diam' }] });
  assert.ok(tak.catatan.some((c) => /gajah/.test(c)));
  assert.equal(yangAda(tak.adegan, 'kelinci')[0].aksi, 'lari');
});

test('MOV-002: rapikan menjaga ubah_aksi dan mengubah "pindah" tanpa tujuan yang berarti berhenti menjadi ubah_aksi diam', () => {
  const sah = rapikan({ peristiwa: [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 2, aksi: 'lari', aksi_awal: 'diam', posisi: '' }] },
    'Dua kelinci mulai berlari.', 'kelinci: 5');
  assert.deepEqual(sah.peristiwa, [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 2, posisi: '', aksi: 'lari', aksi_awal: 'diam' }]);
  const aneh = rapikan({ peristiwa: [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 1, aksi: 'menari', aksi_awal: '' }] }, 'Kelinci menari.', 'kelinci: 1');
  assert.equal(aneh.peristiwa[0].aksi, 'diam');
  for (const posisi of ['', 'diam']) {
    const r = rapikan({ peristiwa: [{ tipe: 'pindah', target: 'kelinci', jumlah: 3, posisi }] },
      'Tiga kelinci yang sedang berlari sekarang berhenti.', 'kelinci: 3');
    assert.equal(r.peristiwa[0].tipe, 'ubah_aksi', `posisi ${JSON.stringify(posisi)}`);
    assert.equal(r.peristiwa[0].aksi, 'diam');
    assert.equal(r.peristiwa[0].jumlah, 3);
  }
  const nyata = rapikan({ peristiwa: [{ tipe: 'pindah', target: 'kucing', jumlah: 1, posisi: 'di atas meja' }] }, 'Kucing naik ke atas meja.', 'kucing: 1');
  assert.equal(nyata.peristiwa[0].tipe, 'pindah');
});

test('ringkasBeda menampilkan perubahan gerakan walau jumlah tetap', () => {
  const a = papanKelinci([3, 'lari']);
  const b = terapkan(a, { entitas: [], peristiwa: [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 0, aksi: 'diam' }] }).adegan;
  assert.deepEqual(Sej.ringkasBeda(a, b), ['gerakan kelinci: 3 diam']);
  const c = papanKelinci([2, 'lari'], [3, 'lompat']);
  const d = terapkan(c, { entitas: [], peristiwa: [{ tipe: 'ubah_aksi', target: 'kelinci', jumlah: 2, aksi_awal: 'lari', aksi: 'diam' }] }).adegan;
  assert.deepEqual(Sej.ringkasBeda(c, d), ['gerakan kelinci: 2 diam dan 3 melompat']);
  assert.deepEqual(Sej.ringkasBeda(a, a), []);
});
