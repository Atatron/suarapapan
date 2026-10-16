import { useCallback, useEffect, useRef, useState } from 'react';
import Adegan from '../scene/Adegan.jsx';
import { ADEGAN_KOSONG, terapkan, konteks, deskripsi, pindahkan } from '../scene/engine.js';
import { buatSesiGuru, sesiDariUrl } from '../lib/saluran.js';
import { buatAntrean } from '../lib/pekerjaan.js';
import { suaraDidukung, buatPendengar } from '../lib/suara.js';
import { uraikan, cekKesehatan, transkripsi } from '../lib/api.js';
import { rekamDidukung, mulaiRekam, siapkanMik, mikSudahDiizinkan, pesanMik, mulaiUkurLevel } from '../lib/rekam.js';
import { kosakata } from '../scene/pustaka.js';
import PilihKarakter from './PilihKarakter.jsx';
import SebelumSesudah from './SebelumSesudah.jsx';
import * as Sej from '../scene/sejarah.js';
import { buangHurufLepas } from '../lib/teks.js';

const KATA_ANGKA = 'satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas belas puluh seratus'.split(' ');
const TOMBOL_CLICKER = new Set(['PageDown', 'PageUp']);
const KOSAKATA = kosakata();
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const CONTOH = [
  'Ada tiga kelinci berlari di rumput.', 'Lalu dua kelinci pergi.',
  'Di hutan ada tiga kelinci dan dua harimau.', 'Berapa jumlah hewan semuanya?',
  'Ibu punya satu pizza, kita bagi empat sama besar.', 'Adik makan satu potong.',
  'Kucing tidur di bawah meja.', 'Ada tujuh ikan berenang di kolam.',
];
const bacaPilihan = () => { try { return localStorage.getItem('suarapapan-akurat') !== '0'; } catch { return true; } };
// StrictMode boleh merender dua kali; hanya satu pengendali dibuat per tab guru.
let sesiAktif;
const ambilSesi = () => sesiAktif ||= buatSesiGuru(sesiDariUrl({ buat: true }), {
  adegan: ADEGAN_KOSONG, sejarah: Sej.awalSejarah(ADEGAN_KOSONG),
});
function kataSorot(hasil) {
  return [...new Set([...KATA_ANGKA, ...(hasil.entitas || []).map((e) => e.jenis), ...(hasil.peristiwa || []).map((e) => e.target)])];
}

