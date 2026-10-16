// Pilihan latar cerdas. Data dari tools/bangun_latar.py (paket
// "subject-matched-backgrounds"): tiap benda punya latar yang paling cocok dan
// area penempatan (tanah, air, meja, ...) pada latar itu.
//
// Urutan keputusan:
//   1. Guru menyebut tempat ("di hutan") → latar dari daftar calon tempat itu.
//      Jika salah satu calon juga cocok untuk benda di papan, calon itu dipilih
//      ("kelinci di rumput" → peternakan, bukan padang kosong).
//   2. Tidak disebut → latar untuk benda yang PERTAMA ada di papan. Menambah karakter
//      lain ("tambahkan kelinci" ke papan berisi harimau) tidak mengganti pemandangan.
//   3. Papan kosong atau benda belum dikenal → ruang kelas.
import data from './latar.json' with { type: 'json' };
import { cariGambar, bersih, cariTempat } from './pustaka.js';
import { areaUntuk } from './permukaan.js';

export const LATAR = data.latar;
const BENDA = data.benda;

// Kata tempat dari guru/parser → latar yang mungkin, dari yang paling umum.
const KANDIDAT = {
  rumput: ['nature', 'farm', 'flower-garden'],
  hutan: ['jungle', 'woodland', 'night-forest'],
  kebun: ['vegetable-garden', 'flower-garden'],
  'kebun-bunga': ['flower-garden'],
  sawah: ['rice-fields'],
  peternakan: ['farm'],
  gunung: ['mountains'],
  sungai: ['river'],
  danau: ['wetland'],
  kolam: ['wetland', 'river'],
  laut: ['deep-ocean', 'underwater', 'beach', 'harbor'],
  'bawah-laut': ['underwater', 'deep-ocean'],
  pantai: ['beach'],
  dapur: ['kitchen'],
  kamar: ['dressing-room', 'playroom'],
  kelas: ['classroom'],
  sekolah: ['classroom', 'playground'],
  pasar: ['fruit-market', 'community'],
  kota: ['city-road', 'community'],
  'jalan-desa': ['rice-fields', 'homeyard', 'city-road'],
  gurun: ['savanna'],
  salju: ['polar'],
  'kebun-binatang': ['savanna', 'jungle'],
  langit: ['open-sky'],
  taman: ['flower-garden', 'playground', 'nature'],
  'taman-bermain': ['playground'],
  malam: ['night-forest'],
  rumah: ['homeyard', 'living-room'],
  'dalam-rumah': ['living-room'],
  'ruang-keluarga': ['living-room'],
  'ruang-bermain': ['playroom'],
  bandara: ['airport'],
  pelabuhan: ['harbor'],
  stasiun: ['railway'],
  angkasa: ['space'],
  'luar-angkasa': ['space'],
  klinik: ['clinic'],
  puskesmas: ['clinic'],
  'rumah-sakit': ['clinic'],
  'tepi-hutan': ['woodland'],
  savana: ['savanna'],
  sabana: ['savanna'],
  // Diorama dan bangunan baru tetap memakai latar 16:9 yang sudah dikurasi.
  'taman-kota': ['flower-garden', 'playground'], 'halaman-rumah': ['homeyard'],
  'kantor-polisi': ['community'], 'halte-bus': ['city-road'], 'stasiun-kereta': ['railway'],
  'kantor-pos': ['community'], bank: ['community'], 'pom-bensin': ['city-road'],
  'markas-pemadam': ['city-road'], 'balai-kota': ['community'], perpustakaan: ['classroom'],
  'warung-makan': ['fruit-market', 'kitchen'], minimarket: ['fruit-market'], supermarket: ['fruit-market'],
  apotek: ['clinic'], 'toko-buku': ['community'], restoran: ['kitchen'], kafe: ['kitchen'],
  'toko-roti': ['kitchen'], 'toko-mainan': ['playroom', 'community'],
  'tenda-pasar-malam': ['fruit-market'], 'kios-buah': ['fruit-market'], butik: ['dressing-room'],
  'ruang-tamu': ['living-room'], 'kamar-rumah': ['dressing-room', 'playroom'], 'dapur-rumah': ['kitchen'],
  'kamar-mandi': ['living-room'], garasi: ['homeyard'], 'halaman-depan': ['homeyard'], teras: ['homeyard'],
  'ruang-makan-rumah': ['kitchen'], loteng: ['living-room'], 'atap-rumah': ['homeyard'],
  balkon: ['homeyard'], 'ruang-cuci': ['living-room'],
  'kelas-sekolah': ['classroom'], 'perpustakaan-sekolah': ['classroom'], kantin: ['kitchen'],
  'lapangan-olahraga': ['playground'], 'ruang-guru': ['classroom'], uks: ['clinic'],
  'gerbang-sekolah': ['playground'], 'toilet-sekolah': ['classroom'], 'koridor-sekolah': ['classroom'],
  'aula-sekolah': ['classroom'], 'laboratorium-komputer': ['classroom'], 'laboratorium-sains': ['classroom'],
  'kolam-renang': ['wetland'], bioskop: ['community'], museum: ['community'], 'alun-alun': ['community'],
  stadion: ['playground'], sirkus: ['playground'], akuarium: ['underwater'], 'komidi-putar': ['playground'],
  'panggung-konser': ['community'], 'gerbang-kebun-binatang': ['savanna', 'jungle'], bianglala: ['playground'],
  saung: ['rice-fields'], 'kandang-ayam': ['farm'], lumbung: ['farm'], sumur: ['homeyard'],
  'pagar-kayu': ['farm'], 'kincir-angin': ['farm'], 'kincir-air': ['river'], dermaga: ['harbor'],
  'jembatan-bambu': ['river'], 'pos-ronda': ['homeyard'], silo: ['farm'], 'kandang-kuda': ['farm'],
  jembatan: ['river'], 'rel-kereta': ['railway'], trotoar: ['city-road'], terowongan: ['city-road'],
  'jembatan-penyeberangan': ['city-road'], 'zebra-cross': ['city-road'], gang: ['city-road'],
  'gardu-tol': ['city-road'], 'bundaran-air-mancur': ['community'], 'halte-trem': ['city-road'],
  masjid: ['community'], gereja: ['community'], pura: ['community'], wihara: ['community'],
  kelenteng: ['community'], musala: ['community'], kapel: ['community'], 'menara-lonceng': ['community'],
  kubah: ['community'], 'gapura-candi': ['community'], altar: ['community'],
  'jembatan-gantung': ['river'], gua: ['mountains'], 'rumah-pohon': ['woodland'], bendungan: ['river'],
  mercusuar: ['harbor'], tambang: ['mountains'], 'menara-pengawas': ['woodland'],
  'jalur-tanah': ['woodland'], 'air-terjun': ['river'], 'anjungan-minyak': ['deep-ocean'],
};

