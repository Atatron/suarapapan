// Pustaka gambar kartun (web/public/aset). Daftar file dibuat oleh
// tools/bangun_aset.py; di sini hanya pencarian: kata dari parser → nama file.
import pustaka from './pustaka.json' with { type: 'json' };
import POSE from './aksi.json' with { type: 'json' };

const OBJ = pustaka.obj;
const TEMPAT = pustaka.tempat;

// Kata lain untuk benda yang sama. Kunci = kata dari guru/parser, nilai = nama
// file di pustaka. Setiap nilai diperiksa oleh tes (engine.test.js).
const ALIAS_OBJ = {
  macan: 'harimau', kera: 'monyet', kodok: 'katak', 'biri-biri': 'domba', lembu: 'sapi', jago: 'ayam', 'ayam-jago': 'ayam',
  kakaktua: 'kakatua', dara: 'merpati', 'anak-ayam': 'anak-bebek', 'bebek-kecil': 'anak-bebek', hippo: 'kuda-nil',
  cumi: 'cumi-cumi', kupu: 'kupu-kupu', 'burung-kecil': 'burung', 'burung-gereja': 'burung', 'burung-pipit': 'burung',
  anak: 'anak-laki-laki', adik: 'anak-perempuan', kakak: 'anak-laki-laki', murid: 'anak-laki-laki', siswa: 'anak-laki-laki',
  // Nama orang tanpa ciri memakai karakter anak bawaan yang juga dipakai untuk
  // "anak"/"murid"; label semantik aslinya tetap disimpan oleh mesin adegan.
  manusia: 'anak-laki-laki', orang: 'anak-laki-laki', seseorang: 'anak-laki-laki', teman: 'anak-laki-laki',
  'anak-menggunakan-kursi-roda': 'anak-kursi-roda', 'anak-memakai-kursi-roda': 'anak-kursi-roda',
  'anak-dengan-kursi-roda': 'anak-kursi-roda', 'anak-di-kursi-roda': 'anak-kursi-roda',
  'anak-pengguna-kursi-roda': 'anak-kursi-roda', 'pengguna-kursi-roda': 'anak-kursi-roda',
  'anak-menggunakan-alat-bantu-dengar': 'anak-dengan-alat-bantu-dengar',
  'anak-memakai-alat-bantu-dengar': 'anak-dengan-alat-bantu-dengar',
  bocah: 'anak-laki-laki', cowok: 'anak-laki-laki', cewek: 'anak-perempuan', bapak: 'ayah', papa: 'ayah', bunda: 'ibu',
  mama: 'ibu', eyang: 'nenek', oma: 'nenek', opa: 'kakek', tukang: 'sopir', 'tukang-pos': 'pak-pos', pemadam: 'pemadam-kebakaran',
  supir: 'sopir', pedagang: 'penjual', juru: 'koki', 'juru-masak': 'koki', 'anak-berhijab': 'siswa-berhijab', hijab: 'siswa-berhijab',
  cabe: 'cabai', mentimun: 'timun', kol: 'brokoli', sawi: 'bayam', eskrim: 'es-krim', es: 'es-krim', 'ice-cream': 'es-krim',
  bakpao: 'roti', 'kue-tart': 'kue', tart: 'kue', 'telur-ayam': 'telur', 'air-putih': 'air', 'segelas-air': 'air',
  'buku-tulis': 'buku', pena: 'pulpen', bolpoin: 'pulpen', ransel: 'tas', 'tas-sekolah': 'tas', 'papan-tulis': 'papan-tulis-kecil',
  'jam-dinding': 'jam', 'bola-dunia': 'globe', lemari: 'keranjang', ranjang: 'tempat-tidur', kasur: 'tempat-tidur',
  'mobil-mobilan': 'mobil', 'sepeda-motor': 'motor', 'kereta-api': 'kereta', 'pesawat-terbang': 'pesawat', ship: 'kapal',
  layang: 'layang-layang', hadiah: 'kado', 'bola-kaki': 'bola', pepohonan: 'pohon', 'bunga-bunga': 'bunga', mentari: 'matahari',
  gunung: 'gunung-kecil', bukit: 'gunung-kecil', kaos: 'baju', kemeja: 'baju', gaun: 'rok', kerudung: 'syal', 'kaus': 'baju',
  'laki-laki': 'anak-laki-laki', laki: 'anak-laki-laki', perempuan: 'anak-perempuan', 'anak-laki': 'anak-laki-laki',
  lingkar: 'lingkaran', bulat: 'lingkaran', uang: 'koin',
};

