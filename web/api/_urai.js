// Pengurai kalimat guru untuk versi online (Vercel): Gemini dengan skema JSON
// yang dipaksakan, jadi bentuk jawabannya selalu sama dengan jawaban IndoBERT
// dan Ollama di server lokal. Aturan perapian di bawah adalah salinan
// rapikan() di ml/serve.py; ubah keduanya bersama-sama.

export const AKSI = ['diam', 'lari', 'lompat', 'terbang', 'berenang', 'jatuh'];
export const KONSEP = ['membilang', 'penjumlahan', 'pengurangan', 'pecahan', 'posisi', 'tidak_ada'];
export const TIPE_PERISTIWA = ['hapus', 'tambah', 'bagi', 'ambil', 'pindah'];
export const TANYA_JENIS = ['tidak_ada', 'benda', 'total', 'selisih', 'terbanyak', 'tersedikit'];

// Format skema Gemini (subset OpenAPI). propertyOrdering membuat model menulis
// field dengan urutan tetap, yang membuat jawabannya lebih stabil.
export const SKEMA = {
  type: 'OBJECT',
  properties: {
    entitas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          jenis: { type: 'STRING' },
          jumlah: { type: 'INTEGER' },
          aksi: { type: 'STRING', enum: AKSI },
          posisi: { type: 'STRING' },
          bagi: { type: 'INTEGER' },
          emoji: { type: 'STRING' },
          emoji_acuan: { type: 'STRING' },
        },
        required: ['jenis', 'jumlah', 'aksi', 'posisi', 'bagi', 'emoji', 'emoji_acuan'],
        propertyOrdering: ['jenis', 'jumlah', 'aksi', 'posisi', 'bagi', 'emoji', 'emoji_acuan'],
      },
    },
    latar: { type: 'STRING' },
    konsep: { type: 'STRING', enum: KONSEP },
    peristiwa: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tipe: { type: 'STRING', enum: TIPE_PERISTIWA },
          target: { type: 'STRING' },
          jumlah: { type: 'INTEGER' },
          posisi: { type: 'STRING' },
        },
        required: ['tipe', 'target', 'jumlah', 'posisi'],
        propertyOrdering: ['tipe', 'target', 'jumlah', 'posisi'],
      },
    },
    pertanyaan: { type: 'STRING' },
    tanya_benda: { type: 'STRING' },
    tanya_jenis: { type: 'STRING', enum: TANYA_JENIS },
    gabung: { type: 'BOOLEAN' },
  },
  required: ['entitas', 'latar', 'konsep', 'peristiwa', 'pertanyaan', 'tanya_benda', 'tanya_jenis', 'gabung'],
  propertyOrdering: ['entitas', 'latar', 'konsep', 'peristiwa', 'pertanyaan', 'tanya_benda', 'tanya_jenis', 'gabung'],
};

