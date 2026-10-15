// Mengukur kesalahan kata (WER) antara kalimat acuan dan hasil pengenalan suara.

const ANGKA = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh',
  'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'delapan belas',
  'sembilan belas', 'dua puluh'];

/** Huruf kecil, tanpa tanda baca, angka "3" → "tiga" (Chrome sering menulis angka). */
export function normalisasi(teks) {
  return String(teks || '')
    .toLowerCase()
    .replace(/\b(\d{1,2})\b/g, (m, n) => ANGKA[Number(n)] ?? m)
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** { salah, total, ganti, sisip, hapus } — jarak edit tingkat kata. */
export function hitungWer(acuan, hasil) {
  const r = normalisasi(acuan);
  const h = normalisasi(hasil);
  const d = Array.from({ length: r.length + 1 }, () => new Array(h.length + 1).fill(0));
  for (let i = 0; i <= r.length; i++) d[i][0] = i;
  for (let j = 0; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
  }
  // Telusuri balik untuk memisahkan jenis kesalahan.
  let i = r.length;
  let j = h.length;
  let ganti = 0;
  let sisip = 0;
  let hapus = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1)) {
      if (r[i - 1] !== h[j - 1]) ganti++;
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { hapus++; i--; } else { sisip++; j--; }
  }
  return { salah: d[r.length][h.length], total: r.length, ganti, sisip, hapus };
}
