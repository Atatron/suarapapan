// Rebuild the model/browser/training vocabulary from the actual shipped assets.
// Run from any directory: node tools/bangun_katalog.mjs [--check]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const library = read('web/src/scene/pustaka.json');
const mapping = read('tools/aset_tampilan_39.json');
const aliases = read('web/src/scene/sinonim.json');
const backgrounds = read('web/src/scene/latar.json').latar;
const normalize = (s) => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const frames = new Map();
for (const sheet of mapping.sheets) sheet.items.forEach((item, index) => {
  const kind = item.kind || sheet.kind;
  if (!library[kind]?.[item.id]) throw new Error(`Missing ${kind}/${item.id}`);
  const key = `${kind}/${item.id}`;
  if (frames.has(key)) throw new Error(`Duplicate frame: ${key}`);
  frames.set(key, { source: item.source, sheet: sheet.number, sheetSlug: sheet.slug,
    frame: index, row: Math.floor(index / 4), column: index % 4 });
});
const assets = [];
for (const kind of ['obj', 'tempat']) for (const [id, item] of Object.entries(library[kind])) {
  const frame = frames.get(`${kind}/${id}`);
  const name = item.n || item.nama || id.replaceAll('-', ' ');
  const words = [id, name.replace(/\s*\(.*?\)/g, '').trim(), frame?.source,
    ...Object.entries(aliases[kind]).filter(([, target]) => target === id).map(([alias]) => alias)].filter(Boolean);
  assets.push({ id, kind, name, category: item.k || frame?.sheetSlug || 'tempat', aliases: [...new Set(words.map(normalize))].sort(),
    source: frame?.source || null, sheet: frame?.sheet || null, sheetSlug: frame?.sheetSlug || null,
    frame: frame?.frame ?? null, row: frame?.row ?? null, column: frame?.column ?? null,
    path: `/aset/${kind}/${id}.webp` });
}
for (const [id, item] of Object.entries(backgrounds)) assets.push({ id, kind: 'latar', name: item.nama,
  category: 'latar-adegan', aliases: [...new Set([id, normalize(item.nama), ...Object.entries(aliases.latar || {}).filter(([, target]) => target === id).map(([alias]) => normalize(alias))])],
  source: null, sheet: null, frame: null, path: `/aset/latar/${id}.webp` });
for (const asset of assets) {
  if (!fs.existsSync(new URL(`web/public${asset.path}`, root))) throw new Error(`Missing file: ${asset.path}`);
}
const output = JSON.stringify(assets, null, 2) + '\n';
const target = new URL('web/src/scene/katalog.json', root);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('Catalog is stale. Run node tools/bangun_katalog.mjs');
} else fs.writeFileSync(target, output);
console.log(JSON.stringify({ assets: assets.length, sheets: mapping.sheets.length, frames: frames.size,
  counts: Object.fromEntries(['obj', 'tempat', 'latar'].map((kind) => [kind, assets.filter((a) => a.kind === kind).length])),
  catalog: fileURLToPath(target) }));