export const SISTEM = `Kamu adalah pengurai kalimat guru SD (kelas 1–3, matematika) untuk aplikasi SuaraPapan.
Ubah SATU kalimat guru menjadi JSON adegan. Aturan:
- "entitas": benda yang DIPERKENALKAN di kalimat ini, misalnya "ada tiga kelinci".
  "jenis" = kata benda tunggal, huruf kecil, tanpa kata penggolong (ekor, buah, biji, batang, lembar, potong).
  "jumlah" = angka. Jika jumlah tidak disebut, pakai 1.
  "aksi" = diam, lari, lompat, terbang, berenang, atau jatuh. Pakai "diam" jika kata kerjanya tidak disebut.
  "posisi" = letak relatif terhadap benda lain, selalu berbentuk "di <atas|bawah|samping|depan|belakang|dalam> <benda>", misalnya "di bawah meja". Selain itu "".
  "bagi" = jumlah potongan sama besar jika benda dibagi ("pizza dibagi empat" → 4), selain itu 0.
  "emoji" = SATU emoji yang paling mirip dengan benda itu (harimau → 🐅, nasi → 🍚, guru → 🧑‍🏫). Wajib diisi untuk benda apa pun.
  "emoji_acuan" = satu emoji untuk benda acuan di "posisi" ("di bawah pohon" → 🌳), atau "" jika posisi kosong.
- "peristiwa": perubahan pada benda yang SUDAH ADA di adegan saat ini.
  "hapus" untuk pergi, terbang pergi, dimakan, hilang, diambil, pecah, meletus.
  "tambah" untuk benda yang SUDAH ADA di papan lalu bertambah: datang lagi, diberi lagi, dibeli lagi, bertambah.
  Jika benda yang datang BELUM ada di papan, itu benda baru: tulis di "entitas", BUKAN di "peristiwa".
  Jangan pernah menulis benda yang sama (dengan jumlah yang sama) di "entitas" dan di "peristiwa" sekaligus.
  "bagi" jika benda yang sudah ada dipotong/dibagi menjadi beberapa bagian sama besar; "jumlah" = banyak potongan.
  "ambil" jika beberapa POTONG dari benda yang sudah dibagi diambil atau dimakan; "jumlah" = banyak potongan.
  "pindah" jika benda dipindah ke letak lain; isi "posisi" dengan letak barunya.
  "posisi" pada peristiwa selain "pindah" diisi "".
  Jika kalimat mengubah benda yang sudah ada, isi "peristiwa" dan biarkan "entitas" kosong.
- "gabung" = true jika kalimat MEMASUKKAN benda baru ke adegan yang sudah ada tanpa mengganti adegannya, misalnya
  "ada juga tiga kelinci", "tiga kelinci datang", "kelinci ikut bergabung", "tambahkan seekor kelinci", "masukkan
  kucing ke gambar". false jika kalimat memulai adegan baru atau tidak memperkenalkan benda.
- "latar" = tempat adegan, pilih SATU yang paling cocok dari: rumput, hutan, kebun, sawah, peternakan, gunung,
  sungai, danau, kolam, laut, bawah-laut, pantai, dapur, kamar, kelas, sekolah, pasar, kota, jalan-desa, gurun,
  salju, kebun-binatang, langit, taman, taman-bermain, malam, rumah, dalam-rumah, bandara, pelabuhan, stasiun,
  angkasa, klinik. Jika tidak ada yang cocok atau tempat tidak disebut, isi "".
- "konsep" = membilang (menghitung benda), penjumlahan, pengurangan, pecahan, posisi, atau tidak_ada.
- "pertanyaan" = kalimat soal jika guru bertanya ("ada berapa kelinci sekarang?"), selain itu "".
  "tanya_benda" = benda yang ditanyakan jumlahnya, atau "" jika tidak ada.
  "tanya_jenis" = macam pertanyaan, jika guru bertanya:
    "benda"      jumlah SATU jenis ("ada berapa kelinci sekarang?"), isi juga tanya_benda;
    "total"      jumlah semua karakter ("berapa semuanya / jumlahnya / seluruhnya?");
    "selisih"    perbedaan jumlah dua jenis ("berapa selisihnya?", "berapa lebihnya?");
    "terbanyak"  "mana yang lebih banyak / paling banyak?";
    "tersedikit" "mana yang lebih sedikit / paling sedikit?";
    "tidak_ada"  jika guru tidak bertanya.
  Papan boleh berisi beberapa jenis karakter sekaligus; hitungan "semuanya" mencakup semua jenis.
- Jika kalimat tidak menggambarkan benda (salam, instruksi, pujian), kembalikan entitas dan peristiwa kosong dan konsep "tidak_ada".
- Jangan mengarang benda yang tidak disebut guru.`;

const kosong = { entitas: [], latar: '', konsep: 'tidak_ada', peristiwa: [], pertanyaan: '', tanya_benda: '', tanya_jenis: 'tidak_ada', gabung: false };
const j = (o) => JSON.stringify({ ...kosong, ...o });

