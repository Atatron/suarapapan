import { useEffect, useState } from 'react';
import { Benda } from './aset.jsx';
import { deskripsi } from './engine.js';

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

  return (
    <div className={`adegan latar-${slug(adegan.latar)}${kecil ? ' adegan-kecil' : ''}`}>
      <p className="sr-only" aria-live="polite">{deskripsi(adegan)}</p>
      <div className="adegan-panggung">
        {adegan.objek.map((o, i) => (
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
              <Benda jenis={o.jenis} indeks={i} />
            </span>
            {hitungan[o.id] ? <span className="obj-nomor">{hitungan[o.id]}</span> : null}
          </button>
        ))}
      </div>
      <div className="adegan-tanah" aria-hidden="true" />
      {adegan.latar ? <div className="adegan-latar">di {adegan.latar}</div> : null}
    </div>
  );
}
