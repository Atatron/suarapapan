// Mesin status adegan: menyimpan apa yang sedang tampil di papan dan
// menerapkan perubahan dari kalimat guru berikutnya. Semua fungsi di sini murni
// (tidak mengubah objek lama), sehingga tombol "Batalkan" cukup kembali ke
// adegan sebelumnya.

export const BATAS_OBJEK = 20;

export const ADEGAN_KOSONG = Object.freeze({
  objek: [],
  latar: '',
  konsep: 'tidak_ada',
  soal: null,
  versi: 0,
});

let nomor = 0;
const idBaru = () => `o${Date.now().toString(36)}${(nomor++).toString(36)}`;
const batasi = (n) => Math.max(1, Math.min(Number(n) || 1, BATAS_OBJEK));

export const yangAda = (adegan, jenis) =>
  adegan.objek.filter((o) => o.status !== 'pergi' && (!jenis || o.jenis === jenis));

const RELASI = ['atas', 'bawah', 'samping', 'depan', 'belakang', 'dalam'];

/** "di bawah meja" → { relasi: 'bawah', acuan: 'meja' }, selain itu null. */
export function uraiPosisi(posisi) {
  const m = String(posisi || '').toLowerCase().match(/^(?:di|ke)\s+(atas|bawah|samping|sebelah|depan|belakang|dalam)\s+(?:sebuah\s+|si\s+)?([a-z-]+)/);
  if (!m) return null;
  return { relasi: m[1] === 'sebelah' ? 'samping' : m[1], acuan: m[2] };
}
export const tulisPosisi = (relasi, acuan) => (RELASI.includes(relasi) && acuan ? `di ${relasi} ${acuan}` : '');

/** Opsi jawaban di sekitar jawaban benar, misalnya 3 → [2, 3, 4]. */
function opsiAngka(jawaban) {
  return [...new Set([jawaban - 1, jawaban, jawaban + 1].filter((x) => x >= 0))];
}

/**
 * Menerapkan hasil parser ke adegan.
 * Mengembalikan { adegan, berubah, catatan }. berubah=false berarti kalimat
 * tidak menggambarkan apa pun (misalnya salam), jadi cukup caption saja.
 */
