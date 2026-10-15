// Gambar untuk topik pecahan dan posisi. Keduanya interaktif di /papan:
// siswa mengetuk potongan untuk mengambilnya, atau menyeret benda ke atas,
// bawah, atau samping benda acuan.
import { useEffect, useRef, useState } from 'react';
import { Benda } from './aset.jsx';
import { uraiPosisi, tulisPosisi } from './engine.js';

const BULAT = new Set(['pizza', 'kue', 'donat', 'roti', 'semangka', 'jeruk', 'apel', 'martabak', 'tart', 'bolu', 'pai', 'piring', 'lingkaran']);
const WARNA = {
  pizza: ['#E9B949', '#E07A5F'], kue: ['#F3B3C8', '#D99BD0'], donat: ['#C98B5A', '#D99BD0'], roti: ['#E3B577', '#C98B5A'],
  semangka: ['#E07A5F', '#7FC4A8'], jeruk: ['#F2A65A', '#E9B949'], apel: ['#E07A5F', '#F3B3A3'], martabak: ['#E3B577', '#8A5F3C'],
  cokelat: ['#8A5F3C', '#6B4A2F'], kertas: ['#F3F4EE', '#C9D8D1'], tempe: ['#E3D3A8', '#C9B27E'],
};

function titik(cx, cy, r, derajat) {
  const a = (derajat * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Satu benda yang dibagi menjadi `bagi` potong sama besar. */
export function Pecahan({ o, interaktif = false, versi }) {
  const n = o.bagi;
  const awal = () => new Set(Array.from({ length: o.diambil || 0 }, (_, i) => i));
  const [diambil, setDiambil] = useState(awal);
  useEffect(() => setDiambil(awal()), [o.id, n, o.diambil, versi]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isi, sisi] = WARNA[o.jenis] || ['#E9B949', '#E07A5F'];
  const ketuk = (i) => {
    if (!interaktif) return;
    setDiambil((s) => { const t = new Set(s); t.has(i) ? t.delete(i) : t.add(i); return t; });
  };
  const k = diambil.size;
  const bulat = BULAT.has(o.jenis) || !WARNA[o.jenis];

  const potongan = Array.from({ length: n }, (_, i) => {
    const ambil = diambil.has(i);
    const label = `potongan ${i + 1} dari ${n}${ambil ? ', sudah diambil' : ''}`;
    const aksi = interaktif ? {
      role: 'button', tabIndex: 0, 'aria-label': label, onClick: () => ketuk(i),
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ketuk(i); } },
    } : { 'aria-label': label };
    if (bulat) {
      const a0 = -90 + (i * 360) / n;
      const a1 = a0 + 360 / n;
      const [x0, y0] = titik(100, 100, 86, a0);
      const [x1, y1] = titik(100, 100, 86, a1);
      const [dx, dy] = titik(0, 0, 16, (a0 + a1) / 2); // potongan yang diambil bergeser keluar
      const d = `M100 100 L${x0} ${y0} A86 86 0 ${360 / n > 180 ? 1 : 0} 1 ${x1} ${y1}Z`;
      return (
        <g key={i} className={`potong${ambil ? ' diambil' : ''}`} transform={ambil ? `translate(${dx} ${dy})` : undefined} {...aksi}>
          <path d={d} fill={isi} stroke="#16302A" strokeWidth="3" />
          {o.jenis === 'pizza' ? <circle cx={100 + (x0 + x1 - 200) * 0.32} cy={100 + (y0 + y1 - 200) * 0.32} r="7" fill={sisi} /> : null}
        </g>
      );
    }
    const w = 180 / n;
    return (
      <g key={i} className={`potong${ambil ? ' diambil' : ''}`} transform={ambil ? 'translate(0 -18)' : undefined} {...aksi}>
        <rect x={10 + i * w} y="60" width={w} height="80" fill={isi} stroke="#16302A" strokeWidth="3" />
        <rect x={10 + i * w + 6} y="66" width={w - 12} height="10" fill={sisi} opacity="0.6" />
      </g>
    );
  });

  return (
    <div className="pecahan">
      <svg viewBox={bulat ? '0 0 200 200' : '0 0 200 160'} className="pecahan-svg" role="group" aria-label={`${o.jenis} dibagi ${n} potong`}>
        {bulat ? <circle cx="100" cy="100" r="92" fill="none" stroke={sisi} strokeWidth="6" strokeDasharray="6 8" opacity="0.5" /> : null}
        {potongan}
      </svg>
      <div className="pecahan-label" aria-live="polite">
        {k ? (
          <>
            <span className="pecahan-angka"><span>{k}</span><span>{n}</span></span>
            <span className="pecahan-kata">{k} dari {n} potong diambil</span>
          </>
        ) : <span className="pecahan-kata">{o.jenis} dibagi {n} sama besar{interaktif ? ' · ketuk potongannya' : ''}</span>}
      </div>
    </div>
  );
}

