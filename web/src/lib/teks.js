// Pembersih ucapan: pengenal suara kadang menyisipkan huruf tunggal liar ("ditambah y tiga kucing").
// Huruf tunggal yang sah di soal (pilihan a/b/c/d, perkalian x) dipertahankan.
const SAH = new Set(['a', 'b', 'c', 'd', 'x']);

export function buangHurufLepas(teks) {
  return String(teks || '')
    .replace(/(^|[\s(])([A-Za-z])(?=$|[\s.,!?;:)])/g, (m, depan, huruf) => (SAH.has(huruf.toLowerCase()) ? m : depan))
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
