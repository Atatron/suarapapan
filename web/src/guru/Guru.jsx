import { useCallback, useEffect, useRef, useState } from 'react';
import Adegan from '../scene/Adegan.jsx';
import { ADEGAN_KOSONG, terapkan, konteks, deskripsi } from '../scene/engine.js';
import { kirim, dengar } from '../lib/saluran.js';
import { suaraDidukung, buatPendengar } from '../lib/suara.js';
import { uraikan, cekKesehatan } from '../lib/api.js';

const KATA_ANGKA = 'satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas belas puluh seratus'.split(' ');
const TOMBOL_CLICKER = new Set(['PageDown', 'PageUp']);

function kataSorot(hasil) {
  const s = new Set(KATA_ANGKA);
  for (const e of hasil.entitas || []) s.add(e.jenis);
  for (const p of hasil.peristiwa || []) s.add(p.target);
  return [...s];
}

export default function Guru() {
  const [papan, setPapan] = useState(ADEGAN_KOSONG);
  const [riwayat, setRiwayat] = useState([]);
  const [pratinjau, setPratinjau] = useState(null);
  const [otomatis, setOtomatis] = useState(false);
  const [jeda, setJeda] = useState(false);
  const [mendengar, setMendengar] = useState(false);
  const [sementara, setSementara] = useState('');
  const [log, setLog] = useState([]);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(0);
  const [ketik, setKetik] = useState('');
  const [sematan, setSematan] = useState([]);
  const [kesehatan, setKesehatan] = useState(null);

  // Ref dipakai di dalam fungsi async supaya selalu membaca nilai terbaru.
  const papanRef = useRef(papan);
  const pratinjauRef = useRef(pratinjau);
  const otomatisRef = useRef(otomatis);
  const jedaRef = useRef(jeda);
  const mendengarRef = useRef(false);
  otomatisRef.current = otomatis;
  jedaRef.current = jeda;
  mendengarRef.current = mendengar;
  const antrean = useRef(Promise.resolve());
  const pendengar = useRef(null);

  const kirimCaption = (teks, sementaraFlag, sorot = []) => {
    if (!jedaRef.current) kirim({ type: 'caption', teks, sementara: sementaraFlag, sorot });
  };

  const tampilkan = useCallback((adegan) => {
    setRiwayat((r) => [...r.slice(-29), papanRef.current]);
    papanRef.current = adegan;
    setPapan(adegan);
    kirim({ type: 'adegan', adegan });
    pratinjauRef.current = null;
    setPratinjau(null);
  }, []);

  const proses = useCallback(async (kalimat) => {
    setSibuk((n) => n + 1);
    setGalat('');
    kirimCaption(kalimat, false);
    // Kalimat berikutnya dibangun di atas pratinjau yang belum disetujui,
    // karena guru biasanya akan menyetujuinya.
    const dasar = pratinjauRef.current?.adegan ?? papanRef.current;
    try {
      const { hasil, ms, sumber, yakin } = await uraikan(kalimat, konteks(dasar));
      const r = terapkan(dasar, hasil);
      kirimCaption(kalimat, false, kataSorot(hasil));
      setLog((l) => [{
        id: `${Date.now()}-${Math.random()}`, kalimat, ms, sumber, yakin,
        ringkas: r.berubah ? deskripsi(r.adegan) : 'Hanya caption (tidak ada benda).',
        catatan: r.catatan,
      }, ...l].slice(0, 30));
      if (!r.berubah) return;
      if (otomatisRef.current) {
        tampilkan(r.adegan);
      } else {
        const p = { adegan: r.adegan, kalimat, ms, catatan: r.catatan };
        pratinjauRef.current = p;
        setPratinjau(p);
      }
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk((n) => n - 1);
    }
  }, [tampilkan]);

  // Kalimat diproses berurutan: kalimat kedua butuh hasil kalimat pertama.
  const masukkan = useCallback((kalimat) => {
    if (!kalimat.trim()) return;
    antrean.current = antrean.current.then(() => proses(kalimat.trim()));
  }, [proses]);

  // Mikrofon
  useEffect(() => {
    if (!suaraDidukung()) return undefined;
    pendengar.current = buatPendengar({
      saatSementara: (t) => { setSementara(t); if (t) kirimCaption(t, true); },
      saatFinal: (t) => { setSementara(''); masukkan(t); },
      saatStatus: setMendengar,
      saatGalat: (pesan) => { setGalat(pesan); setMendengar(false); },
    });
    return () => pendengar.current?.berhenti();
  }, [masukkan]);

  const mulai = () => { setGalat(''); pendengar.current?.mulai(); };
  const berhenti = () => pendengar.current?.berhenti();

  // Spasi = tahan untuk bicara. Tombol clicker presentasi (PageDown/PageUp) = nyala/mati.
  useEffect(() => {
    const diInput = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    const turun = (e) => {
      if (diInput(e) || e.repeat) return;
      if (e.code === 'Space') { e.preventDefault(); mulai(); }
      if (TOMBOL_CLICKER.has(e.key)) { e.preventDefault(); mendengarRef.current ? berhenti() : mulai(); }
    };
    const naik = (e) => {
      if (diInput(e)) return;
      if (e.code === 'Space') { e.preventDefault(); berhenti(); }
    };
    window.addEventListener('keydown', turun);
    window.addEventListener('keyup', naik);
    return () => { window.removeEventListener('keydown', turun); window.removeEventListener('keyup', naik); };
  }, []);

  // /papan yang baru dibuka meminta adegan terakhir.
  useEffect(() => dengar((m) => {
    if (m.type === 'halo') kirim({ type: 'adegan', adegan: papanRef.current });
  }), []);

  useEffect(() => {
    const cek = () => cekKesehatan().then(setKesehatan);
    cek();
    const t = setInterval(cek, 15000);
    return () => clearInterval(t);
  }, []);

  const batalkan = () => {
    if (!riwayat.length) return;
    const sebelumnya = riwayat[riwayat.length - 1];
    setRiwayat((r) => r.slice(0, -1));
    papanRef.current = sebelumnya;
    setPapan(sebelumnya);
    kirim({ type: 'adegan', adegan: sebelumnya });
  };
  const buang = () => { pratinjauRef.current = null; setPratinjau(null); };
  const bersihkan = () => {
    tampilkan({ ...ADEGAN_KOSONG, versi: papanRef.current.versi + 1 });
    kirim({ type: 'caption', teks: '', sementara: false, sorot: [] });
  };
  const sematkan = () => {
    if (!papan.objek.length) return;
    setSematan((s) => [...s, { id: `${Date.now()}`, adegan: papan, label: deskripsi(papan) }]);
  };
  const kirimKetik = (e) => { e.preventDefault(); masukkan(ketik); setKetik(''); };

  const status = kesehatan === null ? 'memeriksa…'
    : !kesehatan.server ? 'server ML mati'
      : kesehatan.indobert && kesehatan.ollama ? 'siap'
        : kesehatan.indobert ? 'IndoBERT siap, LLM cadangan mati'
          : kesehatan.ollama ? 'hanya LLM (IndoBERT belum dilatih)' : 'model belum siap';

  return (
    <main className="guru">
      <header className="guru-kepala">
        <h1>SuaraPapan <span>panel guru</span></h1>
        <div className="guru-kepala-kanan">
          <span className={`chip chip-${status === 'siap' ? 'ok' : 'peringatan'}`}>Model: {status}</span>
          <button type="button" className="tombol" onClick={() => window.open('/papan', 'suarapapan-papan')}>Buka papan</button>
        </div>
      </header>

      <div className="guru-isi">
        <section className="kartu guru-bicara" aria-label="Bicara">
          {suaraDidukung() ? (
            <button
              type="button"
              className={`tombol-mik${mendengar ? ' aktif' : ''}`}
              onPointerDown={mulai}
              onPointerUp={berhenti}
              onPointerLeave={() => mendengar && berhenti()}
            >
              <span className="tombol-mik-titik" aria-hidden="true" />
              {mendengar ? 'Mendengarkan… lepas jika selesai' : 'Tahan untuk bicara'}
            </button>
          ) : (
            <p className="galat">Browser ini tidak mendukung pengenalan suara. Gunakan Google Chrome, atau ketik kalimat di bawah.</p>
          )}
          <p className="petunjuk">Tahan tombol Spasi atau tekan clicker presentasi untuk bicara.</p>
          <p className="transkrip" aria-live="polite">{sementara || (sibuk ? 'Memahami kalimat…' : 'Transkrip muncul di sini.')}</p>
          <form className="form-ketik" onSubmit={kirimKetik}>
            <label htmlFor="ketik-kalimat">Atau ketik kalimat</label>
            <div className="form-ketik-baris">
              <input id="ketik-kalimat" value={ketik} onChange={(e) => setKetik(e.target.value)} placeholder="contoh: ada tiga kelinci berlari di rumput" autoComplete="off" />
              <button type="submit" className="tombol tombol-utama">Kirim</button>
            </div>
          </form>
          {galat ? <p className="galat" role="alert">{galat}</p> : null}
          <div className="sakelar">
            <label><input id="opsi-otomatis" type="checkbox" checked={otomatis} onChange={(e) => setOtomatis(e.target.checked)} /> Tampilkan otomatis tanpa pratinjau</label>
            <label><input id="opsi-jeda" type="checkbox" checked={jeda} onChange={(e) => setJeda(e.target.checked)} /> Jeda caption di papan</label>
          </div>
        </section>

        <section className="kartu" aria-label="Pratinjau">
          <h2>Pratinjau</h2>
          {pratinjau ? (
            <>
              <Adegan adegan={pratinjau.adegan} kecil />
              <p className="ringkas">{deskripsi(pratinjau.adegan)}</p>
              {pratinjau.catatan.map((c) => <p key={c} className="catatan">{c}</p>)}
              <div className="baris-tombol">
                <button type="button" className="tombol tombol-utama" onClick={() => tampilkan(pratinjau.adegan)}>Tampilkan di papan</button>
                <button type="button" className="tombol" onClick={buang}>Buang</button>
              </div>
            </>
          ) : (
            <p className="kosong">Belum ada pratinjau. Ucapkan kalimat seperti “ada tiga kelinci berlari di rumput”.</p>
          )}
        </section>

        <section className="kartu" aria-label="Papan saat ini">
          <h2>Di papan sekarang</h2>
          <Adegan adegan={papan} kecil />
          <p className="ringkas">{deskripsi(papan)}</p>
          <div className="baris-tombol">
            <button type="button" className="tombol" onClick={batalkan} disabled={!riwayat.length}>Batalkan</button>
            <button type="button" className="tombol" onClick={sematkan} disabled={!papan.objek.length}>Sematkan</button>
            <button type="button" className="tombol" onClick={bersihkan}>Bersihkan</button>
          </div>
          {sematan.length ? (
            <div className="sematan">
              <h3>Disematkan</h3>
              {sematan.map((s) => (
                <button key={s.id} type="button" className="tombol tombol-teks" onClick={() => tampilkan({ ...s.adegan, versi: papanRef.current.versi + 1 })}>{s.label}</button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="kartu guru-log" aria-label="Riwayat kalimat">
          <h2>Riwayat kalimat</h2>
          {log.length ? (
            <ol>
              {log.map((l) => (
                <li key={l.id}>
                  <p className="log-kalimat">“{l.kalimat}”</p>
                  <p className="log-hasil">{l.ringkas} <span>{l.sumber} · {Math.round(l.ms)} ms{l.yakin != null ? ` · yakin ${Math.round(l.yakin * 100)}%` : ''}</span></p>
                </li>
              ))}
            </ol>
          ) : <p className="kosong">Belum ada kalimat.</p>}
        </section>
      </div>
    </main>
  );
}
