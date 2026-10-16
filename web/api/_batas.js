// Pengaman ringan untuk endpoint publik yang memakai kuota Gemini milik tim.
// Memori ini per instans serverless (tidak dibagi antar instans), jadi ini penghalang
// terhadap pemakaian berlebihan yang tidak disengaja atau skrip sederhana, bukan perlindungan penuh.
const jendela = new Map(); // "nama|ip" → { mulai, n }
const MAKS_ENTRI = 2000;

export function ipDari(request) {
  const xff = request.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || request.headers.get('x-real-ip') || 'tak-dikenal';
}

/** true = boleh; false = sudah melewati `maks` permintaan dalam `detik` detik. */
export function izinkan(request, nama, { maks, detik = 60 }, sekarang = Date.now()) {
  const k = `${nama}|${ipDari(request)}`;
  const e = jendela.get(k);
  if (!e || sekarang - e.mulai > detik * 1000) {
    if (jendela.size >= MAKS_ENTRI) for (const [kk, v] of jendela) if (sekarang - v.mulai > detik * 1000) jendela.delete(kk);
    jendela.set(k, { mulai: sekarang, n: 1 });
    return true;
  }
  e.n++;
  return e.n <= maks;
}

export const _kosongkan = () => jendela.clear();

// Kalimat yang sama (mis. contoh di README yang dicoba banyak juri) tidak perlu memanggil Gemini lagi.
const cache = new Map(); // kunci → { nilai, sampai }
const MAKS_CACHE = 300;
const UMUR_CACHE_MS = 30 * 60 * 1000;

export function dariCache(kunci, sekarang = Date.now()) {
  const e = cache.get(kunci);
  if (!e) return null;
  if (e.sampai < sekarang) { cache.delete(kunci); return null; }
  return e.nilai;
}

export function simpanCache(kunci, nilai, sekarang = Date.now()) {
  if (cache.size >= MAKS_CACHE) cache.delete(cache.keys().next().value);
  cache.set(kunci, { nilai, sampai: sekarang + UMUR_CACHE_MS });
}

export const _kosongkanCache = () => cache.clear();
