// Arithmetic is computed by code. The model never supplies an accepted answer.
import { idAset } from '../scene/katalog.js';

export const OPERATOR = Object.freeze({ tambah: '+', kurang: '−', kali: '×', bagi: '÷' });
const WORDS = { nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11 };
const NUMBER = '(?:\\d+|(?:nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)(?:\\s+(?:belas|puluh)(?:\\s+(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))?)?)';
const OPS = '(?:ditambah|ditambahkan|tambah|plus|dikurangi|kurang|minus|dikali|dikalikan|kali|dibagi|bagi|[+−×÷*/-]|x)(?:\\s+dengan)?';

function angka(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const [a, scale, rest] = text.split(/\s+/);
  return scale === 'belas' ? WORDS[a] + 10 : scale === 'puluh' ? WORDS[a] * 10 + (WORDS[rest] || 0) : WORDS[a];
}

export function uraiOperasi(input) {
  const text = String(input || '').toLowerCase().trim()
    .replace(/^(?:(?:berapa (?:hasil(?:nya)?(?: dari)?|nilai dari))|hitung(?:lah)?(?: hasil(?: dari)?)?)\s+/,'')
    .replace(/\s*(?:=\s*\??|sama dengan(?: berapa)?|hasilnya berapa)[.!?]*$/,'').replace(/[.!?]+$/,'').trim();
  const grouping = text.match(new RegExp(`^(?:ada )?(${NUMBER}) (?:kelompok|baris) (?:yang )?(?:masing-masing|masing masing|berisi) (${NUMBER}) (.+)$`));
  if (grouping) {
    const jenis = idAset(grouping[3]);
    return jenis ? { operator: 'kali', kiri: angka(grouping[1]), kanan: angka(grouping[2]), jenis } : null;
  }
  const m = text.match(new RegExp(`^(?:ada )?(${NUMBER})\\s*(.*?)\\s*(${OPS})\\s*(${NUMBER})(?:\\s+(.+))?$`));
  if (!m) return null;
  const word = m[3].replace(/\s+dengan$/, '');
  const operator = /^(?:ditambah|ditambahkan|tambah|plus|\+)$/.test(word) ? 'tambah'
    : /^(?:dikurangi|kurang|minus|[−-])$/.test(word) ? 'kurang'
      : /^(?:dikali|dikalikan|kali|[×*x])$/.test(word) ? 'kali' : 'bagi';
  const leftNoun = m[2].trim().replace(/^(?:buah|ekor|orang)\s+/, '');
  const rightNoun = (m[5] || '').trim().replace(/^(?:buah|ekor|orang)\s+/, '');
  const groups = /^(?:kelompok|bagian kelompok)$/.test(rightNoun);
  if (operator === 'bagi' && (leftNoun || rightNoun) && !groups) return null; // "pizza dibagi empat" remains a fraction.
  const leftId = leftNoun ? idAset(leftNoun) : null;
  const rightId = rightNoun && !groups ? idAset(rightNoun) : null;
  if (leftNoun && !leftId || rightNoun && !groups && !rightId || leftId && rightId && leftId !== rightId) return null;
  return { operator, kiri: angka(m[1]), kanan: angka(m[4]), jenis: leftId || rightId || '' };
}

export function hitungOperasi(op) {
  if (!op || !Object.hasOwn(OPERATOR, op.operator) || !Number.isInteger(op.kiri) || !Number.isInteger(op.kanan)
    || op.kiri < 0 || op.kanan < 0 || op.kiri > 100 || op.kanan > 100) return { error: 'Bilangan harus bulat antara 0 dan 100.' };
  if (op.operator === 'bagi' && op.kanan === 0) return { error: 'Pembagian dengan nol tidak terdefinisi.' };
  const answer = op.operator === 'tambah' ? op.kiri + op.kanan : op.operator === 'kurang' ? op.kiri - op.kanan : op.operator === 'kali' ? op.kiri * op.kanan : Math.floor(op.kiri / op.kanan);
  if (answer < 0) return { error: 'Hasil negatif belum didukung pada papan benda. Gunakan pengurangan dengan hasil nol atau positif.' };
  const remainder = op.operator === 'bagi' ? op.kiri % op.kanan : 0;
  const total = op.operator === 'kali' ? answer : op.operator === 'bagi' ? op.kiri : op.operator === 'tambah' ? answer : op.kiri;
  if (op.jenis && total > 20) return { error: 'Operasi memerlukan lebih dari 20 benda. Kurangi bilangannya agar gambar dan hitungan tetap sama.' };
  if (op.jenis && (op.operator === 'kali' ? op.kiri : op.operator === 'bagi' ? op.kanan : 0) > 12) return { error: 'Maksimal 12 kelompok dapat ditampilkan dengan jelas. Kurangi jumlah kelompok.' };
  return { answer, remainder, total, text: `${op.kiri} ${OPERATOR[op.operator]} ${op.kanan} = ?`,
    concept: { tambah: 'penjumlahan', kurang: 'pengurangan', kali: 'perkalian', bagi: 'pembagian' }[op.operator] };
}
