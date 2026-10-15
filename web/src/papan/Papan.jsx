import { useEffect, useMemo, useState } from 'react';
import Adegan from '../scene/Adegan.jsx';
import { Benda } from '../scene/aset.jsx';
import { ADEGAN_KOSONG } from '../scene/engine.js';
import { kirim, dengar } from '../lib/saluran.js';

function Soal({ soal, versi }) {
  const [pilihan, setPilihan] = useState(null);
  useEffect(() => setPilihan(null), [versi]);
  // Adegan lama (tanpa opsi) tetap didukung: opsi dibuat di sekitar jawaban.
  const opsi = useMemo(
    () => soal.opsi || [...new Set([soal.jawaban - 1, soal.jawaban, soal.jawaban + 1].filter((x) => x >= 0))],
    [soal.opsi, soal.jawaban],
  );
  const benar = pilihan !== null && String(pilihan) === String(soal.jawaban);
  return (
    <div className="soal">
      {soal.rincian?.length ? (
        <ul className="soal-rincian" aria-label="Rincian karakter">
          {soal.rincian.map((r) => (
            <li key={r.jenis} className="rincian-item">
              <span className="rincian-gambar"><Benda jenis={r.jenis} /></span>
              <b>{r.n}</b>
              <span>{r.jenis}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="soal-teks">{!benar ? soal.teks : soal.teks.includes('= ?') ? soal.teks.replace('= ?', `= ${soal.jawaban}`) : `${soal.teks} ${soal.jawaban}`}</p>
      <div className="soal-opsi">
        {opsi.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={String(n).includes('/') ? String(n).replace('/', ' per ') : undefined}
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

// Hanya saat pengembangan: /papan?demo=<json adegan>&teks=... memuat adegan langsung,
// untuk tangkapan layar dan pemeriksaan tampilan tanpa panel guru.
function demoDariUrl() {
  if (!import.meta.env.DEV) return null;
  try {
    const q = new URLSearchParams(window.location.search);
    const d = q.get('demo');
    return d ? { adegan: JSON.parse(d), teks: q.get('teks') || '' } : null;
  } catch {
    return null;
  }
}

export default function Papan() {
  const demo = useMemo(demoDariUrl, []);
  const [adegan, setAdegan] = useState(() => demo?.adegan ?? ADEGAN_KOSONG);
  const [caption, setCaption] = useState({ teks: demo?.teks ?? '', sementara: false, sorot: [] });

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
      <div className="papan-panggung">
        <Adegan adegan={adegan} interaktif />
        {adegan.objek.length ? null : (
          <div className="papan-lapis-kosong">
            <div>
              <p className="papan-logo">SuaraPapan</p>
              <p>Menunggu guru berbicara…</p>
            </div>
          </div>
        )}
      </div>
      <div className="papan-bawah">
        <Caption {...caption} />
      </div>
    </main>
  );
}