/** "di hutan lebat" → ['jungle', 'woodland', 'night-forest']; tidak dikenal → []. */
export function calonLatar(latar) {
  const k = bersih(latar).replace(/^(?:di|ke|dari)-/, '');
  if (!k) return [];
  if (Object.hasOwn(LATAR, k)) return [k];
  if (KANDIDAT[k]) return KANDIDAT[k];
  const ikon = cariTempat(latar);
  if (ikon && KANDIDAT[ikon]) return KANDIDAT[ikon];
  const kata = k.split('-');
  for (let n = Math.min(2, kata.length); n >= 1; n--) {
    for (let i = 0; i + n <= kata.length; i++) {
      const c = KANDIDAT[kata.slice(i, i + n).join('-')];
      if (c) return c;
    }
  }
  return [];
}

// Aksi yang hanya masuk akal di permukaan tertentu. Jika latar benda sudah cocok
// (ikan berenang di terumbu, elang terbang di langit), latar tidak diganti.
const LATAR_AKSI = {
  terbang: { latar: 'open-sky', cocok: ['air', 'sky'] },
  berenang: { latar: 'river', cocok: ['water'] },
};

const WILAYAH_LEBAR =[0.04, 0.96];
const WILAYAH_PECAHAN = { x: [0.1, 0.9], y: [0.12, 0.94] };
const BANYAK = 4; // lebih dari ini: pakai area lebih lebar supaya benda (dan kelompoknya) muat satu baris
const MELEBAR = 0.07; // area yang disarankan adalah titik awal; sedikit dilebarkan agar tiga benda muat satu baris

const lebarkan = ([a, b]) => [Math.max(0.03, a - MELEBAR), Math.min(0.97, b + MELEBAR)];

/**
 * @returns {{id:string, file:string, nama:string, permukaan:string, x:number[], y:number[], alasan:string} | null}
 */
export function pilihLatar(adegan) {
  const objek = adegan?.objek ?? [];
  const suara = new Map(); // id latar → berapa benda yang cocok
  const cocokPer = new Map(); // id latar → data benda pertama (untuk area)
  for (const o of objek) {
    const nama = cariGambar(o.jenis);
    const b = nama && BENDA[nama];
    if (!b) continue;
    suara.set(b.latar, (suara.get(b.latar) || 0) + 1);
    if (!cocokPer.has(b.latar)) cocokPer.set(b.latar, b);
  }

  const calon = calonLatar(adegan?.latar);
  let id = null;
  let alasan = '';
  if (calon.length) {
    id = calon.find((c) => suara.has(c)) ?? calon[0];
    alasan = 'tempat disebut guru';
  } else if (suara.size) {
    id = [...suara.keys()][0]; // Map menyimpan urutan masuk: benda yang pertama dikenal
    alasan = 'cocok dengan benda pertama di papan';
    // Aksi bisa menuntut tempat lain: harimau berenang → sungai, burung terbang → langit.
    const pertama = objek.find((o) => BENDA[cariGambar(o.jenis)]);
    const tuntut = LATAR_AKSI[pertama?.aksi];
    if (tuntut && !tuntut.cocok.includes(cocokPer.get(id).permukaan)) {
      id = tuntut.latar;
      alasan = `aksi ${pertama.aksi}`;
    }
  } else {
    // Papan kosong, atau benda yang belum ada gambarnya: ruang kelas yang tenang,
    // bukan papan hijau polos.
    id = 'classroom';
    alasan = objek.length ? 'benda belum dikenal' : 'papan kosong';
  }
  if (!id || !LATAR[id]) return null;

  const sumber = cocokPer.get(id) ?? LATAR[id];
  let { x, y } = sumber;
  const pecahan = objek.some((o) => o.bagi);
  if (pecahan) ({ x, y } = WILAYAH_PECAHAN);
  else if (objek.length > BANYAK) x = WILAYAH_LEBAR;
  else x = lebarkan(x);

  return {
    id, file: `/aset/latar/${id}.webp`, nama: LATAR[id].nama,
    permukaan: cocokPer.get(id)?.permukaan ?? LATAR[id].permukaan, x, y, alasan,
    perJenis: Object.fromEntries(objek.map((o) => [o.jenis, areaUntuk(o, id, BENDA[cariGambar(o.jenis)] || {})])),
    perObjek: Object.fromEntries(objek.filter((o) => o.id).map((o) => [o.id, areaUntuk(o, id, BENDA[cariGambar(o.jenis)] || {})])),
  };
}

export const _untukTes = { KANDIDAT, BENDA };
