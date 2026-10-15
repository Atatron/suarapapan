import { transkripsiGemini } from './_suara.js';
import { GalatUrai } from './_urai.js';

const balas = (data, status = 200) => Response.json(data, { status });
const MIME = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/webm']);

export async function POST(request) {
  const isi = await request.json().catch(() => null);
  const mime = MIME.has(isi?.mime) ? isi.mime : 'audio/wav';
  try {
    return balas(await transkripsiGemini({ audio: isi?.audio, mime, konteks: isi?.konteks, urai: isi?.urai === true }));
  } catch (e) {
    if (e instanceof GalatUrai) return balas({ detail: e.message }, e.status);
    console.error('[transkripsi]', e);
    return balas({ detail: 'Server mengalami galat. Coba lagi.' }, 500);
  }
}
