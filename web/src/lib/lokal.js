// Penguraian kalimat guru tanpa jaringan (aturan bahasa), untuk dua keperluan:
//  1. Cadangan: kuota gratis Gemini hanya ±20 permintaan per hari per model, dan layanan
//     kadang 503. Tanpa cadangan ini, demo berhenti begitu kuota habis.
//  2. Jalur cepat: kalimat pola sederhana ("ada tiga kelinci", "dua kelinci pergi") selesai
//     dalam milidetik dan tidak memakai kuota.
// Hanya benda yang ada di pustaka gambar yang dikenali; kata lain → null (diserahkan ke Gemini).
// Keluarannya dirapikan oleh rapikan() yang sama dengan jalur Gemini, jadi bentuk JSON-nya identik.
import { rapikan, kosong, alasanTinjau, normalkanJenis } from './rapikan.js';
import { _untukTes as P, cariTempat } from '../scene/pustaka.js';
import { idAset, aliasAset } from '../scene/katalog.js';

const SATUAN = { nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };
const KHUSUS = { sepuluh: 10, sebelas: 11, seratus: 100 };
const SE = new Set(['seekor', 'sebuah', 'sebiji', 'sebutir', 'sepotong', 'sebatang', 'setangkai', 'selembar', 'seorang', 'sehelai']);
const KLASIFIKATOR = new Set(['ekor', 'buah', 'biji', 'butir', 'batang', 'tangkai', 'lembar', 'orang', 'helai']);

const PASTI_HAPUS = new Set(['pergi', 'hilang', 'habis', 'pulang', 'meletus', 'pecah', 'keluar', 'kabur', 'lenyap']);
const HAPUS = new Set([...PASTI_HAPUS, 'dimakan', 'makan', 'memakan', 'diambil', 'mengambil', 'ambil', 'dibuang', 'dijual', 'menjual', 'dipetik',
  'memetik', 'diminum', 'minum', 'dihabiskan', 'menghabiskan', 'dikurangi', 'dikurangkan', 'mengurangi', 'dipakai', 'hapus', 'hapuskan',
  'dihapus', 'menghapus', 'kurangi', 'hilangkan', 'menghilangkan', 'buang', 'membuang', 'meminjam', 'dipinjam', 'dipinjamkan', 'meninggalkan',
  'ditinggalkan', 'diambilkan', 'mengambilkan', 'mengeluarkan', 'dikeluarkan', 'keluarkan']);
const TAMBAH = new Set(['datang', 'lagi', 'memberi', 'diberi', 'memberikan', 'membeli', 'dibeli', 'bertambah', 'menyusul', 'bergabung', 'muncul',
  'tambah', 'ditambah', 'menambah', 'menambahkan', 'ditambahkan', 'tambahkan', 'tambahan', 'kemari', 'masukkan', 'memasukkan', 'dimasukkan',
  'letakkan', 'meletakkan', 'diletakkan', 'tempatkan', 'munculkan', 'tiba', 'dikasih', 'kasih', 'menaruh', 'lahir', 'ikut', 'juga', 'plus']);
const BAGI = new Set(['bagi', 'dibagi', 'membagi', 'potong', 'dipotong', 'memotong', 'belah', 'dibelah', 'membelah']);
const PINDAH = new Set(['pindah', 'dipindah', 'dipindahkan', 'pindahkan', 'berpindah', 'naik', 'turun', 'bergeser', 'geser', 'digeser']);
const AKSI = {
  berlari: 'lari', lari: 'lari', berlarian: 'lari', berkejaran: 'lari', berjalan: 'lari',
  melompat: 'lompat', lompat: 'lompat', meloncat: 'lompat', 'melompat-lompat': 'lompat',
  terbang: 'terbang', beterbangan: 'terbang', melayang: 'terbang', berenang: 'berenang', jatuh: 'jatuh', berjatuhan: 'jatuh',
};
const REL = new Set(['atas', 'bawah', 'samping', 'sebelah', 'depan', 'belakang', 'dalam']);
// Sapaan: "anak-anak", "ibu" tanpa angka adalah menyapa, bukan benda di papan.
const SAPAAN = new Set(['anak', 'anak-anak', 'ibu', 'bapak', 'guru', 'adik', 'kakak', 'teman', 'teman-teman', 'murid', 'siswa', 'bu', 'pak']);