export function terapkan(adegan, hasil, opsi = {}) {
  const entitas = hasil?.entitas ?? [];
  // gabung: benda baru dimasukkan ke papan tanpa menghapus yang sudah ada (dari kalimat
  // "ada juga ...", "... datang", atau pilihan guru di panel).
  const gabung = opsi.gabung === true || hasil?.gabung === true;
  const penjelasan = [];
  const peristiwa = [...(hasil?.peristiwa ?? [])]; // salinan: "ambil" tanpa potongan ditambahkan sebagai "hapus"
  const catatan = [];
  const bertanya = Boolean(hasil?.pertanyaan) && yangAda(adegan).length > 0;

  if (!entitas.length && !peristiwa.length && !bertanya) {
    return { adegan, berubah: false, catatan, penjelasan, alternatif: null };
  }

  // Objek yang sudah pergi di langkah sebelumnya dibuang, sisanya dianggap diam di tempat.
  let objek = yangAda(adegan).map((o) => ({ ...o, status: 'ada' }));
  let konsep = hasil.konsep && hasil.konsep !== 'tidak_ada' ? hasil.konsep : adegan.konsep;
  let soal = null;

  if (entitas.length) {
    // Kalimat yang memperkenalkan benda baru memulai adegan baru. Jika kalimat yang
    // sama juga mengubah benda lain yang sudah ada di papan, benda itu dipertahankan.
    const baru = new Set(entitas.map((e) => e.jenis));
    const dipakai = new Set(peristiwa.map((p) => p.target));
    if (!gabung) objek = objek.filter((o) => dipakai.has(o.jenis) && !baru.has(o.jenis));
    for (const e of entitas) {
      const n = batasi(e.jumlah);
      for (let i = 0; i < n && objek.length < BATAS_OBJEK; i++) {
        const o = { id: idBaru(), jenis: e.jenis, aksi: e.aksi || 'diam', posisi: e.posisi || '', status: 'datang' };
        if (e.emoji) o.emoji = e.emoji;
        if (e.emoji_acuan) o.emojiAcuan = e.emoji_acuan;
        if (e.bagi >= 2) Object.assign(o, { bagi: Math.min(e.bagi, 12), diambil: 0 });
        objek.push(o);
      }
    }
    if (objek.some((o) => o.bagi)) konsep = 'pecahan';
  }

  // Satu benda yang sudah ada ditambah lagi lewat entitas ("ada juga dua kelinci" saat kelinci
  // sudah ada) sama artinya dengan penjumlahan: dicatat di sini untuk penjelasan dan alternatif.
  const tambahan = jenisTambahan(adegan, hasil, gabung);
  if (tambahan && entitas.length) {
    penjelasan.push(`${tambahan.sebelum} ${tambahan.jenis} + ${tambahan.n} ${tambahan.jenis} yang datang = ${tambahan.sebelum + tambahan.n}.`);
  } else if (gabung && entitas.length && yangAda(adegan).length) {
    for (const e of entitas) penjelasan.push(`${batasi(e.jumlah)} ${e.jenis} dimasukkan ke papan.`);
  }

  for (const p of peristiwa) {
    const sebelum = yangAda({ objek }, p.target).length;
    const n = batasi(p.jumlah);

    if (p.tipe === 'hapus') {
      if (!sebelum) {
        catatan.push(`Tidak ada ${p.target} di papan untuk dihapus.`);
        continue;
      }
      let dihapus = 0;
      for (let i = objek.length - 1; i >= 0 && dihapus < n; i--) {
        if (objek[i].jenis === p.target && objek[i].status !== 'pergi') {
          objek[i] = { ...objek[i], status: 'pergi' };
          dihapus++;
        }
      }
      if (dihapus < n) catatan.push(`Hanya ada ${sebelum} ${p.target}, jadi hanya ${dihapus} yang dihapus.`);
      konsep = 'pengurangan';
      soal = { teks: `${sebelum} − ${dihapus} = ?`, jawaban: sebelum - dihapus };
    }

    if (p.tipe === 'bagi') {
      const i = objek.findIndex((o) => o.jenis === p.target && o.status !== 'pergi');
      if (i < 0) { catatan.push(`Tidak ada ${p.target} di papan untuk dibagi.`); continue; }
      const n = Math.max(2, Math.min(Number(p.jumlah) || 2, 12));
      objek[i] = { ...objek[i], bagi: n, diambil: 0 };
      konsep = 'pecahan';
      soal = null;
    }

    if (p.tipe === 'ambil') {
      const i = objek.findIndex((o) => o.jenis === p.target && o.bagi && o.status !== 'pergi');
      if (i < 0) {
        // "Diambil" tanpa potongan berarti bendanya diambil utuh.
        peristiwa.push({ ...p, tipe: 'hapus' });
        continue;
      }
      const o = objek[i];
      const diambil = Math.min(o.bagi, (o.diambil || 0) + batasi(p.jumlah));
      if (diambil - (o.diambil || 0) < batasi(p.jumlah)) catatan.push(`${p.target} hanya punya ${o.bagi} potong.`);
      objek[i] = { ...o, diambil };
      konsep = 'pecahan';
      const opsi = [...new Set([diambil - 1, diambil, diambil + 1].filter((x) => x >= 1 && x <= o.bagi))].map((x) => `${x}/${o.bagi}`);
      soal = { teks: `Berapa bagian ${p.target} yang diambil?`, jawaban: `${diambil}/${o.bagi}`, opsi };
    }

    if (p.tipe === 'pindah') {
      const tujuan = uraiPosisi(p.posisi);
      if (!tujuan) { catatan.push(`Letak baru ${p.target} tidak jelas.`); continue; }
      if (!yangAda({ objek }, p.target).length) { catatan.push(`Tidak ada ${p.target} di papan untuk dipindah.`); continue; }
      objek = objek.map((o) => (o.jenis === p.target && o.status !== 'pergi' ? { ...o, posisi: tulisPosisi(tujuan.relasi, tujuan.acuan) } : o));
      konsep = 'posisi';
    }

    if (p.tipe === 'tambah') {
      const contoh = objek.find((o) => o.jenis === p.target);
      let ditambah = 0;
      for (let i = 0; i < n && objek.length < BATAS_OBJEK; i++, ditambah++) {
        const o = { id: idBaru(), jenis: p.target, aksi: contoh?.aksi || 'diam', posisi: contoh?.posisi || '', status: 'datang' };
        if (contoh?.emoji) o.emoji = contoh.emoji;
        if (contoh?.emojiAcuan) o.emojiAcuan = contoh.emojiAcuan;
        objek.push(o);
      }
      if (ditambah < n) catatan.push(`Papan dibatasi ${BATAS_OBJEK} benda.`);
      if (sebelum > 0) {
        konsep = 'penjumlahan';
        soal = { teks: `${sebelum} + ${ditambah} = ?`, jawaban: sebelum + ditambah };
        penjelasan.push(`${sebelum} ${p.target} + ${ditambah} ${p.target} yang datang = ${sebelum + ditambah}.`);
      } else {
        // Belum ada sebelumnya: ini benda baru yang masuk, bukan soal "0 + n".
        penjelasan.push(`${ditambah} ${p.target} dimasukkan ke papan.`);
      }
    }
  }

  // "Ada berapa ikan?" → soal menghitung, kecuali kalimat itu sudah membuat soal sendiri.
  if (hasil?.pertanyaan && !soal) {
    const benda = hasil.tanya_benda && yangAda({ objek }, hasil.tanya_benda).length ? hasil.tanya_benda : '';
    const n = yangAda({ objek }, benda || undefined).length;
    if (n) {
      const jenisAda = new Set(yangAda({ objek }).map((o) => o.jenis));
      const nama = benda || (jenisAda.size === 1 ? [...jenisAda][0] : 'benda');
      soal = { teks: `Ada berapa ${nama}?`, jawaban: n };
      if (konsep === 'tidak_ada') konsep = 'membilang';
    }
  }
  if (soal && !soal.opsi) soal.opsi = opsiAngka(soal.jawaban);

  // Tafsir lain untuk "N kelinci datang" saat kelinci sudah ada: yang dimaksud mungkin hanya N.
  let alternatif = null;
  if (tambahan && !hasil?.tambahEksplisit) {
    const tanpa = { ...adegan, objek: adegan.objek.filter((o) => !(o.jenis === tambahan.jenis && o.status !== 'pergi')) };
    const alt = terapkan(tanpa, {
      entitas: [{ jenis: tambahan.jenis, jumlah: tambahan.n, aksi: tambahan.contoh.aksi, posisi: tambahan.contoh.posisi, emoji: tambahan.contoh.emoji, emoji_acuan: tambahan.contoh.emojiAcuan }],
      peristiwa: [], konsep: 'membilang', latar: hasil.latar,
    }, { gabung: true });
    alternatif = { label: `Maksudnya hanya ${tambahan.n} ${tambahan.jenis}`, adegan: alt.adegan };
  }

  return {
    adegan: { objek, latar: hasil.latar || adegan.latar, konsep, soal, versi: adegan.versi + 1 },
    berubah: true,
    catatan,
    penjelasan,
    alternatif,
  };
}

