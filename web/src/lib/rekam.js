// Merekam suara guru untuk dikirim ke transkripsi Gemini. Berjalan berdampingan
// dengan Web Speech API (yang hanya dipakai untuk caption langsung).
import { LAJU, pcmKeWav, hitungRms, normalkan, keBase64, deteksiUcapan } from './wav.js';

const BATAS_DETIK = 30;

export function rekamDidukung() {
  return typeof window !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && (window.AudioContext || window.webkitAudioContext));
}

const PESAN = {
  NotAllowedError: 'Izin mikrofon ditolak. Klik ikon gembok di address bar, izinkan mikrofon, lalu muat ulang halaman.',
  NotFoundError: 'Mikrofon tidak ditemukan. Periksa apakah mikrofon atau earphone sudah tersambung.',
  NotReadableError: 'Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.',
  MicrophoneDisconnectedError: 'Mikrofon terputus atau izinnya dicabut. Sambungkan dan izinkan mikrofon, lalu coba lagi.',
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
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) throw new Error('Durasi rekaman tidak valid.');
    const durasi = Math.min(audio.duration, BATAS_DETIK);
    const n = Math.max(1, Math.ceil(durasi * LAJU));
    const off = new OfflineAudioContext(1, n, LAJU);
    const sumber = off.createBufferSource();
    sumber.buffer = audio;
    sumber.connect(off.destination);
    sumber.start();
    const hasil = await off.startRendering();
    return { pcm: hasil.getChannelData(0), durasi };
  } finally {
    await ctx.close?.();
  }
}

/**
 * Mulai merekam. Mengembalikan { berhenti() } yang menghasilkan
 * { audio: base64 WAV, mime, durasi, rms, ucapan } atau null jika rekaman tidak berguna.
 */
export async function mulaiRekam({ saatBerhenti, saatGalat } = {}) {
  const s = await siapkanMik();
  const trek = s.getAudioTracks();
  if (!trek.length || !trek.some((t) => t.readyState === 'live')) throw Object.assign(new Error('Mikrofon terputus.'), { name: 'MicrophoneDisconnectedError' });
  const potongan = [];
  const mime = pilihMime();
  const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
  rec.ondataavailable = (e) => { if (e.data?.size) potongan.push(e.data); };
  let galat = null;
  let pengaman;
  let tuntas = false;
  let akhiri;
  const selesai = new Promise((res) => { akhiri = res; });
  const bersihkan = () => {
    clearTimeout(pengaman);
    for (const t of trek) t.removeEventListener?.('ended', terputus);
  };
  const tutup = () => {
    if (tuntas) return;
    tuntas = true; bersihkan(); akhiri(); saatBerhenti?.();
  };
  const hentikan = () => {
    if (rec.state !== 'inactive') {
      try { rec.stop(); } catch (e) { galat ||= e; tutup(); }
    }
  };
  const gagal = (e) => {
    if (galat || tuntas) return;
    galat = e;
    // Jadwalkan stop lebih dulu: callback UI boleh membatalkan pekerjaan ini.
    hentikan(); saatGalat?.(e);
    if (rec.state === 'inactive') tutup();
  };
  const terputus = () => {
    if (aliran === s) aliran = null;
    gagal(Object.assign(new Error(PESAN.MicrophoneDisconnectedError), { name: 'MicrophoneDisconnectedError' }));
  };
  for (const t of trek) t.addEventListener?.('ended', terputus, { once: true });
  rec.onstop = tutup;
  rec.onerror = (e) => gagal(e.error || Object.assign(new Error('Rekaman mikrofon gagal.'), { name: 'NotReadableError' }));
  try { rec.start(); } catch (e) { bersihkan(); throw e; }
  pengaman = setTimeout(hentikan, BATAS_DETIK * 1000);
  let hasil = null;

  return {
    berhenti() {
      clearTimeout(pengaman);
      if (hasil) return hasil;
      // Tetapkan promise sebelum stop memicu callback; pemanggilan ulang tetap satu finalisasi.
      hasil = Promise.resolve().then(async () => {
        hentikan();
        await selesai;
        if (galat) throw galat;
        if (!potongan.length) return null;
        const { pcm, durasi } = await dekode(new Blob(potongan, { type: rec.mimeType || mime }));
        const rms = hitungRms(pcm);
        // Mikrofon laptop sering pelan: ucapan dinilai SETELAH diperkuat (normalkan), bukan dari volume mentah.
        const keras = normalkan(pcm);
        let puncak = 0;
        for (let i = 0; i < pcm.length; i++) puncak = Math.max(puncak, Math.abs(pcm[i]));
        const ucapan = (await deteksiUcapan(keras)).ada;
        return { audio: keBase64(pcmKeWav(keras)), mime: 'audio/wav', durasi, rms, puncak, ucapan };
      });
      return hasil;
    },
  };
}

/**
 * Pengukur level mikrofon untuk tombol "Tes mikrofon": memanggil onLevel(rms) sekitar 12 kali per detik.
 * Mengembalikan { berhenti(), label, bisu } supaya guru melihat mikrofon mana yang dipakai.
 */
export async function mulaiUkurLevel(onLevel) {
  const s = await siapkanMik();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  await ctx.resume?.();
  const sumber = ctx.createMediaStreamSource(s);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  sumber.connect(an);
  const buf = new Float32Array(an.fftSize);
  const t = setInterval(() => { an.getFloatTimeDomainData(buf); onLevel(hitungRms(buf)); }, 80);
  const trek = s.getAudioTracks()[0];
  return {
    label: trek?.label || 'mikrofon bawaan',
    bisu: Boolean(trek?.muted),
    berhenti() { clearInterval(t); try { sumber.disconnect(); } catch { /* sudah putus */ } ctx.close?.(); },
  };
}
