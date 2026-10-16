import { uraiLokal } from './lokal.js';

// Urutan: (1) pola sederhana yang terukur andal dipahami langsung di browser (milidetik, tanpa kuota),
// (2) selain itu Gemini lewat server, (3) jika Gemini gagal (kuota gratis habis, 503, tanpa internet)
// pakai tebakan terbaik dari aturan lokal, supaya kelas tidak berhenti.
export async function uraikan(kalimat, konteks) {
  const lokal = uraiLokal(kalimat, konteks);
  if (lokal?.yakin === 'tinggi') return { hasil: lokal.hasil, sumber: lokal.sumber, ms: lokal.ms };
  let r;
  try {
    r = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kalimat, konteks }),
    });
  } catch {
    if (lokal) return { hasil: lokal.hasil, sumber: 'aturan lokal (tanpa server)', ms: lokal.ms };
    throw new Error('Server tidak bisa dihubungi. Periksa koneksi internet, atau jalankan server Python jika memakai mode offline.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (lokal) return { hasil: lokal.hasil, sumber: 'aturan lokal (Gemini tidak tersedia)', ms: lokal.ms };
    throw new Error(data.detail || `Server ML mengembalikan galat ${r.status}.`);
  }
  return data; // { hasil, sumber, ms }
}

export async function cekKesehatan() {
  try {
    const r = await fetch('/api/kesehatan');
    return r.ok ? await r.json() : { server: false, ollama: false };
  } catch {
    return { server: false, ollama: false };
  }
}

/** Audio WAV (base64) → { transkrip, kalimat[], hasil?, sumber, ms } lewat Gemini. `urai` = sekalian urai kalimat pertama. */
export async function transkripsi(audio, konteks, { urai = false, mime = 'audio/wav' } = {}) {
  let r;
  try {
    r = await fetch('/api/transkripsi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio, mime, konteks, urai }),
    });
  } catch {
    throw new Error('Server tidak bisa dihubungi untuk memeriksa ucapan.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `Transkripsi gagal (galat ${r.status}).`);
  return data;
}
