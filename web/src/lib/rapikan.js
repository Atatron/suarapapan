// Perapian hasil parser (Gemini atau aturan lokal) menjadi JSON adegan yang aman.
// Dipakai server (api/_urai.js) dan browser (src/lib/lokal.js), jadi tidak boleh bergantung pada Node.
// Pengaman jalur Python ada di ml/validasi.py; keduanya memakai katalog yang sama.
import { idAset } from '../scene/katalog.js';
import { landaskanAdegan } from './landasan.js';

export const AKSI = ['diam', 'lari', 'lompat', 'terbang', 'berenang', 'jatuh'];
export const KONSEP = ['membilang', 'penjumlahan', 'pengurangan', 'pecahan', 'posisi', 'tidak_ada'];
export const TIPE_PERISTIWA = ['hapus', 'tambah', 'bagi', 'ambil', 'pindah', 'ubah_aksi'];
export const TANYA_JENIS = ['tidak_ada', 'benda', 'total', 'selisih', 'terbanyak', 'tersedikit'];

export const kosong = { entitas: [], latar: '', konsep: 'tidak_ada', peristiwa: [], pertanyaan: '', tanya_benda: '', tanya_jenis: 'tidak_ada', gabung: false };

// ---------- perapian (salinan ml/serve.py + ml/bahasa.py) ----------

// Kata tempat: "di dalam laut" menyebut tempat, bukan letak relatif terhadap sebuah benda.
const TEMPAT_BUKAN_ACUAN = new Set(['laut', 'sungai', 'kolam', 'danau', 'hutan', 'kelas', 'rumput', 'kebun', 'sawah', 'pantai',
  'gunung', 'langit', 'taman', 'kota', 'pasar', 'dapur', 'kamar', 'sekolah', 'peternakan', 'desa', 'gurun', 'salju', 'udara', 'air']);
// Kata yang berarti "masukkan ke adegan yang ada", bukan "mulai adegan baru".
const KATA_GABUNG = /\b(datang|muncul|juga|bersama|ikut|menyusul|bergabung|masuk|tambahkan|menambahkan|masukkan|memasukkan|ditambahkan|ditambah|menambah|bertambah|tambah|plus)\b/i;
const KATA_BERHENTI = /\b(berhenti|diam|tidak bergerak|tak bergerak|istirahat|tidur|duduk)\b/i;
const KATA_TAMBAH_EKSPLISIT = /\b(lagi|tambahan|lainnya|lain)\b/i;
const KATA_DUA_PERISTIWA = /\b(lagi|lalu|kemudian|setelah itu|serta)\b/i;
export const KATA_ULANG_TETAP = new Set(['kupu-kupu', 'kura-kura', 'laba-laba', 'biri-biri', 'undur-undur', 'ubur-ubur', 'lumba-lumba', 'laki-laki', 'cumi-cumi', 'layang-layang']);
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
  t = m && !KATA_ULANG_TETAP.has(t) ? m[1] : t;
  // Retain the teacher's generic human labels; specific sprites and synonyms
  // share a stable identity so "macan" then "harimau" edits the same group.
  return ['orang', 'manusia', 'seseorang', 'teman', 'anak', 'murid', 'siswa', 'adik', 'kakak', 'laki-laki'].includes(t) ? t : idAset(t) || t;
}

// Hanya terima satu emoji pendek, bukan teks bebas dari model.
export function emojiSah(e) {
  const t = String(e || '').trim();
  // \p{N} juga cocok dengan keycap (1️⃣), jadi hanya huruf yang ditolak.
  return t && t.length <= 16 && /\p{Extended_Pictographic}/u.test(t) && !/\p{L}/u.test(t) ? t : '';
}

const batasi = (n, min, max) => Math.max(min, Math.min(Math.round(Number(n) || 0), max));
const tokenisasi = (teks) => teks.toLowerCase().match(/\w+(?:-\w+)*/g) || [];

export class GalatFormatAdegan extends Error {
  constructor() {
    super('Format jawaban adegan tidak valid. Coba kalimat yang lebih sederhana.');
    this.name = 'GalatFormatAdegan';
    this.code = 'INVALID_SCENE';
  }
}

