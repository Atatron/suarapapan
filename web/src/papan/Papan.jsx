import { useEffect, useMemo, useRef, useState } from 'react';
import Adegan from '../scene/Adegan.jsx';
import { Benda } from '../scene/aset.jsx';
import { ADEGAN_KOSONG, pindahkan } from '../scene/engine.js';
import { bacaSesi, bolehTerimaSnapshot, buatSaluran, sesiDariUrl } from '../lib/saluran.js';

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
  const sesi = useMemo(() => sesiDariUrl(), []);
  const [snapshot, setSnapshot] = useState(() => demo ? null : bacaSesi(sesi));
  const snapshotRef = useRef(snapshot);
  const saluranRef = useRef(null);
  const [koneksi, setKoneksi] = useState(sesi ? 'menghubungkan' : 'tanpa-sesi');
  const [galatLayar, setGalatLayar] = useState('');
  const [jelas, setJelas] = useState(false);
  const adegan = snapshot?.adegan ?? demo?.adegan ?? ADEGAN_KOSONG;
  const caption = snapshot?.caption ?? { teks: demo?.teks ?? '', sementara: false, sorot: [] };

  useEffect(() => {
    if (demo || !sesi) return undefined;
    const saluran = buatSaluran(sesi);
    saluranRef.current = saluran;
    if (!saluran.tersedia) { setKoneksi('tidak-didukung'); return () => saluran.tutup(); }
    let terakhir = 0;
    const lepas = saluran.dengar((m) => {
      if (m.type !== 'snapshot' || !bolehTerimaSnapshot(snapshotRef.current, m.snapshot, sesi)) return;
      terakhir = Date.now();
      setKoneksi('terhubung');
      // Satu pembaruan React memulihkan objek, caption, dan sorot secara serentak.
      if (snapshotRef.current?.controllerId !== m.snapshot.controllerId || snapshotRef.current?.revision !== m.snapshot.revision) {
        snapshotRef.current = m.snapshot;
        setSnapshot(m.snapshot);
      }
    });
    saluran.kirim({ type: 'halo' });
    const mulai = Date.now();
    const t = setInterval(() => {
      if (Date.now() - (terakhir || mulai) > 9000) setKoneksi('terputus');
      saluran.kirim({ type: 'halo' });
    }, 3000);
    return () => { clearInterval(t); lepas(); saluran.tutup(); saluranRef.current = null; };
  }, [sesi, demo]);

  // Karakter diseret langsung di proyektor: papan berubah seketika, dan /guru ikut mencatat posisinya.
  const geserDiPapan = (id, px, py, beku) => {
    const kini = snapshotRef.current;
    if (!kini || koneksi !== 'terhubung') return;
    const baru = { ...kini, adegan: pindahkan(kini.adegan, id, px, py, beku) };
    snapshotRef.current = baru;
    setSnapshot(baru);
    saluranRef.current?.kirim({ type: 'geser', id, px, py, beku, controllerId: kini.controllerId, generation: kini.generation, revision: kini.revision });
  };

  const layarPenuh = async () => {
    try {
      if (!document.documentElement.requestFullscreen) throw new Error();
      await document.documentElement.requestFullscreen();
      setGalatLayar('');
    } catch { setGalatLayar('Layar penuh tidak tersedia. Gunakan tombol layar penuh pada browser.'); }
  };
  const pesanKoneksi = koneksi === 'terhubung' ? 'Terhubung ke panel guru'
    : koneksi === 'menghubungkan' ? 'Menghubungkan ke panel guru…'
      : koneksi === 'tanpa-sesi' ? 'Buka papan lewat tombol “Buka papan” di panel guru.'
        : koneksi === 'tidak-didukung' ? 'Browser ini tidak mendukung sambungan antartab.'
          : 'Panel guru belum terhubung. Papan terakhir tetap ditampilkan.';

  return (
    <main className={`papan${jelas ? ' papan-jelas' : ''}`}>
      <div className="papan-kontrol">
        <button type="button" className="papan-layar-penuh" onClick={layarPenuh}>Layar penuh</button>
        <button type="button" className="papan-mode-jelas" aria-pressed={jelas} onClick={() => setJelas((x) => !x)}>Latar sederhana</button>
      </div>
      {!demo ? <div className={`papan-koneksi${koneksi === 'terhubung' ? ' terhubung' : ''}`} role="status">
        <span>{pesanKoneksi}</span>
        {koneksi !== 'terhubung' ? <small>Panel guru dan papan harus dibuka di browser dan perangkat yang sama.</small> : null}
      </div> : null}
      {galatLayar ? <p className="papan-galat" role="alert">{galatLayar}</p> : null}
      <div className="papan-atas">{adegan.soal ? <Soal soal={adegan.soal} versi={adegan.versi} /> : null}</div>
      <div className="papan-panggung">
        <Adegan adegan={adegan} interaktif bisaGeser={koneksi === 'terhubung'} onGeser={geserDiPapan} />
        {adegan.objek.length || adegan.soal ? null : (
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
