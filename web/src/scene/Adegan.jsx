import { useEffect, useMemo, useRef, useState } from 'react';
import { Benda } from './aset.jsx';
import { deskripsi, uraiPosisi } from './engine.js';
import { Pecahan, PanggungPosisi } from './Matematika.jsx';
import { cariTempat, urlTempat } from './pustaka.js';
import { idAset } from './katalog.js';
import { pilihLatar } from './latar.js';
import { tataObjek, ukuranKarakter, batasi01, WILAYAH_BAWAAN } from './tata.js';

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
export default function Adegan({ adegan, interaktif = false, kecil = false, bisaGeser = false, onGeser }) {
  const [hitungan, setHitungan] = useState({});
  useEffect(() => setHitungan({}), [adegan.versi]);
  const akar = useRef(null);
  const [seret, setSeret] = useState(null); // { id, offX, offY, sx, sy, gerak, px, py }
  const baruSeret = useRef(false); // klik yang mengikuti seretan tidak boleh ikut menghitung

  const latar = useMemo(() => pilihLatar(adegan), [adegan]);
  const ukuran = ukuranUntuk(adegan.objek.length);
  // Tata letak bebas (posisi + ukuran nyata + perspektif) dipakai bila ada latar dan tanpa pecahan;
  // pecahan dan pelajaran posisi memakai tata letak khusus mereka.
  const bebas = Boolean(latar) && !adegan.objek.some((o) => o.bagi);
  const wilayah = latar ? { x: latar.x, y: latar.y } : WILAYAH_BAWAAN;
  const tata = useMemo(() => (bebas ? tataObjek(adegan.objek, wilayah) : null), [bebas, adegan.objek, latar]); // eslint-disable-line react-hooks/exhaustive-deps
  const ketuk = (o) => {
    if (baruSeret.current) { baruSeret.current = false; return; }
    if (!interaktif || o.status === 'pergi' || hitungan[o.id]) return;
    setHitungan((h) => ({ ...h, [o.id]: Object.keys(h).length + 1 }));
  };

  const mulaiSeret = (e, o, t) => {
    if (!bisaGeser || o.status === 'pergi' || !akar.current) return;
    const r = akar.current.getBoundingClientRect();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* penunjuk tidak aktif: seretan tetap jalan */ }
    setSeret({
      id: o.id, sx: e.clientX, sy: e.clientY, gerak: false, px: t.px, py: t.py,
      offX: e.clientX - (r.left + t.px * r.width), offY: e.clientY - (r.top + t.py * r.height),
    });
  };
  const geraknya = (e) => {
    if (!seret || !akar.current) return;
    const r = akar.current.getBoundingClientRect();
    const jauh = seret.gerak || Math.hypot(e.clientX - seret.sx, e.clientY - seret.sy) > 5;
    if (!jauh) return;
    setSeret({
      ...seret, gerak: true,
      px: batasi01((e.clientX - seret.offX - r.left) / r.width),
      py: batasi01((e.clientY - seret.offY - r.top) / r.height),
    });
  };
  const lepasSeret = () => {
    if (seret?.gerak) {
      baruSeret.current = true;
      const beku = Object.fromEntries(adegan.objek.map((o, i) => [o.id, { px: tata[i].px, py: tata[i].py }]));
      onGeser?.(seret.id, seret.px, seret.py, beku);
    }
    setSeret(null);
  };

  const kelas = `adegan latar-${slug(adegan.latar)}${kecil ? ' adegan-kecil' : ''}${latar ? ' dengan-latar' : ''}`;
  const lukisan = latar
    ? <img className="adegan-lukisan" src={latar.file} alt="" aria-hidden="true" draggable={false} />
    : null;
  // The large backdrop supplies atmosphere, but must not erase a specifically
  // requested place (e.g. ruang-guru and perpustakaan share the classroom art).
  const tempat = idAset(adegan.latar, 'tempat');
  const penandaTempat = tempat ? (
    <figure className="adegan-tempat-tepat" aria-label={`Tempat: ${tempat.replaceAll('-', ' ')}`}>
      <img src={urlTempat(tempat)} alt="" draggable={false} />
      <figcaption>{tempat.replaceAll('-', ' ')}</figcaption>
    </figure>
  ) : null;

  if (adegan.objek.some((o) => o.status !== 'pergi' && uraiPosisi(o.posisi))) {
    return (
      <div className={`${kelas} adegan-posisi`}>
        <p className="sr-only" aria-live="polite">{deskripsi(adegan)}</p>
        {lukisan}
        {penandaTempat}
        <PanggungPosisi adegan={adegan} interaktif={interaktif} />
        {latar ? null : <div className="adegan-tanah" aria-hidden="true" />}
      </div>
    );
  }

  // Tanpa latar baru (tempat tidak ada di pustaka): ikon tempat redup seperti sebelumnya.
  const ikon = latar ? null : cariTempat(adegan.latar);
  const wilayahCss = latar
    ? { left: persen(latar.x[0]), width: persen(latar.x[1] - latar.x[0]), top: persen(latar.y[0]), height: persen(latar.y[1] - latar.y[0]) }
    : undefined;

  return (
    <div className={`${kelas}${bebas ? ' adegan-bebas' : ''}`} data-latar={latar?.id} ref={akar}>
      <p className="sr-only" aria-live="polite">{deskripsi(adegan)}</p>
      {lukisan}
      {penandaTempat}
      {bebas ? adegan.objek.map((o, i) => {
        const diseret = seret?.id === o.id && seret.gerak;
        const t = diseret
          ? { ...tata[i], px: seret.px, py: seret.py, ...ukuranKarakter(o.jenis, seret.py, adegan.objek.length, wilayah) }
          : tata[i];
        const pos = diseret ? { px: seret.px, py: seret.py } : t;
        return (
          <button
            key={o.id}
            type="button"
            className={`obj obj-bebas status-${o.status}${bisaGeser && o.status !== 'pergi' ? ' bisa-geser' : ''}${diseret ? ' diseret' : ''}`}
            style={{
              width: `${t.selLebar}cqh`,
              left: `calc(${pos.px * 100}cqw - ${t.selLebar * t.kakiX}cqh)`,
              top: `calc(${pos.py * 100}cqh - ${t.selTinggi * t.kakiY}cqh)`,
              zIndex: Math.round(pos.py * 1000) + (diseret ? 5000 : 0),
              '--tunda': `${(i % 10) * 0.1}s`,
            }}
            onClick={() => ketuk(o)}
            onPointerDown={(e) => mulaiSeret(e, o, t)}
            onPointerMove={geraknya}
            onPointerUp={lepasSeret}
            onPointerCancel={() => setSeret(null)}
            disabled={o.status === 'pergi' || (!interaktif && !bisaGeser)}
            tabIndex={(interaktif || bisaGeser) && o.status !== 'pergi' ? 0 : -1}
            aria-label={hitungan[o.id] ? `${o.jenis} nomor ${hitungan[o.id]}` : `${o.jenis}${bisaGeser ? ', seret untuk memindahkan' : ''}${interaktif ? ', ketuk untuk menghitung' : ''}`}
          >
            <span className={`obj-gerak aksi-${o.aksi}`}>
              <Benda jenis={o.jenis} indeks={i} emoji={o.emoji} aksi={o.aksi} />
            </span>
            {hitungan[o.id] ? <span className="obj-nomor">{hitungan[o.id]}</span> : null}
          </button>
        );
      }) : null}
      {ikon ? <img className="adegan-pemandangan" src={urlTempat(ikon)} alt="" aria-hidden="true" draggable={false} /> : null}
      {bebas ? null : (
      <div className={`adegan-panggung${latar ? ' panggung-latar' : ''}`} style={wilayahCss}>
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
      )}
      {latar ? null : <div className="adegan-tanah" aria-hidden="true" />}
      {adegan.latar && !latar ? <div className="adegan-latar">di {adegan.latar}</div> : null}
    </div>
  );
}
