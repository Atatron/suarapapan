import { uraiGemini, GalatUrai } from './_urai.js';

const balas = (data, status = 200) => Response.json(data, { status });

export async function POST(request) {
  const isi = await request.json().catch(() => null);
  const kalimat = String(isi?.kalimat ?? '').trim().slice(0, 400);
  const konteks = String(isi?.konteks ?? 'kosong').slice(0, 400) || 'kosong';
  if (!kalimat) return balas({ detail: 'Kalimat kosong.' }, 400);
  try {
    return balas(await uraiGemini(kalimat, konteks));
  } catch (e) {
    if (e instanceof GalatUrai) return balas({ detail: e.message }, e.status);
    console.error('[parse]', e);
    return balas({ detail: 'Server mengalami galat. Coba lagi.' }, 500);
  }
}
