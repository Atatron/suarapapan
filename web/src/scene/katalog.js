import catalog from './katalog.json' with { type: 'json' };

export const katalogAset = catalog.filter((a) => a.kind !== 'latar');
export const katalogLatar = catalog.filter((a) => a.kind === 'latar');
export const normalAset = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const indexes = new Map();
export const konflikAlias = [];
for (const kind of ['obj', 'tempat', 'latar']) {
  const items = catalog.filter((a) => a.kind === kind);
  const canonical = new Map(items.map((a) => [a.id, a]));
  const candidates = new Map();
  for (const item of items) for (const phrase of item.aliases) {
    if (!candidates.has(phrase)) candidates.set(phrase, new Set());
    candidates.get(phrase).add(item);
  }
  const exact = new Map(canonical);
  for (const [phrase, options] of candidates) {
    if (exact.has(phrase)) continue;
    if (options.size === 1) exact.set(phrase, [...options][0]);
    else konflikAlias.push({ kind, phrase, ids: [...options].map((a) => a.id) });
  }
  indexes.set(kind, { exact, max: Math.max(...[...exact.keys()].map((a) => a.split('-').length)) });
}

/** Exact canonical ID or supported synonym. No fuzzy/subword substitution. */
export function idAset(text, kind = 'obj') {
  const key = normalAset(text);
  const exact = indexes.get(kind)?.exact;
  const repeated = key.match(/^([a-z0-9]+)-\1$/);
  return exact?.get(key)?.id || (repeated && exact?.get(repeated[1])?.id) || null;
}

/** Longest phrase wins, with original input offsets and whole-word boundaries. */
export function temukanAset(text, kind = 'obj') {
  const input = String(text || '');
  const words = [...input.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ key: normalAset(m[0]), start: m.index, end: m.index + m[0].length }));
  const index = indexes.get(kind);
  if (!index) return [];
  const result = [];
  for (let i = 0; i < words.length;) {
    let match = null;
    for (let n = Math.min(index.max, words.length - i); n >= 1; n--) {
      // Never join names across punctuation or sentence boundaries.
      if (n > 1 && !/^[\s\p{L}\p{N}'’-]+$/u.test(input.slice(words[i].start, words[i + n - 1].end))) continue;
      let key = words.slice(i, i + n).map((w) => w.key).join('-');
      const item = index.exact.get(key) || (n === 1 && index.exact.get(key.replace(/nya$/, '')));
      if (item) { match = { ...item, phrase: input.slice(words[i].start, words[i + n - 1].end), start: words[i].start, end: words[i + n - 1].end, length: n }; break; }
    }
    if (match) { result.push(match); i += match.length; } else i++;
  }
  return result;
}

export function cocokkanAset(text, kind = 'obj') {
  return temukanAset(text, kind).sort((a, b) => b.length - a.length || a.start - b.start)[0] || null;
}

export function aliasAset(kind = 'obj') {
  return Object.fromEntries([...indexes.get(kind).exact].map(([phrase, a]) => [phrase, a.id]));
}

export function namaAset(text, kind = 'obj') {
  if (kind === 'obj' && ['anak','orang','manusia','seseorang','teman','murid','siswa','adik','kakak'].includes(text)) return text;
  return indexes.get(kind)?.exact.get(normalAset(text))?.name || String(text || '').replaceAll('-', ' ');
}

export function teksKatalog(kind = 'obj') {
  return catalog.filter((a) => a.kind === kind).map((a) => `${a.id}: ${a.aliases.filter((p) => p !== a.id).map((p) => p.replaceAll('-', ' ')).join(' | ')}`).join('\n');
}