// Batas zona dalam kotak acuan (viewBox 200×160): permukaan meja ada di y=30.
const ATAS_PERMUKAAN = 30 / 160;

/** Benda acuan (meja, kursi, kotak, …) di tengah, benda lain di atas/bawah/sampingnya. */
export function PanggungPosisi({ adegan, interaktif = false }) {
  const acuan = adegan.objek.map((o) => uraiPosisi(o.posisi)).find(Boolean)?.acuan;
  const [geser, setGeser] = useState({}); // id → relasi pilihan siswa
  const [seret, setSeret] = useState(null); // { id, x, y, dx, dy }
  const kotak = useRef(null);
  useEffect(() => { setGeser({}); setSeret(null); }, [adegan.versi]);

  const benda = adegan.objek.filter((o) => o.jenis !== acuan && o.status !== 'pergi');
  const relasiDari = (o) => geser[o.id] || uraiPosisi(o.posisi)?.relasi || 'samping';
  const zona = {};
  for (const o of benda) (zona[relasiDari(o)] ||= []).push(o);

  const mulaiSeret = (e, o) => {
    if (!interaktif) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setSeret({ id: o.id, x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
  };
  const gerak = (e) => seret && setSeret((s) => ({ ...s, dx: e.clientX - s.x, dy: e.clientY - s.y }));
  const lepas = (e) => {
    if (!seret) return;
    const r = kotak.current?.getBoundingClientRect();
    if (r && (Math.abs(seret.dx) > 8 || Math.abs(seret.dy) > 8)) {
      const { clientX: x, clientY: y } = e;
      const relasi = x < r.left || x > r.right ? 'samping' : y < r.top + r.height * ATAS_PERMUKAAN ? 'atas' : 'bawah';
      setGeser((g) => ({ ...g, [seret.id]: relasi }));
    }
    setSeret(null);
  };

  const label = benda.length
    ? [...new Set(benda.map((o) => `${o.jenis} ${tulisPosisi(relasiDari(o), acuan)}`))].join(', ')
    : '';

  return (
    <div className="posisi" onPointerMove={gerak} onPointerUp={lepas} onPointerCancel={() => setSeret(null)}>
      <div className="posisi-acuan" ref={kotak}>
        <div className="posisi-acuan-gambar"><Benda jenis={acuan} emoji={adegan.objek.find((o) => o.emojiAcuan)?.emojiAcuan} /></div>
        {Object.entries(zona).map(([relasi, isi]) => (
          <div key={relasi} className={`posisi-zona zona-${relasi}`}>
            {isi.map((o, i) => {
              const diseret = seret?.id === o.id;
              return (
                <div
                  key={o.id}
                  className={`posisi-benda status-${o.status}${interaktif ? ' bisa-seret' : ''}${diseret ? ' diseret' : ''}`}
                  style={diseret ? { transform: `translate(${seret.dx}px, ${seret.dy}px)` } : { '--tunda': `${i * 0.1}s` }}
                  onPointerDown={(e) => mulaiSeret(e, o)}
                  role={interaktif ? 'img' : undefined}
                  aria-label={`${o.jenis} ${tulisPosisi(relasi, acuan)}`}
                >
                  <span className={`obj-gerak aksi-${o.aksi}`}><Benda jenis={o.jenis} indeks={i} emoji={o.emoji} /></span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {label ? <p className="posisi-label" aria-live="polite">{label}</p> : null}
      {interaktif ? <p className="posisi-petunjuk">Seret {benda[0]?.jenis || 'benda'} ke atas, bawah, atau samping {acuan}.</p> : null}
    </div>
  );
}
