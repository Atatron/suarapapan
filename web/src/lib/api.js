import { uraiLokal } from './lokal.js';
import { rapikan } from './rapikan.js';

// Urutan: (1) pola sederhana yang terukur andal dipahami langsung di browser (milidetik, tanpa kuota),
// (2) selain itu Gemini lewat server, (3) jika Gemini gagal (kuota gratis habis, 503, tanpa internet)
// tawarkan tafsiran lokal dengan kepastian dan kewajiban tinjau tetap utuh.
export async function uraikan(kalimat, konteks, { signal, timeoutMs = 18000 } = {}) {
  if (signal?.aborted) throw batal();
  const lokal = uraiLokal(kalimat, konteks);
  if (lokal?.yakin === 'tinggi' || ['NEGATION_SCOPE', 'CONDITIONAL_COMMAND', 'QUOTED_COMMAND', 'SELF_CORRECTION', 'LIMITED_QUANTITY', 'UNSUPPORTED_ARITHMETIC'].includes(lokal?.notice?.code)) return { ...lokal, availability: null };
  try {
    const data = await kirim('/api/parse', { kalimat, konteks }, { signal, timeoutMs });
    const hasil = rapikan(data.hasil, kalimat, konteks);
    const metadata = tinjauan(data, hasil, lokal);
    return { ...data, hasil, ...metadata, availability: { status: 'available', reason: null } };
  } catch (e) {
    if (signal?.aborted || e?.name === 'AbortError') throw batal();
    const reason = e.code || 'NETWORK';
    if (lokal) return { ...lokal, sumber: 'aturan lokal (layanan tidak tersedia)', availability: { status: 'unavailable', reason } };
    throw e;
  }
}

export async function cekKesehatan({ signal, timeoutMs = 5000 } = {}) {
  try {
    return await kirim('/api/kesehatan', undefined, { signal, timeoutMs });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    return { server: false, ollama: false };
  }
}

/** Audio WAV (base64) → { transkrip, kalimat[], hasil?, sumber, ms } lewat Gemini. `urai` = sekalian urai kalimat pertama. */
export async function transkripsi(audio, konteks, { urai = false, mime = 'audio/wav', signal, timeoutMs = 18000 } = {}) {
  const data = await kirim('/api/transkripsi', { audio, mime, konteks, urai }, { signal, timeoutMs });
  if (data.transkrip !== undefined && typeof data.transkrip !== 'string'
    || data.kalimat !== undefined && (!Array.isArray(data.kalimat) || data.kalimat.some((k) => typeof k !== 'string'))) throw galat('Format transkrip layanan tidak valid. Ketik kalimat atau coba lagi.', 'INVALID_RESPONSE');
  if (!data.hasil) return { ...data, availability: { status: 'available', reason: null } };
  const kalimat = data.kalimat?.[0] || data.transkrip || '';
  const hasil = rapikan(data.hasil, kalimat, konteks);
  const lokal = uraiLokal(kalimat, konteks);
  const aman = lokal?.yakin === 'tinggi' || lokal?.notice?.code === 'SELF_CORRECTION' ? lokal.hasil : hasil;
  return { ...data, hasil: aman, ...tinjauan(data, aman, lokal), availability: { status: 'available', reason: null } };
}

function tinjauan(data, hasil, lokal) {
  const kurangYakin = data.yakin === 'rendah' || typeof data.yakin === 'number' && (!Number.isFinite(data.yakin) || data.yakin < 0.85);
  const needsConfirmation = Boolean(data.needsConfirmation || hasil.needsConfirmation || lokal?.needsConfirmation || kurangYakin || !lokal);
  const notice = data.notice || (kurangYakin ? { code: 'LOW_PROVIDER_CONFIDENCE', message: 'Pengurai belum yakin. Periksa jenis, jumlah, dan tindakan sebelum menampilkan.', unresolvedSpans: hasil.notice?.unresolvedSpans || [] } : null) || hasil.notice || lokal?.notice
    || (!lokal ? { code: 'MODEL_REVIEW', message: 'Kalimat ini memerlukan tafsiran model. Periksa jenis, jumlah, dan tindakan sebelum menampilkan.', unresolvedSpans: [] } : null);
  return { yakin: typeof data.yakin === 'number' ? data.yakin : needsConfirmation ? 'rendah' : 'tinggi', needsConfirmation, notice };
}

const batal = () => new DOMException('Permintaan dibatalkan.', 'AbortError');
const galat = (message, code, status) => Object.assign(new Error(message), { code, status });

async function kirim(url, body, { signal, timeoutMs }) {
  if (signal?.aborted) throw batal();
  const controller = new AbortController();
  let timer;
  let onAbort;
  const berhenti = new Promise((_, reject) => {
    onAbort = () => { controller.abort(); reject(batal()); };
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      reject(galat('Layanan terlalu lama menjawab. Kalimat tetap tersimpan; coba lagi.', 'TIMEOUT'));
      controller.abort();
    }, Math.max(1, Math.min(Number(timeoutMs) || 18000, 20000)));
  });
  try {
    const jalankan = async () => {
      const r = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        const detail = String(data?.detail || '');
        const code = r.status === 429 || /kuota|quota|resource_exhausted/i.test(detail) ? 'QUOTA' : r.status === 401 || r.status === 403 || /api.key|kunci/i.test(detail) ? 'CONFIGURATION' : r.status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'REQUEST_REJECTED';
        throw galat(detail || `Layanan mengembalikan galat ${r.status}. Coba lagi.`, code, r.status);
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw galat('Format jawaban layanan tidak valid. Coba lagi.', 'INVALID_RESPONSE');
      return data;
    };
    return await Promise.race([jalankan(), berhenti]);
  } catch (e) {
    if (signal?.aborted || e?.name === 'AbortError') throw batal();
    if (e?.code) throw e;
    throw galat('Server tidak bisa dihubungi. Periksa koneksi, lalu coba lagi.', 'NETWORK');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