/** Jika kalimat menambah benda yang SUDAH ada di papan, mengembalikan {jenis, n, sebelum, contoh}. */
function jenisTambahan(adegan, hasil, gabung) {
  const entitas = hasil?.entitas ?? [];
  const peristiwa = hasil?.peristiwa ?? [];
  let jenis = null;
  let n = 0;
  if (!entitas.length && peristiwa.length === 1 && peristiwa[0].tipe === 'tambah') {
    jenis = peristiwa[0].target;
    n = batasi(peristiwa[0].jumlah);
  } else if (gabung && entitas.length === 1 && !peristiwa.length) {
    jenis = entitas[0].jenis;
    n = batasi(entitas[0].jumlah);
  }
  if (!jenis) return null;
  const ada = yangAda(adegan, jenis);
  if (!ada.length) return null;
  return { jenis, n, sebelum: ada.length, contoh: ada[0] };
}

/** Ringkasan untuk LLM, contoh: "kelinci: 3, apel: 2". */
export function konteks(adegan) {
  const hitung = {};
  for (const o of yangAda(adegan)) {
    const k = (hitung[o.jenis] ||= { n: 0, catatan: [] });
    k.n++;
    if (o.bagi && !k.catatan.length) k.catatan.push(`dibagi ${o.bagi}${o.diambil ? `, ${o.diambil} diambil` : ''}`);
    else if (o.posisi && !k.catatan.length) k.catatan.push(o.posisi);
  }
  const isi = Object.entries(hitung).map(([j, k]) => `${j}: ${k.n}${k.catatan.length ? ` (${k.catatan[0]})` : ''}`).join(', ');
  return isi || 'kosong';
}

const KATA_AKSI = { lari: 'berlari', lompat: 'melompat', terbang: 'terbang', berenang: 'berenang', jatuh: 'jatuh', diam: '' };

/** Deskripsi teks untuk guru dan pembaca layar (dan nanti untuk audio siswa tunanetra). */
export function deskripsi(adegan) {
  if (!adegan.objek.length) return 'Papan kosong.';
  const kelompok = {};
  for (const o of adegan.objek) {
    const k = (kelompok[o.jenis] ||= { ada: 0, pergi: 0, aksi: o.aksi, posisi: o.posisi, bagi: o.bagi, diambil: o.diambil });
    k[o.status === 'pergi' ? 'pergi' : 'ada']++;
  }
  const bagian = Object.entries(kelompok).map(([jenis, k]) => {
    const aksi = KATA_AKSI[k.aksi] ? ` ${KATA_AKSI[k.aksi]}` : '';
    // "di rumput" sering terisi di posisi dan latar sekaligus; tulis sekali saja.
    const posisi = k.posisi && !k.posisi.endsWith(adegan.latar || '\u0000') ? ` ${k.posisi}` : '';
    const pergi = k.pergi ? `, ${k.pergi} pergi` : '';
    const potong = k.bagi ? ` dibagi ${k.bagi} potong${k.diambil ? `, ${k.diambil} potong diambil (${k.diambil}/${k.bagi})` : ''}` : '';
    return `${k.ada} ${jenis}${aksi}${posisi}${potong}${pergi}`;
  });
  const latar = adegan.latar ? ` di ${adegan.latar}` : '';
  return `${bagian.join('; ')}${latar}.`;
}
