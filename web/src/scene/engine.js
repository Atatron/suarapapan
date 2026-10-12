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

/**
 * Menerapkan hasil parser ke adegan.
 * Mengembalikan { adegan, berubah, catatan }. berubah=false berarti kalimat
 * tidak menggambarkan apa pun (misalnya salam), jadi cukup caption saja.
 */
export function terapkan(adegan, hasil) {
  const entitas = hasil?.entitas ?? [];
  const peristiwa = hasil?.peristiwa ?? [];
  const catatan = [];

  if (!entitas.length && !peristiwa.length) {
    return { adegan, berubah: false, catatan };
  }

  // Objek yang sudah pergi di langkah sebelumnya dibuang, sisanya dianggap diam di tempat.
  let objek = yangAda(adegan).map((o) => ({ ...o, status: 'ada' }));
  let konsep = hasil.konsep && hasil.konsep !== 'tidak_ada' ? hasil.konsep : adegan.konsep;
  let soal = null;

  if (entitas.length && !peristiwa.length) {
    // Kalimat yang memperkenalkan benda baru memulai adegan baru.
    objek = [];
    for (const e of entitas) {
      const n = batasi(e.jumlah);
      for (let i = 0; i < n && objek.length < BATAS_OBJEK; i++) {
        objek.push({ id: idBaru(), jenis: e.jenis, aksi: e.aksi || 'diam', posisi: e.posisi || '', status: 'datang' });
      }
    }
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

    if (p.tipe === 'tambah') {
      const contoh = objek.find((o) => o.jenis === p.target);
      let ditambah = 0;
      for (let i = 0; i < n && objek.length < BATAS_OBJEK; i++, ditambah++) {
        objek.push({ id: idBaru(), jenis: p.target, aksi: contoh?.aksi || 'diam', posisi: contoh?.posisi || '', status: 'datang' });
      }
      if (ditambah < n) catatan.push(`Papan dibatasi ${BATAS_OBJEK} benda.`);
      konsep = 'penjumlahan';
      soal = { teks: `${sebelum} + ${ditambah} = ?`, jawaban: sebelum + ditambah };
    }
  }

  return {
    adegan: { objek, latar: hasil.latar || adegan.latar, konsep, soal, versi: adegan.versi + 1 },
    berubah: true,
    catatan,
  };
}

/** Ringkasan untuk LLM, contoh: "kelinci: 3, apel: 2". */
export function konteks(adegan) {
  const hitung = {};
  for (const o of yangAda(adegan)) hitung[o.jenis] = (hitung[o.jenis] || 0) + 1;
  const isi = Object.entries(hitung).map(([j, n]) => `${j}: ${n}`).join(', ');
  return isi || 'kosong';
}

const KATA_AKSI = { lari: 'berlari', lompat: 'melompat', terbang: 'terbang', berenang: 'berenang', jatuh: 'jatuh', diam: '' };

/** Deskripsi teks untuk guru dan pembaca layar (dan nanti untuk audio siswa tunanetra). */
export function deskripsi(adegan) {
  if (!adegan.objek.length) return 'Papan kosong.';
  const kelompok = {};
  for (const o of adegan.objek) {
    const k = (kelompok[o.jenis] ||= { ada: 0, pergi: 0, aksi: o.aksi, posisi: o.posisi });
    k[o.status === 'pergi' ? 'pergi' : 'ada']++;
  }
  const bagian = Object.entries(kelompok).map(([jenis, k]) => {
    const aksi = KATA_AKSI[k.aksi] ? ` ${KATA_AKSI[k.aksi]}` : '';
    // "di rumput" sering terisi di posisi dan latar sekaligus; tulis sekali saja.
    const posisi = k.posisi && !k.posisi.endsWith(adegan.latar || '\u0000') ? ` ${k.posisi}` : '';
    const pergi = k.pergi ? `, ${k.pergi} pergi` : '';
    return `${k.ada} ${jenis}${aksi}${posisi}${pergi}`;
  });
  const latar = adegan.latar ? ` di ${adegan.latar}` : '';
  return `${bagian.join('; ')}${latar}.`;
}