export const CONTOH = [
  ['kosong', 'Nah anak-anak, ada tiga kelinci berlari di rumput.',
    j({ entitas: [{ jenis: 'kelinci', jumlah: 3, aksi: 'lari', posisi: '', bagi: 0, emoji: '🐇', emoji_acuan: '' }], latar: 'rumput', konsep: 'membilang' })],
  ['kelinci: 3', 'Lalu dua kelinci pergi.',
    j({ konsep: 'pengurangan', peristiwa: [{ tipe: 'hapus', target: 'kelinci', jumlah: 2, posisi: '' }] })],
  ['apel: 3', 'Ibu memberi dua buah apel lagi.',
    j({ konsep: 'penjumlahan', peristiwa: [{ tipe: 'tambah', target: 'apel', jumlah: 2, posisi: '' }] })],
  ['kosong', 'Ibu punya satu pizza, kita bagi empat sama besar.',
    j({ entitas: [{ jenis: 'pizza', jumlah: 1, aksi: 'diam', posisi: '', bagi: 4, emoji: '🍕', emoji_acuan: '' }], konsep: 'pecahan' })],
  ['pizza: 1 (dibagi 4)', 'Adik makan satu potong.',
    j({ konsep: 'pecahan', peristiwa: [{ tipe: 'ambil', target: 'pizza', jumlah: 1, posisi: '' }] })],
  ['kosong', 'Ada seekor kucing tidur di bawah meja.',
    j({ entitas: [{ jenis: 'kucing', jumlah: 1, aksi: 'diam', posisi: 'di bawah meja', bagi: 0, emoji: '🐈', emoji_acuan: '' }], konsep: 'posisi' })],
  ['kucing: 1 (di bawah meja)', 'Sekarang kucingnya naik ke atas meja.',
    j({ konsep: 'posisi', peristiwa: [{ tipe: 'pindah', target: 'kucing', jumlah: 1, posisi: 'di atas meja' }] })],
  ['ikan: 7', 'Coba hitung, ada berapa ikan di kolam?',
    j({ konsep: 'membilang', pertanyaan: 'Ada berapa ikan di kolam?', tanya_benda: 'ikan', tanya_jenis: 'benda' })],
  ['kosong', 'Di hutan ada tiga kelinci dan dua harimau.',
    j({ entitas: [
      { jenis: 'kelinci', jumlah: 3, aksi: 'diam', posisi: '', bagi: 0, emoji: '🐇', emoji_acuan: '' },
      { jenis: 'harimau', jumlah: 2, aksi: 'diam', posisi: '', bagi: 0, emoji: '🐅', emoji_acuan: '' }], latar: 'hutan', konsep: 'membilang' })],
  ['kelinci: 3, harimau: 2', 'Berapa jumlah hewan semuanya?',
    j({ konsep: 'penjumlahan', pertanyaan: 'Berapa jumlah hewan semuanya?', tanya_jenis: 'total' })],
  ['kelinci: 3, harimau: 2', 'Mana yang lebih banyak, kelinci atau harimau?',
    j({ konsep: 'membilang', pertanyaan: 'Mana yang lebih banyak?', tanya_jenis: 'terbanyak' })],
  ['kelinci: 3, harimau: 2', 'Berapa selisih kelinci dan harimau?',
    j({ konsep: 'pengurangan', pertanyaan: 'Berapa selisih kelinci dan harimau?', tanya_jenis: 'selisih' })],
  ['harimau: 1', 'Ada juga tiga kelinci di sana.',
    j({ entitas: [{ jenis: 'kelinci', jumlah: 3, aksi: 'diam', posisi: '', bagi: 0, emoji: '🐇', emoji_acuan: '' }], konsep: 'membilang', gabung: true })],
  ['harimau: 1', 'Adapun kelinci yang datang sebanyak tiga.',
    j({ entitas: [{ jenis: 'kelinci', jumlah: 3, aksi: 'diam', posisi: '', bagi: 0, emoji: '🐇', emoji_acuan: '' }], konsep: 'membilang', gabung: true })],
  ['kelinci: 3', 'Lalu datang tiga kelinci lagi.',
    j({ konsep: 'penjumlahan', peristiwa: [{ tipe: 'tambah', target: 'kelinci', jumlah: 3, posisi: '' }] })],
  ['kosong', 'Selamat pagi, anak-anak. Ayo duduk yang rapi.', j({})],
];

// ---------- perapian (salinan ml/serve.py + ml/bahasa.py) ----------

// Kata tempat: "di dalam laut" menyebut tempat, bukan letak relatif terhadap sebuah benda.
const TEMPAT_BUKAN_ACUAN = new Set(['laut', 'sungai', 'kolam', 'danau', 'hutan', 'kelas', 'rumput', 'kebun', 'sawah', 'pantai',
  'gunung', 'langit', 'taman', 'kota', 'pasar', 'dapur', 'kamar', 'sekolah', 'peternakan', 'desa', 'gurun', 'salju', 'udara', 'air']);
