import { uraiGemini, GalatUrai } from './_urai.js';
import { izinkan, dariCache, simpanCache } from './_batas.js';

const balas = (data, status = 200, header = {}) => Response.json(data, { status, headers: header });

export async function POST(request) {
  if (!izinkan(request, 'parse', { maks: 30 })) {
    return balas({ detail: 'Terlalu banyak permintaan dalam satu menit. Tunggu sebentar lalu coba lagi.' }, 429, { 'Retry-After': '30' });
  }
  const isi = await request.json().catch(() => null);
  const kalimat = String(isi?.kalimat ?? '').trim().slice(0, 400);
  const konteks = String(isi?.konteks ?? 'kosong').slice(0, 400) || 'kosong';
  if (!kalimat) return balas({ detail: 'Kalimat kosong.' }, 400);
  const kunci = `${kalimat.toLowerCase()}|${konteks.toLowerCase()}`;
  const tersimpan = dariCache(kunci);
  if (tersimpan) return balas({ ...tersimpan, sumber: `${tersimpan.sumber} (simpanan)`, ms: 0 });
  try {
    const hasil = await uraiGemini(kalimat, konteks);
    simpanCache(kunci, hasil);
    return balas(hasil);
  } catch (e) {
    if (e instanceof GalatUrai) return balas({ detail: e.message }, e.status);
    console.error('[parse]', e);
    return balas({ detail: 'Server mengalami galat. Coba lagi.' }, 500);
  }
}
