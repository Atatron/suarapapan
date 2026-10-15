import { useEffect, useMemo, useState } from 'react';
import { Benda } from './aset.jsx';
import { deskripsi, uraiPosisi } from './engine.js';
import { Pecahan, PanggungPosisi } from './Matematika.jsx';
import { cariTempat, urlTempat } from './pustaka.js';
import { pilihLatar } from './latar.js';

const ukuranUntuk = (n) => (n <= 3 ? 'besar' : n <= 6 ? 'sedang' : n <= 12 ? 'kecil' : 'mini');
const slug = (s) => (s || 'kosong').toLowerCase().replace(/[^a-z]+/g, '-');
// Karakter sejenis dikelompokkan; beri jarak di awal tiap kelompok supaya "3 kelinci" dan "2 harimau" terlihat terpisah.
const awalKelompok = (adegan, i) => (i > 0 && adegan.objek[i - 1].jenis !== adegan.objek[i].jenis ? ' awal-kelompok' : '');
const persen = (v) => `${(v * 100).toFixed(2)}%`;

/**
 * Menggambar satu adegan. Dipakai besar di /papan dan kecil sebagai pratinjau di /guru.
 *
 * Latar dipilih otomatis (pilihLatar): dari tempat yang disebut guru, atau dari
 * benda di papan. Benda berdiri di area yang disarankan untuk latar itu (tanah,
 * air, meja, ...). Tanpa latar yang cocok, tampilan lama (papan hijau) dipakai.
 *
 * Animasi masuk/keluar ada di tombol luar, animasi aksi (lari, terbang, …) di
 * span dalam, supaya dua transform tidak saling menimpa.
 */
export default function Adegan({ adegan, interaktif = false, kecil = false }) {
  const [hitungan, setHitungan] = useState({});
  useEffect(() => setHitungan({}), [adegan.versi]);

  const latar = useMemo(() => pilihLatar(adegan), [adegan]);
  const ukuran = ukuranUntuk(adegan.objek.length);
  const ketuk = (o) => {
    if (!interaktif || o.status === 'pergi' || hitungan[o.id]) return;
    setHitungan((h) => ({ ...h, [o.id]: Object.keys(h).length + 1 }));
  };

  const kelas = `adegan latar-${slug(adegan.latar)}${kecil ? ' adegan-kecil' : ''}${latar ? ' dengan-latar' : ''}`;
  const lukisan = latar
    ? <img className="adegan-lukisan" src={latar.file} alt="" aria-hidden="true" draggable={false} />
    : null;

  if (adegan.objek.some((o) => o.status !== 'pergi' && uraiPosisi(o.posisi))) {
    return (
      <div className={`${kelas} adegan-posisi`}>
        <p className="sr-only" aria-live="polite">{deskripsi(adegan)}</p>
        {lukisan}
        <PanggungPosisi adegan={adegan} interaktif={interaktif} />
        {latar ? null : <div className="adegan-tanah" aria-hidden="true" />}
      </div>
    );
  }

  // Tanpa latar baru (tempat tidak ada di pustaka): ikon tempat redup seperti sebelumnya.
  const ikon = latar ? null : cariTempat(adegan.latar);
  const wilayah = latar
    ? { left: persen(latar.x[0]), width: persen(latar.x[1] - latar.x[0]), top: persen(latar.y[0]), height: persen(latar.y[1] - latar.y[0]) }
    : undefined;

  return (
    <div className={kelas} data-latar={latar?.id}>
      <p className="sr-only" aria-live="polite">{deskripsi(adegan)}</p>
      {lukisan}
      {ikon ? <img className="adegan-pemandangan" src={urlTempat(ikon)} alt="" aria-hidden="true" draggable={false} /> : null}
      <div className={`adegan-panggung${latar ? ' panggung-latar' : ''}`} style={wilayah}>
        {adegan.objek.map((o, i) => (o.bagi ? (
          <div key={o.id} className={`obj obj-pecahan status-${o.status}${awalKelompok(adegan, i)}`}>
            <Pecahan o={o} interaktif={interaktif} versi={adegan.versi} />
          </div>
        ) : (
          <button
            key={o.id}
            type="button"
            className={`obj ukuran-${ukuran} status-${o.status}${awalKelompok(adegan, i)}`}
            style={{ '--tunda': `${(i % 10) * 0.1}s` }}
            onClick={() => ketuk(o)}
            disabled={!interaktif || o.status === 'pergi'}
            tabIndex={interaktif && o.status !== 'pergi' ? 0 : -1}
            aria-label={hitungan[o.id] ? `${o.jenis} nomor ${hitungan[o.id]}` : `${o.jenis}, ketuk untuk menghitung`}
          >
            <span className={`obj-gerak aksi-${o.aksi}`}>
              <Benda jenis={o.jenis} indeks={i} emoji={o.emoji} aksi={o.aksi} />
            </span>
            {hitungan[o.id] ? <span className="obj-nomor">{hitungan[o.id]}</span> : null}
          </button>
        )))}
      </div>
      {latar ? null : <div className="adegan-tanah" aria-hidden="true" />}
      {adegan.latar && !latar ? <div className="adegan-latar">di {adegan.latar}</div> : null}
    </div>
  );
}