// The provider's JSON-only mode is not a schema validator. Validate container and
// scalar types before mapping, coercion or clamping; optional legacy fields keep
// their defaults, but malformed arrays/records are never treated as a scene.
export function validasiAdegan(h) {
  const record = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  const scalar = (x, k, tipe) => x[k] === undefined || (typeof x[k] === tipe && (tipe !== 'number' || Number.isFinite(x[k]) && Number.isInteger(x[k])));
  if (!record(h)) throw new GalatFormatAdegan();
  for (const k of ['entitas', 'peristiwa']) {
    if (h[k] === undefined) continue;
    if (!Array.isArray(h[k]) || h[k].length > 200) throw new GalatFormatAdegan();
    for (const x of h[k]) {
      const teks = k === 'entitas' ? ['jenis', 'aksi', 'posisi', 'emoji', 'emoji_acuan'] : ['tipe', 'target', 'posisi', 'aksi', 'aksi_awal'];
      if (!record(x) || teks.some((nama) => !scalar(x, nama, 'string'))
        || !scalar(x, 'jumlah', 'number') || k === 'entitas' && !scalar(x, 'bagi', 'number')) throw new GalatFormatAdegan();
    }
  }
  for (const k of ['latar', 'konsep', 'pertanyaan', 'tanya_benda', 'tanya_jenis']) if (!scalar(h, k, 'string')) throw new GalatFormatAdegan();
  if (!scalar(h, 'gabung', 'boolean')) throw new GalatFormatAdegan();
  return h;
}