const adaBenda = (k) => Object.hasOwn(P.OBJ, k)
  || (Object.hasOwn(P.ALIAS_OBJ, k) && Object.hasOwn(P.OBJ, P.ALIAS_OBJ[k]));
const MAKS_KATA_BENDA = Math.max(...[...Object.keys(P.OBJ), ...Object.keys(P.ALIAS_OBJ)].map((k) => k.split('-').length));
const token = (teks) => String(teks || '').toLowerCase().match(/\d+|[a-z]+(?:-[a-z]+)*/g) || [];

/** Satu kata → benda di pustaka ("kucingnya" → "kucing", "kelinci-kelinci" → "kelinci"), atau null. */
function bendaTunggal(t) {
  if (!t) return null;
  const ulang = t.match(/^([a-z]+)-\1$/);
  const dasar = ulang && !['kupu-kupu', 'kura-kura', 'laba-laba', 'biri-biri', 'lumba-lumba', 'ubur-ubur', 'laki-laki'].includes(t) ? ulang[1] : t;
  if (adaBenda(dasar)) return normalkanJenis(dasar);
  const tanpaNya = dasar.replace(/nya$/, '');
  return tanpaNya !== dasar && adaBenda(tanpaNya) ? normalkanJenis(tanpaNya) : null;
}
/** Frasa benda terpanjang lebih dulu, termasuk "anak menggunakan kursi roda". */
function bendaDi(t, i) {
  if (i >= t.length) return null;
  for (let n = Math.min(MAKS_KATA_BENDA, t.length - i); n >= 2; n--) {
    const jenis = t.slice(i, i + n).join('-');
    if (adaBenda(jenis)) return { jenis: normalkanJenis(jenis), panjang: n };
  }
  const b = bendaTunggal(t[i]);
  return b ? { jenis: b, panjang: 1 } : null;
}

/** Membaca bilangan di posisi i: ["dua","puluh","tujuh"] → 27. → { n, akhir } atau null. */
function bacaAngka(t, i) {
  let total = 0, sekarang = 0, j = i, terakhirSatuan = false;
  for (; j < t.length; j++) {
    const k = t[j];
    if (/^\d+$/.test(k)) { if (j > i) break; sekarang += Number(k); terakhirSatuan = false; }
    else if (Object.hasOwn(SATUAN, k)) { if (terakhirSatuan) break; sekarang += SATUAN[k]; terakhirSatuan = true; }
    else if (Object.hasOwn(KHUSUS, k)) { sekarang += KHUSUS[k]; terakhirSatuan = false; }
    else if (SE.has(k)) { if (j > i) break; sekarang += 1; terakhirSatuan = false; }
    else if (k === 'belas' && j > i) { sekarang = (sekarang || 1) + 10; terakhirSatuan = false; }
    else if (k === 'puluh' && j > i) { sekarang = (sekarang || 1) * 10; terakhirSatuan = false; }
    else if (k === 'ratus' && j > i) { sekarang = (sekarang || 1) * 100; terakhirSatuan = false; }
    else break;
  }
  total += sekarang;
  return j > i && total > 0 ? { n: total, akhir: j } : null;
}

/** "kelinci: 5 (2 berlari dan 3 melompat), harimau: 2" atau "kelinci 3" → [{ jenis, n, bagi }] */
export function bacaKonteks(konteks) {
  const papan = [];
  const teks = String(konteks || '');
  if (!teks || teks.trim() === 'kosong') return papan;
  for (const bagian of teks.split(/,\s*(?![^()]*\))/)) {
    const m = bagian.trim().match(/^([^:(]+?)\s*:?\s*(\d+)\s*(?:\((.*)\))?$/);
    if (m) papan.push({ jenis: m[1].trim().toLowerCase(), n: Number(m[2]), bagi: /dibagi/.test(m[3] || '') });
  }
  return papan;
}

