// Halaman uji suara: guru membaca kalimat acuan, aplikasi merekam dan
// membandingkan hasil Gemini dengan hasil Chrome, lalu menyimpan berkas yang
// bisa dianalisis (termasuk rekaman, supaya bisa diuji ulang).
import { useEffect, useMemo, useRef, useState } from 'react';
import { mulaiRekam, rekamDidukung, pesanMik, siapkanMik } from '../lib/rekam.js';
import { buatPendengar, suaraDidukung } from '../lib/suara.js';
import { transkripsi, cekKesehatan } from '../lib/api.js';
import { hitungWer } from '../lib/wer.js';
import { kosakata } from '../scene/pustaka.js';

const KALIMAT = [
  'Ada tiga kelinci berlari di rumput.',
  'Lalu dua kelinci pergi.',
  'Ada tujuh ikan berenang di kolam.',
  'Coba hitung, ada berapa ikan?',
  'Seekor kuda nil sedang berjemur di sungai.',
  'Ibu membeli lima apel, lalu memberi dua apel lagi.',
  'Pizza ini kita bagi empat sama besar.',
  'Adik makan satu potong.',
  'Kucing tidur di bawah meja.',
  'Sekarang kucingnya naik ke atas meja.',
  'Ada dua belas bebek dan tujuh angsa di peternakan.',
  'Anak-anak, perhatikan papan. Ada lima balon terbang di langit.',
];

const KONDISI = [
  ['tenang', 'Ruangan tenang, mikrofon dekat'],
  ['kelas', 'Ada suara latar (kelas / TV / musik pelan)'],
  ['jauh', 'Mikrofon jauh (±1–2 meter)'],
];

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const persen = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '–');

