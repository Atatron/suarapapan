// Perapian hasil parser (Gemini atau aturan lokal) menjadi JSON adegan yang aman.
// Dipakai server (api/_urai.js) dan browser (src/lib/lokal.js), jadi tidak boleh bergantung pada Node.
// Salinan rapikan() di ml/serve.py; ubah keduanya bersama-sama.

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
    .map((p) => {
      const gerak = p.tipe === 'pindah' || p.tipe === 'ubah_aksi'; // jumlah 0 = semuanya
      const lagi = {
        tipe: p.tipe,
        target: normalkanJenis(p.target),
        jumlah: batasi(p.jumlah, gerak ? 0 : 1, 20),
        posisi: p.tipe === 'pindah' ? String(p.posisi || '').trim().toLowerCase() : '',
      };
      if (p.tipe === 'ubah_aksi') {
        // Gerakan di luar daftar menjadi "diam"; "menari" tidak boleh lolos sebagai aksi yang tidak bisa digambar.
        lagi.aksi = AKSI.includes(p.aksi) ? p.aksi : 'diam';
        lagi.aksi_awal = AKSI.includes(p.aksi_awal) ? p.aksi_awal : '';
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

