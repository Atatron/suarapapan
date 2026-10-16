// Transkripsi ucapan guru dengan Gemini (audio → teks Bahasa Indonesia).
//
// Kenapa bukan hanya Web Speech API milik Chrome: ia tidak bisa diberi tahu kata
// apa yang akan diucapkan ("gurita", "kuda nil", "kerbau" sering salah), tidak
// jalan di browser selain Chrome, dan tidak tahu konteks adegan. Di sini model
// menerima daftar kosakata papan + adegan saat ini sebagai petunjuk ejaan.
import { katalogAset, katalogLatar } from '../src/scene/katalog.js';
import { panggilGemini, GalatUrai, SKEMA, SISTEM, CONTOH, olahAdeganModel } from './_urai.js';
import { deteksiUcapan, wavKePcm } from '../src/lib/wav.js';

// ada_ucapan ditulis lebih dulu: model memutuskan apakah ada ucapan manusia
// sebelum menulis apa pun, supaya derau tidak dikarang menjadi kalimat.
export const SKEMA_SUARA = {
  type: 'OBJECT',
  properties: { ada_ucapan: { type: 'BOOLEAN' }, transkrip: { type: 'STRING' } },
  required: ['ada_ucapan', 'transkrip'],
  propertyOrdering: ['ada_ucapan', 'transkrip'],
};

// Satu panggilan: transkripsi + urai adegan kalimat pertama. Menghemat satu
// perjalanan ke Gemini (±2–4 detik dan separuh kuota gratis) pada kasus umum
// guru mengucapkan satu kalimat.
export const SKEMA_GABUNGAN = {
  type: 'OBJECT',
  properties: { ada_ucapan: { type: 'BOOLEAN' }, transkrip: { type: 'STRING' }, ...SKEMA.properties },
  required: ['ada_ucapan', 'transkrip', ...SKEMA.required],
  propertyOrdering: ['ada_ucapan', 'transkrip', ...SKEMA.propertyOrdering],
};

const KATA_KERJA = [
  'tambah', 'kurang', 'kali', 'dikali', 'dikalikan', 'dibagi', 'kelompok', 'masing-masing', 'sisa', 'perkalian', 'pembagian',
  'berlari', 'melompat', 'terbang', 'berenang', 'jatuh', 'pergi', 'datang', 'bertambah', 'dimakan', 'meletus',
  'diambil', 'dibagi', 'dipotong', 'sama besar', 'potong', 'lagi', 'tersisa', 'tinggal', 'semuanya', 'berapa',
  'di atas', 'di bawah', 'di samping', 'di depan', 'di belakang', 'di dalam',
];
const ANGKA = ['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas', 'dua belas', 'lima belas', 'dua puluh'];

/** Kata yang mungkin diucapkan guru: nama benda, tempat, kata kerja, bilangan. */
export function kosakata() {
  const kata = [
    ...[...katalogAset, ...katalogLatar].flatMap((a) => a.aliases.map((s) => s.replace(/-/g, ' '))),
    ...KATA_KERJA, ...ANGKA,
  ];
  return [...new Set(kata)];
}

export function sistemSuara() {
  return `Kamu juru tulis untuk kelas SD di Indonesia. Kamu menerima rekaman suara seorang guru yang berbicara
dalam Bahasa Indonesia kepada siswa kelas 1–3 sambil mengajar matematika, lalu menuliskan apa yang diucapkan.

Aturan:
- Tulis PERSIS yang diucapkan, tanpa menambah, meringkas, menerjemahkan, atau menjawab pertanyaannya.
- Bilangan ditulis dengan huruf ("tiga kelinci", bukan "3 kelinci").
- Gunakan huruf kapital dan tanda baca biasa; pisahkan kalimat dengan titik atau tanda tanya.
- Abaikan batuk, ketukan, desahan, suara kelas, dan suara siswa yang jauh. Hanya tulis suara guru.
- ada_ucapan = true jika terdengar orang berbicara, walaupun pelan, cepat, atau ada derau kelas di latar.
  ada_ucapan = false hanya jika sama sekali tidak ada orang berbicara (hanya hening, dengung, atau derau); transkrip
  harus kosong. Jangan mengarang kalimat dari konteks adegan atau daftar kata untuk mengisi kekosongan.
- Jika ada kata yang bunyinya mirip kata dalam daftar di bawah, pilih ejaan dari daftar. Daftar ini hanya
  untuk ejaan: jangan menuliskan kata dari daftar kalau tidak diucapkan.

Daftar kata yang sering muncul: ${kosakata().join(', ')}.`;
}