/** Unsupported scope must be reviewed, never silently converted into a positive command. */
export function alasanTinjau(kalimat) {
  const teks = String(kalimat || '');
  if (/\b(jangan|tidak|tak|bukan|belum|tanpa)\b/i.test(teks)) return { code: 'NEGATION_SCOPE', message: 'Kalimat memuat penyangkalan. Tulis ulang perubahan yang ingin ditampilkan.' };
  if (/\b(jika|kalau|andaikan|seandainya|misalnya|apabila)\b/i.test(teks)) return { code: 'CONDITIONAL_COMMAND', message: 'Kalimat bersyarat perlu diperjelas sebelum mengubah papan.' };
  if (/["“”‘’]|'[^']+'/.test(teks)) return { code: 'QUOTED_COMMAND', message: 'Kalimat kutipan perlu diperjelas sebelum mengubah papan.' };
  return null;
}

export function rapikan(h, kalimat, konteks = '') {
  validasiAdegan(h);
  const tinjau = alasanTinjau(kalimat);
  if (tinjau) return { ...kosong, entitas: [], peristiwa: [], needsConfirmation: true, notice: { ...tinjau, unresolvedSpans: [String(kalimat)] } };
  const hasil = { ...kosong, ...h };
  const penyesuaian = [];
  const labelKonteks = String(konteks).split(/,\s*(?![^()]*\))/)
    .map((s) => s.match(/^\s*(.+?)\s*:\s*\d+/)?.[1]?.trim()).filter(Boolean);
  const identitas = (s) => idAset(s) || s;
  const targetKonteks = (s) => {
    const nama = normalkanJenis(s);
    if (labelKonteks.includes(nama)) return nama;
    const cocok = labelKonteks.filter((label) => identitas(label) === identitas(nama));
    return cocok.length === 1 ? cocok[0] : nama;
  };
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
    if (e.aksi && e.aksi !== aksi) penyesuaian.push({ field: 'aksi', target: jenis, requested: e.aksi, applied: aksi });
    const bagi = batasi(e.bagi, 0, 12);
    const jumlah = batasi(e.jumlah, 1, 20);
    if (e.jumlah !== undefined && e.jumlah !== jumlah) penyesuaian.push({ field: 'jumlah', target: jenis, requested: e.jumlah, applied: jumlah });
    if (e.bagi !== undefined && e.bagi !== bagi) penyesuaian.push({ field: 'bagi', target: jenis, requested: e.bagi, applied: bagi });
    if (!jenis) penyesuaian.push({ field: 'entitas', target: '', requested: 'tanpa nama benda', applied: 'diabaikan' });
    return {
      jenis, jumlah, aksi, posisi, bagi: bagi >= 2 ? bagi : 0,
      emoji: emojiSah(e.emoji), emoji_acuan: posisi ? emojiSah(e.emoji_acuan) : '',
    };
  }).filter((e) => e.jenis);

  hasil.peristiwa = (hasil.peristiwa || [])
    .filter((p) => {
      if (TIPE_PERISTIWA.includes(p.tipe)) return true;
      penyesuaian.push({ field: 'peristiwa', target: normalkanJenis(p.target), requested: p.tipe || 'tanpa operasi', applied: 'diabaikan' });
      return false;
    })
    .map((p) => {
      const gerak = p.tipe === 'pindah' || p.tipe === 'ubah_aksi'; // jumlah 0 = semuanya
      const jumlah = batasi(p.jumlah, gerak ? 0 : 1, p.tipe === 'bagi' ? 12 : 20);
      if (p.jumlah !== undefined && p.jumlah !== jumlah) penyesuaian.push({ field: 'jumlah', target: normalkanJenis(p.target), requested: p.jumlah, applied: jumlah });
      if (!normalkanJenis(p.target)) penyesuaian.push({ field: 'peristiwa', target: '', requested: 'tanpa target', applied: 'diabaikan' });
      const lagi = {
        tipe: p.tipe,
        target: targetKonteks(p.target),
        jumlah,
        posisi: p.tipe === 'pindah' ? String(p.posisi || '').trim().toLowerCase() : '',
      };
      if (p.tipe === 'ubah_aksi') {
        // Gerakan di luar daftar menjadi "diam"; "menari" tidak boleh lolos sebagai aksi yang tidak bisa digambar.
        lagi.aksi = AKSI.includes(p.aksi) && (p.aksi === 'diam' || [...kata].some((k) => AKSI_KE_ENUM[k] === p.aksi)) ? p.aksi : 'diam';
        // The utterance must identify an old action used to select a subgroup.
        lagi.aksi_awal = AKSI.includes(p.aksi_awal) && (p.aksi_awal === 'diam' || [...kata].some((k) => AKSI_KE_ENUM[k] === p.aksi_awal)) ? p.aksi_awal : '';
        if (p.aksi && p.aksi !== lagi.aksi) penyesuaian.push({ field: 'aksi', target: lagi.target, requested: p.aksi, applied: lagi.aksi });
        if (p.aksi_awal && p.aksi_awal !== lagi.aksi_awal) penyesuaian.push({ field: 'aksi_awal', target: lagi.target, requested: p.aksi_awal, applied: lagi.aksi_awal });
      }
      return lagi;
    })
    .filter((p) => p.target);

  // "Tiga kelinci yang berlari sekarang berhenti": model kadang memakai "pindah" tanpa letak yang berarti.
  // Itu perubahan gerakan, bukan letak: ubah menjadi ubah_aksi dan hindari "Letak baru tidak jelas".
  hasil.peristiwa = hasil.peristiwa.map((p) => {
    const letakSah = /^(?:di|ke)\s+(atas|bawah|samping|sebelah|depan|belakang|dalam)\s+\S+/.test(p.posisi);
    if (p.tipe !== 'pindah' || letakSah) return p;
    if ((p.posisi === '' || AKSI_KE_ENUM[p.posisi] || p.posisi === 'diam') && KATA_BERHENTI.test(String(kalimat))) {
      return { tipe: 'ubah_aksi', target: p.target, jumlah: p.jumlah, posisi: '', aksi: AKSI_KE_ENUM[p.posisi] || 'diam', aksi_awal: '' };
    }
    return p;
  });

  // Benda yang berubah sering ikut ditulis di "entitas" ("satu kelinci lagi datang").
  // Itu bukan benda baru jika benda itu memang sudah ada di papan. Jika belum ada
  // ("Ibu membeli lima apel, lalu memberi dua apel lagi"), entitas harus dipertahankan.
  const adaDiPapan = new Set(labelKonteks.map(identitas));
  const target = new Set(hasil.peristiwa.map((p) => identitas(p.target)));
  hasil.entitas = hasil.entitas.filter((e) => !(target.has(identitas(e.jenis)) && adaDiPapan.has(identitas(e.jenis))));

  // Model kadang melaporkan satu kejadian dua kali: "kelinci yang datang sebanyak 3" menjadi
  // entitas kelinci 3 DAN tambah kelinci 3 (hasilnya 6). Jika bendanya belum ada di papan dan
  // jumlahnya sama, itu satu kejadian, kecuali kalimat jelas memuat dua peristiwa ("lalu", "lagi").
  if (!KATA_DUA_PERISTIWA.test(String(kalimat))) {
    hasil.peristiwa = hasil.peristiwa.filter((p) => !(p.tipe === 'tambah' && !adaDiPapan.has(identitas(p.target))
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
  if (penyesuaian.length) {
    hasil.needsConfirmation = true;
    const dibatasi = penyesuaian.some((p) => p.field === 'jumlah' || p.field === 'bagi');
    hasil.notice = {
      code: dibatasi ? 'LIMITED_QUANTITY' : 'UNSUPPORTED_OPERATION',
      message: penyesuaian.map((p) => `${p.target || 'Benda/operasi'}: ${p.requested} → ${p.applied}`).join('; ') + '. Periksa pratinjau atau perbaiki kalimat sebelum menampilkan.',
      unresolvedSpans: [], adjustments: penyesuaian,
    };
  }
  return landaskanAdegan(hasil, kalimat, konteks);
}
