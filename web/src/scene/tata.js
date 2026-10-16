// Tata letak karakter di papan: posisi (px, py = kaki karakter, pecahan lebar/tinggi papan),
// ukuran dari tinggi nyata, dan skala perspektif (makin ke depan makin besar).
// Fungsi murni supaya mudah diuji; Adegan.jsx hanya menggambar hasilnya.
import UKURAN from './ukuran.json' with { type: 'json' };
import PUSTAKA from './pustaka.json' with { type: 'json' };
import { cariGambar } from './pustaka.js';

const MANUSIA = 1.7; // meter: tinggi orang dewasa sebagai patokan
const CM_PER_METER = 26; // tinggi papan (cqh) per meter pada skala 1; orang dewasa ≈ 44% tinggi papan
const MIN_METER = 0.55; // benda sangat kecil (semut, ceri) tetap terbaca
const MAKS_CQH = 70; // jerapah dan pohon tidak menembus papan
const MIN_CQH = 7;
const SEL = 1.25; // sprite 400x320
const CQH_KE_LEBAR = 0.5625; // 1cqh = 0,5625cqw pada papan 16:9
const EKSPONEN = 0.55; // memampatkan selisih: semut tidak jadi titik, gajah tidak memenuhi papan

// Angka acak yang tetap untuk id yang sama (susunan tidak berubah-ubah setiap digambar ulang).
function acak(id, garam) {
  let h = 2166136261 ^ garam;
  for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
}

export const WILAYAH_BAWAAN = { x: [0.08, 0.92], y: [0.56, 0.92] };
const adaGambar = (jenis) => { const n = cariGambar(jenis); return n && UKURAN[n] ? UKURAN[n] : null; };

/** Tinggi nyata (m) → tinggi tampil (m) setelah dimampatkan. */
export const tinggiTampil = (meter, eksponen = EKSPONEN) => Math.min(3.2, Math.max(MIN_METER, MANUSIA * (meter / MANUSIA) ** eksponen));

/** manusia, hewan, atau properti: masing-masing punya ukuran dasar sendiri. */
export function kategoriJenis(jenis) {
  const nama = cariGambar(jenis);
  const k = (nama && PUSTAKA.obj[nama]?.k) || '';
  if (k.startsWith('orang')) return 'manusia';
  if (k.startsWith('hewan') || k === 'burung' || k === 'serangga') return 'hewan';
  return 'properti';
}

// Presentation profiles are independent of parser roles. A person who is the
// object of a sentence still uses a human scale; a toy person is a small prop.
export function profilJenis(jenis) {
  const nama = cariGambar(jenis);
  const category = PUSTAKA.obj[nama]?.k || '';
  const coarse = kategoriJenis(jenis);
  if (coarse === 'manusia') return /^(bayi|balita)/.test(nama) ? 'bayi' : /^(anak|murid|siswa|remaja)/.test(nama) ? 'anak' : 'dewasa';
  if (coarse === 'hewan') return category === 'serangga' ? 'hewan-kecil' : 'hewan';
  if (category.startsWith('kendaraan')) return 'kendaraan';
  if (['benda-rumah', 'benda-kelas', 'elektronik', 'alat-musik'].includes(category)) return 'perabot';
  if (['alam', 'alam-ekstra', 'alam-struktur', 'infrastruktur', 'pedesaan-struktur'].includes(category)) return 'lingkungan';
  return 'benda-kecil';
}

export const PROFIL_UKURAN = Object.freeze({
  dewasa: { min: 36, max: 52, factor: 1 }, anak: { min: 28, max: 40, factor: 1 }, bayi: { min: 20, max: 29, factor: 1 },
  hewan: { min: 17, max: 68, factor: 1 }, 'hewan-kecil': { min: 11, max: 23, factor: .9 },
  kendaraan: { min: 26, max: 68, factor: 1 }, perabot: { min: 17, max: 48, factor: .95 },
  lingkungan: { min: 13, max: 70, factor: 1 }, 'benda-kecil': { min: 15, max: 30, factor: .88 },
});

/**
 * Tinggi isi dasar (cqh, sebelum perspektif dan kepadatan) menurut kategori:
 *  - manusia  : mengikuti tinggi nyata (dewasa ≈ 44% tinggi papan, anak lebih pendek)
 *  - hewan    : mengikuti tinggi nyata tetapi lebih dimampatkan; semut tetap terbaca, jerapah tidak menembus papan
 *  - properti : benda kecil (buah, alat tulis) diperbesar supaya mudah dilihat dan dihitung dengan selisih ukuran
 *               yang lembut; benda sebesar rumah (pintu, pohon, bus) memakai skala nyata
 */
