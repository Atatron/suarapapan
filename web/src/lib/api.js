export async function uraikan(kalimat, konteks) {
  let r;
  try {
    r = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kalimat, konteks }),
    });
  } catch {
    throw new Error('Server tidak bisa dihubungi. Periksa koneksi internet, atau jalankan server Python jika memakai mode offline.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `Server ML mengembalikan galat ${r.status}.`);
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