export default function Guru() {
  const [sesi] = useState(ambilSesi);
  const [sejarah, setSejarahState] = useState(() => sesi.baca().sejarah || Sej.awalSejarah(sesi.baca().adegan));
  const sejarahRef = useRef(sejarah);
  const papan = sejarah.sekarang.adegan;
  const papanRef = useRef(papan);
  const captionRef = useRef(sesi.baca().caption);
  const [pratinjau, setPratinjau] = useState(null);
  const pratinjauRef = useRef(null);
  const [otomatis, setOtomatis] = useState(false);
  const [jeda, setJeda] = useState(false);
  const [mendengar, setMendengar] = useState(false);
  const [sementara, setSementara] = useState('');
  const [log, setLog] = useState([]);
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [sibuk, setSibuk] = useState(0);
  const [ketik, setKetik] = useState('');
  const [sematan, setSematan] = useState([]);
  const [kesehatan, setKesehatan] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [akurat, setAkurat] = useState(bacaPilihan);
  const [memeriksa, setMemeriksa] = useState(false);
  const [gabung, setGabung] = useState(false);
  const [hitungSemua, setHitungSemua] = useState(true);
  const [tafsir, setTafsir] = useState(null);
  const [berwenang, setBerwenang] = useState(() => sesi.aktif());
  const [antrean] = useState(() => buatAntrean());
  const pilihanRef = useRef({});
  pilihanRef.current = { otomatis, jeda, akurat, gabung, hitungSemua, kesehatan };
  const captureRef = useRef(null);
  const tahanRef = useRef(false);
  const mendengarRef = useRef(false);
  const prosesRef = useRef(() => {});
  const mulaiRef = useRef(() => {});
  const berhentiRef = useRef(() => {});

  const kirimCaption = useCallback((teks, sementaraFlag = false, sorot = []) => {
    if (pilihanRef.current.jeda || !sesi.aktif()) return;
    captionRef.current = { teks, sementara: sementaraFlag, sorot };
    sesi.perbarui({ caption: captionRef.current });
  }, [sesi]);

  const setSejarah = useCallback((baru, label = null) => {
    if (!sesi.aktif()) return false;
    const caption = label !== null && !pilihanRef.current.jeda
      ? { teks: label, sementara: false, sorot: [] } : captionRef.current;
    if (!sesi.perbarui({ sejarah: baru, adegan: baru.sekarang.adegan, caption })) return false;
    captionRef.current = caption;
    sejarahRef.current = baru;
    papanRef.current = baru.sekarang.adegan;
    setSejarahState(baru);
    return true;
  }, [sesi]);

  const hapusPratinjau = () => { pratinjauRef.current = null; setPratinjau(null); setTafsir(null); };
  const tampilkan = useCallback((adegan, label = '') => {
    if (!setSejarah(Sej.catat(sejarahRef.current, adegan, label), label)) return;
    pratinjauRef.current = null;
    setPratinjau(null);
    setTafsir(null);
  }, [setSejarah]);

  const batalkanProses = useCallback(() => {
    antrean.batalkan();
    const c = captureRef.current;
    captureRef.current = null;
    if (c) {
      c.batal = true;
      c.pendengar?.buang();
      c.kontrol?.berhenti().catch(() => {});
    }
    tahanRef.current = false;
    mendengarRef.current = false;
    setMendengar(false);
    setMemeriksa(false);
    setSementara('');
    setSibuk(0);
  }, [antrean]);

  // Setiap perubahan manual membatalkan jawaban lama, termasuk hasil transkripsi.
  const ubahManual = (fn) => { batalkanProses(); hapusPratinjau(); fn(); };

  const proses = useCallback(async (kalimatMentah, tiket, hasilAwal = null, wajibPeriksa = false) => {
    const kalimat = buangHurufLepas(kalimatMentah);
    if (!kalimat || !tiket.berlaku() || !sesi.aktif()) return;
    setKetik((lama) => lama || kalimat);
    setGalat('');
    setInfo('');
    const dasar = pratinjauRef.current?.adegan ?? papanRef.current;
    const pratinjauMeragukan = Boolean(pratinjauRef.current?.needsConfirmation);
    const k = konteks(dasar);
    const jawaban = hasilAwal?.konteks === k ? hasilAwal.jawaban : await uraikan(kalimat, k, { signal: tiket.signal });
    if (!tiket.berlaku() || !sesi.aktif()) return;
    const { hasil, ms, sumber, yakin, needsConfirmation, notice, availability: tersedia } = jawaban;
    const perluPeriksa = Boolean(needsConfirmation || hasil.needsConfirmation || yakin === 'rendah'
      || (typeof yakin === 'number' && yakin < 0.85) || pratinjauMeragukan || wajibPeriksa);
    if (tersedia) setAvailability(tersedia);
    const r = terapkan(dasar, hasil, { gabung: pilihanRef.current.gabung || undefined, hitungSemua: pilihanRef.current.hitungSemua });
    const catatan = [...(notice?.message ? [notice.message] : []), ...r.catatan];
    setLog((l) => [{ id: `${Date.now()}-${Math.random()}`, kalimat, ms, sumber, yakin,
      ringkas: r.berubah ? deskripsi(r.adegan) : 'Papan tidak berubah.', catatan }, ...l].slice(0, 30));
    if (perluPeriksa || notice) setInfo(notice?.message || 'Tafsiran ini perlu diperiksa. Pastikan jenis, jumlah, dan tindakan sudah benar.');
    if (!perluPeriksa) setKetik((lama) => lama === kalimatMentah ? '' : lama);
    if (!r.berubah) {
      if (!perluPeriksa) kirimCaption(kalimat, false, kataSorot(hasil));
      else kirimCaption(sejarahRef.current.sekarang.label || '', false);
      if (pratinjauRef.current) setInfo((pesan) => `${pesan || 'Kalimat ini tidak mengubah papan.'} Pratinjau sebelumnya tetap menunggu persetujuan.`);
      return;
    }
    // Tafsiran meragukan selalu diperiksa, meskipun mode otomatis dinyalakan.
    if (pilihanRef.current.otomatis && !perluPeriksa) {
      tampilkan(r.adegan, kalimat);
      if (r.alternatif) setTafsir({ ...r.alternatif, penjelasan: r.penjelasan });
    } else {
      kirimCaption(sejarahRef.current.sekarang.label || '', false);
      const p = { adegan: r.adegan, kalimat, ms, catatan, penjelasan: r.penjelasan,
        alternatif: r.alternatif, needsConfirmation: perluPeriksa, sumber };
      pratinjauRef.current = p;
      setPratinjau(p);
    }
  }, [sesi, tampilkan, kirimCaption]);
  prosesRef.current = proses;

  const jalankan = useCallback((tugas) => {
    if (!sesi.aktif()) { setGalat('Sesi ini dikendalikan tab guru lain. Muat ulang untuk mengambil alih.'); return; }
    setSibuk((n) => n + 1);
    antrean.tambahkan(async (tiket) => {
      try { await tugas(tiket); }
      catch (e) {
        if (tiket.berlaku() && e.name !== 'AbortError') {
          if (e.code) setAvailability({ status: 'unavailable', reason: e.code });
          setGalat(`${e.message} Kalimat tetap tersedia untuk diperbaiki atau dicoba lagi.`);
        }
      }
      finally { if (tiket.berlaku()) setSibuk((n) => Math.max(0, n - 1)); }
    }).catch((e) => { setGalat(e.message); setSibuk((n) => Math.max(0, n - 1)); });
  }, [antrean, sesi]);
  const masukkan = useCallback((kalimat) => {
    if (!kalimat.trim()) return;
    if (captureRef.current) { setGalat('Selesaikan rekaman sebelum mengirim kalimat berikutnya.'); return; }
    setKetik(kalimat.trim());
    jalankan((tiket) => prosesRef.current(kalimat.trim(), tiket));
  }, [jalankan]);

  useEffect(() => {
    if (rekamDidukung()) mikSudahDiizinkan().then((ok) => { if (ok) siapkanMik().catch(() => {}); });
    const unsubscribe = sesi.dengar((m) => {
      if (m.type === 'geser') ubahManual(() => setSejarah(Sej.perbarui(sejarahRef.current, pindahkan(papanRef.current, m.id, m.px, m.py, m.beku))));
    });
    const cekOtoritas = () => {
      const aktif = sesi.aktif();
      setBerwenang(aktif);
      if (!aktif) batalkanProses();
    };
    window.addEventListener('storage', cekOtoritas);
    return () => { unsubscribe(); window.removeEventListener('storage', cekOtoritas); batalkanProses(); };
  }, [sesi, setSejarah, batalkanProses]);

  useEffect(() => {
    let aktif = true;
    const cek = () => cekKesehatan().then((k) => { if (aktif) setKesehatan(k); });
    cek();
    const timer = setInterval(cek, 15000);
    return () => { aktif = false; clearInterval(timer); };
  }, []);
  const pilihAkurat = (nilai) => { setAkurat(nilai); try { localStorage.setItem('suarapapan-akurat', nilai ? '1' : '0'); } catch { /* pilihan tetap berlaku di tab ini */ } };

  const finalkan = (c) => {
    if (c.finalisasi || c.batal) return;
    c.finalisasi = true;
    tahanRef.current = false;
    mendengarRef.current = false;
    setMendengar(false);
    setMemeriksa(true);
    c.pendengar?.berhenti();
    // Satu pekerjaan mencakup WAV, transkripsi, dan urai: urutannya tidak bisa menyusul.
    jalankan(async (tiket) => {
      try {
        const rek = await c.kontrol.berhenti();
        await tunggu(500); // beri kesempatan hasil akhir Chrome tiba untuk sesi ini saja
        c.pendengar?.buang();
        if (!tiket.berlaku() || c.batal) return;
        if (!rek || rek.durasi < 0.35 || rek.rms < 0.0008 || !rek.ucapan) {
          setInfo('Ucapan tidak terdeteksi. Rekaman tidak dikirim untuk transkripsi. Dekatkan mikrofon atau ketik kalimat.');
          return;
        }
        let kalimat = [];
        let awal = null;
        if (c.akurat) {
          const k = konteks(pratinjauRef.current?.adegan ?? papanRef.current);
          try {
            const r = await transkripsi(rek.audio, k, { urai: true, signal: tiket.signal });
            if (!tiket.berlaku()) return;
            kalimat = r.kalimat?.length ? r.kalimat : r.transkrip ? [r.transkrip] : [];
            if (r.hasil) awal = { konteks: k, jawaban: r };
            if (r.availability) setAvailability(r.availability);
          } catch (e) {
            if (e.name === 'AbortError') throw e;
            setAvailability({ status: 'unavailable', reason: e.code || 'PROVIDER_UNAVAILABLE' });
            setInfo('Transkripsi online belum tersedia. Periksa hasil pengenalan browser sebelum menampilkannya.');
          }
        }
        const cadangan = !kalimat.length;
        if (cadangan) kalimat = [...c.kalimat];
        if (!kalimat.length) { setInfo('Belum ada transkrip. Coba lagi atau ketik kalimat.'); return; }
        for (let i = 0; i < kalimat.length; i++) {
          if (!tiket.berlaku() || c.batal) return;
          // Cadangan browser juga melewati filter ucapan WAV di atas.
          if (cadangan) setKetik(kalimat[i]);
          await prosesRef.current(kalimat[i], tiket, i === 0 ? awal : null, cadangan);
        }
      } finally {
        c.pendengar?.buang();
        if (captureRef.current === c) { captureRef.current = null; setMemeriksa(false); setSementara(''); }
      }
    });
  };

  const mulai = async () => {
    if (captureRef.current || antrean.jumlah || !sesi.aktif()) return;
    if (!rekamDidukung()) { setGalat('Rekaman mikrofon tidak tersedia. Gunakan kolom ketik.'); return; }
    const c = { kalimat: [], batal: false, finalisasi: false,
      akurat: pilihanRef.current.akurat && Boolean(pilihanRef.current.kesehatan?.suara) };
    if (!c.akurat && !suaraDidukung()) { setGalat('Pengenalan suara belum tersedia. Ketik kalimat untuk melanjutkan.'); return; }
    captureRef.current = c;
    tahanRef.current = true;
    setGalat(''); setInfo('');
    try {
      c.kontrol = await mulaiRekam({ saatBerhenti: () => finalkan(c), saatGalat: (e) => {
        if (c.batal) return;
        setGalat(`${pesanMik(e)} Gunakan kolom ketik untuk melanjutkan.`);
        batalkanProses();
      } });
      if (c.batal) { await c.kontrol.berhenti(); return; }
      if (!tahanRef.current) { finalkan(c); return; }
      // Tidak menyalakan pengenal browser sebelum izin mikrofon berhasil.
      if (suaraDidukung()) {
        c.pendengar = buatPendengar({ kosakata: KOSAKATA,
          saatSementara: (t) => { if (!c.batal && captureRef.current === c) { setSementara(t); if (t) kirimCaption(t, true); } },
          saatFinal: (t) => { if (!c.batal && captureRef.current === c && t) c.kalimat.push(t); },
          saatStatus: () => {},
          saatGalat: (pesan) => { if (!c.batal && !c.akurat) { setInfo(`${pesan} Ketik kalimat bila diperlukan.`); } },
        });
        c.pendengar.mulai();
      }
      mendengarRef.current = true;
      setMendengar(true);
    } catch (e) {
      if (!c.batal) { setGalat(`${pesanMik(e)} Gunakan kolom ketik untuk melanjutkan.`); batalkanProses(); }
    }
  };
  const berhenti = () => {
    tahanRef.current = false;
    const c = captureRef.current;
    if (c?.kontrol) finalkan(c);
  };
  mulaiRef.current = mulai;
  berhentiRef.current = berhenti;

  const [tes, setTes] = useState(null);
  const tesRef = useRef(null);
  const tesEpochRef = useRef(0);
  const tesMenungguRef = useRef(false);
  const matikanTes = useCallback(() => { tesEpochRef.current += 1; tesMenungguRef.current = false; tesRef.current?.berhenti(); tesRef.current = null; setTes(null); }, []);
  useEffect(() => matikanTes, [matikanTes]);
  const nyalakanTes = async () => {
    if (tesRef.current || tesMenungguRef.current) { matikanTes(); return; }
    tesMenungguRef.current = true;
    const epoch = ++tesEpochRef.current;
    setTes({ level: 0, label: 'Membuka mikrofon…', bisu: false, tenang: false });
    setGalat('');
    try {
      let tenangSejak = Date.now();
      const k = await mulaiUkurLevel((level) => {
        if (epoch !== tesEpochRef.current) return;
        if (level > 0.004) tenangSejak = Date.now();
        setTes((t) => t ? { ...t, level, tenang: Date.now() - tenangSejak > 3000 } : t);
      });
      if (epoch !== tesEpochRef.current) { k.berhenti(); return; }
      tesMenungguRef.current = false;
      tesRef.current = k;
      setTes({ level: 0, label: k.label, bisu: k.bisu, tenang: false });
    } catch (e) { if (epoch === tesEpochRef.current) { tesMenungguRef.current = false; setTes(null); setGalat(pesanMik(e)); } }
  };

  const pindahSejarah = (fungsi) => {
    batalkanProses(); hapusPratinjau();
    const baru = fungsi(sejarahRef.current);
    if (baru !== sejarahRef.current) setSejarah(baru, baru.sekarang.label || '');
  };
  const batalkan = () => pindahSejarah(Sej.batalkan);
  const ulangi = () => pindahSejarah(Sej.ulangi);
  const batalkanRef = useRef(batalkan);
  const ulangiRef = useRef(ulangi);
  batalkanRef.current = batalkan; ulangiRef.current = ulangi;
  useEffect(() => {
    const diInput = (e) => e.target.isContentEditable || ['TEXTAREA', 'SELECT'].includes(e.target.tagName)
      || (e.target.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range'].includes(e.target.type));
    const turun = (e) => {
      if (diInput(e)) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); batalkanRef.current(); return; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); ulangiRef.current(); return; }
      }
      if (e.repeat) return;
      if (e.code === 'Space') { e.preventDefault(); mulaiRef.current(); }
      if (TOMBOL_CLICKER.has(e.key)) { e.preventDefault(); captureRef.current && tahanRef.current ? berhentiRef.current() : mulaiRef.current(); }
    };
    const naik = (e) => { if (e.code === 'Space') { e.preventDefault(); berhentiRef.current(); } };
    const lepas = () => berhentiRef.current();
    window.addEventListener('keydown', turun); window.addEventListener('keyup', naik); window.addEventListener('blur', lepas);
    return () => { window.removeEventListener('keydown', turun); window.removeEventListener('keyup', naik); window.removeEventListener('blur', lepas); };
  }, []);

  const buang = () => ubahManual(() => setInfo('Pratinjau dibuang. Papan tetap.'));
  const geserDiPapan = (id, px, py, beku) => ubahManual(() => setSejarah(Sej.perbarui(sejarahRef.current, pindahkan(papanRef.current, id, px, py, beku))));
  const geserDiPratinjau = (id, px, py, beku) => {
    batalkanProses();
    const p = pratinjauRef.current;
    if (p) { const baru = { ...p, adegan: pindahkan(p.adegan, id, px, py, beku) }; pratinjauRef.current = baru; setPratinjau(baru); }
  };
  const pakaiAlternatifPratinjau = () => {
    batalkanProses();
    const p = pratinjauRef.current;
    if (p?.alternatif) { const baru = { ...p, adegan: p.alternatif.adegan, alternatif: null, penjelasan: [`Dibaca sebagai: ${p.alternatif.label}.`] }; pratinjauRef.current = baru; setPratinjau(baru); }
  };
  const terimaPratinjau = () => { const p = pratinjauRef.current; if (p) ubahManual(() => tampilkan(p.adegan, p.kalimat)); };
  const tambahKarakter = (nama, label) => {
    const dasar = pratinjauRef.current?.adegan ?? papanRef.current;
    ubahManual(() => {
      const r = terapkan(dasar, { entitas: [], peristiwa: [{ tipe: 'tambah', target: label, jumlah: 1 }], konsep: 'membilang' });
      if (r.berubah) tampilkan(r.adegan, `Ditambahkan: ${label}`);
      if (r.catatan.length) setInfo(r.catatan.join(' '));
    });
  };
  const bersihkan = () => ubahManual(() => tampilkan({ ...ADEGAN_KOSONG, versi: papanRef.current.versi + 1 }, ''));
  const sematkan = () => { if (papan.objek.length) setSematan((s) => [...s, { id: `${Date.now()}`, adegan: papan, label: deskripsi(papan) }].slice(-12)); };
  const kirimKetik = (e) => { e.preventDefault(); masukkan(ketik); };
  const status = availability?.status === 'unavailable' ? 'layanan online terganggu — mode lokal tersedia'
    : availability?.status === 'available' ? 'layanan online terhubung · mode lokal tersedia'
      : kesehatan === null ? 'memeriksa konfigurasi…' : kesehatan.server ? 'mode lokal tersedia · koneksi model belum diuji' : 'mode lokal tersedia';
  return (
    <main className="guru">
      <header className="guru-kepala">
        <h1>SuaraPapan <span>panel guru</span></h1>
        <div className="guru-kepala-kanan">
          <span className={`chip chip-${availability?.status === 'unavailable' ? 'peringatan' : 'ok'}`} role="status">{status}</span>
          <button type="button" className="tombol" onClick={() => window.open(sesi.urlPapan, `suarapapan-${sesi.sesi}`)}>Buka papan kelas ini</button>
        </div>
      </header>

      <div className="guru-isi">
        <section className="kartu guru-bicara" aria-label="Bicara">
          <h2>1. Masukkan kalimat</h2>
          <p className="petunjuk">Bicara atau ketik → periksa pratinjau → tampilkan di papan.</p>
          {!berwenang ? <p className="galat" role="alert">Sesi diambil alih tab guru lain. Muat ulang untuk mengambil alih kembali.</p> : null}
          {suaraDidukung() || rekamDidukung() ? (
            <button
              type="button"
              disabled={memeriksa || sibuk > 0 || !berwenang}
              className={`tombol-mik${mendengar ? ' aktif' : ''}`}
              onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); mulai(); }}
              onPointerUp={berhenti}
              onPointerCancel={berhenti}
              onLostPointerCapture={berhenti}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span className="tombol-mik-titik" aria-hidden="true" />
              {mendengar ? 'Mendengarkan… lepas jika selesai' : memeriksa ? 'Memeriksa ucapan…' : 'Tahan untuk bicara'}
            </button>
          ) : (
            <p className="galat">Browser ini tidak mendukung pengenalan suara. Gunakan Google Chrome, atau ketik kalimat di bawah.</p>
          )}
          <p className="petunjuk">Tahan tombol Spasi atau tekan clicker presentasi untuk bicara.</p>
          {rekamDidukung() ? (
            <div className="tes-mik">
              <button type="button" className="tombol tombol-kecil" onClick={nyalakanTes} aria-pressed={Boolean(tes)}>{tes ? 'Matikan tes' : 'Tes mikrofon'}</button>
              {tes ? (
                <div className="tes-mik-isi" role="status">
                  <div className="meter" aria-hidden="true"><div className="meter-isi" style={{ width: `${Math.min(100, Math.sqrt(tes.level) * 220)}%` }} /></div>
                  <small>Mikrofon: {tes.label}{tes.bisu ? ' (dibisukan)' : ''}</small>
                  {tes.tenang ? <small className="galat">Tidak ada suara masuk. Bicara, atau periksa mikrofon yang dipilih dan volume input Windows.</small> : <small>Bicaralah: batang harus bergerak.</small>}
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="transkrip" aria-live="polite">{sementara || (memeriksa ? 'Memeriksa ucapan…' : sibuk ? 'Memahami kalimat…' : 'Transkrip muncul di sini.')}</p>
          <form className="form-ketik" onSubmit={kirimKetik}>
            <label htmlFor="ketik-kalimat">Atau ketik kalimat</label>
            <div className="form-ketik-baris">
              <input id="ketik-kalimat" value={ketik} onChange={(e) => setKetik(e.target.value)} placeholder="contoh: ada tiga kelinci berlari di rumput" autoComplete="off" />
              <button type="submit" className="tombol tombol-utama" disabled={mendengar || memeriksa || sibuk > 0 || !ketik.trim() || !berwenang}>Periksa kalimat</button>
            </div>
          </form>
          <div className="contoh" role="group" aria-label="Contoh kalimat">
            <span className="contoh-judul">Coba contoh (berurutan dari atas; Bersihkan di antara pelajaran):</span>
            <div className="contoh-daftar">
              {CONTOH.map((k) => (
                <button key={k} type="button" className="tombol tombol-kecil tombol-contoh" disabled={mendengar || memeriksa || sibuk > 0 || !berwenang} onClick={() => masukkan(k)}>{k}</button>
              ))}
            </div>
          </div>
          {galat ? <p className="galat" role="alert">{galat}</p> : null}
          {info ? <p className="catatan" role="status">{info}</p> : null}
          {sibuk > 0 || memeriksa || mendengar ? <button type="button" className="tombol" onClick={() => { batalkanProses(); setInfo('Proses dibatalkan. Papan tetap.'); }}>Batalkan proses</button> : null}
          <div className="sakelar">
            <label><input id="opsi-otomatis" type="checkbox" checked={otomatis} onChange={(e) => setOtomatis(e.target.checked)} /> Tampilkan otomatis untuk kalimat yang pasti; tafsiran meragukan tetap diperiksa</label>
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
          <p className="petunjuk">Papan kelas tersambung pada browser dan perangkat yang sama. Pengenalan browser dapat memakai layanan online; filter rekaman hanya membatasi kiriman transkripsi aplikasi.</p>
        </section>

        <section className="kartu" aria-label="Pratinjau">
          <h2>2. Periksa pratinjau</h2>
          {pratinjau ? (
            <>
              <p className="ringkas">Kalimat: “{pratinjau.kalimat}”</p>
              {pratinjau.needsConfirmation ? <p className="catatan" role="status">Perlu persetujuan guru. Tafsiran ini belum ditampilkan di papan.</p> : null}
              <Adegan adegan={pratinjau.adegan} kecil bisaGeser onGeser={geserDiPratinjau} />
              <p className="ringkas">{deskripsi(pratinjau.adegan)}</p>
              {(pratinjau.penjelasan || []).map((c) => <p key={c} className="penjelasan">{c}</p>)}
              {pratinjau.catatan.map((c) => <p key={c} className="catatan">{c}</p>)}
              <div className="baris-tombol">
                <button type="button" className="tombol tombol-utama" disabled={!berwenang} onClick={terimaPratinjau}>Tampilkan di papan</button>
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
          <h2>3. Di papan sekarang</h2>
          <Adegan adegan={papan} kecil bisaGeser onGeser={geserDiPapan} />
          <p className="ringkas">{deskripsi(papan)}</p>
          {tafsir ? (
            <>
              {tafsir.penjelasan.map((c) => <p key={c} className="penjelasan">{c}</p>)}
              <div className="baris-tombol">
                <button type="button" className="tombol" onClick={() => ubahManual(() => tampilkan(tafsir.adegan, tafsir.label))}>{tafsir.label}</button>
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
                <div key={s.id} className="sematan-baris">
                  <button type="button" className="tombol tombol-teks" onClick={() => ubahManual(() => tampilkan({ ...s.adegan, versi: papanRef.current.versi + 1 }, 'Papan yang disematkan'))}>{s.label}</button>
                  <button type="button" className="tombol tombol-kecil" onClick={() => setSematan((l) => l.filter((x) => x.id !== s.id))} aria-label={`Lepas sematan: ${s.label}`} title="Lepas sematan">Lepas</button>
                </div>
              ))}
              {sematan.length > 1 ? <button type="button" className="tombol tombol-kecil" onClick={() => setSematan([])}>Lepas semua</button> : null}
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
                  <p className="log-hasil">{l.ringkas} <span>{l.sumber} · {Math.round(l.ms || 0)} ms{typeof l.yakin === 'number' ? ` · yakin ${Math.round(l.yakin * 100)}%` : l.yakin ? ` · kepastian ${l.yakin}` : ''}</span></p>
                  {(l.catatan || []).map((c) => <p className="catatan" key={c}>{c}</p>)}
                </li>
              ))}
            </ol>
          ) : <p className="kosong">Belum ada kalimat.</p>}
        </section>
      </div>
    </main>
  );
}