/** Prompt gabungan: aturan transkripsi + aturan urai adegan + contoh. */
export function sistemGabungan() {
  const contoh = CONTOH.map(([k, kal, jawab]) => `Adegan: ${k} | Kalimat: ${kal} → ${jawab}`).join('\n');
  return `${sistemSuara()}

SETELAH menulis transkrip, urai KALIMAT PERTAMA di transkrip menjadi adegan di field lain. Jika tidak ada ucapan,
kosongkan entitas dan peristiwa dan isi konsep "tidak_ada".

${SISTEM}

Contoh urai (Adegan saat ini | Kalimat → JSON adegan):
${contoh}`;
}

export const BATAS_BASE64 = 3_400_000; // ≈ 2,5 MB audio; batas badan permintaan Vercel 4,5 MB

/** Teks hasil model → teks bersih satu baris, maksimal 600 karakter. */
// Huruf tunggal liar dari pengenal suara ("ditambah y tiga kucing") dibuang; a/b/c/d/x tetap (pilihan jawaban, perkalian).
const HURUF_SAH = new Set(['a', 'b', 'c', 'd', 'x']);
const buangHurufLepas = (t) => t
  .replace(/(^|[\s(])([A-Za-z])(?=$|[\s.,!?;:)])/g, (m, depan, huruf) => (HURUF_SAH.has(huruf.toLowerCase()) ? m : depan))
  .replace(/\s+([.,!?;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();

export function bersihkanTranskrip(t) {
  const rapi = String(t || '').replace(/\s+/g, ' ').trim().replace(/^["“”']+|["“”']+$/g, '').trim().slice(0, 600);
  return buangHurufLepas(rapi);
}

/** "Ada tiga kelinci. Lalu dua pergi?" → ["Ada tiga kelinci.", "Lalu dua pergi?"] */
export function pecahKalimat(teks) {
  return String(teks || '').split(/(?<=[.!?])\s+/).map((k) => k.trim()).filter((k) => /\p{L}/u.test(k));
}

export async function transkripsiGemini({ audio, mime = 'audio/wav', konteks = 'kosong', urai = false }, opsi = {}) {
  if (typeof audio !== 'string' || !audio) throw new GalatUrai('Rekaman kosong.', 400);
  if (audio.length > BATAS_BASE64) throw new GalatUrai('Rekaman terlalu panjang. Ucapkan lebih singkat.', 413);
  // Tolak input yang tidak bisa diperiksa; format lain tidak boleh melewati VAD.
  if (!['audio/wav', 'audio/x-wav'].includes(mime) || audio.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(audio)) {
    throw new GalatUrai('Format rekaman tidak valid. Gunakan WAV PCM mono 16-bit.', 400);
  }
  const w = wavKePcm(Buffer.from(audio, 'base64'));
  if (!w) throw new GalatUrai('Format rekaman WAV tidak valid atau terpotong.', 400);
  if (w.pcm.length > w.laju * 30) throw new GalatUrai('Rekaman terlalu panjang. Maksimal 30 detik.', 413);
  if (!(await deteksiUcapan(w.pcm, { laju: w.laju, minimum: 0.01 })).ada) {
    return { transkrip: '', kalimat: [], tanpaUcapan: true, sumber: 'vad', ms: 0 };
  }
  const contents = [{
    role: 'user',
    parts: [
      { text: `Konteks (bukan ucapan, jangan ditulis): adegan di papan saat ini = ${String(konteks).slice(0, 300)}.\nTuliskan ucapan guru dalam rekaman ini.` },
      { inlineData: { mimeType: mime, data: audio } },
    ],
  }];
  return panggilGemini({
    sistem: urai ? sistemGabungan() : sistemSuara(),
    contents,
    skema: urai ? SKEMA_GABUNGAN : SKEMA_SUARA,
    idSkema: urai ? 'suara+adegan' : 'suara',
    olah: (mentah) => {
      const transkrip = mentah?.ada_ucapan === false ? '' : bersihkanTranskrip(mentah?.transkrip);
      const kalimat = pecahKalimat(transkrip);
      const hasil = { transkrip, kalimat };
      // Hanya satu kalimat: pada ucapan beberapa kalimat, model kadang mengurai kalimat
      // yang salah (terukur dalam uji). Kalimat-kalimat itu diurai satu per satu oleh klien.
      if (urai && kalimat.length === 1) {
        const { transkrip: _t, ada_ucapan: _a, ...adegan } = mentah;
        hasil.hasil = olahAdeganModel(adegan, kalimat[0], String(konteks));
      }
      return hasil;
    },
    ...opsi,
  });
}
