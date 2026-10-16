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
const AKSI_SAH = ['diam', 'lari', 'lompat', 'terbang', 'berenang', 'jatuh'];
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

/** Jumlah per jenis karakter di papan, urut kemunculan: [{ jenis, n }]. */
export function kelompokJenis(adegan) {
  const m = new Map();
  for (const o of yangAda(adegan)) m.set(o.jenis, (m.get(o.jenis) || 0) + 1);
  return [...m].map(([jenis, n]) => ({ jenis, n }));
}
const jumlahSemua = (kel) => kel.reduce((a, k) => a + k.n, 0);

/**
 * Menerapkan hasil parser ke adegan.
 * Mengembalikan { adegan, berubah, catatan }. berubah=false berarti kalimat
 * tidak menggambarkan apa pun (misalnya salam), jadi cukup caption saja.
 */
export function terapkan(adegan, hasil, opsi = {}) {
  const entitas = hasil?.entitas ?? [];
  // gabung: benda baru dimasukkan ke papan tanpa menghapus yang sudah ada (dari kalimat
  // "ada juga ...", "... datang", atau pilihan guru di panel).
  // Jenis yang sama sekali baru di papan yang sudah berisi ("ada 2 gajah", lalu "ada 2 kupu-kupu")
  // otomatis bergabung: guru jarang bermaksud menghapus yang sudah ada. Menyebut jenis yang sudah ada
  // (mis. "ada 3 kelinci" lagi) tetap memulai adegan baru. Guru bisa menolaknya dengan opsi.gabung=false.
  const jenisAda = new Set(yangAda(adegan).map((o) => o.jenis));
  const semuaJenisBaru = (hasil?.entitas ?? []).length > 0 && jenisAda.size > 0
    && hasil.entitas.every((e) => !jenisAda.has(e.jenis));
  const gabung = opsi.gabung === true || hasil?.gabung === true
    || (semuaJenisBaru && opsi.gabung !== false);
  // hitungSemua (bawaan): aritmetika memakai jumlah SEMUA karakter di papan. Dimatikan guru jika
  // karakter lain hanya hiasan dan yang dihitung hanya jenis yang disebut.
  const hitungSemua = opsi.hitungSemua !== false;
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
  // Untuk aritmetika papan campuran: jumlah semua karakter sebelum kalimat ini, dan perubahannya.
  const kelSebelum = kelompokJenis(adegan);
  const totalSebelum = jumlahSemua(kelSebelum);
  let dihapusTotal = 0;
  let ditambahTotal = 0;
  const jenisBaru = new Set(); // jenis yang baru masuk ke papan yang sudah berisi karakter lain

  if (entitas.length) {
    // Kalimat yang memperkenalkan benda baru memulai adegan baru. Jika kalimat yang
    // sama juga mengubah benda lain yang sudah ada di papan, benda itu dipertahankan.
    const baru = new Set(entitas.map((e) => e.jenis));
    const dipakai = new Set(peristiwa.map((p) => p.target));
    if (!gabung) objek = objek.filter((o) => dipakai.has(o.jenis) && !baru.has(o.jenis));
    // "ada 3 anak dan 3 kelinci" saat 3 kelinci sudah di papan: kalimat yang menyebut beberapa jenis
    // sekaligus, dengan sedikitnya satu jenis baru, menyatakan keadaan (bukan menambah lagi).
    // Jenis yang sudah ada hanya dilengkapi sampai sebanyak yang disebut. Kata "lagi/tambahan"
    // atau kata gabung dari kalimat (datang, juga, ...) tetap berarti penjumlahan.
    const pernyataanKeadaan = gabung && !hasil?.tambahEksplisit && !hasil?.gabung && entitas.length >= 2
      && entitas.some((e) => !kelSebelum.some((k) => k.jenis === e.jenis));
    for (const e of entitas) {
      let n = batasi(e.jumlah);
      if (pernyataanKeadaan) {
        const sudah = kelSebelum.find((k) => k.jenis === e.jenis)?.n ?? 0;
        n = Math.max(0, n - sudah);
      }
      let masuk = 0;
      for (let i = 0; i < n && objek.length < BATAS_OBJEK; i++, masuk++) {
        const o = { id: idBaru(), jenis: e.jenis, aksi: e.aksi || 'diam', posisi: e.posisi || '', status: 'datang' };
        if (e.emoji) o.emoji = e.emoji;
        if (e.emoji_acuan) o.emojiAcuan = e.emoji_acuan;
        if (e.bagi >= 2) Object.assign(o, { bagi: Math.min(e.bagi, 12), diambil: 0 });
        objek.push(o);
      }
      if (gabung && totalSebelum > 0) {
        ditambahTotal += masuk;
        if (!kelSebelum.some((k) => k.jenis === e.jenis)) jenisBaru.add(e.jenis);
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
      dihapusTotal += dihapus;
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
      // Hanya sebanyak "jumlah" yang dipindah ("dua dari lima kelinci"); jumlah 0 atau kosong = semuanya.
      // Yang belum di tujuan didahulukan, supaya yang sudah di sana tidak memakan jatah.
      const tempat = tulisPosisi(tujuan.relasi, tujuan.acuan);
      const ada = objek.map((o, i) => i).filter((i) => objek[i].jenis === p.target && objek[i].status !== 'pergi');
      const belum = ada.filter((i) => objek[i].posisi !== tempat);
      const mau = Number(p.jumlah) >= 1 ? Math.round(Number(p.jumlah)) : ada.length;
      if (mau > ada.length) catatan.push(`Hanya ada ${ada.length} ${p.target}, jadi semuanya dipindah.`);
      const pilih = new Set(belum.slice(0, Math.min(mau, ada.length)));
      objek = objek.map((o, i) => (pilih.has(i) ? { ...o, posisi: tempat } : o));
      konsep = 'posisi';
    }

    // Ganti gerakan benda yang sudah ada ("sekarang berhenti", "mulai melompat"); jumlah dan identitas tetap.
    if (p.tipe === 'ubah_aksi') {
      const ada = objek.map((o, i) => i).filter((i) => objek[i].jenis === p.target && objek[i].status !== 'pergi');
      if (!ada.length) { catatan.push(`Tidak ada ${p.target} di papan untuk diubah gerakannya.`); continue; }
      const aksiBaru = AKSI_SAH.includes(p.aksi) ? p.aksi : 'diam';
      // aksi_awal memilih kelompok ("yang berlari"); tanpa itu, yang gerakannya sudah sama dilewati.
      const cocok = p.aksi_awal && AKSI_SAH.includes(p.aksi_awal)
        ? ada.filter((i) => (objek[i].aksi || 'diam') === p.aksi_awal)
        : ada.filter((i) => (objek[i].aksi || 'diam') !== aksiBaru);
      const mau = Number(p.jumlah) >= 1 ? Math.round(Number(p.jumlah)) : cocok.length;
      const pilih = new Set(cocok.slice(0, mau));
      if (!pilih.size) catatan.push(`${p.target} sudah ${aksiBaru === 'diam' ? 'diam' : KATA_AKSI[aksiBaru]}; tidak ada yang berubah.`);
      objek = objek.map((o, i) => (pilih.has(i) ? { ...o, aksi: aksiBaru } : o));
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
      ditambahTotal += ditambah;
      if (sebelum === 0 && totalSebelum > 0) jenisBaru.add(p.target);
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

  // Papan berisi beberapa jenis karakter (atau jenis baru masuk): hitungan memakai jumlah SEMUA
  // karakter, bukan hanya jenis yang disebut. "3 kelinci + 2 harimau" menjadi 3 + 2 = 5.
  // Kalimat yang memulai adegan baru (entitas tanpa gabung) tidak memakai isi papan yang lama.
  const gantiAdegan = entitas.length > 0 && !gabung;
  const campur = kelSebelum.length >= 2 || jenisBaru.size > 0;
  if (hitungSemua && !gantiAdegan && totalSebelum > 0 && (campur || (tambahan && entitas.length))) {
    if (dihapusTotal > 0) {
      konsep = 'pengurangan';
      const sisa = totalSebelum - dihapusTotal;
      soal = { teks: `${totalSebelum} − ${dihapusTotal} = ?`, jawaban: sisa, rincian: kelSebelum };
      penjelasan.length = 0;
      penjelasan.push(`${totalSebelum} karakter di papan − ${dihapusTotal} yang pergi = ${sisa}.`);
    } else if (ditambahTotal > 0) {
      konsep = 'penjumlahan';
      const kelSesudah = kelompokJenis({ objek });
      soal = { teks: `${totalSebelum} + ${ditambahTotal} = ?`, jawaban: totalSebelum + ditambahTotal, rincian: kelSesudah };
      penjelasan.length = 0;
      penjelasan.push(`${totalSebelum} karakter di papan + ${ditambahTotal} yang masuk = ${totalSebelum + ditambahTotal}.`);
    }
  }

  // Pertanyaan guru. tanya_jenis: benda (satu jenis), total, selisih, terbanyak, tersedikit.
  if (hasil?.pertanyaan && !soal) {
    const kel = kelompokJenis({ objek });
    const total = jumlahSemua(kel);
    const sebut = hasil.tanya_benda && kel.some((k) => k.jenis === hasil.tanya_benda) ? hasil.tanya_benda : '';
    const dariParser = hasil.tanya_jenis && hasil.tanya_jenis !== 'tidak_ada' ? hasil.tanya_jenis : '';
    const jenisTanya = dariParser || (sebut ? 'benda' : kel.length > 1 ? 'total' : 'benda');
    const daftar = (k) => k.map((x) => x.n).join(' + ');
    if (kel.length) {
      if (konsep === 'tidak_ada') konsep = 'membilang';
      if (jenisTanya === 'selisih' && kel.length >= 2) {
        const [besar, kecil] = [...kel].sort((x, y) => y.n - x.n);
        soal = { teks: `${besar.n} − ${kecil.n} = ?`, jawaban: besar.n - kecil.n, rincian: [besar, kecil] };
      } else if ((jenisTanya === 'terbanyak' || jenisTanya === 'tersedikit') && kel.length >= 2) {
        const urut = [...kel].sort((x, y) => (jenisTanya === 'terbanyak' ? y.n - x.n : x.n - y.n));
        const seri = urut.filter((k) => k.n === urut[0].n);
        soal = {
          teks: jenisTanya === 'terbanyak' ? 'Mana yang paling banyak?' : 'Mana yang paling sedikit?',
          jawaban: seri.length > 1 ? 'sama banyak' : urut[0].jenis,
          opsi: [...kel.map((k) => k.jenis), 'sama banyak'],
          rincian: kel,
        };
      } else if (jenisTanya === 'total' && kel.length >= 2) {
        soal = { teks: `${daftar(kel)} = ?`, jawaban: total, rincian: kel };
      } else {
        const nama = sebut || (kel.length === 1 ? kel[0].jenis : '');
        if (nama) soal = { teks: `Ada berapa ${nama}?`, jawaban: kel.find((k) => k.jenis === nama).n };
        else soal = { teks: `${daftar(kel)} = ?`, jawaban: total, rincian: kel }; // beberapa jenis, tidak jelas → total
      }
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
    const k = (hitung[o.jenis] ||= { n: 0, catatan: [], aksi: {} });
    k.n++;
    k.aksi[o.aksi || 'diam'] = (k.aksi[o.aksi || 'diam'] || 0) + 1;
    if (o.bagi && !k.catatan.length) k.catatan.push(`dibagi ${o.bagi}${o.diambil ? `, ${o.diambil} diambil` : ''}`);
    else if (o.posisi && !k.catatan.length) k.catatan.push(o.posisi);
  }
  // Jenis yang gerakannya campur: sertakan banyaknya per gerakan, supaya "yang berlari" bisa dipilih.
  // Tanpa koma di dalam kurung, karena konteks dipecah per koma oleh pembacanya.
  for (const k of Object.values(hitung)) {
    const macam = Object.entries(k.aksi);
    if (macam.length > 1) k.catatan.push(macam.map(([a, n]) => `${n} ${KATA_AKSI[a] || 'diam'}`).join(' dan '));
  }
  const isi = Object.entries(hitung).map(([j, k]) => `${j}: ${k.n}${k.catatan.length ? ` (${k.catatan.join('; ')})` : ''}`).join(', ');
  return isi || 'kosong';
}

const KATA_AKSI = { lari: 'berlari', lompat: 'melompat', terbang: 'terbang', berenang: 'berenang', jatuh: 'jatuh', diam: '' };

/** Deskripsi teks untuk guru dan pembaca layar (dan nanti untuk audio siswa tunanetra). */
export function deskripsi(adegan) {
  if (!adegan.objek.length) return 'Papan kosong.';
  // Satu kelompok = benda yang jenis, gerakan, letak, dan keadaan potongannya sama; yang berbeda ditulis terpisah
  // ("2 kelinci berlari; 3 kelinci melompat"), bukan digabung dengan gerakan benda pertama.
  const kelompok = {};
  for (const o of adegan.objek) {
    const kunci = [o.jenis, o.aksi || 'diam', o.posisi || '', o.bagi || 0, o.diambil || 0].join('|');
    const k = (kelompok[kunci] ||= { jenis: o.jenis, ada: 0, pergi: 0, aksi: o.aksi, posisi: o.posisi, bagi: o.bagi, diambil: o.diambil });
    k[o.status === 'pergi' ? 'pergi' : 'ada']++;
  }
  const bagian = Object.values(kelompok).map((k) => {
    const { jenis } = k;
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

/**
 * Memindahkan satu karakter (kaki di px, py = pecahan lebar/tinggi papan). Tidak mengubah jumlah atau riwayat.
 * `beku` = { id: {px, py} }: posisi susunan otomatis karakter lain, disimpan saat pertama kali ada yang
 * diseret supaya mereka tidak berpindah ketika satu karakter keluar dari barisan.
 */
export function pindahkan(adegan, id, px, py, beku = {}) {
  if (!adegan.objek.some((o) => o.id === id)) return adegan;
  const b = (v) => Math.min(0.98, Math.max(0.02, v));
  return {
    ...adegan,
    objek: adegan.objek.map((o) => {
      if (o.id === id) return { ...o, px: b(px), py: b(py) };
      if (Number.isFinite(o.px) || !beku[o.id]) return o;
      return { ...o, px: b(beku[o.id].px), py: b(beku[o.id].py) };
    }),
  };
}