export function ukuranDasar(kategori, meter) {
  if (kategori === 'manusia') return tinggiTampil(meter) * CM_PER_METER;
  if (kategori === 'hewan') return tinggiTampil(meter, 0.5) * CM_PER_METER;
  if (meter >= 1) return tinggiTampil(meter) * CM_PER_METER;
  return 11 + 17 * (Math.log(Math.max(meter, 0.03) / 0.03) / Math.log(1 / 0.03));
}

/** Skala perspektif di garis kaki py: atas wilayah 0,72, bawah 1,0 (boleh sedikit lewat saat diseret). */
export function perspektif(py, wilayah = WILAYAH_BAWAAN) {
  const [y0, y1] = wilayah.y;
  const z = Math.min(1.3, Math.max(-0.3, (py - y0) / (y1 - y0)));
  return 0.72 + 0.28 * z;
}

/** Makin banyak karakter, makin kecil, supaya semuanya muat. */
export const kepadatan = (n) => (n <= 4 ? 1 : n <= 8 ? 0.86 : n <= 14 ? 0.72 : n <= 24 ? 0.58 : 0.46);

/** Ukuran satu karakter di garis kaki py: tinggi isi (cqh), tinggi/lebar sel, dan sisi isi. */
export function ukuranKarakter(jenis, py, n, wilayah) {
  const d = adaGambar(jenis) || { t: 0.3, x: 0, y: 0, w: 1, h: 1 };
  const kategori = kategoriJenis(jenis);
  const profil = profilJenis(jenis);
  const range = PROFIL_UKURAN[profil];
  const dasar = Math.max(range.min, Math.min(range.max, ukuranDasar(kategori, d.t) * range.factor)) * (wilayah?.skala || 1);
  let isi = Math.min(MAKS_CQH, Math.max(MIN_CQH, dasar * perspektif(py, wilayah) * kepadatan(n)));
  // A wide bus/table must fit horizontally too. Preserve aspect ratio; do not
  // stretch sprites or give a pencil the same size as a human.
  const lebarIsi = isi / d.h * SEL * d.w * CQH_KE_LEBAR;
  const maxLebar = wilayah?.batasiX ? Math.min(80, (wilayah.x[1] - wilayah.x[0]) * 100) : 80;
  if (lebarIsi > maxLebar) isi *= maxLebar / lebarIsi;
  const selTinggi = isi / d.h;
  const selLebar = selTinggi * SEL;
  return {
    isi, selTinggi, selLebar, kategori, profil,
    // lebar isi sebagai pecahan lebar papan, untuk menata baris
    lebar: (selLebar * d.w * CQH_KE_LEBAR) / 100,
    // titik kaki di dalam sel (pecahan sel)
    kakiX: d.x + d.w / 2,
    kakiY: d.y + d.h,
    punyaGambar: Boolean(adaGambar(jenis)),
  };
}

/**
 * Posisi semua karakter. Karakter yang pernah diseret (px, py tersimpan) tetap di tempatnya;
 * yang lain disusun berbaris dari depan ke belakang di dalam wilayah. Hasil sejajar dengan objek.
 */
