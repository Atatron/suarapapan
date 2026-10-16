// Riwayat papan untuk Batalkan / Ulangi. Fungsi murni (tidak mengubah objek lama),
// supaya mudah diuji dan aman dipakai bersama ref di panel guru.
//
//   lalu     : keadaan-keadaan sebelumnya, yang terbaru di ujung
//   sekarang : yang tampil di papan { adegan, label }; label = kalimat yang membuatnya
//   maju     : keadaan yang dibatalkan, bisa diulangi; kosong setelah ada perubahan baru
import { yangAda } from './engine.js';

export const MAKS_RIWAYAT = 30;

export const awalSejarah = (adegan, label = '') => ({ lalu: [], sekarang: { adegan, label }, maju: [] });

/** Perubahan baru: keadaan sekarang masuk riwayat, dan "ulangi" dikosongkan. */
export function catat(s, adegan, label = '') {
  return { lalu: [...s.lalu.slice(-(MAKS_RIWAYAT - 1)), s.sekarang], sekarang: { adegan, label }, maju: [] };
}

export function batalkan(s) {
  if (!s.lalu.length) return s;
  const sebelum = s.lalu[s.lalu.length - 1];
  return { lalu: s.lalu.slice(0, -1), sekarang: sebelum, maju: [...s.maju, s.sekarang] };
}

export function ulangi(s) {
  if (!s.maju.length) return s;
  const berikut = s.maju[s.maju.length - 1];
  return { lalu: [...s.lalu, s.sekarang], sekarang: berikut, maju: s.maju.slice(0, -1) };
}

export const bisaBatalkan = (s) => s.lalu.length > 0;
export const bisaUlangi = (s) => s.maju.length > 0;

const hitung = (adegan) => {
  const m = new Map();
  for (const o of yangAda(adegan)) m.set(o.jenis, (m.get(o.jenis) || 0) + 1);
  return m;
};
const potongDiambil = (adegan) => yangAda(adegan).reduce((n, o) => n + (o.bagi ? o.diambil || 0 : 0), 0);

/** Daftar perubahan jumlah per jenis: [{ jenis, dari, ke, selisih }]. */
export function bedaAdegan(sebelum, sesudah) {
  const x = hitung(sebelum);
  const y = hitung(sesudah);
  const hasil = [];
  for (const jenis of new Set([...x.keys(), ...y.keys()])) {
    const dari = x.get(jenis) || 0;
    const ke = y.get(jenis) || 0;
    if (dari !== ke) hasil.push({ jenis, dari, ke, selisih: ke - dari });
  }
  return hasil;
}

/** Ringkasan untuk guru: ["+3 kelinci", "−1 harimau", "potongan diambil: 0 → 1"]. */
export function ringkasBeda(sebelum, sesudah) {
  const daftar = bedaAdegan(sebelum, sesudah).map((b) => `${b.selisih > 0 ? '+' : '−'}${Math.abs(b.selisih)} ${b.jenis}`);
  const a = potongDiambil(sebelum);
  const b = potongDiambil(sesudah);
  if (a !== b) daftar.push(`potongan diambil: ${a} → ${b}`);
  if (sesudah.latar && (sebelum.latar || '') !== sesudah.latar) daftar.push(`tempat: ${sebelum.latar || '—'} → ${sesudah.latar}`);
  return daftar;
}

/** Mengganti adegan yang sedang tampil tanpa mencatat langkah baru (mis. karakter hanya digeser). */
export const perbarui = (s, adegan) => ({ ...s, sekarang: { ...s.sekarang, adegan } });
