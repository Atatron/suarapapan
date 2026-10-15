import { useEffect, useState } from 'react';
import { Benda } from './aset.jsx';
import { deskripsi, uraiPosisi } from './engine.js';
import { Pecahan, PanggungPosisi } from './Matematika.jsx';
import { cariTempat, urlTempat } from './pustaka.js';

const ukuranUntuk = (n) => (n <= 3 ? 'besar' : n <= 6 ? 'sedang' : n <= 12 ? 'kecil' : 'mini');
const slug = (s) => (s || 'kosong').toLowerCase().replace(/[^a-z]+/g, '-');

/**
 * Menggambar satu adegan. Dipakai besar di /papan dan kecil sebagai pratinjau di /guru.
 * Animasi masuk/keluar ada di tombol luar, animasi aksi (lari, terbang, …) di
 * span dalam, supaya dua transform tidak saling menimpa.
 */
export default function Adegan({ adegan, interaktif = false, kecil = false }) {
  const [hitungan, setHitungan] = useState({});
  useEffect(() => setHitungan({}), [adegan.versi]);

  const ukuran = ukuranUntuk(adegan.objek.length);
  const ketuk = (o) => {
    if (!interaktif || o.status === 'pergi' || hitungan[o.id]) return;
    setHitungan((h) => ({ ...h, [o.id]: Object.keys(h).length + 1 }));
  };

  const kelas = `adegan latar-${slug(adegan.latar)}${kecil ? ' adegan-kecil' : ''}`;
  if (adegan.objek.some((o) => o.status !== 'pergi' && uraiPosisi(o.posisi))) {
    return (
      <div className={`${kelas} adegan-posisi`}>
        <p className="sr-only" aria-live="polite">{deskripsi(adegan)}</p>
        <PanggungPosisi adegan={adegan} interaktif={interaktif} />
        <div className="adegan-tanah" aria-hidden="true" />
      </div>
    );
  }

  const tempat = cariTempat(adegan.latar);
  return (
    <div className={kelas}>
      <p className="sr-only" aria-live="polite">{deskripsi(adegan)}</p>
      {tempat ? <img className="adegan-pemandangan" src={urlTempat(tempat)} alt="" aria-hidden="true" draggable={false} /> : null}
      <div className="adegan-panggung">
        {adegan.objek.map((o, i) => (o.bagi ? (
          <div key={o.id} className={`obj obj-pecahan status-${o.status}`}>
            <Pecahan o={o} interaktif={interaktif} versi={adegan.versi} />
          </div>
        ) : (
          <button
            key={o.id}
            type="button"
            className={`obj ukuran-${ukuran} status-${o.status}`}
            style={{ '--tunda': `${(i % 10) * 0.1}s` }}
            onClick={() => ketuk(o)}
            disabled={!interaktif || o.status === 'pergi'}
            tabIndex={interaktif && o.status !== 'pergi' ? 0 : -1}
            aria-label={hitungan[o.id] ? `${o.jenis} nomor ${hitungan[o.id]}` : `${o.jenis}, ketuk untuk menghitung`}
          >
            <span className={`obj-gerak aksi-${o.aksi}`}>
              <Benda jenis={o.jenis} indeks={i} emoji={o.emoji} />
            </span>
            {hitungan[o.id] ? <span className="obj-nomor">{hitungan[o.id]}</span> : null}
          </button>
        )))}
      </div>
      <div className="adegan-tanah" aria-hidden="true" />
      {adegan.latar ? <div className="adegan-latar">di {adegan.latar}</div> : null}
    </div>
  );
}
