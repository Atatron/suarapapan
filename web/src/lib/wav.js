// Pembantu audio murni (tanpa DOM), supaya bisa diuji di Node.

export const LAJU = 16000; // 16 kHz mono cukup untuk ucapan dan kecil: 32 KB per detik

/** Float32 [-1, 1] → WAV 16-bit PCM mono (ArrayBuffer). */
export function pcmKeWav(pcm, laju = LAJU) {
  const n = pcm.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const tulis = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  tulis(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); tulis(8, 'WAVE');
  tulis(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, laju, true); v.setUint32(28, laju * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  tulis(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/** Akar rata-rata kuadrat: 0 = hening, ~0.05–0.2 = orang bicara dekat mikrofon. */
export function hitungRms(pcm) {
  if (!pcm.length) return 0;
  let jumlah = 0;
  for (let i = 0; i < pcm.length; i++) jumlah += pcm[i] * pcm[i];
  return Math.sqrt(jumlah / pcm.length);
}

/** Memperkuat rekaman pelan sampai puncaknya ±0,9 (maksimal 8×), tanpa memotong. */
export function normalkan(pcm) {
  let puncak = 0;
  for (let i = 0; i < pcm.length; i++) puncak = Math.max(puncak, Math.abs(pcm[i]));
  if (puncak < 1e-4) return pcm;
  const g = Math.min(8, 0.9 / puncak);
  if (g <= 1.05) return pcm;
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] * g;
  return out;
}

/** ArrayBuffer → base64 (tanpa menumpuk string besar sekaligus). */
export function keBase64(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Prapenyaring energi (bukan pengenal ucapan): ucapan punya ledakan energi yang jelas
 * di atas lantai derau, sedangkan hening, dengung kipas, dan desis stabil tidak.
 * Ini lapisan pengaman di luar Gemini, yang kadang "mendengar" kalimat di rekaman sunyi.
 *   - lantai  = energi bingkai 20 ms pada persentil ke-10
 *   - ambang  = max(minimum, 4 × lantai)
 *   - ucapan  = total ≥ 300 ms di atas ambang dan sedikitnya satu rentetan ≥ 100 ms
 */
export function adaUcapan(pcm, { laju = LAJU, minimum = 0.004 } = {}) {
  const ukuran = Math.round(laju * 0.02);
  const n = Math.floor(pcm.length / ukuran);
  if (n < 10) return { ada: false, bingkaiUcapan: 0, terpanjang: 0 };
  const e = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    let j = 0;
    for (let i = b * ukuran; i < (b + 1) * ukuran; i++) j += pcm[i] * pcm[i];
    e[b] = Math.sqrt(j / ukuran);
  }
  const urut = Float32Array.from(e).sort();
  const lantai = urut[Math.floor(n * 0.1)];
  const ambang = Math.max(minimum, lantai * 4);
  let total = 0;
  let rentet = 0;
  let terpanjang = 0;
  for (const v of e) {
    if (v > ambang) { total++; rentet++; if (rentet > terpanjang) terpanjang = rentet; } else rentet = 0;
  }
  return { ada: total >= 15 && terpanjang >= 5, bingkaiUcapan: total, terpanjang };
}

let modulVad;
/** WebRTC GMM VAD lokal, sesudah prapenyaring energi. Tidak mengunggah audio. */
export async function deteksiUcapan(pcm, { laju = LAJU, minimum = 0.004 } = {}) {
  if (!(pcm instanceof Float32Array) || ![8000, 16000, 32000, 48000].includes(laju)
    || pcm.length > laju * 30 || pcm.some((x) => !Number.isFinite(x))) {
    throw new Error('Format audio tidak valid. Gunakan WAV PCM mono 16-bit, maksimal 30 detik.');
  }
  const energi = adaUcapan(pcm, { laju, minimum });
  if (!energi.ada) return { ...energi, metode: 'energi' };
  // Hanya byte WASM yang disimpan bersama aplikasi; tidak ada CDN atau telemetri.
  if (!modulVad) modulVad = import('./vendor/libfvad.js').then(({ default: b64 }) =>
    WebAssembly.compile(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
  let lib;
  try { lib = (await WebAssembly.instantiate(await modulVad)).exports; }
  catch { modulVad = null; throw new Error('Pemeriksa ucapan tidak tersedia. Gunakan input teks, lalu muat ulang halaman.'); }
  const handle = lib.fvad_new();
  const ukuran = laju / 50; // 20 ms; ukuran yang didukung libfvad
  const ptr = lib.malloc(ukuran * 2);
  if (!handle || !ptr) {
    if (ptr) lib.free(ptr);
    if (handle) lib.fvad_free(handle);
    throw new Error('Pemeriksa ucapan kehabisan memori. Gunakan input teks.');
  }
  let total = 0;
  let rentet = 0;
  let terpanjang = 0;
  try {
    if (lib.fvad_set_mode(handle, 3) < 0 || lib.fvad_set_sample_rate(handle, laju) < 0) throw new Error('Konfigurasi pemeriksa ucapan tidak valid.');
    const frame = new Int16Array(lib.memory.buffer, ptr, ukuran);
    for (let awal = 0; awal + ukuran <= pcm.length; awal += ukuran) {
      let lintasanNol = 0;
      for (let i = 0; i < ukuran; i++) {
        const x = Math.max(-1, Math.min(1, pcm[awal + i]));
        frame[i] = x * (x < 0 ? 32768 : 32767);
        if (i && (pcm[awal + i - 1] >= 0) !== (x >= 0)) lintasanNol++;
      }
      const suara = lib.fvad_process(handle, ptr, ukuran);
      if (suara < 0) throw new Error('Bingkai audio tidak dapat diperiksa. Gunakan input teks.');
      // Derau putih berdenyut bisa menipu WebRTC. Tolak bingkai desis broadband;
      // frikatif ucapan bisa terlewat, jadi keputusan memakai rangkaian, bukan semua bingkai.
      // Ini pagar tambahan yang diuji, bukan jaminan semua derau kelas tertolak.
      if (suara === 1 && lintasanNol / (ukuran - 1) < 0.35) { total++; rentet++; terpanjang = Math.max(terpanjang, rentet); }
      else rentet = 0;
    }
    return { ada: total >= 15 && terpanjang >= 5, bingkaiUcapan: total, terpanjang, metode: 'webrtc' };
  } finally {
    lib.free(ptr);
    lib.fvad_free(handle);
  }
}

/** WAV 16-bit PCM (ArrayBuffer atau Buffer) → { pcm: Float32Array, laju } atau null jika bukan WAV yang dikenal. */
export function wavKePcm(data) {
  if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) return null;
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (u8.length < 44) return null;
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const teks = (o, n) => String.fromCharCode(...u8.subarray(o, o + n));
  if (teks(0, 4) !== 'RIFF' || teks(8, 4) !== 'WAVE') return null;
  if (v.getUint32(4, true) !== u8.length - 8) return null;
  let o = 12;
  let laju = 0;
  let bit = 0;
  let kanal = 0;
  while (o + 8 <= u8.length) {
    const id = teks(o, 4);
    const ukuran = v.getUint32(o + 4, true);
    if (o + 8 + ukuran > u8.length) return null;
    if (id === 'fmt ') {
      if (ukuran < 16 || v.getUint16(o + 8, true) !== 1) return null;
      kanal = v.getUint16(o + 10, true);
      laju = v.getUint32(o + 12, true);
      bit = v.getUint16(o + 22, true);
      if (kanal !== 1 || bit !== 16 || ![8000, 16000, 32000, 48000].includes(laju)
        || v.getUint16(o + 20, true) !== 2 || v.getUint32(o + 16, true) !== laju * 2) return null;
    } else if (id === 'data') {
      if (bit !== 16 || !laju || !kanal || ukuran % 2) return null;
      const awal = o + 8;
      const jumlah = Math.floor(Math.min(ukuran, u8.length - awal) / (2 * kanal));
      const pcm = new Float32Array(jumlah);
      for (let i = 0; i < jumlah; i++) pcm[i] = v.getInt16(awal + i * 2 * kanal, true) / 32768;
      return { pcm, laju };
    }
    o += 8 + ukuran + (ukuran % 2);
  }
  return null;
}