export function tataObjek(objek, wilayah = WILAYAH_BAWAAN) {
  if (wilayah.perJenis) {
    const result = new Array(objek.length);
    const groups = new Map();
    objek.forEach((o, i) => {
      const region = wilayah.perObjek?.[o.id] || wilayah.perJenis[o.jenis] || wilayah;
      const key = JSON.stringify(region);
      if (!groups.has(key)) groups.set(key, { region, entries: [] });
      groups.get(key).entries.push({ o, i });
    });
    for (const { region, entries } of groups.values()) {
      const layout = tataObjek(entries.map((e) => e.o), { ...region, jumlahGlobal: objek.length });
      layout.forEach((p, i) => { result[entries[i].i] = p; });
    }
    return result;
  }
  const n = objek.length;
  // Sebar di seluruh lebar papan (bukan hanya area sempit yang disarankan latar): karakter tidak
  // menumpuk di satu sisi dan tidak perlu mengecil. Latar hanya menentukan kedalaman (tanah/air).
  const x0 = wilayah.batasiX ? wilayah.x[0] : 0.07;
  const x1 = wilayah.batasiX ? wilayah.x[1] : 0.93;
  const [y0, y1] = wilayah.y;
  const langkahY = 0.4 * (y1 - y0);
  const hasil = new Array(n);
  const aliran = [];
  objek.forEach((o, i) => {
    if (Number.isFinite(o.px) && Number.isFinite(o.py)) {
      hasil[i] = { px: o.px, py: o.py, ...ukuranKarakter(o.jenis, o.py, wilayah.jumlahGlobal || n, wilayah) };
    } else aliran.push(i);
  });

  // Langkah 1: berapa baris yang dibutuhkan (penuhi baris dari depan, ukuran memakai garis kaki baris itu).
  const lebarPada = (i, py) => ukuranKarakter(objek[i].jenis, py, wilayah.jumlahGlobal || n, wilayah).lebar;
  const selaAntara = (i, j) => (objek[i].jenis !== objek[j].jenis ? 0.03 : 0.012);
  const jumlahBaris = (() => {
    let baris = 0;
    let kursor = 0;
    while (kursor < aliran.length) {
      const py = Math.max(y0, y1 - baris * langkahY);
      let lebar = 0;
      let di = 0;
      while (kursor < aliran.length) {
        const i = aliran[kursor];
        const tambah = lebarPada(i, py) + (di ? selaAntara(aliran[kursor - 1], i) : 0);
        if (di && lebar + tambah > x1 - x0) break;
        lebar += tambah; di++; kursor++;
      }
      baris++;
    }
    return baris;
  })();

  // Langkah 2: bagi rata ke baris-baris itu supaya baris belakang tidak hanya berisi satu karakter,
  // lalu geser baris belakang setengah slot agar tidak tepat di belakang karakter depan.
  // Karakter yang cukup banyak selalu dibagi ke minimal dua baris kedalaman supaya tidak berderet lurus.
  const sebar = aliran.length >= 4;
  const perBaris = Math.max(1, Math.ceil(aliran.length / Math.max(1, jumlahBaris, sebar ? 2 : 1)));
  for (let baris = 0, mulai = 0; mulai < aliran.length; baris++, mulai += perBaris) {
    const py = Math.max(y0, y1 - baris * langkahY);
    const isi = aliran.slice(mulai, mulai + perBaris).map((i, k, arr) => ({
      i, u: ukuranKarakter(objek[i].jenis, py, wilayah.jumlahGlobal || n, wilayah), sela: k ? selaAntara(arr[k - 1], i) : 0,
    }));
    const lebarBaris = isi.reduce((t, e) => t + e.sela + e.u.lebar, 0);
    // Cukup lega: tiap karakter mendapat slot yang sama lebar di seluruh papan (dua hewan duduk sekitar ¼ dan ¾,
    // bukan menggerombol di tengah). Terlalu penuh: dirapatkan berurutan seperti sebelumnya.
    const lebarSlot = (x1 - x0) / isi.length;
    const lega = isi.every((e) => e.u.lebar * 1.08 <= lebarSlot);
    const sisa = Math.max(0, x1 - x0 - lebarBaris);
    const jarak = Math.min(0.24, sisa / (isi.length + 1));
    const total = lebarBaris + jarak * (isi.length - 1);
    const geserSlot = baris % 2 ? (baris % 4 === 1 ? 1 : -1) * lebarSlot * 0.22 : 0;
    let x = Math.min(x1 - total, Math.max(x0, (x0 + x1) / 2 - total / 2 + geserSlot * 0.5));
    isi.forEach(({ i, u, sela }, j) => {
      let px;
      if (lega) px = x0 + (j + 0.5) * lebarSlot + geserSlot;
      else { x += sela; px = x + u.lebar / 2; x += u.lebar + jarak; }
      let pyi = py;
      if (sebar) {
        // Goyangan kecil yang tetap per karakter: tersebar, bukan berbaris kaku.
        const id = objek[i].id ?? i;
        const ruang = lega ? Math.max(0, lebarSlot - u.lebar) / 2 : Math.min(0.06, jarak);
        px += (acak(id, 1) - 0.5) * ruang * 0.9;
        pyi = Math.min(y1, Math.max(y0, py + (acak(id, 2) - 0.5) * 0.6 * langkahY));
      }
      px = Math.min(x1 - u.lebar / 2, Math.max(x0 + u.lebar / 2, px));
      hasil[i] = { px, py: pyi, ...(sebar ? ukuranKarakter(objek[i].jenis, pyi, wilayah.jumlahGlobal || n, wilayah) : u) };
    });
  }
  return hasil;
}

/** Batas px/py supaya karakter tidak hilang dari papan. */
export const batasi01 = (v) => Math.min(0.98, Math.max(0.02, v));
