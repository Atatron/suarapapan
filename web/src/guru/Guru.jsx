import { useCallback, useEffect, useRef, useState } from 'react';
import Adegan from '../scene/Adegan.jsx';
import { ADEGAN_KOSONG, terapkan, konteks, deskripsi } from '../scene/engine.js';
import { kirim, dengar } from '../lib/saluran.js';
import { suaraDidukung, buatPendengar } from '../lib/suara.js';
import { uraikan, cekKesehatan, transkripsi } from '../lib/api.js';
import { rekamDidukung, mulaiRekam, siapkanMik, mikSudahDiizinkan, pesanMik } from '../lib/rekam.js';
import { kosakata } from '../scene/pustaka.js';
import PilihKarakter from './PilihKarakter.jsx';
import SebelumSesudah from './SebelumSesudah.jsx';
import * as Sej from '../scene/sejarah.js';

const KATA_ANGKA = 'satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas belas puluh seratus'.split(' ');
const TOMBOL_CLICKER = new Set(['PageDown', 'PageUp']);
const KOSAKATA = kosakata();
const TUNGGU_HASIL_CHROME_MS = 500; // hasil akhir Web Speech tiba sedikit setelah tombol dilepas
const JEDA_MIN_DETIK = 0.35;        // lebih pendek dari ini = tombol tersentuh, bukan ucapan
const RMS_MIN = 0.004;              // lebih pelan dari ini = hening
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

const bacaPilihan = () => {
  try { return localStorage.getItem('suarapapan-akurat') !== '0'; } catch { return true; }
};

function kataSorot(hasil) {
  const s = new Set(KATA_ANGKA);
  for (const e of hasil.entitas || []) s.add(e.jenis);
  for (const p of hasil.peristiwa || []) s.add(p.target);
  return [...s];
}

