// Ground every model path in catalog IDs AND words the teacher actually used.
// A schema-correct response is not evidence that an asset was requested.
import { idAset, temukanAset, normalAset } from '../scene/katalog.js';

const identity = (s) => idAset(s) || normalAset(s);
const mentioned = (text, phrase) => (`-${normalAset(text)}-`).includes(`-${normalAset(phrase)}-`);

export function landaskanAdegan(scene, text, context = '') {
  const issues = [];
  const matches = temukanAset(text);
  const uttered = new Set(matches.map((a) => a.id));
  // Colors baked into a catalog name are supported (e.g. anak-berambut-merah).
  // Free-form recoloring is not implemented, so do not silently ignore it.
  const allMatches = [...matches, ...temukanAset(text, 'tempat'), ...temukanAset(text, 'latar')];
  for (const word of String(text).matchAll(/\b(merah|biru|hijau|kuning|putih|hitam|coklat|cokelat|ungu|oranye|pink|red|blue|green|yellow|white|black|purple|orange)\b/gi)) {
    if (!allMatches.some((a) => a.start <= word.index && a.end >= word.index + word[0].length)
      && scene.entitas.length) issues.push({ field: 'properti', target: word[0], reason: 'UNSUPPORTED_PROPERTY' });
  }
  const previous = String(context).split(/,\s*(?![^()]*\))/).map((s) => s.match(/^\s*(.+?)\s*:?\s+\d+/)?.[1]?.replace(/:$/, '').trim()).filter(Boolean);
  const known = new Set(previous.map(identity));
  const check = (name, field, allowContext = false) => {
    const id = idAset(name);
    if (!id) {
      issues.push({ field, target: name, reason: 'ASSET_NOT_AVAILABLE' });
      return;
    }
    if (!uttered.has(id) && !(allowContext && known.has(id))) issues.push({ field, target: name, reason: 'ASSET_NOT_MENTIONED' });
  };
  for (const entity of scene.entitas) {
    check(entity.jenis, 'entitas');
    checkPosition(entity.posisi);
  }
  for (const event of scene.peristiwa) {
    check(event.target, 'peristiwa', true);
    const labels = previous.filter((label) => identity(label) === identity(event.target));
    if (labels.length === 1) event.target = labels[0];
    checkPosition(event.posisi);
  }
  if (scene.tanya_benda) check(scene.tanya_benda, 'tanya_benda', true);
  if (scene.latar) {
    const id = idAset(scene.latar, 'tempat') || idAset(scene.latar, 'latar');
    // Existing hand-curated scene selectors have no miniature place asset.
    const legacy = ['langit', 'taman', 'malam', 'rumah', 'dalam-rumah', 'ruang-keluarga', 'ruang-bermain', 'pelabuhan', 'stasiun', 'angkasa', 'luar-angkasa', 'puskesmas', 'tepi-hutan', 'savana', 'sabana'];
    const evidence = [...temukanAset(text, 'tempat'), ...temukanAset(text, 'latar')].some((a) => a.id === id);
    if ((!id && !legacy.includes(normalAset(scene.latar))) || !(evidence || mentioned(text, scene.latar))) issues.push({ field: 'latar', target: scene.latar, reason: 'UNSUPPORTED_BACKGROUND' });
    else if (id) scene.latar = id;
  }
  function checkPosition(position) {
    if (!position) return;
    const m = position.match(/^(?:di|ke)\s+(atas|bawah|samping|sebelah|depan|belakang|dalam)\s+(.+)$/);
    if (!m) { issues.push({ field: 'posisi', target: position, reason: 'INVALID_POSITION' }); return; }
    check(m[2], 'posisi');
    // Do not let the provider invent a relation between two spoken objects.
    if (!new RegExp(`\\b(?:di|ke)\\s+${m[1] === 'samping' ? '(?:samping|sebelah)' : m[1]}\\b`, 'i').test(String(text))) issues.push({ field: 'posisi', target: position, reason: 'POSITION_NOT_MENTIONED' });
  }
  if (!issues.length) return scene;
  // Reject the whole transaction: keeping a known half of an unknown request
  // silently drops subjects and can produce a mathematically false lesson.
  return { ...scene, entitas: [], peristiwa: [], latar: '', pertanyaan: '', tanya_benda: '', tanya_jenis: 'tidak_ada', konsep: 'tidak_ada',
    needsConfirmation: true, notice: { code: 'ASSET_GROUNDING',
      message: `Aset atau rincian belum sesuai kalimat: ${[...new Set(issues.map((i) => i.target))].join(', ')}. Papan dipertahankan; pilih nama dari pustaka atau perjelas kalimat.`,
      unresolvedSpans: issues.map((i) => i.target), issues } };
}