const ALIAS_TEMPAT = {
  'padang-rumput': 'rumput', lapangan: 'rumput', halaman: 'rumput', padang: 'rumput', ladang: 'kebun',
  'hutan-rimba': 'hutan', rimba: 'hutan', belantara: 'hutan', 'hutan-lebat': 'hutan',
  'kebun-sayur': 'kebun', 'kebun-buah': 'kebun', pertanian: 'peternakan', kandang: 'peternakan', 'sawah-padi': 'sawah',
  padi: 'sawah', pegunungan: 'gunung', bukit: 'gunung', kali: 'sungai', telaga: 'danau', waduk: 'danau', empang: 'kolam',
  tambak: 'kolam', lautan: 'laut', samudra: 'laut', samudera: 'laut', 'dalam-laut': 'bawah-laut', 'dasar-laut': 'bawah-laut',
  'bawah-air': 'bawah-laut', 'kamar-tidur': 'kamar', 'ruang-kelas': 'kelas', 'dalam-kelas': 'kelas', 'ruang-makan': 'dapur',
  'jalan-raya': 'kota', jalan: 'kota', 'padang-pasir': 'gurun', kutub: 'salju', zoo: 'kebun-binatang',
  desa: 'jalan-desa', kampung: 'jalan-desa', 'pasar-malam': 'pasar', toko: 'pasar',
};

// Batasi pencarian oleh frasa terpanjang yang benar-benar didukung pustaka,
// bukan tiga kata: nama inklusi seperti "anak dengan alat bantu dengar" lebih panjang.
const panjangFrasa = (daftar, alias) => Math.max(1, ...Object.keys({ ...daftar, ...alias }).map((k) => k.split('-').length));
const PANJANG_OBJ = panjangFrasa(OBJ, ALIAS_OBJ);
const PANJANG_TEMPAT = panjangFrasa(TEMPAT, ALIAS_TEMPAT);

// Kata pelengkap yang bukan nama benda ("apel merah", "kucing kecil", "ekor kucing").
const LEWATI = new Set(['anak', 'kecil', 'besar', 'baru', 'si', 'sang', 'seekor', 'sebuah', 'buah', 'ekor', 'biji', 'butir', 'potong',
  'batang', 'lembar', 'orang', 'manusia', 'seseorang', 'teman', 'warna', 'merah', 'biru', 'hijau', 'kuning', 'putih', 'hitam', 'coklat', 'cokelat', 'pink', 'oranye',
  'ungu', 'abu-abu', 'di', 'ke', 'dari', 'dekat', 'yang', 'dan', 'lagi', 'itu', 'ini']);

export const bersih = (s) => String(s || '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function cari(teks, daftar, alias, panjang) {
  const k = bersih(teks);
  if (!k) return null;
  const coba = (x) => (Object.hasOwn(daftar, x) ? x : Object.hasOwn(alias, x) && Object.hasOwn(daftar, alias[x]) ? alias[x] : null);
  const ulang = k.match(/^([a-z0-9]+)-\1$/); // kelinci-kelinci → kelinci
  const langsung = coba(k) || (ulang && coba(ulang[1]));
  if (langsung) return langsung;
  const kata = k.split('-');
  // Frasa paling spesifik lebih dulu, lalu kata tunggal dari depan
  // ("kucing kecil" → kucing), dengan melewati kata pelengkap.
  for (let n = Math.min(panjang, kata.length); n >= 2; n--) {
    for (let i = 0; i + n <= kata.length; i++) {
      const r = coba(kata.slice(i, i + n).join('-'));
      if (r) return r;
    }
  }
  for (const w of kata) {
    if (LEWATI.has(w)) continue;
    const r = coba(w);
    if (r) return r;
  }
  return null;
}

/** Nama file gambar kartun untuk benda ("harimau" → "harimau"), atau null. */
export const cariGambar = (jenis) => cari(jenis, OBJ, ALIAS_OBJ, PANJANG_OBJ);
/** Nama file gambar tempat untuk latar ("di hutan" → "hutan"), atau null. */
export const cariTempat = (latar) => cari(latar, TEMPAT, ALIAS_TEMPAT, PANJANG_TEMPAT);

const KATA_PENDUKUNG = ['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas', 'belas', 'puluh',
  'berlari', 'melompat', 'terbang', 'berenang', 'jatuh', 'pergi', 'datang', 'lagi', 'dibagi', 'potong', 'berapa', 'atas', 'bawah', 'samping'];

/** Semua kata yang mungkin diucapkan guru (nama benda, tempat, bilangan, kata kerja). */
export function kosakata() {
  const kata = new Set(KATA_PENDUKUNG);
  for (const n of [...Object.keys(OBJ), ...Object.keys(TEMPAT), ...Object.keys(ALIAS_OBJ), ...Object.keys(ALIAS_TEMPAT)]) {
    kata.add(n);                       // "kuda-nil"
    for (const w of n.split('-')) if (w.length > 3) kata.add(w);
  }
  return kata;
}

export const urlGambar = (nama) => `/aset/obj/${nama}.webp`;

/**
 * Gambar pose untuk aksi ("harimau", "lari") → "/aset/aksi/harimau__lari.webp", atau null.
 * Daftar dari tools/bangun_aksi.py; aksi tanpa pose memakai gambar biasa + animasi CSS.
 */
export const urlPose = (nama, aksi) => {
  const pose = nama && POSE[nama]?.[aksi];
  return pose ? `/aset/aksi/${nama}__${pose}.webp` : null;
};
export const urlTempat = (nama) => `/aset/tempat/${nama}.webp`;
export const _untukTes = { OBJ, TEMPAT, ALIAS_OBJ, ALIAS_TEMPAT };
