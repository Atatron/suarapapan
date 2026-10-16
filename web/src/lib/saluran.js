// BroadcastChannel menghubungkan tab pada browser/profil dan origin yang sama.
// ID sesi memisahkan kelas; ini bukan transport lintas perangkat atau autentikasi.
import { BATAS_OBJEK, BATAS_ANIMASI_KELUAR } from '../scene/engine.js';
const FORMAT = 1;
const AWAL_KUNCI = 'suarapapan-sesi-v1:';
const MAKS_USIA = 7 * 24 * 60 * 60 * 1000;
const MAKS_SIMPAN = 2_000_000;
const ID_SAH = /^[a-zA-Z0-9_-]{8,80}$/;
const CAPTION_KOSONG = { teks: '', sementara: false, sorot: [] };

export const idBaru = () => globalThis.crypto?.randomUUID?.() || `sesi-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function sesiDariUrl({ buat = false } = {}) {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const lama = url.searchParams.get('sesi');
  if (ID_SAH.test(lama || '')) return lama;
  if (!buat) return null;
  const sesi = idBaru();
  url.searchParams.set('sesi', sesi);
  window.history.replaceState(window.history.state, '', url);
  return sesi;
}

export const urlPapan = (sesi) => `/papan?sesi=${encodeURIComponent(sesi)}`;

const penyimpanan = () => {
  try { return globalThis.localStorage; } catch { return null; }
};
const kunciSesi = (sesi) => `${AWAL_KUNCI}${sesi}`;
const kunciOtoritas = (sesi) => `${kunciSesi(sesi)}:pengendali`;
const objek = (x) => x && typeof x === 'object' && !Array.isArray(x);
const teksSah = (x, maks = 200) => typeof x === 'string' && x.length <= maks;
const jawabanSah = (x) => Number.isFinite(x) || teksSah(x);
const soalSah = (x) => x == null || (objek(x) && teksSah(x.teks, 2000) && jawabanSah(x.jawaban)
  && (x.opsi === undefined || (Array.isArray(x.opsi) && x.opsi.length <= 40 && x.opsi.every(jawabanSah)))
  && (x.rincian === undefined || (Array.isArray(x.rincian) && x.rincian.length <= BATAS_OBJEK
    && x.rincian.every((r) => objek(r) && teksSah(r.jenis) && Number.isFinite(r.n) && r.n >= 0 && r.n <= BATAS_OBJEK))));
const bendaSah = (o) => objek(o) && teksSah(o.id) && teksSah(o.jenis)
  && ['aksi', 'status', 'posisi', 'emoji'].every((k) => o[k] === undefined || teksSah(o[k]))
  && ['px', 'py'].every((k) => o[k] === undefined || (Number.isFinite(o[k]) && o[k] >= 0 && o[k] <= 1))
  && (o.bagi === undefined || (Number.isInteger(o.bagi) && o.bagi >= 2 && o.bagi <= 12))
  && (o.diambil === undefined || (Number.isInteger(o.diambil) && o.diambil >= 0 && o.diambil <= (o.bagi || 12)));
const adeganSah = (x) => objek(x) && Array.isArray(x.objek) && x.objek.length <= BATAS_OBJEK + BATAS_ANIMASI_KELUAR
  && x.objek.filter((o) => o?.status !== 'pergi').length <= BATAS_OBJEK && x.objek.every(bendaSah)
  && new Set(x.objek.map((o) => o.id)).size === x.objek.length
  && ['latar', 'konsep'].every((k) => x[k] === undefined || teksSah(x[k]))
  && (x.versi === undefined || (Number.isSafeInteger(x.versi) && x.versi >= 0)) && soalSah(x.soal);
const captionSah = (x) => objek(x) && typeof x.teks === 'string' && x.teks.length <= 20000
  && typeof x.sementara === 'boolean' && Array.isArray(x.sorot) && x.sorot.length <= 500
  && x.sorot.every((s) => typeof s === 'string');
const frameSah = (x) => objek(x) && adeganSah(x.adegan) && (x.label === undefined || teksSah(x.label, 20000));
const sejarahSah = (x) => objek(x) && frameSah(x.sekarang)
  && ['lalu', 'maju'].every((k) => Array.isArray(x[k]) && x[k].length <= 30 && x[k].every(frameSah));

export function snapshotSah(x, sesi) {
  return objek(x) && x.format === FORMAT && x.sesi === sesi && ID_SAH.test(sesi || '')
    && ID_SAH.test(x.controllerId || '') && Number.isSafeInteger(x.generation) && x.generation > 0
    && Number.isSafeInteger(x.revision) && x.revision >= 0 && Number.isFinite(x.updatedAt)
    && adeganSah(x.adegan) && captionSah(x.caption)
    && (x.sejarah === undefined || (sejarahSah(x.sejarah) && JSON.stringify(x.sejarah.sekarang.adegan) === JSON.stringify(x.adegan)));
}

export function bacaSesi(sesi, storage = penyimpanan()) {
  if (!ID_SAH.test(sesi || '')) return null;
  try {
    const teks = storage?.getItem(kunciSesi(sesi));
    if (!teks || teks.length > MAKS_SIMPAN) return null;
    const x = JSON.parse(teks);
    return snapshotSah(x, sesi) && Date.now() - x.updatedAt < MAKS_USIA ? x : null;
  } catch { return null; }
}

export function simpanSesi(sesi, snapshot, storage = penyimpanan()) {
  if (!snapshotSah(snapshot, sesi)) return false;
  try {
    const teks = JSON.stringify(snapshot);
    if (teks.length > MAKS_SIMPAN || !storage) return false;
    storage.setItem(kunciSesi(sesi), teks);
    return true;
  } catch { return false; }
}

export function bacaOtoritas(sesi, storage = penyimpanan()) {
  try {
    const x = JSON.parse(storage?.getItem(kunciOtoritas(sesi)) || 'null');
    return objek(x) && ID_SAH.test(x.controllerId || '') && Number.isSafeInteger(x.generation) && x.generation > 0 ? x : null;
  } catch { return null; }
}

// Pembaca menolak revisi lama, pengendali lama, dan pesan dari kelas lain.
export function bolehTerimaSnapshot(lama, baru, sesi, otoritas = bacaOtoritas(sesi)) {
  if (!snapshotSah(baru, sesi)) return false;
  if (otoritas && (baru.controllerId !== otoritas.controllerId || baru.generation !== otoritas.generation)) return false;
  if (!lama) return true;
  // Dua tab dapat membaca generasi yang sama sebelum salah satunya menulis.
  // Penyimpanan menentukan pemenang; pesan tab yang kalah sudah ditolak di atas.
  if (otoritas && baru.controllerId !== lama.controllerId) return true;
  if (baru.generation !== lama.generation) return baru.generation > lama.generation;
  return baru.controllerId === lama.controllerId && baru.revision >= lama.revision;
}

export function buatSaluran(sesi, Channel = globalThis.BroadcastChannel) {
  const saluran = ID_SAH.test(sesi || '') && Channel ? new Channel(`suarapapan:v1:${sesi}`) : null;
  return {
    kirim(pesan) { if (objek(pesan)) saluran?.postMessage({ ...pesan, sesi }); },
    dengar(fn) {
      if (!saluran) return () => {};
      const h = (e) => { if (objek(e.data) && e.data.sesi === sesi) fn(e.data); };
      saluran.addEventListener('message', h);
      return () => saluran.removeEventListener('message', h);
    },
    tutup() { saluran?.close(); },
    tersedia: Boolean(saluran),
  };
}

/** Satu guru berwenang per sesi; membuka URL guru yang sama mengambil alih sesi. */
export function buatSesiGuru(sesi, awal, { storage = penyimpanan(), Channel = globalThis.BroadcastChannel } = {}) {
  const lama = bacaSesi(sesi, storage);
  const otoritas = { controllerId: idBaru(), generation: Math.max(lama?.generation || 0, bacaOtoritas(sesi, storage)?.generation || 0) + 1 };
  try { storage?.setItem(kunciOtoritas(sesi), JSON.stringify(otoritas)); } catch { /* tab tetap bekerja tanpa penyimpanan */ }
  let snapshot = { ...(lama || awal), format: FORMAT, sesi, ...otoritas, revision: (lama?.revision || 0) + 1, updatedAt: Date.now() };
  snapshot.caption = snapshot.caption || { ...CAPTION_KOSONG };
  let saluran = buatSaluran(sesi, Channel);
  const sambungan = () => saluran ||= buatSaluran(sesi, Channel);
  const aktif = () => {
    const kini = bacaOtoritas(sesi, storage);
    return !kini || (kini.controllerId === otoritas.controllerId && kini.generation === otoritas.generation);
  };
  const siarkan = () => { if (aktif()) sambungan().kirim({ type: 'snapshot', snapshot }); };
  simpanSesi(sesi, snapshot, storage);
  return {
    sesi, urlPapan: urlPapan(sesi), aktif,
    baca: () => snapshot,
    perbarui(perubahan) {
      if (!aktif()) return false;
      const baru = { ...snapshot, ...perubahan, format: FORMAT, sesi, ...otoritas, revision: snapshot.revision + 1, updatedAt: Date.now() };
      if (!snapshotSah(baru, sesi)) return false;
      snapshot = baru;
      simpanSesi(sesi, snapshot, storage);
      siarkan();
      return true;
    },
    dengar(fn) {
      return sambungan().dengar((m) => {
        if (!aktif()) return;
        if (m.type === 'halo') siarkan();
        if (m.type === 'geser' && (m.controllerId !== snapshot.controllerId || m.generation !== snapshot.generation || m.revision !== snapshot.revision)) return;
        fn?.(m);
      });
    },
    tutup() { saluran?.tutup(); saluran = null; },
  };
}

// Bentuk lama dipertahankan untuk pemanggil lain; tanpa ID sesi tidak ada siaran global.
let standar;
const saluranStandar = () => standar ||= buatSaluran(sesiDariUrl());
export const kirim = (pesan) => saluranStandar().kirim(pesan);
export const dengar = (fn) => saluranStandar().dengar(fn);