// Kata yang berarti "masukkan ke adegan yang ada", bukan "mulai adegan baru".
const KATA_GABUNG = /\b(datang|muncul|juga|bersama|ikut|menyusul|bergabung|masuk|tambahkan|menambahkan|masukkan|memasukkan|ditambahkan)\b/i;
const KATA_TAMBAH_EKSPLISIT = /\b(lagi|tambahan|lainnya|lain)\b/i;
const KATA_DUA_PERISTIWA = /\b(lagi|lalu|kemudian|setelah itu|serta)\b/i;
const KATA_ULANG_TETAP = new Set(['kupu-kupu', 'kura-kura', 'laba-laba', 'biri-biri', 'undur-undur', 'ubur-ubur', 'lumba-lumba']);
const AKSI_KE_ENUM = {
  berlari: 'lari', lari: 'lari', berjalan: 'lari', berlarian: 'lari', berkejaran: 'lari',
  melompat: 'lompat', lompat: 'lompat', meloncat: 'lompat', bermain: 'lompat', 'melompat-lompat': 'lompat',
  terbang: 'terbang', beterbangan: 'terbang', melayang: 'terbang',
  berenang: 'berenang',
  jatuh: 'jatuh', berjatuhan: 'jatuh',
};

export function normalkanJenis(teks) {
  let t = String(teks || '').trim().toLowerCase();
  t = t.replace(/^(ekor|buah|biji|batang|lembar|orang|potong)\s+/, '');
  const m = t.match(/^(\S+)-\1$/); // kelinci-kelinci → kelinci, tetapi kupu-kupu tetap
  return m && !KATA_ULANG_TETAP.has(t) ? m[1] : t;
}

// Hanya terima satu emoji pendek, bukan teks bebas dari model.
export function emojiSah(e) {
  const t = String(e || '').trim();
  // \p{N} juga cocok dengan keycap (1️⃣), jadi hanya huruf yang ditolak.
  return t && t.length <= 16 && /\p{Extended_Pictographic}/u.test(t) && !/\p{L}/u.test(t) ? t : '';
}

const batasi = (n, min, max) => Math.max(min, Math.min(Math.round(Number(n) || 0), max));
const tokenisasi = (teks) => teks.toLowerCase().match(/\w+(?:-\w+)*/g) || [];

