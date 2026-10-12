import { useEffect, useMemo, useState } from 'react';
import Adegan from '../scene/Adegan.jsx';
import { ADEGAN_KOSONG } from '../scene/engine.js';
import { kirim, dengar } from '../lib/saluran.js';

function Soal({ soal, versi }) {
  const [pilihan, setPilihan] = useState(null);
  useEffect(() => setPilihan(null), [versi]);
  const opsi = useMemo(
    () => [...new Set([soal.jawaban - 1, soal.jawaban, soal.jawaban + 1].filter((x) => x >= 0))],
    [soal.jawaban],
  );
  const benar = pilihan === soal.jawaban;
  return (
    <div className="soal">
      <p className="soal-teks">{pilihan !== null && benar ? soal.teks.replace('?', String(soal.jawaban)) : soal.teks}</p>
      <div className="soal-opsi">
        {opsi.map((n) => (
          <button
            key={n}
            type="button"
            className={`soal-tombol${pilihan === n ? (benar ? ' benar' : ' salah') : ''}`}
            onClick={() => setPilihan(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="soal-umpan" aria-live="polite">
        {pilihan === null ? '' : benar ? 'Benar!' : 'Belum tepat. Coba hitung lagi.'}
      </p>
    </div>
  );
}

function Caption({ teks, sementara, sorot }) {
  if (!teks) return null;
  const set = new Set((sorot || []).map((s) => s.toLowerCase()));
  const kata = teks.split(/(\s+)/);
  return (
    <p className={`caption${sementara ? ' caption-sementara' : ''}`} aria-live="polite">
      {kata.map((k, i) => {
        const bersih = k.toLowerCase().replace(/[^a-z-]/g, '');
        return set.has(bersih) ? <mark key={i}>{k}</mark> : <span key={i}>{k}</span>;
      })}
    </p>
  );
}

export default function Papan() {
  const [adegan, setAdegan] = useState(ADEGAN_KOSONG);
  const [caption, setCaption] = useState({ teks: '', sementara: false, sorot: [] });

  useEffect(() => {
    const lepas = dengar((m) => {
      if (m.type === 'adegan') setAdegan(m.adegan);
      if (m.type === 'caption') setCaption(m);
    });
    kirim({ type: 'halo' }); // minta adegan terakhir dari /guru
    return lepas;
  }, []);

  const layarPenuh = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <main className="papan">
      <button type="button" className="papan-layar-penuh" onClick={layarPenuh}>Layar penuh</button>
      <div className="papan-atas">{adegan.soal ? <Soal soal={adegan.soal} versi={adegan.versi} /> : null}</div>
      {adegan.objek.length ? (
        <Adegan adegan={adegan} interaktif />
      ) : (
        <div className="papan-kosong">
          <p className="papan-logo">SuaraPapan</p>
          <p>Menunggu guru berbicara…</p>
        </div>
      )}
      <div className="papan-bawah">
        <Caption {...caption} />
      </div>
    </main>
  );
}
