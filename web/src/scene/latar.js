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
};

/** "di hutan lebat" → ['jungle', 'woodland', 'night-forest']; tidak dikenal → []. */
export function calonLatar(latar) {
  const k = bersih(latar);
  if (!k) return [];
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

const WILAYAH_LEBAR = [0.04, 0.96];
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
  };
}

export const _untukTes = { KANDIDAT, BENDA };