export function rapikan(h, kalimat, konteks = '') {
  const hasil = { ...kosong, ...h };
  hasil.latar = String(hasil.latar || '').trim().toLowerCase();
  const kata = new Set(tokenisasi(kalimat));

  hasil.entitas = (hasil.entitas || []).map((e) => {
    const jenis = normalkanJenis(e.jenis);
    let posisi = String(e.posisi || '').trim().toLowerCase();
    // "di rumput" adalah latar, bukan posisi relatif seperti "di bawah meja". Begitu juga
    // "di dalam laut" atau "di atas rumput": acuannya sebuah tempat, bukan benda pelajaran posisi.
    const acuan = posisi.split(/\s+/).pop();
    if (hasil.latar && (posisi === hasil.latar || posisi === `di ${hasil.latar}` || acuan === hasil.latar)) posisi = '';
    else if (TEMPAT_BUKAN_ACUAN.has(acuan)) posisi = '';
    // LLM kadang mengarang aksi ("kue berenang"); aksi dipakai hanya jika kata kerjanya diucapkan.
    const aksi = [...kata].some((k) => AKSI_KE_ENUM[k] === e.aksi) ? e.aksi : 'diam';
    const bagi = batasi(e.bagi, 0, 12);
    return {
      jenis, jumlah: batasi(e.jumlah, 1, 20), aksi, posisi, bagi: bagi >= 2 ? bagi : 0,
      emoji: emojiSah(e.emoji), emoji_acuan: posisi ? emojiSah(e.emoji_acuan) : '',
    };
  }).filter((e) => e.jenis);

  hasil.peristiwa = (hasil.peristiwa || [])
    .filter((p) => TIPE_PERISTIWA.includes(p.tipe))
    .map((p) => ({
      tipe: p.tipe,
      target: normalkanJenis(p.target),
      jumlah: batasi(p.jumlah, 1, 20),
      posisi: p.tipe === 'pindah' ? String(p.posisi || '').trim().toLowerCase() : '',
    }))
    .filter((p) => p.target);

  // Benda yang berubah sering ikut ditulis di "entitas" ("satu kelinci lagi datang").
  // Itu bukan benda baru jika benda itu memang sudah ada di papan. Jika belum ada
  // ("Ibu membeli lima apel, lalu memberi dua apel lagi"), entitas harus dipertahankan.
  const adaDiPapan = new Set(String(konteks).split(',').map((x) => x.split(':')[0].trim()).filter(Boolean));
  const target = new Set(hasil.peristiwa.map((p) => p.target));
  hasil.entitas = hasil.entitas.filter((e) => !(target.has(e.jenis) && adaDiPapan.has(e.jenis)));

  // Model kadang melaporkan satu kejadian dua kali: "kelinci yang datang sebanyak 3" menjadi
  // entitas kelinci 3 DAN tambah kelinci 3 (hasilnya 6). Jika bendanya belum ada di papan dan
  // jumlahnya sama, itu satu kejadian, kecuali kalimat jelas memuat dua peristiwa ("lalu", "lagi").
  if (!KATA_DUA_PERISTIWA.test(String(kalimat))) {
    hasil.peristiwa = hasil.peristiwa.filter((p) => !(p.tipe === 'tambah' && !adaDiPapan.has(p.target)
      && hasil.entitas.some((e) => e.jenis === p.target && e.jumlah === p.jumlah)));
  }
  // "gabung" hanya dari kata yang jelas (terukur: model menandai kalimat pembuka adegan baru sebagai gabung
  // juga). Guru juga bisa menyalakannya lewat kotak centang di panel.
  hasil.gabung = KATA_GABUNG.test(String(kalimat));
  // "dua kelinci LAGI" jelas penjumlahan: tidak perlu menawarkan tafsir "hanya dua".
  hasil.tambahEksplisit = KATA_TAMBAH_EKSPLISIT.test(String(kalimat));

  if (hasil.entitas.some((e) => e.bagi)) hasil.konsep = 'pecahan';
  else if (hasil.entitas.some((e) => /^(di|ke) /.test(e.posisi) && e.jumlah === 1)) hasil.konsep = 'posisi';
  if (!KONSEP.includes(hasil.konsep)) hasil.konsep = 'tidak_ada';

  hasil.pertanyaan = String(hasil.pertanyaan || '').trim();
  hasil.tanya_jenis = hasil.pertanyaan && TANYA_JENIS.includes(h.tanya_jenis) ? h.tanya_jenis : 'tidak_ada';
  hasil.tanya_benda = normalkanJenis(hasil.tanya_benda);
  return hasil;
}

// ---------- pemanggilan Gemini ----------

const API = 'https://generativelanguage.googleapis.com/v1beta';
let daftarModel = null;