/** Kelompok "<angka> [penggolong] <benda>" dan "<angka> dari <angka> <benda>". */
function cariKelompok(t) {
  const hasil = [];
  for (let i = 0; i < t.length;) {
    const a = bacaAngka(t, i);
    if (!a) { i++; continue; }
    let j = a.akhir;
    let n = a.n;
    if (t[j] === 'dari') { // "dua dari lima kelinci": yang berubah dua, jumlah semula lima
      const b = bacaAngka(t, j + 1);
      if (b) j = b.akhir; else { i = j; continue; }
    }
    let potong = false;
    const awalBenda = j;
    while (j < t.length && (KLASIFIKATOR.has(t[j]) || t[j] === 'potong')) { if (t[j] === 'potong') potong = true; j++; }
    let b = bendaDi(t, j);
    // "dua orang guru" memakai orang sebagai penggolong; "dua orang di samping
    // meja" memakai orang sebagai subjek. "seorang" sendiri juga berarti manusia.
    if (!b && t[awalBenda] === 'orang') { j = awalBenda; b = bendaDi(t, j); }
    if (!b && t[a.akhir - 1] === 'seorang') b = { jenis: 'orang', panjang: 0 };
    if (b) hasil.push({ n, jenis: b.jenis, mulai: i, akhir: j + b.panjang });
    else if (potong) hasil.push({ n, jenis: null, potong: true, mulai: i, akhir: j }); // "makan satu potong"
    else hasil.push({ n, jenis: null, mulai: i, akhir: j, tanpaBenda: true });
    i = Math.max(j + (b ? b.panjang : 0), i + 1);
  }
  return hasil;
}

const caritempat = (t) => {
  const max = Math.max(...Object.keys({ ...aliasAset('tempat'), ...aliasAset('latar') }).map((s) => s.split('-').length));
  for (let i = 0; i < t.length; i++) {
    if (!['di', 'ke', 'dari', 'dalam', 'sekitar'].includes(t[i - 1] ?? '')) continue;
    for (let n = Math.min(max, t.length - i); n >= 2; n--) {
      const tempat = idAset(t.slice(i, i + n).join(' '), 'tempat') || idAset(t.slice(i, i + n).join(' '), 'latar');
      if (tempat) return tempat;
    }
    if (REL.has(t[i]) && t[i] !== 'dalam') continue;
    const satu = cariTempat(t[i]);
    if (satu && !bendaDi(t, i)?.jenis?.startsWith('meja')) return satu;
    const latar = idAset(t[i], 'latar');
    if (latar) return t[i];
  }
  return '';
};

/** "di bawah meja" / "ke atas meja" → "di bawah meja" (acuan harus benda di pustaka), atau "". */
function cariPosisi(t, dari = 0, sampai = t.length) {
  for (let i = dari; i < sampai - 2; i++) {
    if ((t[i] === 'di' || t[i] === 'ke') && REL.has(t[i + 1])) {
      const acuan = bendaDi(t, i + 2);
      if (acuan) return { teks: `di ${t[i + 1] === 'sebelah' ? 'samping' : t[i + 1]} ${acuan.jenis}`, akhir: i + 2 + acuan.panjang };
    }
  }
  return null;
}

function cariAksi(t, dari, sampai) {
  for (let i = dari; i < sampai; i++) if (Object.hasOwn(AKSI, t[i])) return AKSI[t[i]];
  return 'diam';
}

const huruf = (s) => s.trim().replace(/^\p{L}/u, (c) => c.toUpperCase());

/** Pertanyaan berhitung. → { pertanyaan, jenis, benda } atau null. */
function cariTanya(kalimat, t, papan, kelompok) {
  const teks = t.join(' ');
  const bertanya = /\bberapa\b/.test(teks) || /\bmana (yang )?(lebih|paling)\b/.test(teks) || /\b(selisih|lebihnya|bedanya|perbedaannya)\b/.test(teks);
  if (!bertanya) return null;
  const pertanyaan = huruf(kalimat.replace(/^[\s,.]*(nah|coba|ayo|sekarang|lalu|kemudian)[\s,]+/i, ''));
  let jenis;
  if (/\b(selisih|lebihnya|bedanya|perbedaannya|kurangnya)\b/.test(teks)) jenis = 'selisih';
  else if (/\b(lebih|paling|ter)\s*banyak|terbanyak\b/.test(teks)) jenis = 'terbanyak';
  else if (/\b(lebih|paling)\s*sedikit|tersedikit\b/.test(teks)) jenis = 'tersedikit';
  else if (/\b(semua|semuanya|seluruh|seluruhnya|total|keseluruhan|jumlahnya|jumlah)\b/.test(teks) && !/berapa\s+\w*\s*(ekor\s+)?\b[a-z-]+\b\s+(ada|sekarang)\b/.test('')) jenis = 'total';
  else jenis = 'benda';
  let benda = '';
  if (jenis === 'benda' || jenis === 'total') {
    for (let i = 0; i < t.length; i++) { const b = bendaDi(t, i); if (b && !SAPAAN.has(b.jenis) && !(kelompok.some((k) => k.jenis === b.jenis && !k.tanpaBenda) && false)) { benda = b.jenis; break; } }
    if (jenis === 'total' && benda && papan.length > 1 && !/\b(hewan|benda|karakter|semua)\b/.test(teks)) jenis = 'benda';
    if (jenis === 'benda' && !benda) benda = papan.length === 1 ? papan[0].jenis : '';
    if (jenis === 'benda' && !benda && papan.length > 1) jenis = 'total';
  }
  return { pertanyaan, jenis, benda: jenis === 'benda' ? benda : '' };
}

