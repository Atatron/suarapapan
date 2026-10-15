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