// Nama model gratis Gemini sering berganti, jadi daftar model diminta dari API:
// Flash-Lite terbaru dulu (paling cepat, kuota gratis paling besar), lalu Flash.
export function urutkanModel(nama) {
  const id = nama.map((n) => n.replace(/^models\//, ''));
  const versi = (m) => Number((m.match(/gemini-(\d+(?:\.\d+)?)/) || [0, '0'])[1]);
  const terbaru = (a, b) => versi(b) - versi(a);
  const lite = id.filter((m) => /^gemini-[\d.]+-flash-lite$/.test(m)).sort(terbaru);
  const flash = id.filter((m) => /^gemini-[\d.]+-flash$/.test(m)).sort(terbaru);
  return [...lite.slice(0, 2), ...flash.slice(0, 1)];
}

async function ambilModel(kunci, fetchFn) {
  if (daftarModel) return daftarModel;
  const pilihan = process.env.GEMINI_MODEL;
  let urut = [];
  try {
    const r = await fetchFn(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': kunci } });
    if (r.ok) {
      const d = await r.json();
      urut = urutkanModel((d.models || [])
        .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => m.name));
    } else if (r.status === 400 || r.status === 403) {
      console.error('[gemini] daftar model ditolak:', r.status, (await r.text().catch(() => '')).slice(0, 400));
      throw new GalatUrai('Kunci GEMINI_API_KEY ditolak Google. Periksa kuncinya di pengaturan Vercel.', 503);
    }
  } catch (e) {
    if (e instanceof GalatUrai) throw e;
    console.warn('[gemini] daftar model gagal diambil:', e?.message);
  }
  if (!urut.length) urut = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  daftarModel = pilihan ? [pilihan, ...urut.filter((m) => m !== pilihan)] : urut;
  return daftarModel;
}

// Kunci di Vercel tersimpan dengan nama Suara_Papan_API_Key; GEMINI_API_KEY tetap diterima.
export const kunciGemini = () => process.env.GEMINI_API_KEY || process.env.Suara_Papan_API_Key || '';

export class GalatUrai extends Error {
  constructor(pesan, status = 502) { super(pesan); this.status = status; }
}

const SIBUK = new Set([429, 500, 503, 504]);

// Skema yang sama dalam format JSON Schema biasa (untuk responseJsonSchema).
function keJsonSchema(sk) {
  if (Array.isArray(sk)) return sk.map(keJsonSchema);
  if (!sk || typeof sk !== 'object') return sk;
  const hasil = {};
  for (const [k, v] of Object.entries(sk)) {
    if (k === 'propertyOrdering') continue;
    hasil[k] = k === 'type' ? String(v).toLowerCase() : keJsonSchema(v);
  }
  return hasil;
}

const dasar = { temperature: 0, responseMimeType: 'application/json' };
// Bentuk permintaan dari yang paling ketat ke yang paling longgar. Google hanya
// menjawab "invalid argument" tanpa menyebut opsi mana yang ditolak, dan model
// berbeda menerima opsi berbeda (mis. Gemini 3 memakai thinkingLevel).
const varianUntuk = (skema) => [
  { nama: 'responseSchema+tanpa-berpikir', config: () => ({ ...dasar, responseSchema: skema, thinkingConfig: { thinkingBudget: 0 } }) },
  { nama: 'responseSchema+berpikir-minimal', config: () => ({ ...dasar, responseSchema: skema, thinkingConfig: { thinkingLevel: 'minimal' } }) },
  { nama: 'responseSchema+berpikir-rendah', config: () => ({ ...dasar, responseSchema: skema, thinkingConfig: { thinkingLevel: 'low' } }) },
  { nama: 'responseSchema', config: () => ({ ...dasar, responseSchema: skema }) },
  { nama: 'responseJsonSchema', config: () => ({ ...dasar, responseJsonSchema: keJsonSchema(skema) }) },
  { nama: 'json-saja', config: () => ({ ...dasar }) },
];
const varianBerhasil = new Map(); // "model|skema" → indeks varian yang diterima

// Satu model, dengan varian bentuk permintaan di atas.
async function cobaModel(model, { kunci, fetchFn, sistem, contents, skema, idSkema, olah, signal, mulai }) {
  const varian = varianUntuk(skema);
  const kunciVarian = `${model}|${idSkema}`;
  let terakhir = { ok: false, status: 0, pesan: '' };
  for (let v = varianBerhasil.get(kunciVarian) ?? 0; v < varian.length; v++) {
    const t0 = Date.now();
    let r;
    try {
      r = await fetchFn(`${API}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': kunci },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sistem }] }, contents, generationConfig: varian[v].config() }),
        signal,
      });
    } catch (e) {
      return { ok: false, status: 0, pesan: String(e?.message || e) };
    }
    if (r.ok) {
      console.log('[gemini] waktu', JSON.stringify({ model, skema: idSkema, varian: varian[v].nama, total: Date.now() - mulai, panggilan: Date.now() - t0 }));
      varianBerhasil.set(kunciVarian, v);
      const d = await r.json().catch(() => ({}));
      const teks = d.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('') || '';
      try {
        const mentah = JSON.parse(teks.replace(/^```(?:json)?\s*|\s*```$/g, ''));
        return { ok: true, nilai: { ...olah(mentah), sumber: model, ms: Date.now() - mulai } };
      } catch {
        return { ok: false, status: 502, pesan: 'jawaban bukan JSON' };
      }
    }
    terakhir = { ok: false, status: r.status, pesan: await r.text().catch(() => '') };
    if (r.status !== 400) break;
    console.warn('[gemini]', model, varian[v].nama, 'ditolak:', terakhir.pesan.slice(0, 200));
  }
  return terakhir;
}

function galatDari(h) {
  if (!h) return new GalatUrai('Gemini tidak menjawab. Coba lagi.', 503);
  if (h.status === 429) return new GalatUrai('Kuota gratis Gemini habis untuk saat ini. Tunggu sebentar atau ketik kalimat lagi nanti.', 503);
  if (h.status === 400 || h.status === 403) return new GalatUrai('Gemini menolak permintaan. Periksa GEMINI_API_KEY di pengaturan Vercel.', 503);
  if (h.status === 502) return new GalatUrai('Jawaban Gemini tidak bisa dibaca. Coba ucapkan lagi.');
  return new GalatUrai(`Gemini sedang sibuk (galat ${h.status || 'jaringan'}). Coba ucapkan lagi.`, 503);
}

// Layanan gratis Gemini kadang lambat (sampai 17 detik dalam uji) atau sibuk
// (503). Jika model pertama belum menjawab setelah TUNDA_CADANGAN, permintaan
// yang sama dikirim juga ke model berikutnya, dan jawaban tercepat yang dipakai.
const TUNDA_CADANGAN = 2500;
const BATAS_WAKTU = 15000;

/**
 * Memanggil Gemini dengan skema JSON, model cadangan, dan batas waktu.
 * `olah(json)` mengubah JSON mentah menjadi nilai akhir (boleh melempar).
 */
export async function panggilGemini({
  sistem, contents, skema, idSkema, olah,
  kunci = kunciGemini(), fetchFn = fetch, tundaCadangan = TUNDA_CADANGAN, batasWaktu = BATAS_WAKTU,
}) {
  if (!kunci) throw new GalatUrai('GEMINI_API_KEY belum diisi di pengaturan Vercel.', 503);
  const mulai = Date.now();
  const model = await ambilModel(kunci, fetchFn);
  const ac = new AbortController();
  const ctx = { kunci, fetchFn, sistem, contents, skema, idSkema, olah, signal: ac.signal, mulai };

  return new Promise((resolve, reject) => {
    let berikut = 0;
    let berjalan = 0;
    let selesai = false;
    let terakhir = null;
    const akhiri = (fn) => { selesai = true; clearTimeout(cadangan); clearTimeout(habis); ac.abort(); fn(); };

    const jalankan = () => {
      if (selesai || berikut >= model.length) return false;
      const m = model[berikut++];
      berjalan++;
      cobaModel(m, ctx).then((h) => {
        berjalan--;
        if (selesai) return;
        if (h.ok) return akhiri(() => resolve(h.nilai));
        terakhir = h;
        if (h.status === 403) return akhiri(() => reject(galatDari(h))); // kunci salah: model lain sama saja
        console.warn('[gemini] pindah dari', m, 'karena', h.status);
        if (!jalankan() && !berjalan) {
          console.error('[gemini] gagal:', h.status, h.pesan?.slice(0, 400));
          akhiri(() => reject(galatDari(terakhir)));
        }
      });
      return true;
    };

    jalankan();
    const cadangan = setTimeout(jalankan, tundaCadangan);
    const habis = setTimeout(() => {
      console.error('[gemini] terlalu lama:', Date.now() - mulai, 'ms');
      akhiri(() => reject(new GalatUrai('Gemini terlalu lama menjawab. Coba ucapkan lagi.', 504)));
    }, batasWaktu);
  });
}

/** Kalimat guru (teks) → JSON adegan. */
export async function uraiGemini(kalimat, konteks, opsi = {}) {
  const contents = [];
  for (const [k, kal, jawab] of CONTOH) {
    contents.push({ role: 'user', parts: [{ text: `Adegan saat ini: ${k}\nKalimat: ${kal}` }] });
    contents.push({ role: 'model', parts: [{ text: jawab }] });
  }
  contents.push({ role: 'user', parts: [{ text: `Adegan saat ini: ${konteks}\nKalimat: ${kalimat}` }] });
  return panggilGemini({
    sistem: SISTEM, contents, skema: SKEMA, idSkema: 'adegan',
    olah: (mentah) => ({ hasil: rapikan(mentah, kalimat, konteks) }),
    ...opsi,
  });
}

export function _setelUlangUntukTes() { daftarModel = null; varianBerhasil.clear(); }
