// Tata letak karakter di papan: posisi (px, py = kaki karakter, pecahan lebar/tinggi papan),
// ukuran dari tinggi nyata, dan skala perspektif (makin ke depan makin besar).
// Fungsi murni supaya mudah diuji; Adegan.jsx hanya menggambar hasilnya.
import UKURAN from './ukuran.json' with { type: 'json' };
import { cariGambar } from './pustaka.js';

const MANUSIA = 1.7; // meter: tinggi orang dewasa sebagai patokan
const CM_PER_METER = 26; // tinggi papan (cqh) per meter pada skala 1; orang dewasa ≈ 44% tinggi papan
const MIN_METER = 0.55; // benda sangat kecil (semut, ceri) tetap terbaca
const MAKS_CQH = 70; // jerapah dan pohon tidak menembus papan
const MIN_CQH = 7;
const SEL = 1.25; // sprite 400x320
const CQH_KE_LEBAR = 0.5625; // 1cqh = 0,5625cqw pada papan 16:9
const EKSPONEN = 0.55; // memampatkan selisih: semut tidak jadi titik, gajah tidak memenuhi papan

export const WILAYAH_BAWAAN = { x: [0.08, 0.92], y: [0.56, 0.92] };
const adaGambar = (jenis) => { const n = cariGambar(jenis); return n && UKURAN[n] ? UKURAN[n] : null; };

/** Tinggi nyata (m) → tinggi tampil (m) setelah dimampatkan. */
export const tinggiTampil = (meter) => Math.min(3.2, Math.max(MIN_METER, MANUSIA * (meter / MANUSIA) ** EKSPONEN));

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
  const isi = Math.min(MAKS_CQH, Math.max(MIN_CQH, tinggiTampil(d.t) * CM_PER_METER * perspektif(py, wilayah) * kepadatan(n)));
  const selTinggi = isi / d.h;
  const selLebar = selTinggi * SEL;
  return {
    isi, selTinggi, selLebar,
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
  const n = objek.length;
  // Sebar di seluruh lebar papan (bukan hanya area sempit yang disarankan latar): karakter tidak
  // menumpuk di satu sisi dan tidak perlu mengecil. Latar hanya menentukan kedalaman (tanah/air).
  const x0 = 0.07;
  const x1 = 0.93;
  const [y0, y1] = wilayah.y;
  const langkahY = 0.28 * (y1 - y0);
  const hasil = new Array(n);
  const aliran = [];
  objek.forEach((o, i) => {
    if (Number.isFinite(o.px) && Number.isFinite(o.py)) {
      hasil[i] = { px: o.px, py: o.py, ...ukuranKarakter(o.jenis, o.py, n, wilayah) };
    } else aliran.push(i);
  });

  // Langkah 1: berapa baris yang dibutuhkan (penuhi baris dari depan, ukuran memakai garis kaki baris itu).
  const lebarPada = (i, py) => ukuranKarakter(objek[i].jenis, py, n, wilayah).lebar;
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
  const perBaris = Math.max(1, Math.ceil(aliran.length / Math.max(1, jumlahBaris)));
  for (let baris = 0, mulai = 0; mulai < aliran.length; baris++, mulai += perBaris) {
    const py = Math.max(y0, y1 - baris * langkahY);
    const isi = aliran.slice(mulai, mulai + perBaris).map((i, k, arr) => ({
      i, u: ukuranKarakter(objek[i].jenis, py, n, wilayah), sela: k ? selaAntara(arr[k - 1], i) : 0,
    }));
    const lebarBaris = isi.reduce((t, e) => t + e.sela + e.u.lebar, 0);
    // Sisa ruang dibagi rata supaya baris terasa tersebar; jarak dibatasi agar tidak terlalu renggang.
    const sisa = Math.max(0, x1 - x0 - lebarBaris);
    const jarak = Math.min(0.1, sisa / (isi.length + 1));
    const total = lebarBaris + jarak * (isi.length - 1);
    const geser = baris % 2 ? (baris % 4 === 1 ? 1 : -1) * Math.min(0.5 * (lebarBaris / isi.length), jarak * 0.8 + 0.02) : 0;
    let x = Math.min(x1 - total, Math.max(x0, (x0 + x1) / 2 - total / 2 + geser));
    for (const { i, u, sela } of isi) {
      x += sela;
      hasil[i] = { px: x + u.lebar / 2, py, ...u };
      x += u.lebar + jarak;
    }
  }
  return hasil;
}

/** Batas px/py supaya karakter tidak hilang dari papan. */
export const batasi01 = (v) => Math.min(0.98, Math.max(0.02, v));