export default function Uji() {
  const [hasil, setHasil] = useState({}); // indeks → hasil satu kalimat
  const [aktif, setAktif] = useState(null); // indeks yang sedang direkam
  const [sibuk, setSibuk] = useState(null); // indeks yang sedang diperiksa
  const [kondisi, setKondisi] = useState('tenang');
  const [galat, setGalat] = useState('');
  const [siap, setSiap] = useState(null);
  const kontrolRef = useRef(null);
  const chromeRef = useRef([]);
  const pendengarRef = useRef(null);
  const mulaiRef = useRef(0);

  useEffect(() => {
    cekKesehatan().then((k) => setSiap(Boolean(k?.suara)));
    if (!suaraDidukung()) return undefined;
    pendengarRef.current = buatPendengar({
      saatSementara: () => {},
      saatFinal: (t) => chromeRef.current.push(t),
      saatStatus: () => {},
      saatGalat: () => {},
      kosakata: kosakata(),
    });
    return () => pendengarRef.current?.berhenti();
  }, []);

  const rekam = async (i) => {
    setGalat('');
    chromeRef.current = [];
    setAktif(i);
    try {
      await siapkanMik();
      pendengarRef.current?.mulai();
      kontrolRef.current = await mulaiRekam();
      mulaiRef.current = Date.now();
    } catch (e) {
      setAktif(null);
      setGalat(pesanMik(e));
    }
  };

  const berhenti = async (i) => {
    const kontrol = kontrolRef.current;
    kontrolRef.current = null;
    setAktif(null);
    setSibuk(i);
    pendengarRef.current?.berhenti();
    try {
      const rek = await kontrol.berhenti();
      await tunggu(700); // hasil akhir Chrome tiba sedikit terlambat
      const chrome = chromeRef.current.join(' ').trim();
      const hasilBaru = { acuan: KALIMAT[i], chrome, kondisi, durasi: rek?.durasi ?? 0, rms: rek?.rms ?? 0, ucapanTerdeteksi: Boolean(rek?.ucapan) };
      if (!rek) {
        hasilBaru.catatan = 'Rekaman gagal dibaca.';
      } else if (!rek.ucapan) {
        hasilBaru.catatan = 'Tidak ada ucapan terdeteksi (terlalu pelan atau terlalu singkat). Coba lagi lebih dekat ke mikrofon.';
        hasilBaru.audio = rek.audio;
      } else {
        const t0 = Date.now();
        try {
          const r = await transkripsi(rek.audio, 'kosong', { urai: true });
          hasilBaru.gemini = r.transkrip;
          hasilBaru.latensiMs = Date.now() - t0;
          hasilBaru.model = r.sumber;
        } catch (e) {
          hasilBaru.catatan = e.message;
        }
        hasilBaru.audio = rek.audio;
      }
      setHasil((h) => ({ ...h, [i]: hasilBaru }));
    } finally {
      setSibuk(null);
    }
  };

  const ringkasan = useMemo(() => {
    let g = { salah: 0, total: 0 };
    let c = { salah: 0, total: 0 };
    let n = 0;
    for (const [i, r] of Object.entries(hasil)) {
      if (r.gemini === undefined) continue;
      n++;
      const a = hitungWer(KALIMAT[i], r.gemini);
      g = { salah: g.salah + a.salah, total: g.total + a.total };
      if (suaraDidukung()) {
        const b = hitungWer(KALIMAT[i], r.chrome);
        c = { salah: c.salah + b.salah, total: c.total + b.total };
      }
    }
    return { n, g, c };
  }, [hasil]);

  const rekamanSelesai = Object.keys(hasil).length;

  const unduh = () => {
    const data = {
      versi: 1,
      waktu: new Date().toISOString(),
      kondisiUmum: kondisi,
      browser: navigator.userAgent,
      kalimatAcuan: KALIMAT,
      hasil: Object.entries(hasil).map(([i, r]) => ({ nomor: Number(i) + 1, ...r })),
    };
    const nama = `suarapapan-uji-suara-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nama;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const [tersalin, setTersalin] = useState(false);
  const salin = async () => {
    const baris = Object.entries(hasil).map(([i, r]) => [
      `${Number(i) + 1}. (${r.kondisi}) acuan : ${r.acuan}`,
      `   Gemini: ${r.gemini ?? '(tidak ada)'}`,
      `   Chrome: ${r.chrome || '(tidak ada)'}`,
    ].join('\n'));
    const teks = `Uji suara SuaraPapan — ${new Date().toLocaleString('id-ID')}\n${baris.join('\n')}`;
    try { await navigator.clipboard.writeText(teks); setTersalin(true); setTimeout(() => setTersalin(false), 2500); } catch { setGalat('Tidak bisa menyalin. Pakai tombol Unduh.'); }
  };

  if (!rekamDidukung()) {
    return <main className="guru"><p className="galat">Browser ini tidak bisa merekam suara. Buka halaman ini di Google Chrome.</p></main>;
  }

  return (
    <main className="guru uji">
      <header className="guru-kepala">
        <h1>SuaraPapan <span>uji suara</span></h1>
        <a className="tombol" href="/guru">Kembali ke panel guru</a>
      </header>

      <section className="kartu">
        <h2>Cara uji</h2>
        <ol className="uji-langkah">
          <li>Izinkan mikrofon jika Chrome bertanya.</li>
          <li>Pilih kondisi ruangan di bawah.</li>
          <li>Tekan <b>Rekam</b>, baca kalimat dengan suara dan kecepatan seperti saat mengajar, lalu tekan <b>Berhenti</b>.</li>
          <li>Ulangi untuk setiap kalimat (boleh tidak semua, minimal 6).</li>
          <li>Tekan <b>Unduh hasil</b>, lalu beri tahu saya.</li>
        </ol>
        <p className="petunjuk">Rekaman dikirim ke Gemini lewat server SuaraPapan untuk diperiksa, sama seperti saat dipakai di kelas.
          Berkas yang diunduh hanya tersimpan di komputer Anda sampai Anda membagikannya.</p>
        <label className="uji-kondisi">Kondisi:{' '}
          <select value={kondisi} onChange={(e) => setKondisi(e.target.value)} disabled={aktif !== null}>
            {KONDISI.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
        {siap === false ? <p className="galat">Server pengenalan suara akurat belum aktif (GEMINI_API_KEY).</p> : null}
        {galat ? <p className="galat" role="alert">{galat}</p> : null}
      </section>

      <section className="kartu">
        <h2>Kalimat</h2>
        <ol className="uji-daftar">
          {KALIMAT.map((k, i) => {
            const r = hasil[i];
            const wg = r?.gemini !== undefined ? hitungWer(k, r.gemini) : null;
            const wc = r && suaraDidukung() ? hitungWer(k, r.chrome) : null;
            return (
              <li key={k} className={aktif === i ? 'uji-aktif' : ''}>
                <p className="uji-acuan">{k}</p>
                <div className="baris-tombol">
                  {aktif === i ? (
                    <button type="button" className="tombol tombol-utama" onClick={() => berhenti(i)}>● Berhenti</button>
                  ) : (
                    <button type="button" className="tombol" onClick={() => rekam(i)} disabled={aktif !== null || sibuk !== null}>
                      {r ? 'Rekam ulang' : 'Rekam'}
                    </button>
                  )}
                  {sibuk === i ? <span className="petunjuk">Memeriksa…</span> : null}
                </div>
                {r ? (
                  <dl className="uji-hasil">
                    <dt>Gemini</dt>
                    <dd>{r.gemini ?? '—'} {wg ? <span className={wg.salah ? 'uji-salah' : 'uji-benar'}>{wg.salah ? `${wg.salah} salah / ${wg.total} kata` : 'tepat'}</span> : null}</dd>
                    {suaraDidukung() ? (
                      <>
                        <dt>Chrome</dt>
                        <dd>{r.chrome || '—'} {wc ? <span className={wc.salah ? 'uji-salah' : 'uji-benar'}>{wc.salah ? `${wc.salah} salah / ${wc.total} kata` : 'tepat'}</span> : null}</dd>
                      </>
                    ) : null}
                    {r.latensiMs ? (<><dt>Waktu</dt><dd>{(r.latensiMs / 1000).toFixed(1)} detik</dd></>) : null}
                    {r.catatan ? <dd className="uji-catatan">{r.catatan}</dd> : null}
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="kartu">
        <h2>Ringkasan</h2>
        <p>{ringkasan.n ? (
          <>
            Gemini: <b>{persen(ringkasan.g.salah, ringkasan.g.total)}</b> kata salah ({ringkasan.g.salah}/{ringkasan.g.total}).
            {suaraDidukung() ? <> Chrome: <b>{persen(ringkasan.c.salah, ringkasan.c.total)}</b> ({ringkasan.c.salah}/{ringkasan.c.total}).</> : null}
          </>
        ) : 'Belum ada kalimat yang direkam.'}</p>
        <div className="baris-tombol">
          <button type="button" className="tombol tombol-utama" onClick={unduh} disabled={!rekamanSelesai}>Unduh hasil (.json)</button>
          <button type="button" className="tombol" onClick={salin} disabled={!rekamanSelesai}>{tersalin ? 'Tersalin ✓' : 'Salin ringkasan teks'}</button>
        </div>
      </section>
    </main>
  );
}