export default function Guru() {
  // Riwayat papan (Batalkan/Ulangi): ref = sumber kebenaran (dibaca di fungsi async), state = untuk tampilan.
  const [sejarah, setSejarahState] = useState(() => Sej.awalSejarah(ADEGAN_KOSONG));
  const sejarahRef = useRef(sejarah);
  const papan = sejarah.sekarang.adegan;
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
  const [akurat, setAkurat] = useState(bacaPilihan);
  const [memeriksa, setMemeriksa] = useState(false);
  const [gabung, setGabung] = useState(false);
  const [hitungSemua, setHitungSemua] = useState(true);
  const [tafsir, setTafsir] = useState(null); // tafsir lain untuk kalimat terakhir yang sudah tampil di papan

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
  // Mode "akurat": suara direkam dan diperiksa Gemini; Web Speech Chrome hanya
  // untuk caption langsung dan sebagai cadangan jika Gemini gagal.
  const akuratRef = useRef(akurat);
  const suaraSiapRef = useRef(false);
  const tahanRef = useRef(false);
  const rekamRef = useRef(null);
  const cadanganRef = useRef([]);
  const modeAkuratRef = useRef(false);
  const sesiRef = useRef(0);
  const masukkanRef = useRef(() => {});
  akuratRef.current = akurat;
  const gabungRef = useRef(false);
  gabungRef.current = gabung;
  const hitungSemuaRef = useRef(true);
  hitungSemuaRef.current = hitungSemua;

  const kirimCaption = (teks, sementaraFlag, sorot = []) => {
    if (!jedaRef.current) kirim({ type: 'caption', teks, sementara: sementaraFlag, sorot });
  };

  const setSejarah = useCallback((baru) => {
    sejarahRef.current = baru;
    papanRef.current = baru.sekarang.adegan;
    setSejarahState(baru);
  }, []);

  // `label` = kalimat (atau tindakan) yang menghasilkan papan ini; tampil di "Sebelum dan sesudah".
  const tampilkan = useCallback((adegan, label = '') => {
    setSejarah(Sej.catat(sejarahRef.current, adegan, label));
    kirim({ type: 'adegan', adegan });
    pratinjauRef.current = null;
    setPratinjau(null);
    setTafsir(null);
  }, [setSejarah]);

  // `awal` = { konteks, janji }: hasil urai yang sudah dimulai lebih dulu dari teks Chrome.
  // Dipakai hanya jika konteks adegannya masih sama persis dengan sekarang.
  const proses = useCallback(async (kalimat, awal = null) => {
    setSibuk((n) => n + 1);
    setGalat('');
    kirimCaption(kalimat, false);
    // Kalimat berikutnya dibangun di atas pratinjau yang belum disetujui,
    // karena guru biasanya akan menyetujuinya.
    const dasar = pratinjauRef.current?.adegan ?? papanRef.current;
    try {
      const konteksIni = konteks(dasar);
      const dariAwal = awal && awal.konteks === konteksIni ? await awal.janji : null;
      const { hasil, ms, sumber, yakin } = dariAwal ?? await uraikan(kalimat, konteksIni);
      const r = terapkan(dasar, hasil, { gabung: gabungRef.current || undefined, hitungSemua: hitungSemuaRef.current });
      kirimCaption(kalimat, false, kataSorot(hasil));
      setLog((l) => [{
        id: `${Date.now()}-${Math.random()}`, kalimat, ms, sumber, yakin,
        ringkas: r.berubah
          ? `${deskripsi(r.adegan)}${r.penjelasan.length ? ` (${r.penjelasan.join(' ')})` : ''}`
          : 'Hanya caption (tidak ada benda).',
        catatan: r.catatan,
      }, ...l].slice(0, 30));
      if (!r.berubah) return;
      if (otomatisRef.current) {
        tampilkan(r.adegan, kalimat);
        if (r.alternatif) setTafsir({ ...r.alternatif, penjelasan: r.penjelasan });
      } else {
        const p = { adegan: r.adegan, kalimat, ms, catatan: r.catatan, penjelasan: r.penjelasan, alternatif: r.alternatif };
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
  const masukkan = useCallback((kalimat, awal = null) => {
    if (!kalimat.trim()) return;
    antrean.current = antrean.current.then(() => proses(kalimat.trim(), awal));
  }, [proses]);

  // Mikrofon
  useEffect(() => {
    if (!suaraDidukung()) return undefined;
    pendengar.current = buatPendengar({
      saatSementara: (t) => { setSementara(t); if (t) kirimCaption(t, true); },
      saatFinal: (t) => {
        setSementara('');
        // Mode akurat: hasil Chrome hanya jadi caption dan cadangan.
        if (modeAkuratRef.current) {
          cadanganRef.current.push(t);
          kirimCaption(t, true);
        } else masukkan(t);
      },
      saatStatus: (aktif) => { if (!modeAkuratRef.current) setMendengar(aktif); },
      saatGalat: (pesan) => {
        // Galat Chrome tidak fatal selama rekaman jalan: Gemini tetap bisa memeriksa ucapannya.
        if (!modeAkuratRef.current) { setGalat(pesan); setMendengar(false); }
      },
      kosakata: KOSAKATA,
    });
    return () => pendengar.current?.berhenti();
  }, [masukkan]);
  masukkanRef.current = masukkan;

  // Mikrofon dibuka lebih awal jika izinnya sudah ada, supaya kata pertama tidak terpotong.
  useEffect(() => {
    if (!rekamDidukung()) return;
    mikSudahDiizinkan().then((ok) => { if (ok) siapkanMik().catch(() => {}); });
  }, []);

  const pilihAkurat = (nilai) => {
    setAkurat(nilai);
    try { localStorage.setItem('suarapapan-akurat', nilai ? '1' : '0'); } catch { /* tidak apa-apa */ }
  };

  // Rekaman selesai: transkripsi Gemini → kalimat; jika gagal pakai hasil Chrome.
  const selesaikan = useCallback(async (kontrol, sesi) => {
    setMemeriksa(true);
    let kalimat = [];
    let pesanGagal = '';
    let abaikan = false;
    let awalPertama = null;
    try {
      const rek = await kontrol.berhenti();
      if (rek && (rek.durasi < JEDA_MIN_DETIK || rek.rms < RMS_MIN || !rek.ucapan)) {
        abaikan = true; // tertekan tak sengaja, hening, atau hanya derau: jangan kirim apa pun
      } else if (rek) {
        try {
          const dasar = pratinjauRef.current?.adegan ?? papanRef.current;
          const konteksIni = konteks(dasar);
          const r = await transkripsi(rek.audio, konteksIni, { urai: true });
          kalimat = r.kalimat?.length ? r.kalimat : (r.transkrip ? [r.transkrip] : []);
          // Kalimat pertama sudah diurai dalam panggilan yang sama.
          if (r.hasil) awalPertama = { konteks: konteksIni, janji: Promise.resolve({ hasil: r.hasil, ms: r.ms, sumber: r.sumber }) };
        } catch (e) {
          pesanGagal = e.message;
        }
      }
      if (!abaikan && !kalimat.length) {
        // Gemini gagal atau kosong: pakai hasil Chrome (tunggu hasil akhirnya yang terlambat tiba).
        await tunggu(TUNGGU_HASIL_CHROME_MS);
        kalimat = cadanganRef.current.splice(0);
        if (pesanGagal && kalimat.length) setGalat(`${pesanGagal} Memakai hasil pengenalan Chrome.`);
        else if (pesanGagal) setGalat(pesanGagal);
      }
      cadanganRef.current = [];
      kalimat.forEach((k, i) => masukkanRef.current(k, i === 0 ? awalPertama : null));
    } finally {
      setMemeriksa(false);
      if (sesiRef.current === sesi) modeAkuratRef.current = false;
    }
  }, []);

  const pakaiAkurat = () => akuratRef.current && suaraSiapRef.current && rekamDidukung();

  const mulai = async () => {
    if (tahanRef.current) return;
    tahanRef.current = true;
    setGalat('');
    const sesi = ++sesiRef.current;
    cadanganRef.current = [];
    const akuratIni = pakaiAkurat();
    if (!akuratIni && !pendengar.current) {
      tahanRef.current = false;
      setGalat('Pengenalan suara tidak tersedia di browser ini. Gunakan Google Chrome, atau ketik kalimat di bawah.');
      return;
    }
    modeAkuratRef.current = akuratIni;
    setMendengar(true);
    pendengar.current?.mulai(); // caption langsung (jika browser mendukung)
    if (!akuratIni) return;
    try {
      rekamRef.current = { kontrol: await mulaiRekam(), sesi };
    } catch (e) {
      modeAkuratRef.current = false;
      rekamRef.current = null;
      setGalat(pesanMik(e));
      return;
    }
    if (!tahanRef.current) berhentiRekam(); // tombol sudah dilepas sambil menunggu izin mikrofon
  };

  const berhentiRekam = () => {
    const r = rekamRef.current;
    rekamRef.current = null;
    if (r) selesaikan(r.kontrol, r.sesi);
  };

  const berhenti = () => {
    if (!tahanRef.current) return;
    tahanRef.current = false;
    setMendengar(false);
    pendengar.current?.berhenti();
    berhentiRekam();
  };

  // Spasi = tahan untuk bicara. Tombol clicker presentasi (PageDown/PageUp) = nyala/mati.
  useEffect(() => {
    const diInput = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    const turun = (e) => {
      if (diInput(e)) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); batalkanRef.current(); return; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); ulangiRef.current(); return; }
      }
      if (e.repeat) return;
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
    const cek = () => cekKesehatan().then((k) => { suaraSiapRef.current = Boolean(k?.suara); setKesehatan(k); });
    cek();
    const t = setInterval(cek, 15000);
    return () => clearInterval(t);
  }, []);

  // Batalkan / Ulangi: papan (dan /papan di proyektor) pindah ke keadaan sebelum / sesudahnya.
  // Pratinjau yang menunggu disetujui dibangun di atas papan lama, jadi dibuang.
  const pindahSejarah = (fungsi) => {
    const lama = sejarahRef.current;
    const baru = fungsi(lama);
    if (baru === lama) return;
    setSejarah(baru);
    kirim({ type: 'adegan', adegan: baru.sekarang.adegan });
    pratinjauRef.current = null;
    setPratinjau(null);
    setTafsir(null);
  };
  const batalkan = () => pindahSejarah(Sej.batalkan);
  const ulangi = () => pindahSejarah(Sej.ulangi);
  const batalkanRef = useRef(batalkan);
  const ulangiRef = useRef(ulangi);
  batalkanRef.current = batalkan;
  ulangiRef.current = ulangi;
  const buang = () => { pratinjauRef.current = null; setPratinjau(null); };
  // Tafsir lain di pratinjau: "3 kelinci datang" dibaca sebagai "hanya 3", bukan 3 + 3.
  const pakaiAlternatifPratinjau = () => {
    const p = pratinjauRef.current;
    if (!p?.alternatif) return;
    const baru = { ...p, adegan: p.alternatif.adegan, alternatif: null, penjelasan: [`Dibaca sebagai: ${p.alternatif.label.replace('Maksudnya ', '').toLowerCase()}.`] };
    pratinjauRef.current = baru;
    setPratinjau(baru);
  };
  // Memasukkan satu karakter dari daftar langsung ke papan, tanpa mengganti isinya.
  const tambahKarakter = (nama, label) => {
    const dasar = pratinjauRef.current?.adegan ?? papanRef.current;
    const r = terapkan(dasar, { entitas: [], peristiwa: [{ tipe: 'tambah', target: label, jumlah: 1 }], konsep: 'membilang' });
    if (!r.berubah) return;
    tampilkan(r.adegan, `+ ${label}`);
    setLog((l) => [{
      id: `${Date.now()}-${Math.random()}`, kalimat: `+ ${label}`, ms: 0, sumber: 'dipilih guru', yakin: null,
      ringkas: deskripsi(r.adegan), catatan: r.catatan,
    }, ...l].slice(0, 30));
    kirimCaption(`Ditambahkan: ${label}`, false, [label]);
  };
  const bersihkan = () => {
    tampilkan({ ...ADEGAN_KOSONG, versi: papanRef.current.versi + 1 }, 'Papan dibersihkan');
    kirim({ type: 'caption', teks: '', sementara: false, sorot: [] });
  };
  const sematkan = () => {
    if (!papan.objek.length) return;
    setSematan((s) => [...s, { id: `${Date.now()}`, adegan: papan, label: deskripsi(papan) }]);
  };
  const kirimKetik = (e) => { e.preventDefault(); masukkan(ketik); setKetik(''); };

  const status = kesehatan === null ? 'memeriksa…'
    : !kesehatan.server ? 'server ML mati'
      : kesehatan.gemini !== undefined ? (kesehatan.gemini ? 'siap' : 'GEMINI_API_KEY belum diisi')
      : kesehatan.indobert && kesehatan.ollama ? 'siap'
        : kesehatan.indobert ? 'IndoBERT siap, LLM cadangan mati'
          : kesehatan.ollama ? 'hanya LLM (IndoBERT belum dilatih)' : 'model belum siap';

  return (
    <main className="guru">
      <header className="guru-kepala">
        <h1>SuaraPapan <span>panel guru</span></h1>
        <div className="guru-kepala-kanan">
          <span className={`chip chip-${status === 'siap' ? 'ok' : 'peringatan'}`}>{kesehatan?.gemini !== undefined ? 'Online (Gemini)' : 'Model'}: {status}</span>
          <button type="button" className="tombol" onClick={() => window.open('/papan', 'suarapapan-papan')}>Buka papan</button>
        </div>
      </header>

      <div className="guru-isi">
        <section className="kartu guru-bicara" aria-label="Bicara">
          {suaraDidukung() || rekamDidukung() ? (
            <button
              type="button"
              className={`tombol-mik${mendengar ? ' aktif' : ''}`}
              onPointerDown={mulai}
              onPointerUp={berhenti}
              onPointerLeave={() => mendengar && berhenti()}
            >
              <span className="tombol-mik-titik" aria-hidden="true" />
              {mendengar ? 'Mendengarkan… lepas jika selesai' : memeriksa ? 'Memeriksa ucapan…' : 'Tahan untuk bicara'}
            </button>
          ) : (
            <p className="galat">Browser ini tidak mendukung pengenalan suara. Gunakan Google Chrome, atau ketik kalimat di bawah.</p>
          )}
          <p className="petunjuk">Tahan tombol Spasi atau tekan clicker presentasi untuk bicara.</p>
          <p className="transkrip" aria-live="polite">{sementara || (memeriksa ? 'Memeriksa ucapan…' : sibuk ? 'Memahami kalimat…' : 'Transkrip muncul di sini.')}</p>
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
            <label title="Merekam suara dan memeriksanya dengan Gemini: lebih tepat untuk kata benda dan angka, tambah 1–3 detik.">
              <input id="opsi-akurat" type="checkbox" checked={akurat && Boolean(kesehatan?.suara)} disabled={!kesehatan?.suara} onChange={(e) => pilihAkurat(e.target.checked)} /> Pengenalan suara akurat (Gemini){kesehatan && !kesehatan.suara ? ' — tidak tersedia' : ''}
            </label>
            <label title="Benda yang disebut ditambahkan ke papan; benda yang sudah ada tidak dihapus. Kalimat seperti “ada juga …” atau “… datang” melakukannya otomatis.">
              <input id="opsi-gabung" type="checkbox" checked={gabung} onChange={(e) => setGabung(e.target.checked)} /> Masukkan ke papan tanpa mengganti yang sudah ada
            </label>
            <label title="Jika papan berisi beberapa jenis karakter, soal penjumlahan dan pengurangan memakai jumlah semua karakter (3 kelinci + 2 harimau = 5). Matikan jika karakter lain hanya hiasan.">
              <input id="opsi-hitung-semua" type="checkbox" checked={hitungSemua} onChange={(e) => setHitungSemua(e.target.checked)} /> Hitung semua karakter di papan
            </label>
            <label><input id="opsi-jeda" type="checkbox" checked={jeda} onChange={(e) => setJeda(e.target.checked)} /> Jeda caption di papan</label>
          </div>
        </section>

        <section className="kartu" aria-label="Pratinjau">
          <h2>Pratinjau</h2>
          {pratinjau ? (
            <>
              <Adegan adegan={pratinjau.adegan} kecil />
              <p className="ringkas">{deskripsi(pratinjau.adegan)}</p>
              {(pratinjau.penjelasan || []).map((c) => <p key={c} className="penjelasan">{c}</p>)}
              {pratinjau.catatan.map((c) => <p key={c} className="catatan">{c}</p>)}
              <div className="baris-tombol">
                <button type="button" className="tombol tombol-utama" onClick={() => tampilkan(pratinjau.adegan, pratinjau.kalimat)}>Tampilkan di papan</button>
                {pratinjau.alternatif ? (
                  <button type="button" className="tombol" onClick={pakaiAlternatifPratinjau}>{pratinjau.alternatif.label}</button>
                ) : null}
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
          {tafsir ? (
            <>
              {tafsir.penjelasan.map((c) => <p key={c} className="penjelasan">{c}</p>)}
              <div className="baris-tombol">
                <button type="button" className="tombol" onClick={() => tampilkan(tafsir.adegan, tafsir.label)}>{tafsir.label}</button>
              </div>
            </>
          ) : null}
          <div className="baris-tombol">
            <button type="button" className="tombol" onClick={batalkan} disabled={!Sej.bisaBatalkan(sejarah)} title="Ctrl+Z">↶ Batalkan</button>
            <button type="button" className="tombol" onClick={ulangi} disabled={!Sej.bisaUlangi(sejarah)} title="Ctrl+Y atau Ctrl+Shift+Z">↷ Ulangi</button>
            <button type="button" className="tombol" onClick={sematkan} disabled={!papan.objek.length}>Sematkan</button>
            <button type="button" className="tombol" onClick={bersihkan}>Bersihkan</button>
          </div>
          {sematan.length ? (
            <div className="sematan">
              <h3>Disematkan</h3>
              {sematan.map((s) => (
                <button key={s.id} type="button" className="tombol tombol-teks" onClick={() => tampilkan({ ...s.adegan, versi: papanRef.current.versi + 1 }, 'Papan yang disematkan')}>{s.label}</button>
              ))}
            </div>
          ) : null}
        </section>

        <SebelumSesudah sejarah={sejarah} onBatalkan={batalkan} onUlangi={ulangi} />

        <PilihKarakter onPilih={tambahKarakter} />

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
