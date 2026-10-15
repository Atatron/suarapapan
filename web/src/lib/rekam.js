// Merekam suara guru untuk dikirim ke transkripsi Gemini. Berjalan berdampingan
// dengan Web Speech API (yang hanya dipakai untuk caption langsung).
import { LAJU, pcmKeWav, hitungRms, normalkan, keBase64, adaUcapan } from './wav.js';

const BATAS_DETIK = 30;

export function rekamDidukung() {
  return typeof window !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && (window.AudioContext || window.webkitAudioContext));
}

const PESAN = {
  NotAllowedError: 'Izin mikrofon ditolak. Klik ikon gembok di address bar, izinkan mikrofon, lalu muat ulang halaman.',
  NotFoundError: 'Mikrofon tidak ditemukan. Periksa apakah mikrofon atau earphone sudah tersambung.',
  NotReadableError: 'Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.',
};
export const pesanMik = (e) => PESAN[e?.name] || `Mikrofon tidak bisa dibuka (${e?.name || 'galat'}).`;

// Aliran mikrofon dibuka sekali dan dipertahankan, supaya kata pertama guru
// tidak terpotong oleh waktu membuka mikrofon pada setiap tahan tombol.
let aliran = null;
export async function siapkanMik() {
  if (aliran?.getAudioTracks().some((t) => t.readyState === 'live')) return aliran;
  aliran = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  return aliran;
}

export async function mikSudahDiizinkan() {
  try {
    const s = await navigator.permissions?.query({ name: 'microphone' });
    return s?.state === 'granted';
  } catch {
    return false;
  }
}

function pilihMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

/** Decode hasil rekaman → PCM 16 kHz mono. */
async function dekode(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const n = Math.max(1, Math.ceil(audio.duration * LAJU));
    const off = new OfflineAudioContext(1, n, LAJU);
    const sumber = off.createBufferSource();
    sumber.buffer = audio;
    sumber.connect(off.destination);
    sumber.start();
    const hasil = await off.startRendering();
    return { pcm: hasil.getChannelData(0), durasi: audio.duration };
  } finally {
    ctx.close?.();
  }
}

/**
 * Mulai merekam. Mengembalikan { berhenti() } yang menghasilkan
 * { audio: base64 WAV, mime, durasi, rms, ucapan } atau null jika rekaman tidak berguna.
 */
export async function mulaiRekam() {
  const s = await siapkanMik();
  const potongan = [];
  const mime = pilihMime();
  const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
  rec.ondataavailable = (e) => { if (e.data?.size) potongan.push(e.data); };
  const selesai = new Promise((res) => { rec.onstop = res; });
  rec.start();
  const pengaman = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, BATAS_DETIK * 1000);
  let hasil = null;

  return {
    async berhenti() {
      clearTimeout(pengaman);
      if (hasil) return hasil;
      hasil = (async () => {
        if (rec.state !== 'inactive') rec.stop();
        await selesai;
        if (!potongan.length) return null;
        const { pcm, durasi } = await dekode(new Blob(potongan, { type: rec.mimeType || mime }));
        const rms = hitungRms(pcm);
        const ucapan = adaUcapan(pcm).ada;
        return { audio: keBase64(pcmKeWav(normalkan(pcm))), mime: 'audio/wav', durasi, rms, ucapan };
      })().catch(() => null);
      return hasil;
    },
  };
}