/**
 * Kalimat guru → JSON adegan (bentuk sama dengan jalur Gemini), atau null jika tidak dipahami.
 * yakin: 'tinggi' = pola sederhana yang terukur andal, aman dipakai tanpa Gemini;
 *        'rendah' = tebakan terbaik, dipakai hanya jika Gemini tidak bisa dihubungi.
 */
export function uraiLokal(kalimat, konteks = 'kosong') {
  const mulai = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const tinjau = alasanTinjau(kalimat);
  if (tinjau) return perluTinjau(mulai, { ...kosong, entitas: [], peristiwa: [] }, tinjau, [String(kalimat)]);
  // A repair restates the intended quantity; it is not a second addition. Only
  // a complete replacement clause is offered, and it still requires review.
  const koreksi = String(kalimat).match(/\b(?:eh\s+salah|ralat|maksudnya)\b[\s,:-]*(.+)$/i);
  if (koreksi) {
    const pengganti = uraiLokal(`Ada ${koreksi[1]}`, konteks);
    if (pengganti?.hasil.entitas.length === 1 && !pengganti.hasil.peristiwa.length) {
      return perluTinjau(mulai, pengganti.hasil, { code: 'SELF_CORRECTION', message: 'Koreksi ucapan terdeteksi. Periksa jumlah pengganti sebelum menampilkan.' }, []);
    }
    return perluTinjau(mulai, { ...kosong, entitas: [], peristiwa: [] }, { code: 'SELF_CORRECTION', message: 'Koreksi belum jelas. Tulis ulang jumlah akhir yang dimaksud.' }, [String(kalimat)]);
  }
  const t = token(kalimat);
  if (!t.length) return null;
  const papan = bacaKonteks(konteks);
  const adaDi = (j) => papan.find((x) => (idAset(x.jenis) || x.jenis) === (idAset(j) || j));
  const pernyataan = { entitas: [], peristiwa: [], latar: '', gabung: false, pertanyaan: '', tanya_benda: '', tanya_jenis: 'tidak_ada', konsep: 'tidak_ada' };
  const kelompok = cariKelompok(t);
  const kataKunci = (daftar) => t.some((k) => daftar.has(k));
  const pastiHapus = kataKunci(PASTI_HAPUS);
  const adaTambah = kataKunci(TAMBAH);
  const adaHapus = kataKunci(HAPUS);
  const bagiAda = kataKunci(BAGI);
  const adaPindah = kataKunci(PINDAH);
  let yakin = 'tinggi';
  let dipahami = false;

  // --- pecahan: "kita bagi empat sama besar" / "dibagi 4" ---
  const iBagi = t.findIndex((k) => BAGI.has(k));
  let bagiN = 0;
  if (iBagi >= 0) {
    const a = bacaAngka(t, iBagi + 1) || (t[iBagi + 1] && bacaAngka(t, iBagi + 2));
    if (a && a.n >= 2 && a.n <= 12) bagiN = a.n;
  }

  // --- kelompok berangka ---
  const dipakaiSebagaiBagi = new Set();
  if (bagiN) kelompok.forEach((k, idx) => { if (k.mulai > iBagi && k.n === bagiN) dipakaiSebagaiBagi.add(idx); });
  const bendaKelompok = kelompok.filter((k, idx) => k.jenis && !dipakaiSebagaiBagi.has(idx));
  const jumlahPeristiwa = new Map();
  const angkaPeristiwa = new Set();
  // "Tiga apel itu dimakan satu": tiga describes the existing set; satu is
  // the event operand. Do not subtract the reference count or create it twice.
  for (const [idx, k] of bendaKelompok.entries()) {
    const sampai = bendaKelompok[idx + 1]?.mulai ?? t.length;
    const iHapus = t.findIndex((kata, i) => i >= k.akhir && i < sampai && HAPUS.has(kata));
    const operand = kelompok.find((g) => !g.jenis && !g.potong && g.mulai > iHapus && g.mulai < sampai
      && (g.akhir >= sampai || ['lagi', 'saja', 'oleh', 'di', 'ke', 'dari', 'dan', 'lalu', 'kemudian'].includes(t[g.akhir])));
    if (adaDi(k.jenis) && iHapus >= 0 && operand) {
      jumlahPeristiwa.set(k, operand.n);
      angkaPeristiwa.add(operand);
    }
  }
  const takDipahami = kelompok.filter((k, idx) => !k.jenis && !k.potong && !angkaPeristiwa.has(k) && !dipakaiSebagaiBagi.has(idx) && !(bagiN && k.n === bagiN));
  // A known first subject must not make an unnumbered unknown second subject
  // disappear ("ada tiga kelinci dan unicorn"). Ambiguous continuations go to review.
  const sambunganTakDikenal = [];
  for (let i = 0; i < t.length - 1; i++) {
    if (!['dan', 'serta'].includes(t[i])) continue;
    let j = i + 1;
    if (['ada', 'terdapat'].includes(t[j])) j++;
    const k = t[j];
    if (!k || bacaAngka(t, j) || Object.hasOwn(AKSI, k) || HAPUS.has(k) || TAMBAH.has(k) || BAGI.has(k) || PINDAH.has(k)
      || ['yang', 'di', 'ke', 'dari', 'sama', 'berhenti', 'diam', 'duduk', 'tidur', 'berdiri', 'sekarang', 'kemudian', 'lalu', 'semuanya', 'jumlahnya'].includes(k)) continue;
    sambunganTakDikenal.push(t.slice(j, j + 4).join(' '));
  }
  const sisaTanpaBenda = takDipahami.length > 0;

  const tanya = cariTanya(kalimat, t, papan, kelompok);

  for (const [idx, k] of bendaKelompok.entries()) {
    dipahami = true;
    const ada = adaDi(k.jenis);
    const segmenAkhir = (bendaKelompok[idx + 1]?.mulai) ?? t.length;
    const pindahKe = adaPindah && ada ? cariPosisi(t, k.akhir, t.length) : null;
    if (ada && pindahKe) {
      pernyataan.peristiwa.push({ tipe: 'pindah', target: k.jenis, jumlah: k.n >= ada.n ? 0 : k.n, posisi: pindahKe.teks, aksi: '', aksi_awal: '' });
    } else if (ada && pastiHapus) {
      pernyataan.peristiwa.push({ tipe: 'hapus', target: k.jenis, jumlah: jumlahPeristiwa.get(k) ?? k.n, posisi: '', aksi: '', aksi_awal: '' });
    } else if (ada && bagiAda && bagiN && !ada.bagi) {
      pernyataan.peristiwa.push({ tipe: 'bagi', target: k.jenis, jumlah: bagiN, posisi: '', aksi: '', aksi_awal: '' });
    } else if (ada && !adaTambah && cariAksi(t, k.akhir, t.length) !== 'diam' && t.slice(k.akhir).includes('ke')) {
      // "dua kelinci lari ke hutan": bergerak menuju tempat lain = meninggalkan papan
      pernyataan.peristiwa.push({ tipe: 'hapus', target: k.jenis, jumlah: k.n, posisi: '', aksi: '', aksi_awal: '' });
    } else if (ada && adaTambah) {
      pernyataan.peristiwa.push({ tipe: 'tambah', target: k.jenis, jumlah: k.n, posisi: '', aksi: '', aksi_awal: '' });
    } else if (ada && adaHapus && !tanya) {
      const potongan = ada.bagi;
      pernyataan.peristiwa.push({ tipe: potongan ? 'ambil' : 'hapus', target: k.jenis, jumlah: jumlahPeristiwa.get(k) ?? k.n, posisi: '', aksi: '', aksi_awal: '' });
    } else if (!ada && papan.length === 0 && pastiHapus && !adaTambah) {
      yakin = 'rendah'; // "dua kelinci pergi" padahal papan kosong: ambigu
      pernyataan.entitas.push({ jenis: k.jenis, jumlah: k.n, aksi: 'diam', posisi: '', bagi: 0, emoji: '', emoji_acuan: '' });
    } else {
      const aksi = cariAksi(t, k.akhir, segmenAkhir);
      const posisi = cariPosisi(t, k.akhir, segmenAkhir)?.teks || '';
      const bagi = bagiAda && bagiN && !idx ? bagiN : 0;
      pernyataan.entitas.push({ jenis: k.jenis, jumlah: k.n, aksi: aksi === 'diam' && bendaKelompok.length === 1 ? cariAksi(t, 0, t.length) : aksi, posisi, bagi, emoji: '', emoji_acuan: '' });
      // Menyebut jenis yang sudah ada tanpa kata perubahan ("tiga balon terbang" saat 7 balon di papan) bisa berarti
      // adegan baru atau balon yang pergi: tidak cukup pasti untuk dijalankan tanpa Gemini.
      if (ada && !bagiAda && !tanya && !t.includes('ada') && !t.includes('terdapat')) yakin = 'rendah';
    }
  }

  // --- "makan satu potong" (pecahan), tanpa nama benda ---
  const potong = kelompok.find((k) => k.potong && !k.jenis);
  if (potong && !bendaKelompok.length) {
    const kue = papan.find((x) => x.bagi) || (papan.length === 1 ? papan[0] : null);
    if (kue) { dipahami = true; pernyataan.peristiwa.push({ tipe: 'ambil', target: kue.jenis, jumlah: potong.n, posisi: '', aksi: '', aksi_awal: '' }); }
  }
  // --- "dibagi empat" tanpa angka di depan bendanya ("pizza itu dibagi empat sama besar") ---
  if (!bendaKelompok.length && bagiN) {
    for (let i = 0; i < t.length; i++) {
      const b = bendaDi(t, i);
      const ada = b && adaDi(b.jenis);
      if (b && !SAPAAN.has(b.jenis)) {
        dipahami = true;
        if (ada) pernyataan.peristiwa.push({ tipe: 'bagi', target: b.jenis, jumlah: bagiN, posisi: '', aksi: '', aksi_awal: '' });
        else pernyataan.entitas.push({ jenis: b.jenis, jumlah: 1, aksi: 'diam', posisi: '', bagi: bagiN, emoji: '', emoji_acuan: '' });
        break;
      }
    }
  }

  // --- tanpa angka: benda tunggal ("kucing tidur di bawah meja"), pindah ("kucingnya naik ke atas meja"), berhenti ---
  if (!dipahami && !tanya) {
    const iCue = t.findIndex((k, i) => (t[i - 1] === 'ada' || t[i - 1] === 'terdapat') && bendaDi(t, i));
    for (let i = 0; i < t.length && !dipahami; i++) {
      const b = bendaDi(t, i);
      if (!b || SAPAAN.has(b.jenis) && i !== iCue) { if (b) i += b.panjang - 1; continue; }
      const sebelumnya = t[i - 1];
      if (['di', 'ke', 'dari', 'atas', 'bawah', 'samping', 'sebelah', 'depan', 'belakang', 'dalam'].includes(sebelumnya)) { i += b.panjang - 1; continue; }
      const ada = adaDi(b.jenis);
      const posisi = cariPosisi(t, i + b.panjang, t.length);
      if (ada && /\bberhenti\b|\btidak (berlari|bergerak|melompat)\b|\bdiam\b/.test(t.join(' '))) {
        dipahami = true;
        pernyataan.peristiwa.push({ tipe: 'ubah_aksi', target: b.jenis, jumlah: 0, posisi: '', aksi: 'diam', aksi_awal: '' });
      } else if (ada && posisi && (adaPindah || t[i + b.panjang] === 'ke' || t[i - 0] !== undefined)) {
        dipahami = true;
        pernyataan.peristiwa.push({ tipe: 'pindah', target: b.jenis, jumlah: 0, posisi: posisi.teks, aksi: '', aksi_awal: '' });
      } else if (!ada && (i === iCue || t[i - 1] === 'seekor' || posisi || cariAksi(t, i + b.panjang, Math.min(t.length, i + b.panjang + 3)) !== 'diam' || t.slice(i + b.panjang, i + b.panjang + 3).some((k) => ['tidur', 'duduk', 'berdiri', 'makan'].includes(k)))) {
        dipahami = true;
        if (!(i === iCue || t[i - 1] === 'seekor' || posisi)) yakin = 'rendah'; // satu benda tanpa angka dan tanpa petunjuk jelas: tebakan
        const aksi = cariAksi(t, i + b.panjang, t.length);
        pernyataan.entitas.push({ jenis: b.jenis, jumlah: 1, aksi, posisi: posisi?.teks || '', bagi: 0, emoji: '', emoji_acuan: posisi ? '' : '' });
      }
      i += b.panjang - 1;
    }
  }

  if (tanya) {
    dipahami = true;
    Object.assign(pernyataan, { pertanyaan: tanya.pertanyaan, tanya_jenis: tanya.jenis, tanya_benda: tanya.benda });
    if (!papan.length && !pernyataan.entitas.length) yakin = 'rendah';
  }

  // --- latar ---
  pernyataan.latar = pernyataan.entitas.length ? caritempat(t) : '';

  // --- konsep ---
  if (pernyataan.peristiwa.some((p) => p.tipe === 'hapus')) pernyataan.konsep = 'pengurangan';
  else if (pernyataan.peristiwa.some((p) => p.tipe === 'tambah')) pernyataan.konsep = 'penjumlahan';
  else if (tanya?.jenis === 'total') pernyataan.konsep = 'penjumlahan';
  else if (tanya?.jenis === 'selisih') pernyataan.konsep = 'pengurangan';
  else if (pernyataan.entitas.length || tanya) pernyataan.konsep = 'membilang';

  if (!dipahami) {
    // Tidak ada benda berangka atau pertanyaan. Tanpa benda pustaka sama sekali, ini sapaan/instruksi ("selamat pagi anak-anak").
    const adaBendaSungguh = t.some((k, i) => { const b = bendaDi(t, i); return b && !SAPAAN.has(b.jenis); });
    if (kelompok.length || adaBendaSungguh || t.some((k) => ['ada', 'terdapat', 'punya', 'memiliki'].includes(k))) return null;
    return { hasil: rapikan(pernyataan, kalimat, konteks), sumber: 'aturan lokal', yakin: 'tinggi', needsConfirmation: false, notice: null, ms: ahir(mulai) };
  }
  // Angka yang tidak berpasangan dengan benda pustaka ("ada tiga kodok-kodokan"): bukan pola yang kami pahami.
  if (sisaTanpaBenda || sambunganTakDikenal.length) {
    return perluTinjau(mulai, { ...kosong, entitas: [], peristiwa: [] }, { code: 'INCOMPLETE_COVERAGE', message: 'Sebagian benda atau jumlah belum dikenali. Papan dipertahankan; tulis ulang kalimat lengkap.' }, [...takDipahami.map((k) => t.slice(k.mulai, Math.max(k.akhir + 2, k.mulai + 1)).join(' ')), ...sambunganTakDikenal]);
  }
  if (t.length > 14 || kataKunci(new Set(['bukan', 'maksudnya', 'eh', 'salah', 'tadi', 'ralat']))) yakin = 'rendah'; // koreksi diri atau kalimat panjang
  if (pernyataan.entitas.length === 0 && pernyataan.peristiwa.length === 0 && !tanya) return null;
  const hasil = rapikan(pernyataan, kalimat, konteks);
  if (hasil.needsConfirmation) return perluTinjau(mulai, hasil, hasil.notice, hasil.notice?.unresolvedSpans || []);
  if (yakin === 'rendah') return perluTinjau(mulai, hasil, { code: 'AMBIGUOUS_LOCAL_PARSE', message: 'Tafsiran lokal belum pasti. Periksa pratinjau sebelum menampilkan.' }, []);
  return { hasil, sumber: 'aturan lokal', yakin, needsConfirmation: false, notice: null, ms: ahir(mulai) };
}

function ahir(mulai) { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) - mulai; }

function perluTinjau(mulai, hasil, alasan, unresolvedSpans) {
  return { hasil, sumber: 'aturan lokal', yakin: 'rendah', needsConfirmation: true, notice: { ...alasan, unresolvedSpans }, ms: ahir(mulai) };
}
