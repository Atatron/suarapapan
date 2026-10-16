// Memilih karakter dari pustaka dan memasukkannya ke papan tanpa mengucapkan kalimat:
// berguna saat guru ingin menambah "kelinci" ke gambar yang sudah berisi harimau.
import { useMemo, useState } from 'react';
import pustaka from '../scene/pustaka.json';
import { urlGambar } from '../scene/pustaka.js';
import { katalogAset, normalAset } from '../scene/katalog.js';

const ALIASES = new Map(katalogAset.filter((a) => a.kind === 'obj').map((a) => [a.id, a.aliases]));

const JUDUL = {
  'hewan-ternak': 'Hewan ternak', 'hewan-hutan': 'Hewan hutan', 'hewan-laut': 'Hewan laut', burung: 'Burung',
  serangga: 'Serangga dan kecil', 'orang-1': 'Orang', 'orang-2': 'Orang (pekerjaan dan inklusi)', buah: 'Buah',
  sayur: 'Sayur', makanan: 'Makanan', 'alat-sekolah': 'Alat sekolah', 'benda-rumah': 'Benda rumah', kendaraan: 'Kendaraan',
  alam: 'Alam', pakaian: 'Pakaian', 'mainan-bentuk': 'Mainan dan bentuk',
  'makanan-minuman': 'Makanan dan minuman', mainan: 'Mainan', 'alat-kebersihan': 'Alat kebersihan',
  elektronik: 'Elektronik', 'alat-musik': 'Alat musik', 'alat-olahraga': 'Alat olahraga', perkakas: 'Perkakas',
  jajanan: 'Jajanan', 'uang-belanja': 'Uang dan belanja', aksesoris: 'Aksesori', 'kendaraan-ekstra': 'Kendaraan lainnya',
  'alat-dapur': 'Alat dapur', 'benda-kelas': 'Benda kelas', 'pedesaan-struktur': 'Bangunan dan benda pedesaan',
  'infrastruktur': 'Infrastruktur', 'tempat-ibadah': 'Tempat ibadah', 'alam-struktur': 'Bangunan dan benda alam',
  'alam-ekstra': 'Benda alam lainnya', 'orang-keluarga-usia': 'Keluarga dan usia',
  'orang-profesi-1': 'Pekerjaan', 'orang-profesi-2': 'Pekerjaan lainnya',
  'orang-inklusi-disabilitas': 'Orang dan keberagaman disabilitas', 'orang-aktivitas': 'Kegiatan sehari-hari',
  'orang-fisik-keberagaman': 'Keberagaman penampilan', 'orang-pakaian-budaya': 'Pakaian dan budaya',
};

export default function PilihKarakter({ onPilih }) {
  const [cari, setCari] = useState('');
  const [terbuka, setTerbuka] = useState(false);

  const kelompok = useMemo(() => {
    const q = normalAset(cari);
    const per = new Map();
    for (const [nama, v] of Object.entries(pustaka.obj)) {
      if (q && !normalAset(v.n).includes(q) && !(ALIASES.get(nama) || []).some((a) => a.includes(q))) continue;
      if (!per.has(v.k)) per.set(v.k, []);
      per.get(v.k).push({ nama, label: v.n.replace(/\s*\(.*\)\s*/, '') });
    }
    return [...per.entries()];
  }, [cari]);

  return (
    <details className="kartu pilih-karakter" onToggle={(e) => setTerbuka(e.currentTarget.open)}>
      <summary>Tambah karakter ke papan <span className="petunjuk">(tanpa mengganti yang sudah ada)</span></summary>
      {terbuka ? (
        <>
          <label className="pilih-cari">
            <span className="sr-only">Cari karakter</span>
            <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari: kelinci, kapal, dokter…" autoComplete="off" />
          </label>
          {kelompok.length ? kelompok.map(([kat, daftar]) => (
            <section key={kat} aria-label={JUDUL[kat] || kat}>
              <h3>{JUDUL[kat] || kat}</h3>
              <div className="pilih-grid">
                {daftar.map((k) => (
                  <button key={k.nama} type="button" className="pilih-item" onClick={() => onPilih(k.nama, k.label)} title={`Tambahkan ${k.label}`}>
                    <img src={urlGambar(k.nama)} alt="" loading="lazy" decoding="async" draggable={false} />
                    <span>{k.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )) : <p className="kosong">Tidak ada karakter dengan nama itu.</p>}
        </>
      ) : null}
    </details>
  );
}
